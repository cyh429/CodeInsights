import { randomUUID } from 'node:crypto'
import {
  isAgentRuntimeTerminalEvent,
  type AgentEventSource,
  type AgentQueueMessageInput,
  type AgentRuntimeErrorPayload,
  type AgentRuntimeEvent,
  type AgentStreamEnvelope,
  type CodeInsightsPermissionMode,
} from '@codeinsights/shared'
import type { CodexOptions, ThreadOptions } from '@openai/codex-sdk'
import { createRuntimeEnvelope } from '../agent-sdk-message-converter'
import {
  buildCodexEnv as defaultBuildCodexEnv,
  sanitizeCodexGitEnvironment,
} from '../codex-runtime/codex-env'
import {
  resolveCodexAuth as defaultResolveCodexAuth,
  type CodexAuthState,
} from '../codex-runtime/codex-auth'
import {
  createCodexExecutionGuard as defaultCreateCodexExecutionGuard,
  type CodexCommandGuard,
  type CodexExecutionGuardPurpose,
} from '../codex-runtime/codex-command-guard'
import {
  resolveCodexCliPath as defaultResolveCodexCliPath,
} from '../codex-runtime/codex-binary'
import type { CodexRuntimeOptions } from '../codex-runtime/codex-channel'
import {
  createDefaultCodexSdkClient,
  type CreateCodexSdkClient,
} from '../codex-runtime/codex-sdk-client'
import { CodexEventAdapter } from './codex-event-adapter'
import { resolveCodexPermissionPolicy } from './codex-permission-policy'
import type {
  CodexCodingAgentRuntimeRunInput,
  CodingAgentRuntime,
  CodingAgentRuntimeCapabilities,
  UnsupportedRuntimeCapability,
  UnsupportedRuntimeCapabilityResult,
} from './coding-agent-runtime-types'

export type CodexAgentRuntimeErrorCode =
  | 'codex_auth_missing'
  | 'codex_binary_missing'
  | 'codex_channel_invalid'
  | 'codex_stream_error'
  | 'codex_stream_ended_without_terminal'
  | 'codex_runtime_error'

export interface CodexAgentRuntimeDeps {
  createCodexClient?: CreateCodexSdkClient
  resolveCodexRuntime?: (channelId?: string) => CodexRuntimeOptions | Promise<CodexRuntimeOptions>
  buildCodexEnv?: (sourceEnv?: NodeJS.ProcessEnv) => Promise<Record<string, string>>
  resolveCodexAuth?: (runtime: CodexRuntimeOptions, env: Record<string, string>) => CodexAuthState
  createExecutionGuard?: (
    env: Record<string, string>,
    repositoryRoot: string | undefined,
    options: { auth: CodexAuthState; purpose?: CodexExecutionGuardPurpose },
  ) => Promise<CodexCommandGuard>
  resolveCodexCliPath?: () => string
  createRunId?: () => string
  now?: () => string
}

const CODEX_AGENT_RUNTIME_CAPABILITIES: CodingAgentRuntimeCapabilities = {
  runtimeKind: 'codex',
  supportsStreamEvents: true,
  supportsResumeThread: true,
  supportsAbort: true,
  supportsQueueMessage: false,
  supportsSetPermissionMode: false,
  supportsPerToolPermission: false,
}

export class CodexAgentRuntime implements CodingAgentRuntime {
  readonly kind = 'codex' as const
  private readonly activeAbortControllers = new Map<string, AbortController>()

  constructor(private readonly deps: CodexAgentRuntimeDeps = {}) {}

  getCapabilities(): CodingAgentRuntimeCapabilities {
    return CODEX_AGENT_RUNTIME_CAPABILITIES
  }

  async *run(input: CodexCodingAgentRuntimeRunInput): AsyncIterable<AgentStreamEnvelope> {
    const runId = input.runId ?? this.deps.createRunId?.() ?? randomUUID()
    const abortController = new AbortController()
    let nextSequenceValue = 0
    let terminalWritten = false
    const seenSdkSessionIds = new Set<string>()
    let commandGuard: CodexCommandGuard | undefined

    const nextSequence = (): number => {
      const sequence = nextSequenceValue
      nextSequenceValue += 1
      return sequence
    }
    const makeEnvelope = (
      event: AgentRuntimeEvent,
      source: AgentEventSource,
    ): AgentStreamEnvelope | null => {
      if (event.type === 'sdk_session') {
        if (seenSdkSessionIds.has(event.sdkSessionId)) return null
        seenSdkSessionIds.add(event.sdkSessionId)
      }
      if (isAgentRuntimeTerminalEvent(event)) {
        if (terminalWritten) return null
        terminalWritten = true
      }
      return createRuntimeEnvelope(event, source, {
        sessionId: input.sessionId,
        runId,
        nextSequence,
        createdAt: this.deps.now,
      })
    }
    const makeStoppedEnvelope = (): AgentStreamEnvelope | null =>
      makeEnvelope({ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' }, 'runtime_service')

    const onExternalAbort = (): void => {
      abortController.abort()
    }
    if (input.abortSignal?.aborted) {
      abortController.abort()
    } else {
      input.abortSignal?.addEventListener('abort', onExternalAbort, { once: true })
    }

    this.activeAbortControllers.set(input.sessionId, abortController)

    try {
      const runtime = await this.resolveCodexRuntime(input.channelId ?? undefined)
      const model = input.model ?? runtime.model ?? 'codex'
      const runStarted = makeEnvelope({
        type: 'run_started',
        model,
        cwd: input.workingDirectory,
        permissionMode: input.permissionMode,
        runtimeHash: input.runtimeHash ?? 'codex-agent-runtime',
        runnerMode: input.runnerMode ?? 'runner-v2',
        runtimeKind: 'codex',
      }, 'runtime_service')
      if (runStarted) yield runStarted

      if (abortController.signal.aborted) {
        const stoppedEnvelope = makeStoppedEnvelope()
        if (stoppedEnvelope) yield stoppedEnvelope
        return
      }

      const codexEnv = sanitizeCodexGitEnvironment(await this.buildCodexEnv())
      const auth = this.resolveCodexAuth(runtime, codexEnv)
      commandGuard = await this.createExecutionGuard(
        codexEnv,
        input.repositoryRoot ?? input.workingDirectory,
        { auth, purpose: 'agent' },
      )

      if (abortController.signal.aborted) {
        const stoppedEnvelope = makeStoppedEnvelope()
        if (stoppedEnvelope) yield stoppedEnvelope
        return
      }

      const client = await this.createCodexClient({
        codexPathOverride: this.resolveCodexCliPath(),
        apiKey: runtime.apiKey,
        baseUrl: runtime.baseUrl,
        env: buildCodexClientEnv(commandGuard.env, runtime),
      })
      const threadOptions = buildCodexThreadOptions({
        ...input,
        model,
      })
      const thread = input.externalSessionId
        ? client.resumeThread(input.externalSessionId, threadOptions)
        : client.startThread(threadOptions)

      if (input.externalSessionId) {
        const resumeEnvelope = makeEnvelope({
          type: 'sdk_session',
          sdkSessionId: input.externalSessionId,
          resumeFrom: input.externalSessionId,
        }, 'runtime_service')
        if (resumeEnvelope) yield resumeEnvelope
      }

      if (abortController.signal.aborted) {
        const stoppedEnvelope = makeStoppedEnvelope()
        if (stoppedEnvelope) yield stoppedEnvelope
        return
      }

      const adapter = new CodexEventAdapter({
        sessionId: input.sessionId,
        runId,
        nextSequence,
        createdAt: this.deps.now,
      })
      const streamedResult = await raceWithAbort(
        () => thread.runStreamed(input.prompt, { signal: abortController.signal }),
        abortController.signal,
      )
      if (streamedResult.kind === 'aborted') {
        const stoppedEnvelope = makeStoppedEnvelope()
        if (stoppedEnvelope) yield stoppedEnvelope
        return
      }

      const iterator = streamedResult.value.events[Symbol.asyncIterator]()
      while (true) {
        const nextResult = await raceWithAbort(() => iterator.next(), abortController.signal)
        if (nextResult.kind === 'aborted') {
          iterator.return?.(undefined as never).catch(() => {})
          const stoppedEnvelope = makeStoppedEnvelope()
          if (stoppedEnvelope) yield stoppedEnvelope
          return
        }
        if (nextResult.value.done) break
        const event = nextResult.value.value

        for (const envelope of adapter.adapt(event)) {
          if (abortController.signal.aborted) {
            const stoppedEnvelope = makeStoppedEnvelope()
            if (stoppedEnvelope) yield stoppedEnvelope
            return
          }
          if (envelope.event.type === 'sdk_session') {
            if (seenSdkSessionIds.has(envelope.event.sdkSessionId)) continue
            seenSdkSessionIds.add(envelope.event.sdkSessionId)
          }
          if (isAgentRuntimeTerminalEvent(envelope.event)) {
            if (terminalWritten) continue
            terminalWritten = true
          }
          yield envelope
          if (isAgentRuntimeTerminalEvent(envelope.event)) return
        }
      }

      if (!terminalWritten) {
        const envelope = abortController.signal.aborted
          ? makeStoppedEnvelope()
          : makeEnvelope(createRunFailedEvent(
            'codex_stream_ended_without_terminal',
            'Codex 流式事件异常结束',
            'Codex stream ended without a terminal event',
          ), 'runtime_service')
        if (envelope) yield envelope
      }
    } catch (error) {
      const envelope = abortController.signal.aborted
        ? makeStoppedEnvelope()
        : makeEnvelope(createRunFailedEventFromError(error), 'runtime_service')
      if (envelope) yield envelope
    } finally {
      input.abortSignal?.removeEventListener('abort', onExternalAbort)
      if (this.activeAbortControllers.get(input.sessionId) === abortController) {
        this.activeAbortControllers.delete(input.sessionId)
      }
      await commandGuard?.cleanup()
    }
  }

  abort(sessionId: string): void {
    this.activeAbortControllers.get(sessionId)?.abort()
  }

  async queueMessage(_input: AgentQueueMessageInput): Promise<UnsupportedRuntimeCapabilityResult> {
    return unsupportedCapability('queueMessage')
  }

  async setPermissionMode(
    _sessionId: string,
    _mode: CodeInsightsPermissionMode,
  ): Promise<UnsupportedRuntimeCapabilityResult> {
    return unsupportedCapability('setPermissionMode')
  }

  dispose(): void {
    for (const controller of this.activeAbortControllers.values()) {
      controller.abort()
    }
    this.activeAbortControllers.clear()
  }

  private createCodexClient(options: CodexOptions): ReturnType<CreateCodexSdkClient> {
    return (this.deps.createCodexClient ?? createDefaultCodexSdkClient)(options)
  }

  private async resolveCodexRuntime(channelId?: string): Promise<CodexRuntimeOptions> {
    if (this.deps.resolveCodexRuntime) {
      return this.deps.resolveCodexRuntime(channelId)
    }
    const { resolveCodexRuntime } = await import('../codex-runtime/codex-channel')
    return resolveCodexRuntime(channelId)
  }

  private buildCodexEnv(): Promise<Record<string, string>> {
    return (this.deps.buildCodexEnv ?? defaultBuildCodexEnv)()
  }

  private resolveCodexAuth(runtime: CodexRuntimeOptions, env: Record<string, string>): CodexAuthState {
    return (this.deps.resolveCodexAuth ?? defaultResolveCodexAuth)(runtime, env)
  }

  private createExecutionGuard(
    env: Record<string, string>,
    repositoryRoot: string | undefined,
    options: { auth: CodexAuthState; purpose?: CodexExecutionGuardPurpose },
  ): Promise<CodexCommandGuard> {
    return (this.deps.createExecutionGuard ?? defaultCreateCodexExecutionGuard)(env, repositoryRoot, options)
  }

  private resolveCodexCliPath(): string {
    return (this.deps.resolveCodexCliPath ?? defaultResolveCodexCliPath)()
  }
}

export function buildCodexThreadOptions(
  input: CodexCodingAgentRuntimeRunInput & { model: string },
): ThreadOptions {
  const policy = resolveCodexPermissionPolicy(input.permissionMode, {
    networkAccessEnabled: input.networkAccessEnabled,
    webSearchMode: input.webSearchMode,
    allowDangerFullAccess: input.allowDangerFullAccess,
  })
  return {
    model: input.model,
    sandboxMode: policy.sandboxMode,
    workingDirectory: input.workingDirectory,
    skipGitRepoCheck: true,
    modelReasoningEffort: input.modelReasoningEffort,
    networkAccessEnabled: policy.networkAccessEnabled,
    webSearchMode: policy.webSearchMode,
    approvalPolicy: policy.approvalPolicy,
    additionalDirectories: input.additionalDirectories,
  }
}

function unsupportedCapability(capability: UnsupportedRuntimeCapability): UnsupportedRuntimeCapabilityResult {
  return {
    ok: false,
    code: 'runtime_capability_unsupported',
    runtimeKind: 'codex',
    capability,
    message: `Codex Runtime 暂不支持 ${capability}。`,
  }
}

function buildCodexClientEnv(
  env: Record<string, string>,
  runtime: CodexRuntimeOptions,
): Record<string, string> {
  if (!runtime.apiKey) return env
  const clientEnv = { ...env }
  delete clientEnv.CODEX_API_KEY
  return clientEnv
}

function createRunFailedEvent(
  code: CodexAgentRuntimeErrorCode,
  title: string,
  message: string,
): AgentRuntimeEvent {
  return {
    type: 'run_failed',
    recoverable: false,
    error: {
      code,
      title,
      message,
      retryable: false,
    },
  }
}

function createRunFailedEventFromError(error: unknown): AgentRuntimeEvent {
  const payload = classifyCodexRuntimeError(error)
  return {
    type: 'run_failed',
    recoverable: false,
    error: payload,
  }
}

export function classifyCodexRuntimeError(error: unknown): AgentRuntimeErrorPayload {
  const message = errorToMessage(error)
  const originalError = error instanceof Error ? error.stack : undefined
  const code = classifyCodexRuntimeErrorCode(message)
  return {
    code,
    title: titleForCodexRuntimeErrorCode(code),
    message,
    retryable: false,
    ...(originalError ? { originalError } : {}),
  }
}

function classifyCodexRuntimeErrorCode(message: string): CodexAgentRuntimeErrorCode {
  if (
    message.includes('CODEX_API_KEY')
    || message.includes('auth.json')
    || message.includes('Codex 登录')
  ) {
    return 'codex_auth_missing'
  }
  if (
    message.includes('不支持的 Codex CLI')
    || message.includes('@openai/codex')
    || message.includes('codexPathOverride')
  ) {
    return 'codex_binary_missing'
  }
  if (
    message.includes('Codex 渠道')
    || message.includes('OpenAI 或 Custom')
  ) {
    return 'codex_channel_invalid'
  }
  if (message.includes('without a terminal event')) {
    return 'codex_stream_ended_without_terminal'
  }
  return 'codex_stream_error'
}

function titleForCodexRuntimeErrorCode(code: CodexAgentRuntimeErrorCode): string {
  switch (code) {
    case 'codex_auth_missing':
      return 'Codex 认证缺失'
    case 'codex_binary_missing':
      return 'Codex CLI 不可用'
    case 'codex_channel_invalid':
      return 'Codex 渠道不可用'
    case 'codex_stream_ended_without_terminal':
      return 'Codex 流式事件异常结束'
    case 'codex_stream_error':
      return 'Codex 流式事件失败'
    case 'codex_runtime_error':
      return 'Codex Runtime 运行失败'
    default:
      return assertNever(code)
  }
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Codex Runtime 运行失败'
}

type AbortRaceResult<T> =
  | { kind: 'value'; value: T }
  | { kind: 'aborted' }

function raceWithAbort<T>(start: () => Promise<T>, signal: AbortSignal): Promise<AbortRaceResult<T>> {
  if (signal.aborted) {
    return Promise.resolve({ kind: 'aborted' })
  }

  const promise = start()
  let cleanup = (): void => {}
  const abortPromise = new Promise<AbortRaceResult<T>>((resolve) => {
    const onAbort = (): void => resolve({ kind: 'aborted' })
    signal.addEventListener('abort', onAbort, { once: true })
    cleanup = () => signal.removeEventListener('abort', onAbort)
  })

  return Promise.race([
    promise.then((value): AbortRaceResult<T> => ({ kind: 'value', value })),
    abortPromise,
  ]).finally(() => {
    cleanup()
  })
}

function assertNever(value: never): never {
  throw new Error(`未支持的 Codex runtime 错误类型: ${String(value)}`)
}

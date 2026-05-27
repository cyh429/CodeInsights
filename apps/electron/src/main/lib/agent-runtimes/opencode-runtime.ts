import { randomUUID } from 'node:crypto'
import {
  createAgentStreamEnvelope,
  isAgentRuntimeTerminalEvent,
  validateAgentStreamEnvelope,
  type AgentEventSource,
  type AgentQueueMessageInput,
  type AgentRuntimeErrorPayload,
  type AgentRuntimeEvent,
  type AgentStreamEnvelope,
  type CodeInsightsPermissionMode,
} from '@codeinsights/shared'
import {
  OpencodeEventAdapter,
  type OpencodeRawEvent,
} from './opencode-event-adapter'
import type {
  CodingAgentRuntime,
  CodingAgentRuntimeCapabilities,
  CodingAgentRuntimeRunInput,
  OpencodeCodingAgentRuntimeRunInput,
  UnsupportedRuntimeCapability,
  UnsupportedRuntimeCapabilityResult,
} from './coding-agent-runtime-types'

export type OpencodeAgentRuntimeErrorCode =
  | 'opencode_mock_runtime_error'
  | 'opencode_stream_error'
  | 'opencode_stream_ended_without_terminal'

export interface OpencodeRuntimeServerLease {
  key: string
  endpoint: string
  version?: string
}

export interface OpencodeRuntimeServerManagerLike {
  ensure(input: OpencodeRuntimeServerEnsureInput): Promise<OpencodeRuntimeServerLease>
  abort?(input: OpencodeRuntimeAbortInput): void | Promise<void>
  release?(lease: OpencodeRuntimeServerLease): void | Promise<void>
  dispose?(): void
}

export interface OpencodeRuntimeServerEnsureInput {
  sessionId: string
  workingDirectory: string
  channelId?: string | null
  model?: string
  agent?: string
  authSource?: string
  runtimeHash?: string
}

export interface OpencodeRuntimeAbortInput {
  sessionId: string
  externalSessionId?: string
}

export interface OpencodeRuntimeClientLike {
  stream(input: OpencodeRuntimeClientStreamInput): AsyncIterable<OpencodeRawEvent>
}

export interface OpencodeRuntimeClientStreamInput {
  sessionId: string
  prompt: string
  externalSessionId?: string
  model?: string
  agent?: string
  workingDirectory: string
  permissionMode: CodeInsightsPermissionMode
  server: OpencodeRuntimeServerLease
  signal: AbortSignal
}

export interface OpencodeAgentRuntimeDeps {
  serverManager?: OpencodeRuntimeServerManagerLike
  client?: OpencodeRuntimeClientLike
  createRunId?: () => string
  now?: () => string
}

const OPENCODE_AGENT_RUNTIME_CAPABILITIES: CodingAgentRuntimeCapabilities = {
  runtimeKind: 'opencode',
  displayName: 'opencode',
  supportsStreamEvents: true,
  supportsResumeThread: true,
  supportsAbort: true,
  supportsQueueMessage: false,
  supportsSetPermissionMode: false,
  supportsPerToolPermission: false,
  supportsServerStatus: false,
  supportsModelRefresh: false,
  authSources: ['native', 'channel'],
}

export class OpencodeAgentRuntime implements CodingAgentRuntime {
  readonly kind = 'opencode' as const
  private readonly activeAbortControllers = new Map<string, AbortController>()
  private readonly serverManager: OpencodeRuntimeServerManagerLike
  private readonly client: OpencodeRuntimeClientLike

  constructor(private readonly deps: OpencodeAgentRuntimeDeps = {}) {
    this.serverManager = deps.serverManager ?? new MockOpencodeServerManager()
    this.client = deps.client ?? new MockOpencodeRuntimeClient(deps.now)
  }

  getCapabilities(): CodingAgentRuntimeCapabilities {
    return OPENCODE_AGENT_RUNTIME_CAPABILITIES
  }

  async *run(input: OpencodeCodingAgentRuntimeRunInput): AsyncIterable<AgentStreamEnvelope> {
    const runId = input.runId ?? this.deps.createRunId?.() ?? randomUUID()
    const abortController = new AbortController()
    let sequence = 0
    let terminalWritten = false
    let lease: OpencodeRuntimeServerLease | undefined

    const nextSequence = (): number => {
      const current = sequence
      sequence += 1
      return current
    }
    const makeEnvelope = (
      event: AgentRuntimeEvent,
      source: AgentEventSource,
    ): AgentStreamEnvelope | null => {
      if (isAgentRuntimeTerminalEvent(event)) {
        if (terminalWritten) return null
        terminalWritten = true
      }
      const envelope = createAgentStreamEnvelope({
        sessionId: input.sessionId,
        runId,
        sequence: nextSequence(),
        source,
        createdAt: this.deps.now?.(),
        event,
      })
      const validation = validateAgentStreamEnvelope(envelope)
      if (!validation.ok) {
        console.warn(`[opencode Runtime] envelope 校验失败，已跳过: ${validation.errors.join('; ')}`)
        return null
      }
      return envelope
    }
    const makeStoppedEnvelope = (): AgentStreamEnvelope | null =>
      makeEnvelope({ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' }, 'runtime_service')
    const makeRunFailedEnvelope = (error: unknown): AgentStreamEnvelope | null =>
      makeEnvelope(createRunFailedEventFromError(error), 'runtime_service')

    const onExternalAbort = (): void => {
      abortController.abort()
    }
    if (input.abortSignal?.aborted) {
      abortController.abort()
    } else {
      input.abortSignal?.addEventListener('abort', onExternalAbort, { once: true })
    }

    this.activeAbortControllers.set(input.sessionId, abortController)

    const adapter = new OpencodeEventAdapter({
      sessionId: input.sessionId,
      runId,
      externalSessionId: input.externalSessionId,
      createdAt: this.deps.now,
      nextSequence,
      promptSent: true,
    })

    try {
      const displayModel = normalizeOptionalModel(input.model) ?? 'opencode default'
      const runStarted = makeEnvelope({
        type: 'run_started',
        model: displayModel,
        cwd: input.workingDirectory,
        permissionMode: input.permissionMode,
        runtimeHash: input.runtimeHash ?? 'opencode-agent-runtime-mock',
        runnerMode: input.runnerMode ?? 'runner-v2',
        runtimeKind: 'opencode',
      }, 'runtime_service')
      if (runStarted) yield runStarted

      if (abortController.signal.aborted) {
        const stopped = makeStoppedEnvelope()
        if (stopped) yield stopped
        return
      }

      lease = await this.serverManager.ensure({
        sessionId: input.sessionId,
        workingDirectory: input.workingDirectory,
        channelId: input.channelId,
        model: input.model,
        agent: input.agent,
        authSource: input.authSource,
        runtimeHash: input.runtimeHash,
      })

      if (abortController.signal.aborted) {
        const stopped = makeStoppedEnvelope()
        if (stopped) yield stopped
        return
      }

      if (input.externalSessionId) {
        const resumed = makeEnvelope({
          type: 'sdk_session',
          sdkSessionId: input.externalSessionId,
          resumeFrom: input.externalSessionId,
        }, 'runtime_service')
        if (resumed) yield resumed
      }

      const iterator = this.client.stream({
        sessionId: input.sessionId,
        prompt: stringifyPrompt(input.prompt),
        externalSessionId: input.externalSessionId,
        model: input.model,
        agent: input.agent,
        workingDirectory: input.workingDirectory,
        permissionMode: input.permissionMode,
        server: lease,
        signal: abortController.signal,
      })[Symbol.asyncIterator]()

      while (true) {
        const nextResult = await raceWithAbort(() => iterator.next(), abortController.signal)
        if (nextResult.kind === 'aborted') {
          iterator.return?.(undefined as never).catch(() => {})
          const stopped = adapter.stop('user_abort', 'user')
          if (stopped.length > 0) {
            yield stopped[0]!
          } else {
            const fallback = makeStoppedEnvelope()
            if (fallback) yield fallback
          }
          return
        }
        if (nextResult.value.done) break

        if (abortController.signal.aborted) {
          const stopped = adapter.stop('user_abort', 'user')
          if (stopped.length > 0) yield stopped[0]!
          return
        }

        for (const envelope of adapter.adapt(nextResult.value.value)) {
          if (abortController.signal.aborted) {
            const stopped = adapter.stop('user_abort', 'user')
            if (stopped.length > 0) yield stopped[0]!
            return
          }
          yield envelope
          if (isAgentRuntimeTerminalEvent(envelope.event)) {
            terminalWritten = true
            return
          }
        }
      }

      if (!terminalWritten) {
        if (abortController.signal.aborted) {
          const stopped = adapter.stop('user_abort', 'user')
          if (stopped.length > 0) {
            yield stopped[0]!
          } else {
            const fallback = makeStoppedEnvelope()
            if (fallback) yield fallback
          }
          return
        }
        const failed = makeEnvelope(createRunFailedEvent(
          'opencode_stream_ended_without_terminal',
          'opencode 流式事件异常结束',
          'opencode stream ended without a terminal event',
        ), 'runtime_service')
        if (failed) yield failed
      }
    } catch (error) {
      const envelope = abortController.signal.aborted
        ? makeStoppedEnvelope()
        : makeRunFailedEnvelope(error)
      if (envelope) yield envelope
    } finally {
      input.abortSignal?.removeEventListener('abort', onExternalAbort)
      if (this.activeAbortControllers.get(input.sessionId) === abortController) {
        this.activeAbortControllers.delete(input.sessionId)
      }
      if (lease) {
        await this.serverManager.release?.(lease)
      }
    }
  }

  abort(sessionId: string): void {
    const controller = this.activeAbortControllers.get(sessionId)
    controller?.abort()
    void this.serverManager.abort?.({ sessionId })
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
    this.serverManager.dispose?.()
  }
}

class MockOpencodeServerManager implements OpencodeRuntimeServerManagerLike {
  async ensure(input: OpencodeRuntimeServerEnsureInput): Promise<OpencodeRuntimeServerLease> {
    return {
      key: `mock:${input.sessionId}`,
      endpoint: 'mock://opencode-runtime',
      version: 'mock',
    }
  }
}

class MockOpencodeRuntimeClient implements OpencodeRuntimeClientLike {
  constructor(private readonly now?: () => string) {}

  async *stream(input: OpencodeRuntimeClientStreamInput): AsyncIterable<OpencodeRawEvent> {
    if (input.signal.aborted) return
    const externalSessionId = input.externalSessionId ?? `ses_mock_${input.sessionId.replaceAll('-', '_')}`
    const timestamp = this.mockTimestamp()
    if (!input.externalSessionId) {
      yield {
        id: `evt-${externalSessionId}-created`,
        type: 'session.created',
        properties: {
          info: {
            id: externalSessionId,
            directory: input.workingDirectory,
            title: 'CodeInsights opencode mock session',
            version: input.server.version,
            time: { created: timestamp, updated: timestamp },
          },
        },
      }
    }
    if (input.signal.aborted) return
    const model = splitOpencodeModel(input.model)
    yield {
      id: `evt-${externalSessionId}-user`,
      type: 'message.updated',
      properties: {
        info: {
          id: `msg_user_${externalSessionId}`,
          sessionID: externalSessionId,
          role: 'user',
          time: { created: timestamp + 1 },
          agent: input.agent,
          model,
        },
      },
    }
    if (input.signal.aborted) return
    const response = `opencode mock response: ${input.prompt.slice(0, 80)}`
    yield {
      id: `evt-${externalSessionId}-text`,
      type: 'message.part.updated',
      properties: {
        part: {
          id: `part_text_${externalSessionId}`,
          sessionID: externalSessionId,
          messageID: `msg_assistant_${externalSessionId}`,
          type: 'text',
          text: response,
          time: { start: timestamp + 2, end: timestamp + 3 },
        },
        delta: response,
      },
    }
    if (input.signal.aborted) return
    yield {
      id: `evt-${externalSessionId}-usage`,
      type: 'message.updated',
      properties: {
        info: {
          id: `msg_assistant_${externalSessionId}`,
          sessionID: externalSessionId,
          role: 'assistant',
          time: { created: timestamp + 2, completed: timestamp + 3 },
          parentID: `msg_user_${externalSessionId}`,
          providerID: model?.providerID ?? 'mock',
          modelID: model?.modelID ?? 'opencode-mock',
          mode: input.agent,
          path: { cwd: input.workingDirectory, root: input.workingDirectory },
          cost: 0,
          tokens: {
            input: Math.max(1, Math.ceil(input.prompt.length / 4)),
            output: Math.max(1, Math.ceil(response.length / 4)),
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          finish: 'stop',
        },
      },
    }
    if (input.signal.aborted) return
    yield {
      id: `evt-${externalSessionId}-idle`,
      type: 'session.idle',
      properties: { sessionID: externalSessionId },
    }
  }

  private mockTimestamp(): number {
    const value = this.now?.()
    const parsed = value ? Date.parse(value) : NaN
    return Number.isFinite(parsed) ? parsed : Date.now()
  }
}

function unsupportedCapability(capability: UnsupportedRuntimeCapability): UnsupportedRuntimeCapabilityResult {
  return {
    ok: false,
    code: 'runtime_capability_unsupported',
    runtimeKind: 'opencode',
    capability,
    message: `opencode Runtime 暂不支持 ${capability}。`,
  }
}

function normalizeOptionalModel(model: string | undefined): string | undefined {
  const trimmed = model?.trim()
  return trimmed ? trimmed : undefined
}

function stringifyPrompt(prompt: CodingAgentRuntimeRunInput['prompt']): string {
  if (typeof prompt === 'string') return prompt
  if (Array.isArray(prompt)) {
    return prompt
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text
        return JSON.stringify(part)
      })
      .join('\n')
  }
  return String(prompt)
}

function splitOpencodeModel(model: string | undefined): { providerID: string; modelID: string } | undefined {
  const trimmed = normalizeOptionalModel(model)
  if (!trimmed) return undefined
  const slashIndex = trimmed.indexOf('/')
  if (slashIndex <= 0 || slashIndex === trimmed.length - 1) {
    return { providerID: 'codeinsights', modelID: trimmed }
  }
  return {
    providerID: trimmed.slice(0, slashIndex),
    modelID: trimmed.slice(slashIndex + 1),
  }
}

function createRunFailedEvent(
  code: OpencodeAgentRuntimeErrorCode,
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
  return {
    type: 'run_failed',
    recoverable: false,
    error: classifyOpencodeRuntimeError(error),
  }
}

export function classifyOpencodeRuntimeError(error: unknown): AgentRuntimeErrorPayload {
  const message = errorToMessage(error)
  return {
    code: 'opencode_stream_error',
    title: 'opencode Runtime 运行失败',
    message,
    retryable: false,
    ...(error instanceof Error && error.stack ? { originalError: error.stack } : {}),
  }
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'opencode Runtime 运行失败'
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

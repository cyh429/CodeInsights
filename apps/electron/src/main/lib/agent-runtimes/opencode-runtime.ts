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
import {
  applyOpencodeRuntimeConfigEnv,
  buildOpencodeBaseEnv,
  buildOpencodeConfig,
  buildOpencodeMcpConfigFromWorkspace,
  createOpencodeMcpStatusSummary,
  createOpencodeAuthState,
  createOpencodeClientWrapper,
  createOpencodeServerKey,
  detectOpencodeBinaryVersion,
  mergeOpencodeScopedSecretEnv,
  OpencodeServerManager,
  parseOpencodeModel,
  resolveOpencodeCliPath,
  writeOpencodeRuntimeConfig,
  type OpencodeClientWrapper,
  type OpencodeMcpConfigBuildResult,
  type OpencodeProviderAuthConfig,
  type OpencodeServerEntry,
  type OpencodeServerStatus,
} from '../opencode-runtime'
import type {
  CodingAgentRuntime,
  CodingAgentRuntimeCapabilities,
  CodingAgentRuntimePermissionResponseInput,
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
  auth?: {
    username: string
    password: string
  }
  model?: string
  agent?: string
}

export interface OpencodeRuntimeServerManagerLike {
  ensure(input: OpencodeRuntimeServerEnsureInput): Promise<OpencodeRuntimeServerLease>
  getStatus?(): OpencodeServerStatus | undefined
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
  permissionMode?: CodeInsightsPermissionMode
  opencodeMcp?: OpencodeMcpConfigBuildResult
}

export interface OpencodeRuntimeAbortInput {
  sessionId: string
  externalSessionId?: string
}

export interface OpencodeRuntimeClientLike {
  stream(input: OpencodeRuntimeClientStreamInput): AsyncIterable<OpencodeRawEvent>
  respondPermission?(input: OpencodeRuntimePermissionResponseInput): Promise<boolean>
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

export interface OpencodeRuntimePermissionResponseInput {
  sessionId: string
  requestId: string
  externalSessionId: string
  directory: string
  lease: OpencodeRuntimeServerLease
  response: 'once' | 'always' | 'reject'
}

export interface OpencodeAgentRuntimeDeps {
  serverManager?: OpencodeRuntimeServerManagerLike
  client?: OpencodeRuntimeClientLike
  createRunId?: () => string
  now?: () => string
}

interface PendingOpencodePermission {
  sessionId: string
  requestId: string
  externalSessionId: string
  directory: string
  lease: OpencodeRuntimeServerLease
}

const OPENCODE_AGENT_RUNTIME_CAPABILITIES: CodingAgentRuntimeCapabilities = {
  runtimeKind: 'opencode',
  displayName: 'opencode',
  supportsStreamEvents: true,
  supportsResumeThread: true,
  supportsAbort: true,
  supportsQueueMessage: false,
  supportsSetPermissionMode: false,
  supportsPerToolPermission: true,
  supportsServerStatus: true,
  supportsModelRefresh: false,
  authSources: ['native', 'channel'],
}

export class OpencodeAgentRuntime implements CodingAgentRuntime {
  readonly kind = 'opencode' as const
  private readonly activeAbortControllers = new Map<string, AbortController>()
  private readonly pendingPermissions = new Map<string, PendingOpencodePermission>()
  private readonly serverManager: OpencodeRuntimeServerManagerLike
  private readonly client: OpencodeRuntimeClientLike

  constructor(private readonly deps: OpencodeAgentRuntimeDeps = {}) {
    this.serverManager = deps.serverManager ?? new DefaultOpencodeRuntimeServerManager()
    this.client = deps.client ?? new DefaultOpencodeRuntimeClient()
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
        permissionMode: input.permissionMode,
        opencodeMcp: input.opencodeMcp,
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
          this.capturePermissionEnvelope(envelope, lease, input.workingDirectory)
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
      this.clearSessionPendingPermissions(input.sessionId)
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

  getServerStatus(): OpencodeServerStatus | undefined {
    return this.serverManager.getStatus?.()
  }

  async respondPermission(input: CodingAgentRuntimePermissionResponseInput): Promise<boolean> {
    const pending = this.pendingPermissions.get(makePermissionKey(input.sessionId, input.requestId))
    if (!pending || pending.sessionId !== input.sessionId) return false

    const response = input.behavior === 'deny'
      ? 'reject'
      : input.alwaysAllow ? 'always' : 'once'
    const ok = this.client.respondPermission
      ? await this.client.respondPermission({
        sessionId: input.sessionId,
        requestId: input.requestId,
        externalSessionId: pending.externalSessionId,
        directory: pending.directory,
        lease: pending.lease,
        response,
      })
      : await respondOpencodePermissionWithLease({
        lease: pending.lease,
        externalSessionId: pending.externalSessionId,
        requestId: pending.requestId,
        directory: pending.directory,
        response,
      })
    if (ok) {
      this.pendingPermissions.delete(makePermissionKey(input.sessionId, input.requestId))
    }
    return ok
  }

  dispose(): void {
    for (const controller of this.activeAbortControllers.values()) {
      controller.abort()
    }
    this.activeAbortControllers.clear()
    this.pendingPermissions.clear()
    this.serverManager.dispose?.()
  }

  private capturePermissionEnvelope(
    envelope: AgentStreamEnvelope,
    lease: OpencodeRuntimeServerLease,
    directory: string,
  ): void {
    if (envelope.event.type === 'permission_requested') {
      const externalSessionId = envelope.metadata?.externalSessionId
      if (!externalSessionId) return
      this.pendingPermissions.set(makePermissionKey(envelope.sessionId, envelope.event.requestId), {
        sessionId: envelope.sessionId,
        requestId: envelope.event.requestId,
        externalSessionId,
        directory,
        lease,
      })
      return
    }

    if (envelope.event.type === 'permission_resolved') {
      this.pendingPermissions.delete(makePermissionKey(envelope.sessionId, envelope.event.requestId))
    }
  }

  private clearSessionPendingPermissions(sessionId: string): void {
    for (const [key, pending] of this.pendingPermissions) {
      if (pending.sessionId === sessionId) {
        this.pendingPermissions.delete(key)
      }
    }
  }
}

async function respondOpencodePermissionWithLease(input: {
  lease: OpencodeRuntimeServerLease
  externalSessionId: string
  requestId: string
  directory: string
  response: 'once' | 'always' | 'reject'
}): Promise<boolean> {
  const client = createOpencodeClientWrapper({
    baseUrl: input.lease.endpoint,
    auth: input.lease.auth,
    timeoutMs: 30_000,
  })
  return await client.respondPermission({
    sessionId: input.externalSessionId,
    permissionId: input.requestId,
    directory: input.directory,
    response: input.response,
  })
}

function makePermissionKey(sessionId: string, requestId: string): string {
  return `${sessionId}\0${requestId}`
}

class DefaultOpencodeRuntimeServerManager implements OpencodeRuntimeServerManagerLike {
  private readonly manager = new OpencodeServerManager({ idleTimeoutMs: 5 * 60 * 1000 })

  async ensure(input: OpencodeRuntimeServerEnsureInput): Promise<OpencodeRuntimeServerLease> {
    const binary = resolveOpencodeCliPath({
      allowSystemPathFallback: process.env.CODEINSIGHTS_AGENT_OPENCODE_ALLOW_SYSTEM_PATH === '1',
    })
    const binaryVersion = await detectOpencodeBinaryVersion(binary)
    const authState = await resolveOpencodeRuntimeAuth(input)
    const mcp = input.opencodeMcp ?? buildOpencodeMcpConfigFromWorkspace({ servers: {} })
    const providerAuth = await toOpencodeProviderAuthConfig(authState, input)
    const builtConfig = buildOpencodeConfig({
      modelId: normalizeOpencodeConfigModel(input.model, authState.source),
      agentName: input.agent ?? 'build',
      auth: providerAuth,
      permissionMode: input.permissionMode ?? 'auto',
      mcp: mcp.config,
      opencodeVersion: binaryVersion.version,
    })
    const writtenConfig = await writeOpencodeRuntimeConfig({
      rootDir: input.workingDirectory,
      built: builtConfig,
    })
    const baseEnv = buildOpencodeBaseEnv()
    const env = applyOpencodeRuntimeConfigEnv({
      env: mergeOpencodeScopedSecretEnv(baseEnv, {
        ...authState.env,
        ...mcp.env,
      }),
      configPath: writtenConfig.configPath,
      configDir: writtenConfig.configDir,
      inlinePolicyContent: writtenConfig.inlinePolicyContent,
      includeConfigDir: process.env.CODEINSIGHTS_AGENT_OPENCODE_ENABLE_CONFIG_DIR === '1',
    })

    const key = createOpencodeServerKey({
      workspaceId: input.sessionId,
      workingDirectory: input.workingDirectory,
      authSourceHash: authState.authSourceHash,
      runtimeConfigHash: writtenConfig.runtimeConfigHash,
    })
    const entry = await this.manager.ensure({
      key,
      binaryPath: binaryVersion.path,
      cwd: input.workingDirectory,
      env,
      mcp: createOpencodeMcpStatusSummary(mcp.config, mcp.skipped),
    })
    await this.refreshMcpStatus(entry, mcp)
    return toRuntimeServerLease(entry, {
      model: writtenConfig.config.model,
      agent: input.agent,
    })
  }

  release(lease: OpencodeRuntimeServerLease): void {
    this.manager.release(lease.key)
  }

  getStatus(): OpencodeServerStatus | undefined {
    return this.manager.getLatestStatus()
  }

  private async refreshMcpStatus(
    entry: OpencodeServerEntry,
    mcp: OpencodeMcpConfigBuildResult,
  ): Promise<void> {
    try {
      const client = createOpencodeClientWrapper({
        baseUrl: entry.endpoint,
        auth: entry.auth,
        timeoutMs: 5000,
      })
      const runtimeStatus = await client.requestJson<unknown>('/mcp')
      this.manager.updateMcpStatus(entry.key, createOpencodeMcpStatusSummary(mcp.config, mcp.skipped, runtimeStatus))
    } catch {
      this.manager.updateMcpStatus(entry.key, createOpencodeMcpStatusSummary(mcp.config, mcp.skipped))
    }
  }

  dispose(): void {
    this.manager.dispose()
  }
}

class DefaultOpencodeRuntimeClient implements OpencodeRuntimeClientLike {
  async *stream(input: OpencodeRuntimeClientStreamInput): AsyncIterable<OpencodeRawEvent> {
    const client = createOpencodeClientWrapper({
      baseUrl: input.server.endpoint,
      auth: input.server.auth,
      timeoutMs: 30_000,
    })
    const eventController = new AbortController()
    let externalSessionId = input.externalSessionId
    const onAbort = (): void => {
      eventController.abort()
      if (externalSessionId) {
        void abortOpencodeSession(client, externalSessionId, input.workingDirectory)
      }
    }
    input.signal.addEventListener('abort', onAbort, { once: true })

    try {
      const eventStream = await client.subscribeEvents({
        directory: input.workingDirectory,
        signal: eventController.signal,
        maxRetryAttempts: 0,
      })

      if (!externalSessionId) {
        const session = await client.createSession({ directory: input.workingDirectory })
        externalSessionId = session.id
        yield createSessionCreatedEvent(session, input.workingDirectory)
      }

      if (input.signal.aborted) {
        await abortOpencodeSession(client, externalSessionId, input.workingDirectory)
        return
      }

      await client.promptAsync({
        sessionId: externalSessionId,
        prompt: input.prompt,
        model: input.server.model ?? input.model,
        agent: input.server.agent ?? input.agent,
        directory: input.workingDirectory,
      })

      for await (const event of eventStream) {
        if (input.signal.aborted) {
          await abortOpencodeSession(client, externalSessionId, input.workingDirectory)
          return
        }
        yield event as unknown as OpencodeRawEvent
      }
    } finally {
      input.signal.removeEventListener('abort', onAbort)
      eventController.abort()
    }
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

async function resolveOpencodeRuntimeAuth(input: OpencodeRuntimeServerEnsureInput): Promise<ReturnType<typeof createOpencodeAuthState>> {
  if (input.authSource === 'channel' || input.channelId) {
    if (!input.channelId) {
      throw new Error('opencode channel auth 缺少渠道 ID')
    }
    const { decryptApiKey, getChannelById } = await import('../channel-manager')
    const channel = getChannelById(input.channelId)
    if (!channel) {
      throw new Error(`未找到 opencode 渠道: ${input.channelId}`)
    }
    if (!channel.enabled) {
      throw new Error(`opencode 渠道已禁用: ${channel.name}`)
    }
    const modelId = normalizeOpencodeChannelModel(input.model)
    return createOpencodeAuthState({
      source: 'channel',
      channelId: input.channelId,
      providerId: channel.provider,
      baseUrl: channel.baseUrl || undefined,
      modelId,
      apiKey: decryptApiKey(input.channelId),
    })
  }

  return createOpencodeAuthState({ source: 'native', modelId: input.model })
}

async function toOpencodeProviderAuthConfig(
  authState: ReturnType<typeof createOpencodeAuthState>,
  input: OpencodeRuntimeServerEnsureInput,
): Promise<OpencodeProviderAuthConfig> {
  if (authState.source !== 'channel') return { source: 'native' }
  if (!input.channelId || !authState.apiKeyEnvName) {
    throw new Error('opencode channel auth 状态不完整')
  }
  const { getChannelById } = await import('../channel-manager')
  const channel = getChannelById(input.channelId)
  if (!channel) {
    throw new Error(`未找到 opencode 渠道: ${input.channelId}`)
  }
  return {
    source: 'channel',
    providerId: channel.provider,
    baseUrl: channel.baseUrl || undefined,
    apiKeyEnvName: authState.apiKeyEnvName,
  }
}

function normalizeOpencodeConfigModel(model: string | undefined, authSource: 'native' | 'channel' | 'smoke'): string {
  if (authSource === 'channel') return normalizeOpencodeChannelModel(model)
  return normalizeOptionalModel(model) ?? 'anthropic/claude-sonnet-4-5'
}

function normalizeOpencodeChannelModel(model: string | undefined): string {
  const trimmed = normalizeOptionalModel(model)
  if (!trimmed) return 'gpt-5.1-codex'
  const parsed = parseOpencodeModel(trimmed)
  return parsed.modelID
}

function toRuntimeServerLease(
  entry: OpencodeServerEntry,
  options: { model: string; agent?: string },
): OpencodeRuntimeServerLease {
  return {
    key: entry.key,
    endpoint: entry.endpoint,
    version: entry.version,
    auth: entry.auth,
    model: options.model,
    agent: options.agent,
  }
}

function createSessionCreatedEvent(
  session: { id: string; directory?: string; title?: string; version?: string },
  workingDirectory: string,
): OpencodeRawEvent {
  return {
    id: `evt-${session.id}-created`,
    type: 'session.created',
    properties: {
      info: {
        id: session.id,
        directory: session.directory ?? workingDirectory,
        title: session.title ?? 'CodeInsights opencode session',
        version: session.version,
        time: { created: Date.now(), updated: Date.now() },
      },
    },
  }
}

async function abortOpencodeSession(
  client: OpencodeClientWrapper,
  sessionId: string,
  directory: string,
): Promise<void> {
  await client.abortSession({ sessionId, directory }).catch(() => false)
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

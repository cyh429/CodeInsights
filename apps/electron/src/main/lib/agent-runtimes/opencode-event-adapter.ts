import {
  createAgentStreamEnvelope,
  isAgentRuntimeTerminalEvent,
  validateAgentStreamEnvelope,
  type AgentEventSource,
  type AgentRuntimeErrorPayload,
  type AgentRuntimeEvent,
  type AgentRuntimeEventMetadata,
  type AgentRuntimeRiskLevel,
  type AgentRuntimeUsagePayload,
  type AgentStreamEnvelope,
} from '@codeinsights/shared'

type OpencodeEventSource = Extract<AgentEventSource, 'opencode_server' | 'opencode_cli'>
type OpencodeStoppedReason = Extract<AgentRuntimeEvent, { type: 'run_stopped' }>['reason']
type OpencodeStoppedBy = Extract<AgentRuntimeEvent, { type: 'run_stopped' }>['stoppedBy']

type OpencodeRecord = Record<string, unknown>

interface OpencodeTimeRange {
  start?: number
  end?: number
  created?: number
  completed?: number
  updated?: number
}

interface OpencodeSessionInfo {
  id: string
  projectID?: string
  directory?: string
  title?: string
  version?: string
  time?: OpencodeTimeRange
}

interface OpencodeUserMessage {
  id: string
  sessionID: string
  role: 'user'
  time?: OpencodeTimeRange
  agent?: string
  model?: {
    providerID: string
    modelID: string
  }
}

interface OpencodeAssistantMessage {
  id: string
  sessionID: string
  role: 'assistant'
  time?: OpencodeTimeRange
  parentID?: string
  modelID?: string
  providerID?: string
  mode?: string
  path?: {
    cwd: string
    root: string
  }
  cost?: number
  tokens?: {
    input: number
    output: number
    reasoning: number
    cache: {
      read: number
      write: number
    }
  }
  finish?: string
  error?: OpencodeRuntimeError
}

type OpencodeMessage = OpencodeUserMessage | OpencodeAssistantMessage

interface OpencodePartBase {
  id: string
  sessionID: string
  messageID: string
}

interface OpencodeTextPart extends OpencodePartBase {
  type: 'text'
  text: string
  synthetic?: boolean
  ignored?: boolean
  time?: OpencodeTimeRange
  metadata?: OpencodeRecord
}

interface OpencodeReasoningPart extends OpencodePartBase {
  type: 'reasoning'
  text: string
  metadata?: OpencodeRecord
  time?: OpencodeTimeRange
}

interface OpencodeFilePart extends OpencodePartBase {
  type: 'file'
  mime: string
  filename?: string
  url: string
  source?: OpencodeRecord
}

interface OpencodeToolStatePending {
  status: 'pending'
  input: OpencodeRecord
  raw: string
}

interface OpencodeToolStateRunning {
  status: 'running'
  input: OpencodeRecord
  title?: string
  metadata?: OpencodeRecord
  time: OpencodeTimeRange
}

interface OpencodeToolStateCompleted {
  status: 'completed'
  input: OpencodeRecord
  output: string
  title: string
  metadata: OpencodeRecord
  time: OpencodeTimeRange
  attachments?: OpencodeFilePart[]
}

interface OpencodeToolStateError {
  status: 'error'
  input: OpencodeRecord
  error: string
  metadata?: OpencodeRecord
  time: OpencodeTimeRange
}

type OpencodeToolState =
  | OpencodeToolStatePending
  | OpencodeToolStateRunning
  | OpencodeToolStateCompleted
  | OpencodeToolStateError

interface OpencodeToolPart extends OpencodePartBase {
  type: 'tool'
  callID: string
  tool: string
  state: OpencodeToolState
  metadata?: OpencodeRecord
}

interface OpencodeStepFinishPart extends OpencodePartBase {
  type: 'step-finish'
  reason: string
  snapshot?: string
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: {
      read: number
      write: number
    }
  }
}

interface OpencodeSnapshotPart extends OpencodePartBase {
  type: 'snapshot'
  snapshot: string
}

interface OpencodePatchPart extends OpencodePartBase {
  type: 'patch'
  hash: string
  files: string[]
}

interface OpencodeAgentPart extends OpencodePartBase {
  type: 'agent'
  name: string
  source?: {
    value: string
    start: number
    end: number
  }
}

interface OpencodeSubtaskPart extends OpencodePartBase {
  type: 'subtask'
  prompt: string
  description: string
  agent: string
}

interface OpencodeRetryPart extends OpencodePartBase {
  type: 'retry'
  attempt: number
  error: OpencodeApiError
  time: {
    created: number
  }
}

interface OpencodeCompactionPart extends OpencodePartBase {
  type: 'compaction'
  auto: boolean
}

type OpencodePart =
  | OpencodeTextPart
  | OpencodeReasoningPart
  | OpencodeFilePart
  | OpencodeToolPart
  | OpencodeStepFinishPart
  | OpencodeSnapshotPart
  | OpencodePatchPart
  | OpencodeAgentPart
  | OpencodeSubtaskPart
  | OpencodeRetryPart
  | OpencodeCompactionPart

interface OpencodePermission {
  id: string
  type: string
  pattern?: string | string[]
  sessionID: string
  messageID: string
  callID?: string
  title: string
  metadata: OpencodeRecord
  time?: {
    created?: number
  }
}

interface OpencodeTodo {
  id: string
  content: string
  status: string
  priority: string
}

interface OpencodeProviderAuthError {
  name: 'ProviderAuthError'
  data: {
    providerID: string
    message: string
  }
}

interface OpencodeUnknownError {
  name: 'UnknownError'
  data: {
    message: string
  }
}

interface OpencodeMessageOutputLengthError {
  name: 'MessageOutputLengthError'
  data: OpencodeRecord
}

interface OpencodeMessageAbortedError {
  name: 'MessageAbortedError'
  data: {
    message: string
  }
}

interface OpencodeApiError {
  name: 'APIError'
  data: {
    message: string
    statusCode?: number
    isRetryable: boolean
    responseHeaders?: Record<string, string>
    responseBody?: string
  }
}

type OpencodeRuntimeError =
  | OpencodeProviderAuthError
  | OpencodeUnknownError
  | OpencodeMessageOutputLengthError
  | OpencodeMessageAbortedError
  | OpencodeApiError

type OpencodeSessionStatus =
  | { type: 'idle' }
  | { type: 'retry'; attempt: number; message: string; next: number }
  | { type: 'busy' }

interface OpencodeRawEventBase<TType extends string, TProperties> {
  id?: string
  type: TType
  properties: TProperties
}

export type OpencodeRawEvent =
  | OpencodeRawEventBase<'server.connected', OpencodeRecord>
  | OpencodeRawEventBase<'session.created', { info: OpencodeSessionInfo }>
  | OpencodeRawEventBase<'session.status', { sessionID: string; status: OpencodeSessionStatus }>
  | OpencodeRawEventBase<'session.idle', { sessionID: string }>
  | OpencodeRawEventBase<'session.error', { sessionID?: string; error?: OpencodeRuntimeError }>
  | OpencodeRawEventBase<'message.updated', { info: OpencodeMessage }>
  | OpencodeRawEventBase<'message.part.updated', { part: OpencodePart; delta?: string }>
  | OpencodeRawEventBase<'permission.updated', OpencodePermission>
  | OpencodeRawEventBase<'permission.replied', { sessionID: string; permissionID: string; response: string }>
  | OpencodeRawEventBase<'todo.updated', { sessionID: string; todos: OpencodeTodo[] }>

export interface OpencodeGlobalRawEvent {
  directory: string
  payload: OpencodeRawEvent
}

export type OpencodeAdapterInput = OpencodeRawEvent | OpencodeGlobalRawEvent

interface AdaptedRuntimeEvent {
  event: AgentRuntimeEvent
  metadata?: AgentRuntimeEventMetadata
}

interface OpencodeTextUpdate {
  changed: boolean
  appendOnly: boolean
  delta: string
}

interface OpencodeTodoState {
  content: string
  status: string
  completedEventWritten: boolean
}

interface OpencodeStopState {
  reason: OpencodeStoppedReason
  stoppedBy: OpencodeStoppedBy
}

interface OpencodeEventAdapterContext {
  sessionId: string
  runId: string
  externalSessionId?: string
  source?: OpencodeEventSource
  createdAt?: () => string
  nextSequence?: () => number
  promptSent?: boolean
}

interface OpencodeAdaptOptions {
  recovered?: boolean
}

interface OpencodeMetadataInput extends OpencodeAdaptOptions {
  sessionID?: string
  messageID?: string
  partID?: string
  occurredAt?: number
}

export const OPENCODE_EVENT_MAPPINGS = {
  'server.connected': 'ignored',
  'session.created': 'sdk_session',
  'session.status': 'retry_scheduled',
  'session.idle': 'run_completed',
  'session.error': 'run_failed',
  'message.updated': 'usage_or_error',
  'message.part.updated': 'part',
  'permission.updated': 'permission_requested',
  'permission.replied': 'permission_resolved',
  'todo.updated': 'agent_task',
} satisfies Record<OpencodeRawEvent['type'], string>

export class OpencodeEventAdapter {
  private sequence = 0
  private externalSessionId: string | undefined
  private promptSent: boolean
  private terminalWritten = false
  private stopState: OpencodeStopState | undefined
  private lastUsage: AgentRuntimeUsagePayload = {}
  private readonly seenEventKeys = new Set<string>()
  private readonly textByPartId = new Map<string, string>()
  private readonly taskTextById = new Map<string, string>()
  private readonly completedTextParts = new Set<string>()
  private readonly startedTools = new Set<string>()
  private readonly completedTools = new Set<string>()
  private readonly startedTasks = new Set<string>()
  private readonly completedTasks = new Set<string>()
  private readonly todoStates = new Map<string, OpencodeTodoState>()

  constructor(private readonly context: OpencodeEventAdapterContext) {
    this.externalSessionId = context.externalSessionId
    this.promptSent = context.promptSent ?? false
  }

  markPromptSent(): void {
    this.promptSent = true
  }

  markStopped(reason: OpencodeStoppedReason = 'user_abort', stoppedBy: OpencodeStoppedBy = 'user'): void {
    this.stopState = { reason, stoppedBy }
  }

  stop(reason: OpencodeStoppedReason = 'user_abort', stoppedBy: OpencodeStoppedBy = 'user'): AgentStreamEnvelope[] {
    this.markStopped(reason, stoppedBy)
    if (this.terminalWritten) return []
    const envelopes = [this.createEnvelope({
      event: { type: 'run_stopped', reason, stoppedBy },
      metadata: this.createMetadata({}),
    })].filter((envelope): envelope is AgentStreamEnvelope => envelope !== null)
    if (envelopes.length > 0) this.terminalWritten = true
    return envelopes
  }

  adapt(input: OpencodeAdapterInput, options: OpencodeAdaptOptions = {}): AgentStreamEnvelope[] {
    if (this.terminalWritten) return []
    const event = unwrapOpencodeEvent(input)
    if (!this.isRelevantEvent(event)) return []

    const eventKey = createOpencodeEventKey(event, options)
    if (this.seenEventKeys.has(eventKey)) return []
    this.seenEventKeys.add(eventKey)

    const adapted = this.adaptToRuntimeEvents(event, options)
    if (adapted.some((item) => isAgentRuntimeTerminalEvent(item.event))) {
      this.terminalWritten = true
    }
    return adapted
      .map((item) => this.createEnvelope(item))
      .filter((envelope): envelope is AgentStreamEnvelope => envelope !== null)
  }

  private adaptToRuntimeEvents(event: OpencodeRawEvent, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    switch (event.type) {
      case 'server.connected':
        return []
      case 'session.created':
        return this.adaptSessionCreated(event.properties.info, options)
      case 'session.status':
        this.captureSessionId(event.properties.sessionID)
        return this.adaptSessionStatus(event.properties.status, event.properties.sessionID, options)
      case 'session.idle':
        this.captureSessionId(event.properties.sessionID)
        return this.adaptSessionIdle(event.properties.sessionID, options)
      case 'session.error':
        if (event.properties.sessionID) this.captureSessionId(event.properties.sessionID)
        return this.adaptSessionError(event.properties.sessionID, event.properties.error, options)
      case 'message.updated':
        this.captureSessionId(event.properties.info.sessionID)
        return this.adaptMessageUpdated(event.properties.info, options)
      case 'message.part.updated':
        this.captureSessionId(event.properties.part.sessionID)
        return this.adaptPartUpdated(event.properties.part, event.properties.delta, options)
      case 'permission.updated':
        this.captureSessionId(event.properties.sessionID)
        return this.adaptPermissionUpdated(event.properties, options)
      case 'permission.replied':
        this.captureSessionId(event.properties.sessionID)
        return this.adaptPermissionReplied(event.properties, options)
      case 'todo.updated':
        this.captureSessionId(event.properties.sessionID)
        return this.adaptTodoUpdated(event.properties.todos, event.properties.sessionID, options)
      default:
        return assertNever(event)
    }
  }

  private adaptSessionCreated(info: OpencodeSessionInfo, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    if (this.externalSessionId === info.id) return []
    this.externalSessionId = info.id
    return [{
      event: { type: 'sdk_session', sdkSessionId: info.id },
      metadata: this.createMetadata({
        sessionID: info.id,
        occurredAt: info.time?.created,
        ...options,
      }),
    }]
  }

  private adaptSessionStatus(
    status: OpencodeSessionStatus,
    sessionID: string,
    options: OpencodeAdaptOptions,
  ): AdaptedRuntimeEvent[] {
    if (status.type === 'retry') {
      return [{
        event: {
          type: 'retry_scheduled',
          attempt: status.attempt,
          maxAttempts: status.attempt,
          reason: status.message,
          delayMs: 0,
        },
        metadata: this.createMetadata({ sessionID, ...options }),
      }]
    }
    if (status.type === 'idle') return this.adaptSessionIdle(sessionID, options)
    return []
  }

  private adaptSessionIdle(sessionID: string, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    if (!this.promptSent) return []
    if (this.stopState) {
      return [{
        event: {
          type: 'run_stopped',
          reason: this.stopState.reason,
          stoppedBy: this.stopState.stoppedBy,
        },
        metadata: this.createMetadata({ sessionID, ...options }),
      }]
    }
    return [{
      event: {
        type: 'run_completed',
        resultSubtype: 'success',
        terminalReason: 'completed',
        usage: this.lastUsage,
        sdkSessionId: this.externalSessionId ?? sessionID,
      },
      metadata: this.createMetadata({ sessionID, ...options }),
    }]
  }

  private adaptSessionError(
    sessionID: string | undefined,
    error: OpencodeRuntimeError | undefined,
    options: OpencodeAdaptOptions,
  ): AdaptedRuntimeEvent[] {
    if (isOpencodeAbortError(error)) {
      this.markStopped('user_abort', 'user')
      return [{
        event: { type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' },
        metadata: this.createMetadata({ sessionID, ...options }),
      }]
    }
    const mapped = mapOpencodeRuntimeError(error)
    return [{
      event: { type: 'run_failed', error: mapped.error, recoverable: mapped.recoverable },
      metadata: this.createMetadata({ sessionID, ...options }),
    }]
  }

  private adaptMessageUpdated(info: OpencodeMessage, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    if (info.role === 'user') return []
    this.lastUsage = adaptMessageUsage(info)
    if (info.error) {
      return this.adaptSessionError(info.sessionID, info.error, options)
    }
    if (!hasUsage(info)) return []
    return [{
      event: { type: 'usage_updated', usage: this.lastUsage },
      metadata: this.createMetadata({
        sessionID: info.sessionID,
        messageID: info.id,
        occurredAt: info.time?.completed ?? info.time?.created,
        ...options,
      }),
    }]
  }

  private adaptPartUpdated(
    part: OpencodePart,
    delta: string | undefined,
    options: OpencodeAdaptOptions,
  ): AdaptedRuntimeEvent[] {
    switch (part.type) {
      case 'text':
        return this.adaptTextPart(part, delta, options)
      case 'reasoning':
        return this.adaptReasoningPart(part, options)
      case 'file':
        return []
      case 'tool':
        return this.adaptToolPart(part, options)
      case 'step-finish':
        return this.adaptStepFinishPart(part, options)
      case 'snapshot':
        return []
      case 'patch':
        return this.adaptPatchPart(part, options)
      case 'agent':
        return this.adaptAgentPart(part, options)
      case 'subtask':
        return this.adaptSubtaskPart(part, options)
      case 'retry':
        return this.adaptRetryPart(part, options)
      case 'compaction':
        return []
      default:
        return assertNever(part)
    }
  }

  private adaptTextPart(
    part: OpencodeTextPart,
    delta: string | undefined,
    options: OpencodeAdaptOptions,
  ): AdaptedRuntimeEvent[] {
    if (part.ignored) return []
    const events: AdaptedRuntimeEvent[] = []
    const update = updateTextMap(this.textByPartId, part.id, part.text, delta)
    const metadata = this.createMetadata({
      sessionID: part.sessionID,
      messageID: part.messageID,
      partID: part.id,
      occurredAt: part.time?.end ?? part.time?.start,
      ...options,
    })

    if (update.changed && update.appendOnly && update.delta.length > 0) {
      events.push({
        event: { type: 'assistant_delta', messageId: part.messageID, delta: update.delta },
        metadata,
      })
    } else if (update.changed && !update.appendOnly) {
      events.push({
        event: {
          type: 'assistant_message',
          messageId: part.messageID,
          contentBlocks: [{ type: 'text', text: part.text }],
          status: 'complete',
        },
        metadata,
      })
    }

    if (part.time?.end !== undefined && !this.completedTextParts.has(part.id)) {
      this.completedTextParts.add(part.id)
      events.push({
        event: {
          type: 'assistant_message',
          messageId: part.messageID,
          contentBlocks: [{ type: 'text', text: part.text }],
          status: 'complete',
        },
        metadata,
      })
    }
    return events
  }

  private adaptReasoningPart(part: OpencodeReasoningPart, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    const metadata = this.createMetadata({
      sessionID: part.sessionID,
      messageID: part.messageID,
      partID: part.id,
      occurredAt: part.time?.end ?? part.time?.start,
      ...options,
    })
    const events = this.ensureTaskStarted(part.id, 'opencode reasoning', metadata)
    const update = updateTextMap(this.taskTextById, part.id, part.text)
    if (update.changed && part.text.length > 0) {
      events.push({ event: { type: 'agent_task_progress', taskId: part.id, message: part.text }, metadata })
    }
    if (part.time?.end !== undefined) {
      events.push(...this.completeTask(part.id, 'completed', part.text, metadata))
    }
    return events
  }

  private adaptToolPart(part: OpencodeToolPart, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    const toolCallId = part.callID || part.id
    const state = part.state
    const metadata = this.createMetadata({
      sessionID: part.sessionID,
      messageID: part.messageID,
      partID: part.id,
      occurredAt: getToolStateOccurredAt(state),
      ...options,
    })
    const events = this.ensureToolStarted(toolCallId, part.tool, summarizeToolInput(state), riskForTool(part.tool), metadata)

    if (state.status === 'running') {
      events.push({
        event: {
          type: 'tool_progress',
          toolCallId,
          message: state.title ?? `${part.tool} 执行中`,
        },
        metadata,
      })
    }
    if (state.status === 'completed' && !this.completedTools.has(toolCallId)) {
      this.completedTools.add(toolCallId)
      events.push({
        event: {
          type: 'tool_completed',
          toolCallId,
          status: 'success',
          outputSummary: summarizeCompletedToolState(state),
        },
        metadata,
      })
    }
    if (state.status === 'error' && !this.completedTools.has(toolCallId)) {
      this.completedTools.add(toolCallId)
      events.push({
        event: {
          type: 'tool_completed',
          toolCallId,
          status: 'error',
          outputSummary: state.error,
        },
        metadata,
      })
    }
    return events
  }

  private adaptStepFinishPart(part: OpencodeStepFinishPart, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    this.lastUsage = adaptStepUsage(part)
    return [{
      event: { type: 'usage_updated', usage: this.lastUsage },
      metadata: this.createMetadata({
        sessionID: part.sessionID,
        messageID: part.messageID,
        partID: part.id,
        ...options,
      }),
    }]
  }

  private adaptPatchPart(part: OpencodePatchPart, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    const metadata = this.createMetadata({
      sessionID: part.sessionID,
      messageID: part.messageID,
      partID: part.id,
      ...options,
    })
    const events = this.ensureToolStarted(
      part.id,
      'PatchApply',
      safeStringify({ hash: part.hash, files: part.files }),
      'normal',
      metadata,
    )
    if (!this.completedTools.has(part.id)) {
      this.completedTools.add(part.id)
      events.push({
        event: {
          type: 'tool_completed',
          toolCallId: part.id,
          status: 'success',
          outputSummary: part.files.join('\n'),
        },
        metadata,
      })
    }
    return events
  }

  private adaptAgentPart(part: OpencodeAgentPart, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    const metadata = this.createMetadata({
      sessionID: part.sessionID,
      messageID: part.messageID,
      partID: part.id,
      ...options,
    })
    return [
      ...this.ensureTaskStarted(part.id, `opencode agent: ${part.name}`, metadata),
      { event: { type: 'agent_task_progress', taskId: part.id, message: part.source?.value ?? part.name }, metadata },
      ...this.completeTask(part.id, 'completed', part.name, metadata),
    ]
  }

  private adaptSubtaskPart(part: OpencodeSubtaskPart, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    const metadata = this.createMetadata({
      sessionID: part.sessionID,
      messageID: part.messageID,
      partID: part.id,
      ...options,
    })
    return [
      ...this.ensureTaskStarted(part.id, `opencode subtask: ${part.agent}`, metadata),
      { event: { type: 'agent_task_progress', taskId: part.id, message: part.prompt }, metadata },
      ...this.completeTask(part.id, 'completed', part.description, metadata),
    ]
  }

  private adaptRetryPart(part: OpencodeRetryPart, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    return [{
      event: {
        type: 'retry_scheduled',
        attempt: part.attempt,
        maxAttempts: part.attempt,
        reason: part.error.data.message,
        delayMs: 0,
      },
      metadata: this.createMetadata({
        sessionID: part.sessionID,
        messageID: part.messageID,
        partID: part.id,
        occurredAt: part.time.created,
        ...options,
      }),
    }]
  }

  private adaptPermissionUpdated(permission: OpencodePermission, options: OpencodeAdaptOptions): AdaptedRuntimeEvent[] {
    const metadata = this.createMetadata({
      sessionID: permission.sessionID,
      messageID: permission.messageID,
      partID: permission.callID,
      occurredAt: permission.time?.created,
      ...options,
    })
    const inputSummary = permission.title || summarizePermissionPattern(permission.pattern) || permission.type
    const command = getStringRecordValue(permission.metadata, 'command')
    const cwd = getStringRecordValue(permission.metadata, 'cwd')
    const toolInput = buildPermissionToolInput(permission)
    const hasPreview = inputSummary.length > 0 || command !== undefined || permission.pattern !== undefined
    const scopeOptions: Array<'once' | 'session'> = hasPreview ? ['once', 'session'] : ['once']
    const riskLevel = riskForTool(permission.type)
    return [{
      event: {
        type: 'permission_requested',
        requestId: permission.id,
        toolName: permission.type,
        riskLevel,
        inputSummary,
        scopeOptions,
        request: {
          requestId: permission.id,
          sessionId: this.context.sessionId,
          runtimeKind: 'opencode',
          toolName: permission.type,
          toolInput,
          description: inputSummary,
          ...(command ? { command } : {}),
          ...(cwd ? { cwd } : {}),
          dangerLevel: riskLevel,
          riskLabel: formatOpencodeRiskLabel(permission.type, riskLevel),
          scopeOptions,
          sdkDisplayName: permission.type,
          sdkTitle: permission.title,
          sdkDescription: inputSummary,
        },
      },
      metadata,
    }]
  }

  private adaptPermissionReplied(
    properties: Extract<OpencodeRawEvent, { type: 'permission.replied' }>['properties'],
    options: OpencodeAdaptOptions,
  ): AdaptedRuntimeEvent[] {
    const allowed = properties.response === 'once' || properties.response === 'always'
    const scope = properties.response === 'always' ? 'session' : properties.response === 'once' ? 'once' : undefined
    return [{
      event: {
        type: 'permission_resolved',
        requestId: properties.permissionID,
        decision: allowed ? 'allowed' : 'denied',
        decidedBy: 'user',
        ...(scope ? { scope } : {}),
      },
      metadata: this.createMetadata({
        sessionID: properties.sessionID,
        ...options,
      }),
    }]
  }

  private adaptTodoUpdated(
    todos: OpencodeTodo[],
    sessionID: string,
    options: OpencodeAdaptOptions,
  ): AdaptedRuntimeEvent[] {
    const metadata = this.createMetadata({ sessionID, ...options })
    const events: AdaptedRuntimeEvent[] = []
    for (const todo of todos) {
      const existing = this.todoStates.get(todo.id)
      if (!existing) {
        events.push(...this.ensureTaskStarted(todo.id, todo.content, metadata))
      }
      const changed = !existing || existing.content !== todo.content || existing.status !== todo.status
      if (changed) {
        events.push({
          event: {
            type: 'agent_task_progress',
            taskId: todo.id,
            message: `${todo.status}: ${todo.content}`,
          },
          metadata,
        })
      }

      const nextState: OpencodeTodoState = existing ?? {
        content: todo.content,
        status: todo.status,
        completedEventWritten: false,
      }
      nextState.content = todo.content
      nextState.status = todo.status
      this.todoStates.set(todo.id, nextState)

      if (todo.status === 'completed' && !nextState.completedEventWritten) {
        events.push(...this.completeTask(todo.id, 'completed', todo.content, metadata))
        nextState.completedEventWritten = true
      }
      if (todo.status === 'cancelled' && !nextState.completedEventWritten) {
        events.push(...this.completeTask(todo.id, 'stopped', todo.content, metadata))
        nextState.completedEventWritten = true
      }
    }
    return events
  }

  private ensureToolStarted(
    toolCallId: string,
    name: string,
    inputSummary: string,
    riskLevel: AgentRuntimeRiskLevel,
    metadata: AgentRuntimeEventMetadata,
  ): AdaptedRuntimeEvent[] {
    if (this.startedTools.has(toolCallId)) return []
    this.startedTools.add(toolCallId)
    return [{
      event: {
        type: 'tool_started',
        toolCallId,
        name,
        inputSummary,
        riskLevel,
      },
      metadata,
    }]
  }

  private ensureTaskStarted(
    taskId: string,
    description: string,
    metadata: AgentRuntimeEventMetadata,
  ): AdaptedRuntimeEvent[] {
    if (this.startedTasks.has(taskId)) return []
    this.startedTasks.add(taskId)
    return [{ event: { type: 'agent_task_started', taskId, description }, metadata }]
  }

  private completeTask(
    taskId: string,
    status: Extract<AgentRuntimeEvent, { type: 'agent_task_completed' }>['status'],
    summary: string,
    metadata: AgentRuntimeEventMetadata,
  ): AdaptedRuntimeEvent[] {
    if (this.completedTasks.has(taskId)) return []
    this.completedTasks.add(taskId)
    return [{ event: { type: 'agent_task_completed', taskId, status, summary }, metadata }]
  }

  private createEnvelope(item: AdaptedRuntimeEvent): AgentStreamEnvelope | null {
    const envelope = createAgentStreamEnvelope({
      sessionId: this.context.sessionId,
      runId: this.context.runId,
      sequence: this.context.nextSequence?.() ?? this.sequence++,
      createdAt: this.context.createdAt?.(),
      source: this.context.source ?? 'opencode_server',
      event: item.event,
      metadata: item.metadata,
    })
    const validation = validateAgentStreamEnvelope(envelope)
    if (!validation.ok) {
      console.warn(`[opencode EventAdapter] envelope 校验失败，已跳过: ${validation.errors.join('; ')}`)
      return null
    }
    return envelope
  }

  private createMetadata(input: OpencodeMetadataInput): AgentRuntimeEventMetadata {
    const sessionID = input.sessionID ?? this.externalSessionId
    return {
      runtimeKind: 'opencode',
      ...(sessionID ? { externalSessionId: sessionID } : {}),
      ...(input.messageID ? { externalMessageId: input.messageID } : {}),
      ...(input.partID ? { externalPartId: input.partID } : {}),
      ...(input.occurredAt !== undefined ? { occurredAt: numberToIso(input.occurredAt) } : {}),
      ...(input.recovered !== undefined ? { recovered: input.recovered } : {}),
    }
  }

  private captureSessionId(sessionID: string): void {
    if (!this.externalSessionId) this.externalSessionId = sessionID
  }

  private isRelevantEvent(event: OpencodeRawEvent): boolean {
    const sessionID = getOpencodeEventSessionId(event)
    if (!sessionID || !this.externalSessionId) return true
    return sessionID === this.externalSessionId
  }
}

function unwrapOpencodeEvent(input: OpencodeAdapterInput): OpencodeRawEvent {
  if ('payload' in input) return input.payload
  return input
}

function getOpencodeEventSessionId(event: OpencodeRawEvent): string | undefined {
  switch (event.type) {
    case 'server.connected':
      return undefined
    case 'session.created':
      return event.properties.info.id
    case 'session.status':
    case 'session.idle':
      return event.properties.sessionID
    case 'session.error':
      return event.properties.sessionID
    case 'message.updated':
      return event.properties.info.sessionID
    case 'message.part.updated':
      return event.properties.part.sessionID
    case 'permission.updated':
      return event.properties.sessionID
    case 'permission.replied':
      return event.properties.sessionID
    case 'todo.updated':
      return event.properties.sessionID
    default:
      return assertNever(event)
  }
}

function createOpencodeEventKey(event: OpencodeRawEvent, options: OpencodeAdaptOptions): string {
  const recovered = options.recovered ? ':recovered' : ''
  if (event.id) return `${event.id}${recovered}`
  if (event.type === 'message.part.updated') {
    const part = event.properties.part
    return [
      event.type,
      part.sessionID,
      part.messageID,
      part.id,
      part.type,
      event.properties.delta ?? '',
      hashString(safeStringify(part)),
      recovered,
    ].join(':')
  }
  return `${event.type}:${hashString(safeStringify(event.properties))}${recovered}`
}

function updateTextMap(values: Map<string, string>, itemId: string, nextText: string, delta?: string): OpencodeTextUpdate {
  const previous = values.get(itemId) ?? ''
  values.set(itemId, nextText)
  if (previous === nextText) return { changed: false, appendOnly: true, delta: '' }
  if (nextText.startsWith(previous)) {
    return { changed: true, appendOnly: true, delta: nextText.slice(previous.length) }
  }
  if (delta && `${previous}${delta}` === nextText) {
    return { changed: true, appendOnly: true, delta }
  }
  return { changed: true, appendOnly: false, delta: nextText }
}

function adaptMessageUsage(info: OpencodeAssistantMessage): AgentRuntimeUsagePayload {
  return {
    inputTokens: info.tokens?.input,
    outputTokens: info.tokens?.output,
    reasoningOutputTokens: info.tokens?.reasoning,
    cacheReadTokens: info.tokens?.cache.read,
    cacheCreationTokens: info.tokens?.cache.write,
    costUsd: info.cost,
  }
}

function hasUsage(info: OpencodeAssistantMessage): boolean {
  return info.tokens !== undefined || info.cost !== undefined
}

function adaptStepUsage(part: OpencodeStepFinishPart): AgentRuntimeUsagePayload {
  return {
    inputTokens: part.tokens.input,
    outputTokens: part.tokens.output,
    reasoningOutputTokens: part.tokens.reasoning,
    cacheReadTokens: part.tokens.cache.read,
    cacheCreationTokens: part.tokens.cache.write,
    costUsd: part.cost,
  }
}

function getToolStateOccurredAt(state: OpencodeToolState): number | undefined {
  if (state.status === 'pending') return undefined
  return state.time.end ?? state.time.start
}

function summarizeToolInput(state: OpencodeToolState): string {
  if (state.status === 'pending') return state.raw || safeStringify(state.input)
  return safeStringify(state.input)
}

function summarizeCompletedToolState(state: OpencodeToolStateCompleted): string {
  return [state.title, state.output].filter((part) => part.length > 0).join('\n')
}

function riskForTool(tool: string): AgentRuntimeRiskLevel {
  const normalized = tool.toLowerCase()
  if (
    normalized.includes('bash')
    || normalized.includes('edit')
    || normalized.includes('write')
    || normalized.includes('delete')
    || normalized.includes('patch')
    || normalized.includes('external')
  ) {
    return 'dangerous'
  }
  if (normalized.includes('read') || normalized.includes('grep') || normalized.includes('glob')) {
    return 'safe'
  }
  return 'normal'
}

function formatOpencodeRiskLabel(tool: string, riskLevel: AgentRuntimeRiskLevel): string {
  const normalized = tool.toLowerCase()
  if (normalized.includes('bash')) return 'Shell 命令'
  if (normalized.includes('edit') || normalized.includes('write') || normalized.includes('patch')) return '文件写入'
  if (normalized.includes('web')) return '网络访问'
  if (normalized.includes('mcp')) return 'MCP 工具'
  if (normalized.includes('external')) return '外部目录'
  if (riskLevel === 'safe') return '只读操作'
  if (riskLevel === 'dangerous') return '高风险操作'
  return '需要确认'
}

function buildPermissionToolInput(permission: OpencodePermission): OpencodeRecord {
  return {
    ...permission.metadata,
    ...(permission.pattern !== undefined ? { pattern: permission.pattern } : {}),
    ...(permission.callID ? { callID: permission.callID } : {}),
    messageID: permission.messageID,
  }
}

function summarizePermissionPattern(pattern: string | string[] | undefined): string {
  if (Array.isArray(pattern)) return pattern.join(', ')
  return pattern ?? ''
}

function getStringRecordValue(record: OpencodeRecord, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function isOpencodeAbortError(error: OpencodeRuntimeError | undefined): boolean {
  if (!error) return false
  if (error.name === 'MessageAbortedError') return true
  if ('data' in error && isRecord(error.data) && typeof error.data.message === 'string') {
    return /abort|aborted|cancelled|canceled/i.test(error.data.message)
  }
  return false
}

function mapOpencodeRuntimeError(error: OpencodeRuntimeError | undefined): { error: AgentRuntimeErrorPayload; recoverable: boolean } {
  if (!error) {
    return {
      recoverable: true,
      error: {
        code: 'opencode_session_error',
        title: 'opencode 会话错误',
        message: 'opencode session emitted an unknown error',
        retryable: true,
      },
    }
  }
  switch (error.name) {
    case 'ProviderAuthError':
      return {
        recoverable: true,
        error: {
          code: 'opencode_provider_auth_error',
          title: 'opencode Provider 鉴权失败',
          message: error.data.message,
          retryable: false,
          details: [`provider=${error.data.providerID}`],
        },
      }
    case 'UnknownError':
      return {
        recoverable: false,
        error: {
          code: 'opencode_unknown_error',
          title: 'opencode 运行失败',
          message: error.data.message,
          retryable: false,
        },
      }
    case 'MessageOutputLengthError':
      return {
        recoverable: false,
        error: {
          code: 'opencode_output_length_exceeded',
          title: 'opencode 输出超出长度限制',
          message: 'opencode message exceeded the model output length limit',
          retryable: false,
          details: [safeStringify(error.data)],
        },
      }
    case 'MessageAbortedError':
      return {
        recoverable: true,
        error: {
          code: 'opencode_message_aborted',
          title: 'opencode 已停止',
          message: error.data.message,
          retryable: false,
        },
      }
    case 'APIError':
      return {
        recoverable: error.data.isRetryable,
        error: {
          code: `opencode_api_error_${error.data.statusCode ?? 'unknown'}`,
          title: 'opencode API 请求失败',
          message: error.data.message,
          retryable: error.data.isRetryable,
          ...(error.data.responseBody ? { details: [truncateText(error.data.responseBody)] } : {}),
        },
      }
    default:
      return assertNever(error)
  }
}

function numberToIso(value: number): string {
  const milliseconds = value < 10_000_000_000 ? value * 1000 : value
  return new Date(milliseconds).toISOString()
}

function hashString(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash).toString(36)
}

function truncateText(value: string, maxLength = 1000): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function isRecord(value: unknown): value is OpencodeRecord {
  return typeof value === 'object' && value !== null
}

function assertNever(value: never): never {
  throw new Error(`未支持的 opencode event/part: ${safeStringify(value)}`)
}

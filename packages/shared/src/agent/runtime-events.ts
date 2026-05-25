import type {
  AgentEvent,
  AgentEventUsage,
  AgentStreamPayload,
  AgentRuntimeRunnerMode,
  CodingAgentRuntimeKind,
  AskUserRequest,
  DangerLevel,
  ExitPlanModeRequest,
  PermissionRequest,
  CodeInsightsEvent,
  CodeInsightsPermissionMode,
  RetryAttempt,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKToolProgressMessage,
  SDKUserMessage,
  SDKMessage,
  TypedError,
} from '../types/agent'

export const AGENT_RUNTIME_EVENTS_SCHEMA_VERSION = 1

export const agentRuntimeEventsV2 = {
  enabled: false,
} as const

export type AgentEventSource =
  | 'claude_sdk'
  | 'codex_sdk'
  | 'codex_cli'
  | 'codeinsights'
  | 'permission_service'
  | 'ask_user_service'
  | 'runtime_service'
  | 'event_log'

type LegacyAgentEventSource = 'rv_insights'

export type AgentRuntimeRiskLevel = DangerLevel

export interface AgentRuntimeErrorPayload {
  code: string
  title: string
  message: string
  retryable: boolean
  details?: string[]
  originalError?: string
}

export interface AgentRuntimeUsagePayload {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  cacheTokens?: number
  reasoningOutputTokens?: number
  costUsd?: number
  contextWindow?: number
}

export type AgentRuntimeEvent =
  | { type: 'run_started'; model: string; cwd: string; permissionMode: CodeInsightsPermissionMode; runtimeHash: string; runnerMode?: AgentRuntimeRunnerMode; runtimeKind?: CodingAgentRuntimeKind }
  | { type: 'sdk_session'; sdkSessionId: string; resumeFrom?: string }
  | { type: 'assistant_delta'; messageId: string; delta: string; parentToolUseId?: string }
  | { type: 'assistant_message'; messageId: string; contentBlocks: unknown[]; status: 'complete' | 'error'; parentToolUseId?: string }
  | { type: 'tool_started'; toolCallId: string; name: string; inputSummary: string; riskLevel: AgentRuntimeRiskLevel; parentToolUseId?: string }
  | { type: 'tool_progress'; toolCallId: string; message: string; progress?: number }
  | { type: 'tool_completed'; toolCallId: string; status: 'success' | 'error' | 'denied' | 'stopped'; outputSummary: string }
  | { type: 'permission_requested'; requestId: string; toolName: string; riskLevel: AgentRuntimeRiskLevel; inputSummary: string; scopeOptions: string[]; request?: PermissionRequest }
  | { type: 'permission_resolved'; requestId: string; decision: 'allowed' | 'denied'; decidedBy: 'user' | 'policy'; scope?: string }
  | { type: 'ask_user_requested'; requestId: string; prompt: string; options?: string[]; request?: AskUserRequest }
  | { type: 'ask_user_resolved'; requestId: string; response: string; answeredBy: 'user' | 'system' }
  | { type: 'plan_mode_entered'; requestId?: string; reason?: string; request?: ExitPlanModeRequest }
  | { type: 'plan_mode_exited'; requestId?: string; decision: 'approved' | 'denied' | 'feedback' | 'cancelled'; summary?: string }
  | { type: 'usage_updated'; usage: AgentRuntimeUsagePayload }
  | { type: 'retry_scheduled'; attempt: number; maxAttempts: number; reason: string; delayMs: number }
  | { type: 'retry_attempt'; attemptData: RetryAttempt }
  | { type: 'retry_cleared' }
  | { type: 'retry_failed'; attemptData: RetryAttempt }
  | { type: 'compact_started' }
  | { type: 'compact_completed' }
  | { type: 'prompt_suggestion'; suggestion: string }
  | { type: 'agent_task_started'; taskId: string; description: string; toolCallId?: string }
  | { type: 'agent_task_progress'; taskId: string; message: string; usage?: AgentRuntimeUsagePayload }
  | { type: 'agent_task_completed'; taskId: string; status: 'completed' | 'failed' | 'stopped'; summary: string }
  | { type: 'run_completed'; resultSubtype: string; terminalReason?: string; usage: AgentRuntimeUsagePayload; sdkSessionId?: string }
  | { type: 'run_failed'; error: AgentRuntimeErrorPayload; recoverable: boolean }
  | { type: 'run_stopped'; reason: 'user_abort' | 'system_abort' | 'timeout' | 'unknown'; stoppedBy: 'user' | 'system' }

export interface AgentStreamEnvelope {
  schemaVersion: typeof AGENT_RUNTIME_EVENTS_SCHEMA_VERSION
  sessionId: string
  runId: string
  sequence: number
  createdAt: string
  source: AgentEventSource
  event: AgentRuntimeEvent
}

export interface AgentStreamEnvelopeInput {
  sessionId: string
  runId: string
  sequence: number
  source: AgentEventSource
  event: AgentRuntimeEvent
  createdAt?: string
}

export interface AgentRuntimeValidationResult {
  ok: boolean
  errors: string[]
}

export function createAgentStreamEnvelope(input: AgentStreamEnvelopeInput): AgentStreamEnvelope {
  return {
    schemaVersion: AGENT_RUNTIME_EVENTS_SCHEMA_VERSION,
    sessionId: input.sessionId,
    runId: input.runId,
    sequence: input.sequence,
    createdAt: input.createdAt ?? new Date().toISOString(),
    source: input.source,
    event: input.event,
  }
}

export function isAgentRuntimeTerminalEvent(event: AgentRuntimeEvent): boolean {
  return event.type === 'run_completed' || event.type === 'run_failed' || event.type === 'run_stopped'
}

export function validateAgentStreamEnvelope(envelope: AgentStreamEnvelope): AgentRuntimeValidationResult {
  const errors: string[] = []
  if (envelope.schemaVersion !== AGENT_RUNTIME_EVENTS_SCHEMA_VERSION) errors.push('schemaVersion 必须为 1')
  if (!envelope.sessionId.trim()) errors.push('sessionId 不能为空')
  if (!envelope.runId.trim()) errors.push('runId 不能为空')
  if (!Number.isInteger(envelope.sequence) || envelope.sequence < 0) errors.push('sequence 必须是非负整数')
  if (Number.isNaN(Date.parse(envelope.createdAt))) errors.push('createdAt 必须是有效 ISO 时间')
  if (!isKnownEventSource(envelope.source)) errors.push('source 不在允许范围内')
  errors.push(...validateAgentRuntimeEvent(envelope.event))
  return { ok: errors.length === 0, errors }
}

export function isAgentStreamEnvelope(value: unknown): value is AgentStreamEnvelope {
  if (!isRecord(value) || !isRecord(value.event)) return false
  return validateAgentStreamEnvelope(value as unknown as AgentStreamEnvelope).ok
}

export function validateAgentRuntimeEvent(event: AgentRuntimeEvent): string[] {
  const errors: string[] = []
  if (!isRecord(event) || typeof event.type !== 'string') return ['event.type 不能为空']

  switch (event.type) {
    case 'run_started':
      requireString(errors, event.model, 'run_started.model')
      requireString(errors, event.cwd, 'run_started.cwd')
      requireString(errors, event.permissionMode, 'run_started.permissionMode')
      requireString(errors, event.runtimeHash, 'run_started.runtimeHash')
      if (
        event.runnerMode !== undefined
        && event.runnerMode !== 'runner-v2'
        && event.runnerMode !== 'legacy'
      ) {
        errors.push('run_started.runnerMode 非法')
      }
      if (
        event.runtimeKind !== undefined
        && event.runtimeKind !== 'claude-code'
        && event.runtimeKind !== 'codex'
      ) {
        errors.push('run_started.runtimeKind 非法')
      }
      break
    case 'sdk_session':
      requireString(errors, event.sdkSessionId, 'sdk_session.sdkSessionId')
      break
    case 'assistant_delta':
      requireString(errors, event.messageId, 'assistant_delta.messageId')
      requireString(errors, event.delta, 'assistant_delta.delta')
      break
    case 'assistant_message':
      requireString(errors, event.messageId, 'assistant_message.messageId')
      if (!Array.isArray(event.contentBlocks)) errors.push('assistant_message.contentBlocks 必须是数组')
      if (event.status !== 'complete' && event.status !== 'error') errors.push('assistant_message.status 非法')
      break
    case 'tool_started':
      requireString(errors, event.toolCallId, 'tool_started.toolCallId')
      requireString(errors, event.name, 'tool_started.name')
      requireString(errors, event.inputSummary, 'tool_started.inputSummary')
      break
    case 'tool_progress':
      requireString(errors, event.toolCallId, 'tool_progress.toolCallId')
      requireString(errors, event.message, 'tool_progress.message')
      break
    case 'tool_completed':
      requireString(errors, event.toolCallId, 'tool_completed.toolCallId')
      requireString(errors, event.status, 'tool_completed.status')
      requireString(errors, event.outputSummary, 'tool_completed.outputSummary')
      break
    case 'permission_requested':
      requireString(errors, event.requestId, 'permission_requested.requestId')
      requireString(errors, event.toolName, 'permission_requested.toolName')
      requireString(errors, event.inputSummary, 'permission_requested.inputSummary')
      if (!Array.isArray(event.scopeOptions)) errors.push('permission_requested.scopeOptions 必须是数组')
      break
    case 'permission_resolved':
      requireString(errors, event.requestId, 'permission_resolved.requestId')
      if (event.decision !== 'allowed' && event.decision !== 'denied') errors.push('permission_resolved.decision 非法')
      break
    case 'ask_user_requested':
      requireString(errors, event.requestId, 'ask_user_requested.requestId')
      requireString(errors, event.prompt, 'ask_user_requested.prompt')
      break
    case 'ask_user_resolved':
      requireString(errors, event.requestId, 'ask_user_resolved.requestId')
      requireString(errors, event.response, 'ask_user_resolved.response')
      break
    case 'plan_mode_entered':
      break
    case 'plan_mode_exited':
      requireString(errors, event.decision, 'plan_mode_exited.decision')
      break
    case 'usage_updated':
      if (!isRecord(event.usage)) errors.push('usage_updated.usage 必须是对象')
      break
    case 'retry_scheduled':
      if (!Number.isInteger(event.attempt) || event.attempt < 1) errors.push('retry_scheduled.attempt 必须大于 0')
      if (!Number.isInteger(event.maxAttempts) || event.maxAttempts < event.attempt) errors.push('retry_scheduled.maxAttempts 必须不小于 attempt')
      requireString(errors, event.reason, 'retry_scheduled.reason')
      if (!Number.isFinite(event.delayMs) || event.delayMs < 0) errors.push('retry_scheduled.delayMs 必须是非负数')
      break
    case 'retry_attempt':
    case 'retry_failed':
      if (!isRecord(event.attemptData)) errors.push(`${event.type}.attemptData 必须是对象`)
      break
    case 'retry_cleared':
      break
    case 'compact_started':
    case 'compact_completed':
      break
    case 'prompt_suggestion':
      requireString(errors, event.suggestion, 'prompt_suggestion.suggestion')
      break
    case 'agent_task_started':
      requireString(errors, event.taskId, 'agent_task_started.taskId')
      requireString(errors, event.description, 'agent_task_started.description')
      break
    case 'agent_task_progress':
      requireString(errors, event.taskId, 'agent_task_progress.taskId')
      requireString(errors, event.message, 'agent_task_progress.message')
      break
    case 'agent_task_completed':
      requireString(errors, event.taskId, 'agent_task_completed.taskId')
      requireString(errors, event.status, 'agent_task_completed.status')
      requireString(errors, event.summary, 'agent_task_completed.summary')
      break
    case 'run_completed':
      requireString(errors, event.resultSubtype, 'run_completed.resultSubtype')
      if (!isRecord(event.usage)) errors.push('run_completed.usage 必须是对象')
      break
    case 'run_failed':
      if (!isRecord(event.error)) errors.push('run_failed.error 必须是对象')
      break
    case 'run_stopped':
      requireString(errors, event.reason, 'run_stopped.reason')
      requireString(errors, event.stoppedBy, 'run_stopped.stoppedBy')
      break
    default:
      errors.push(`未知事件类型: ${(event as { type: string }).type}`)
      break
  }

  return errors
}

export function adaptAgentEventToRuntimeEvent(event: AgentEvent): AgentRuntimeEvent[] {
  switch (event.type) {
    case 'text_delta':
      return [{ type: 'assistant_delta', messageId: event.turnId ?? 'current', delta: event.text, parentToolUseId: event.parentToolUseId }]
    case 'text_complete':
      return [{ type: 'assistant_message', messageId: event.turnId ?? 'current', contentBlocks: [{ type: 'text', text: event.text }], status: 'complete', parentToolUseId: event.parentToolUseId }]
    case 'tool_start':
      return [{ type: 'tool_started', toolCallId: event.toolUseId, name: event.toolName, inputSummary: summarizeRecord(event.input), riskLevel: 'normal', parentToolUseId: event.parentToolUseId }]
    case 'tool_result':
      return [{ type: 'tool_completed', toolCallId: event.toolUseId, status: event.isError ? 'error' : 'success', outputSummary: event.result }]
    case 'permission_request':
      return [adaptPermissionRequest(event.request)]
    case 'permission_resolved':
      return [{ type: 'permission_resolved', requestId: event.requestId, decision: event.behavior === 'allow' ? 'allowed' : 'denied', decidedBy: 'user' }]
    case 'ask_user_request':
      return [adaptAskUserRequest(event.request)]
    case 'ask_user_resolved':
      return [{ type: 'ask_user_resolved', requestId: event.requestId, response: '', answeredBy: 'user' }]
    case 'exit_plan_mode_request':
      return [{ type: 'plan_mode_entered', requestId: event.request.requestId, reason: summarizeRecord(event.request.toolInput), request: event.request }]
    case 'exit_plan_mode_resolved':
      return [{ type: 'plan_mode_exited', requestId: event.requestId, decision: 'approved' }]
    case 'enter_plan_mode':
      return [{ type: 'plan_mode_entered', reason: event.sessionId }]
    case 'usage_update':
      return [{ type: 'usage_updated', usage: adaptUsage(event.usage) }]
    case 'complete':
      return [{ type: 'run_completed', resultSubtype: 'success', terminalReason: event.stopReason, usage: adaptUsage(event.usage) }]
    case 'typed_error':
      return [{ type: 'run_failed', error: adaptTypedError(event.error), recoverable: event.error.canRetry }]
    case 'error':
      return [{ type: 'run_failed', error: { code: 'unknown_error', title: 'Agent 运行失败', message: event.message, retryable: false }, recoverable: false }]
    case 'retrying':
      return [{ type: 'retry_scheduled', attempt: event.attempt, maxAttempts: event.maxAttempts, reason: event.reason, delayMs: event.delaySeconds * 1000 }]
    case 'retry_attempt':
      return [{ type: 'retry_attempt', attemptData: event.attemptData }]
    case 'retry_cleared':
      return [{ type: 'retry_cleared' }]
    case 'retry_failed':
      return [{ type: 'retry_failed', attemptData: event.finalAttempt }]
    case 'compacting':
      return [{ type: 'compact_started' }]
    case 'compact_complete':
      return [{ type: 'compact_completed' }]
    case 'prompt_suggestion':
      return [{ type: 'prompt_suggestion', suggestion: event.suggestion }]
    case 'task_started':
      return [{ type: 'agent_task_started', taskId: event.taskId, description: event.description, toolCallId: event.toolUseId }]
    case 'task_progress':
      return [{ type: 'agent_task_progress', taskId: event.taskId ?? event.toolUseId, message: event.description ?? event.lastToolName ?? '任务执行中', usage: adaptTaskUsage(event.usage) }]
    case 'task_notification':
      return [{ type: 'agent_task_completed', taskId: event.taskId, status: event.status, summary: event.summary }]
    default:
      return []
  }
}

export function adaptAgentStreamPayloadToRuntimeEvents(payload: AgentStreamPayload): AgentRuntimeEvent[] {
  if (payload.kind === 'codeinsights_event' || payload.kind === 'rv_insights_event') {
    return adaptCodeInsightsEventToRuntimeEvent(payload.event)
  }
  return adaptSDKMessageToRuntimeEvents(payload.message)
}

export function adaptSDKMessageToRuntimeEvents(message: SDKMessage): AgentRuntimeEvent[] {
  if (isSDKAssistantMessage(message)) {
    const events: AgentRuntimeEvent[] = []
    const content = message.message.content
    for (const block of content) {
      if (isSDKTextBlock(block)) {
        events.push({ type: 'assistant_message', messageId: message.uuid ?? 'assistant', contentBlocks: [block], status: 'complete', parentToolUseId: message.parent_tool_use_id ?? undefined })
      }
      if (isSDKToolUseBlock(block)) {
        events.push({ type: 'tool_started', toolCallId: block.id, name: block.name, inputSummary: summarizeRecord(block.input), riskLevel: 'normal', parentToolUseId: message.parent_tool_use_id ?? undefined })
      }
    }
    return events
  }
  if (isSDKUserMessage(message)) {
    const content = message.message?.content ?? []
    return content.flatMap((block) => {
      if (!isSDKToolResultBlock(block)) return []
      return [{ type: 'tool_completed', toolCallId: block.tool_use_id, status: block.is_error ? 'error' : 'success', outputSummary: summarizeUnknown(block.content) } satisfies AgentRuntimeEvent]
    })
  }
  if (isSDKResultMessage(message)) {
    const usage = adaptUsage({
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens,
      cacheCreationTokens: message.usage.cache_creation_input_tokens,
      costUsd: message.total_cost_usd,
    })
    const usageEvent: AgentRuntimeEvent = { type: 'usage_updated', usage }
    if (message.subtype === 'success') return [usageEvent, { type: 'run_completed', resultSubtype: message.subtype, terminalReason: 'completed', usage, sdkSessionId: message.session_id }]
    return [usageEvent, { type: 'run_failed', error: { code: message.subtype, title: 'Agent 运行失败', message: message.errors?.join('\n') ?? message.subtype, retryable: false }, recoverable: false }]
  }
  if (isSDKSystemMessage(message) && message.subtype === 'init' && typeof message.session_id === 'string') {
    return [{ type: 'sdk_session', sdkSessionId: message.session_id }]
  }
  if (isSDKToolProgressMessage(message)) {
    return [{ type: 'tool_progress', toolCallId: message.tool_use_id, message: `${message.tool_name} 执行中` }]
  }
  if (message.type === 'prompt_suggestion' && typeof message.suggestion === 'string') {
    return [{ type: 'prompt_suggestion', suggestion: message.suggestion }]
  }
  return []
}

export function adaptCodeInsightsEventToRuntimeEvent(event: CodeInsightsEvent): AgentRuntimeEvent[] {
  switch (event.type) {
    case 'permission_request':
      return [adaptPermissionRequest(event.request)]
    case 'permission_resolved':
      return [{ type: 'permission_resolved', requestId: event.requestId, decision: event.behavior === 'allow' ? 'allowed' : 'denied', decidedBy: 'user' }]
    case 'ask_user_request':
      return [adaptAskUserRequest(event.request)]
    case 'ask_user_resolved':
      return [{ type: 'ask_user_resolved', requestId: event.requestId, response: '', answeredBy: 'user' }]
    case 'exit_plan_mode_request':
      return [{ type: 'plan_mode_entered', requestId: event.request.requestId, reason: summarizeRecord(event.request.toolInput), request: event.request }]
    case 'exit_plan_mode_resolved':
      return [{ type: 'plan_mode_exited', requestId: event.requestId, decision: 'approved' }]
    case 'enter_plan_mode':
      return [{ type: 'plan_mode_entered', reason: event.sessionId }]
    case 'retry':
      if (event.status === 'starting' && event.attempt != null) {
        return [{ type: 'retry_scheduled', attempt: event.attempt, maxAttempts: event.maxAttempts ?? event.attempt, reason: event.reason ?? '', delayMs: (event.delaySeconds ?? 0) * 1000 }]
      }
      if (event.status === 'attempt' && event.attemptData) return [{ type: 'retry_attempt', attemptData: event.attemptData }]
      if (event.status === 'cleared') return [{ type: 'retry_cleared' }]
      if (event.status === 'failed' && event.attemptData) return [{ type: 'retry_failed', attemptData: event.attemptData }]
      return []
    case 'model_resolved':
      return []
    case 'waiting_resume':
      return []
    case 'resume_start':
      return []
    case 'permission_mode_changed':
      return []
  }
}

export interface AgentRuntimeReplayState {
  appliedSequences: number[]
  textByMessageId: Record<string, string>
  tools: Record<string, { name: string; status: 'running' | 'success' | 'error' | 'denied' | 'stopped'; outputSummary?: string }>
  pendingPermissionRequestIds: string[]
  pendingPermissionRequests: PermissionRequest[]
  pendingAskUserRequestIds: string[]
  pendingAskUserRequests: AskUserRequest[]
  pendingExitPlanRequestIds: string[]
  pendingExitPlanRequests: ExitPlanModeRequest[]
  planModeActive: boolean
  usage?: AgentRuntimeUsagePayload
  terminal?: AgentRuntimeEvent
}

export function createInitialAgentRuntimeReplayState(): AgentRuntimeReplayState {
  return {
    appliedSequences: [],
    textByMessageId: {},
    tools: {},
    pendingPermissionRequestIds: [],
    pendingPermissionRequests: [],
    pendingAskUserRequestIds: [],
    pendingAskUserRequests: [],
    pendingExitPlanRequestIds: [],
    pendingExitPlanRequests: [],
    planModeActive: false,
  }
}

export function replayAgentStreamEnvelopes(envelopes: AgentStreamEnvelope[]): AgentRuntimeReplayState {
  return envelopes
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .reduce(applyAgentStreamEnvelope, createInitialAgentRuntimeReplayState())
}

export function applyAgentStreamEnvelope(state: AgentRuntimeReplayState, envelope: AgentStreamEnvelope): AgentRuntimeReplayState {
  if (state.appliedSequences.includes(envelope.sequence)) return state
  const next: AgentRuntimeReplayState = {
    ...state,
    appliedSequences: [...state.appliedSequences, envelope.sequence],
    textByMessageId: { ...state.textByMessageId },
    tools: { ...state.tools },
    pendingPermissionRequestIds: [...state.pendingPermissionRequestIds],
    pendingPermissionRequests: [...state.pendingPermissionRequests],
    pendingAskUserRequestIds: [...state.pendingAskUserRequestIds],
    pendingAskUserRequests: [...state.pendingAskUserRequests],
    pendingExitPlanRequestIds: [...state.pendingExitPlanRequestIds],
    pendingExitPlanRequests: [...state.pendingExitPlanRequests],
    planModeActive: state.planModeActive,
  }
  const event = envelope.event
  if (event.type === 'assistant_delta') {
    next.textByMessageId[event.messageId] = `${next.textByMessageId[event.messageId] ?? ''}${event.delta}`
  } else if (event.type === 'assistant_message') {
    next.textByMessageId[event.messageId] = event.contentBlocks.map(summarizeUnknown).join('')
  } else if (event.type === 'tool_started') {
    next.tools[event.toolCallId] = { name: event.name, status: 'running' }
  } else if (event.type === 'tool_completed') {
    const existing = next.tools[event.toolCallId] ?? { name: event.toolCallId, status: 'running' as const }
    next.tools[event.toolCallId] = { ...existing, status: event.status, outputSummary: event.outputSummary }
  } else if (event.type === 'permission_requested') {
    next.pendingPermissionRequestIds = addUnique(next.pendingPermissionRequestIds, event.requestId)
    if (event.request && !next.pendingPermissionRequests.some((request) => request.requestId === event.request?.requestId)) {
      next.pendingPermissionRequests = [...next.pendingPermissionRequests, event.request]
    }
  } else if (event.type === 'permission_resolved') {
    next.pendingPermissionRequestIds = next.pendingPermissionRequestIds.filter((id) => id !== event.requestId)
    next.pendingPermissionRequests = next.pendingPermissionRequests.filter((request) => request.requestId !== event.requestId)
  } else if (event.type === 'ask_user_requested') {
    next.pendingAskUserRequestIds = addUnique(next.pendingAskUserRequestIds, event.requestId)
    if (event.request && !next.pendingAskUserRequests.some((request) => request.requestId === event.request?.requestId)) {
      next.pendingAskUserRequests = [...next.pendingAskUserRequests, event.request]
    }
  } else if (event.type === 'ask_user_resolved') {
    next.pendingAskUserRequestIds = next.pendingAskUserRequestIds.filter((id) => id !== event.requestId)
    next.pendingAskUserRequests = next.pendingAskUserRequests.filter((request) => request.requestId !== event.requestId)
  } else if (event.type === 'plan_mode_entered') {
    if (event.request) {
      next.pendingExitPlanRequestIds = addUnique(next.pendingExitPlanRequestIds, event.request.requestId)
      if (!next.pendingExitPlanRequests.some((request) => request.requestId === event.request?.requestId)) {
        next.pendingExitPlanRequests = [...next.pendingExitPlanRequests, event.request]
      }
    } else {
      next.planModeActive = true
    }
  } else if (event.type === 'plan_mode_exited') {
    next.planModeActive = false
    if (event.requestId) {
      next.pendingExitPlanRequestIds = next.pendingExitPlanRequestIds.filter((id) => id !== event.requestId)
      next.pendingExitPlanRequests = next.pendingExitPlanRequests.filter((request) => request.requestId !== event.requestId)
    }
  } else if (event.type === 'usage_updated') {
    next.usage = event.usage
  } else if (isAgentRuntimeTerminalEvent(event)) {
    next.terminal = event
  }
  return next
}

function adaptPermissionRequest(request: PermissionRequest): AgentRuntimeEvent {
  return {
    type: 'permission_requested',
    requestId: request.requestId,
    toolName: request.toolName,
    riskLevel: request.dangerLevel,
    inputSummary: request.sdkDescription ?? request.description,
    scopeOptions: ['once', 'session'],
    request,
  }
}

function adaptAskUserRequest(request: AskUserRequest): AgentRuntimeEvent {
  return {
    type: 'ask_user_requested',
    requestId: request.requestId,
    prompt: request.questions.map((question) => question.question).join('\n'),
    options: request.questions.flatMap((question) => question.options.map((option) => option.label)),
    request,
  }
}

function adaptTypedError(error: TypedError): AgentRuntimeErrorPayload {
  return {
    code: error.code,
    title: error.title,
    message: error.message,
    retryable: error.canRetry,
    details: error.details,
    originalError: error.originalError,
  }
}

function adaptUsage(usage?: Partial<AgentEventUsage>): AgentRuntimeUsagePayload {
  if (!usage) return {}
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    reasoningOutputTokens: usage.reasoningOutputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheCreationTokens: usage.cacheCreationTokens,
    costUsd: usage.costUsd,
    contextWindow: usage.contextWindow,
  }
}

function adaptTaskUsage(usage?: { totalTokens: number }): AgentRuntimeUsagePayload | undefined {
  if (!usage) return undefined
  return { inputTokens: usage.totalTokens }
}

function isKnownEventSource(source: string): source is AgentEventSource | LegacyAgentEventSource {
  return ['claude_sdk', 'codex_sdk', 'codex_cli', 'codeinsights', 'rv_insights', 'permission_service', 'ask_user_service', 'runtime_service', 'event_log'].includes(source)
}

function isSDKAssistantMessage(message: SDKMessage): message is SDKAssistantMessage {
  return message.type === 'assistant' && isRecord(message.message) && Array.isArray(message.message.content)
}

function isSDKUserMessage(message: SDKMessage): message is SDKUserMessage {
  return message.type === 'user'
}

function isSDKResultMessage(message: SDKMessage): message is SDKResultMessage {
  return message.type === 'result' && isRecord(message.usage)
}

function isSDKSystemMessage(message: SDKMessage): message is SDKSystemMessage {
  return message.type === 'system'
}

function isSDKToolProgressMessage(message: SDKMessage): message is SDKToolProgressMessage {
  return message.type === 'tool_progress' && typeof message.tool_use_id === 'string' && typeof message.tool_name === 'string'
}

function isSDKTextBlock(block: unknown): block is { type: 'text'; text: string } {
  return isRecord(block) && block.type === 'text' && typeof block.text === 'string'
}

function isSDKToolUseBlock(block: unknown): block is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } {
  return isRecord(block) && block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string' && isRecord(block.input)
}

function isSDKToolResultBlock(block: unknown): block is { type: 'tool_result'; tool_use_id: string; content?: unknown; is_error?: boolean } {
  return isRecord(block) && block.type === 'tool_result' && typeof block.tool_use_id === 'string'
}

function requireString(errors: string[], value: unknown, field: string): void {
  if (typeof value !== 'string' || value.length === 0) errors.push(`${field} 不能为空`)
}

function summarizeRecord(input: Record<string, unknown>): string {
  return JSON.stringify(input)
}

function summarizeUnknown(input: unknown): string {
  if (typeof input === 'string') return input
  if (isRecord(input) && typeof input.text === 'string') return input.text
  return JSON.stringify(input ?? '')
}

function addUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

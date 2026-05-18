import {
  adaptSDKMessageToRuntimeEvents,
  createAgentStreamEnvelope,
  isAgentRuntimeTerminalEvent,
  validateAgentStreamEnvelope,
  type AgentEventSource,
  type AgentRuntimeEvent,
  type AgentStreamEnvelope,
  type SDKMessage,
} from '@rv-insights/shared'

export interface AgentSdkMessageConversionContext {
  sessionId: string
  runId: string
  nextSequence: () => number
  source?: AgentEventSource
  createdAt?: () => string
}

export function convertSdkMessageToRuntimeEnvelopes(
  message: SDKMessage,
  context: AgentSdkMessageConversionContext,
): AgentStreamEnvelope[] {
  return adaptSDKMessageToRuntimeEvents(message)
    .map((event) => createRuntimeEnvelope(event, context.source ?? 'claude_sdk', context))
    .filter((envelope): envelope is AgentStreamEnvelope => envelope !== null)
}

export function createRuntimeEnvelope(
  event: AgentRuntimeEvent,
  source: AgentEventSource,
  context: AgentSdkMessageConversionContext,
): AgentStreamEnvelope | null {
  const envelope = createAgentStreamEnvelope({
    sessionId: context.sessionId,
    runId: context.runId,
    sequence: context.nextSequence(),
    createdAt: context.createdAt?.(),
    source,
    event,
  })
  const validation = validateAgentStreamEnvelope(envelope)
  if (!validation.ok) {
    console.warn(`[Agent Runner] envelope 校验失败，已跳过: ${validation.errors.join('; ')}`)
    return null
  }
  return envelope
}

export function isRuntimeTerminalEnvelope(envelope: AgentStreamEnvelope): boolean {
  return isAgentRuntimeTerminalEvent(envelope.event)
}

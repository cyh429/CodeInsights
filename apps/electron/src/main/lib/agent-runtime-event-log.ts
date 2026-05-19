import { randomUUID } from 'node:crypto'
import {
  adaptAgentStreamPayloadToRuntimeEvents,
  adaptSDKMessageToRuntimeEvents,
  createAgentStreamEnvelope,
  isAgentRuntimeTerminalEvent,
  replayAgentStreamEnvelopes,
  validateAgentStreamEnvelope,
  type AgentEventSource,
  type AgentRuntimeEvent,
  type AgentRuntimeReplayState,
  type AgentStreamEnvelope,
  type AgentStreamPayload,
  type RVInsightsPermissionMode,
  type SDKMessage,
} from '@rv-insights/shared'
import { appendAgentRuntimeEvents, getAgentSessionRuntimeEvents } from './agent-session-manager'

export interface AgentRuntimeRunStartInput {
  sessionId: string
  model: string
  cwd: string
  permissionMode: RVInsightsPermissionMode
  runtimeHash?: string
  resumeFrom?: string
}

export interface AgentRuntimeEventLogWriter {
  readonly sessionId: string
  readonly runId: string
  appendRuntimeEvent(source: AgentEventSource, event: AgentRuntimeEvent): AgentStreamEnvelope | null
  appendSDKMessage(message: SDKMessage): AgentStreamEnvelope[]
  appendStreamPayload(payload: AgentStreamPayload): AgentStreamEnvelope[]
  completeIfMissing(event: Extract<AgentRuntimeEvent, { type: 'run_completed' | 'run_failed' | 'run_stopped' }>): AgentStreamEnvelope | null
  shadowCompare(label: string): void
}

interface ActiveWriterEntry {
  writer: AgentRuntimeEventLogWriter
}

const activeWriters = new Map<string, ActiveWriterEntry>()

export function startAgentRuntimeEventLogRun(input: AgentRuntimeRunStartInput): AgentRuntimeEventLogWriter {
  const writer = new JsonlAgentRuntimeEventLogWriter(input.sessionId)
  activeWriters.set(input.sessionId, { writer })
  writer.appendRuntimeEvent('runtime_service', {
    type: 'run_started',
    model: input.model,
    cwd: input.cwd,
    permissionMode: input.permissionMode,
    runtimeHash: input.runtimeHash ?? 'legacy-orchestrator',
  })
  if (input.resumeFrom) {
    writer.appendRuntimeEvent('runtime_service', {
      type: 'sdk_session',
      sdkSessionId: input.resumeFrom,
      resumeFrom: input.resumeFrom,
    })
  }
  return writer
}

export function getActiveAgentRuntimeEventLogWriter(sessionId: string): AgentRuntimeEventLogWriter | null {
  return activeWriters.get(sessionId)?.writer ?? null
}

export function finishAgentRuntimeEventLogRun(sessionId: string, writer: AgentRuntimeEventLogWriter | null | undefined): void {
  const active = activeWriters.get(sessionId)?.writer
  if (active && active === writer) {
    activeWriters.delete(sessionId)
  }
}

export function appendPermissionResolvedRuntimeEvent(
  sessionId: string,
  requestId: string,
  behavior: 'allow' | 'deny',
): void {
  getActiveAgentRuntimeEventLogWriter(sessionId)?.appendRuntimeEvent('permission_service', {
    type: 'permission_resolved',
    requestId,
    decision: behavior === 'allow' ? 'allowed' : 'denied',
    decidedBy: 'user',
  })
}

export function appendAskUserResolvedRuntimeEvent(
  sessionId: string,
  requestId: string,
  answers: Record<string, string>,
): void {
  getActiveAgentRuntimeEventLogWriter(sessionId)?.appendRuntimeEvent('ask_user_service', {
    type: 'ask_user_resolved',
    requestId,
    response: summarizeAnswers(answers),
    answeredBy: 'user',
  })
}

class JsonlAgentRuntimeEventLogWriter implements AgentRuntimeEventLogWriter {
  readonly runId = randomUUID()
  private nextSequence = 0
  private terminalWritten = false
  private sdkSessionIds = new Set<string>()
  private envelopes: AgentStreamEnvelope[] = []
  private replayState: AgentRuntimeReplayState | undefined

  constructor(readonly sessionId: string) {}

  appendRuntimeEvent(source: AgentEventSource, event: AgentRuntimeEvent): AgentStreamEnvelope | null {
    if (event.type === 'sdk_session') {
      if (this.sdkSessionIds.has(event.sdkSessionId)) {
        console.warn(`[Agent EventLog] 重复 sdk_session，已跳过: sessionId=${this.sessionId}, runId=${this.runId}, sdkSessionId=${event.sdkSessionId}`)
        return null
      }
      this.sdkSessionIds.add(event.sdkSessionId)
    }
    if (isAgentRuntimeTerminalEvent(event)) {
      if (this.terminalWritten) {
        console.warn(`[Agent EventLog] 终态重复，已跳过: sessionId=${this.sessionId}, runId=${this.runId}, type=${event.type}`)
        return null
      }
      this.terminalWritten = true
    }

    const envelope = createAgentStreamEnvelope({
      sessionId: this.sessionId,
      runId: this.runId,
      sequence: this.nextSequence,
      source,
      event,
    })
    const validation = validateAgentStreamEnvelope(envelope)
    if (!validation.ok) {
      console.warn(`[Agent EventLog] envelope 校验失败，已跳过: ${validation.errors.join('; ')}`)
      return null
    }

    this.nextSequence += 1
    appendAgentRuntimeEvents(this.sessionId, [envelope])
    this.updateShadowReplay(envelope)
    return envelope
  }

  appendSDKMessage(message: SDKMessage): AgentStreamEnvelope[] {
    return adaptSDKMessageToRuntimeEvents(message)
      .map((event) => this.appendRuntimeEvent('claude_sdk', event))
      .filter((envelope): envelope is AgentStreamEnvelope => envelope !== null)
  }

  appendStreamPayload(payload: AgentStreamPayload): AgentStreamEnvelope[] {
    return adaptAgentStreamPayloadToRuntimeEvents(payload)
      .map((event) => this.appendRuntimeEvent(resolveSource(payload, event), event))
      .filter((envelope): envelope is AgentStreamEnvelope => envelope !== null)
  }

  completeIfMissing(event: Extract<AgentRuntimeEvent, { type: 'run_completed' | 'run_failed' | 'run_stopped' }>): AgentStreamEnvelope | null {
    return this.appendRuntimeEvent('runtime_service', event)
  }

  shadowCompare(label: string): void {
    const events = getAgentSessionRuntimeEvents(this.sessionId).filter((event) => event.runId === this.runId)
    const replayed = replayAgentStreamEnvelopes(events)
    const expectedSequences = events.map((event) => event.sequence).sort((a, b) => a - b)
    const missingSequences = findMissingSequences(expectedSequences)
    if (missingSequences.length > 0) {
      console.warn(`[Agent EventLog] shadow compare 发现 sequence 缺口: ${label}, sessionId=${this.sessionId}, runId=${this.runId}, missing=${missingSequences.join(',')}`)
    }

    const inMemoryTerminal = this.replayState?.terminal?.type ?? 'none'
    const replayedTerminal = replayed.terminal?.type ?? 'none'
    if (inMemoryTerminal !== replayedTerminal) {
      console.warn(`[Agent EventLog] shadow compare 终态不一致: ${label}, sessionId=${this.sessionId}, runId=${this.runId}, memory=${inMemoryTerminal}, persisted=${replayedTerminal}`)
    }
  }

  private updateShadowReplay(envelope: AgentStreamEnvelope): void {
    this.envelopes.push(envelope)
    this.replayState = replayAgentStreamEnvelopes(this.envelopes)
  }
}

function findMissingSequences(sequences: number[]): number[] {
  if (sequences.length === 0) return []
  const missing: number[] = []
  const max = sequences[sequences.length - 1]!
  const existing = new Set(sequences)
  for (let sequence = 0; sequence <= max; sequence += 1) {
    if (!existing.has(sequence)) missing.push(sequence)
  }
  return missing
}

function summarizeAnswers(answers: Record<string, string>): string {
  return Object.entries(answers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

function resolveSource(payload: AgentStreamPayload, event: AgentRuntimeEvent): AgentEventSource {
  if (payload.kind === 'sdk_message') return 'claude_sdk'
  if (event.type.startsWith('permission_')) return 'permission_service'
  if (event.type.startsWith('ask_user_')) return 'ask_user_service'
  return 'rv_insights'
}

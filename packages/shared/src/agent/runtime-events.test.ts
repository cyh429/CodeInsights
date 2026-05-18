import { describe, expect, test } from 'bun:test'

import type { AgentEvent, AgentStreamPayload, RVInsightsEvent, SDKMessage } from '../types/agent'
import {
  adaptAgentEventToRuntimeEvent,
  adaptAgentStreamPayloadToRuntimeEvents,
  agentRuntimeEventsV2,
  createAgentStreamEnvelope,
  isAgentStreamEnvelope,
  replayAgentStreamEnvelopes,
  validateAgentStreamEnvelope,
  type AgentRuntimeEvent,
  type AgentStreamEnvelope,
} from './runtime-events'

const sessionId = 'session-1'
const runId = 'run-1'
const createdAt = '2026-05-18T00:00:00.000Z'

function envelope(sequence: number, event: AgentRuntimeEvent): AgentStreamEnvelope {
  return createAgentStreamEnvelope({
    sessionId,
    runId,
    sequence,
    createdAt,
    source: 'claude_sdk',
    event,
  })
}

const sdkMessageFixture: SDKMessage[] = [
  { type: 'system', subtype: 'init', session_id: 'sdk-session-1' },
  {
    type: 'assistant',
    uuid: 'assistant-1',
    parent_tool_use_id: null,
    session_id: 'sdk-session-1',
    message: {
      content: [
        { type: 'text', text: '你好' },
        { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/tmp/a.txt' } },
      ],
    },
  },
  {
    type: 'user',
    parent_tool_use_id: null,
    session_id: 'sdk-session-1',
    message: {
      content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: '文件内容', is_error: false }],
    },
  },
  {
    type: 'result',
    subtype: 'success',
    session_id: 'sdk-session-1',
    terminal_reason: 'completed',
    usage: { input_tokens: 10, output_tokens: 4, cache_read_input_tokens: 2 },
    total_cost_usd: 0.001,
  },
]

const envelopeFixture: AgentStreamEnvelope[] = [
  envelope(0, { type: 'run_started', model: 'deepseek-v4-flash', cwd: '/tmp/workspace', permissionMode: 'auto', runtimeHash: 'hash-1' }),
  envelope(1, { type: 'assistant_delta', messageId: 'msg-1', delta: '你' }),
  envelope(2, { type: 'assistant_delta', messageId: 'msg-1', delta: '好' }),
  envelope(3, { type: 'tool_started', toolCallId: 'tool-1', name: 'Read', inputSummary: '{"file_path":"/tmp/a.txt"}', riskLevel: 'safe' }),
  envelope(4, { type: 'tool_completed', toolCallId: 'tool-1', status: 'success', outputSummary: '文件内容' }),
  envelope(5, { type: 'permission_requested', requestId: 'permission-1', toolName: 'Write', riskLevel: 'dangerous', inputSummary: '写入文件', scopeOptions: ['once', 'session'] }),
  envelope(6, { type: 'permission_resolved', requestId: 'permission-1', decision: 'allowed', decidedBy: 'user', scope: 'once' }),
  envelope(7, { type: 'ask_user_requested', requestId: 'ask-1', prompt: '选择方案', options: ['A', 'B'] }),
  envelope(8, { type: 'ask_user_resolved', requestId: 'ask-1', response: 'A', answeredBy: 'user' }),
  envelope(9, { type: 'usage_updated', usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 2, costUsd: 0.001 } }),
  envelope(10, { type: 'run_completed', resultSubtype: 'success', terminalReason: 'completed', usage: { inputTokens: 10, outputTokens: 4 }, sdkSessionId: 'sdk-session-1' }),
]

describe('Agent runtime event contract', () => {
  test('feature flag defaults off', () => {
    expect(agentRuntimeEventsV2.enabled).toBe(false)
  })

  test('validates AgentStreamEnvelope fixtures', () => {
    for (const item of envelopeFixture) {
      expect(validateAgentStreamEnvelope(item)).toEqual({ ok: true, errors: [] })
      expect(isAgentStreamEnvelope(item)).toBe(true)
    }
  })

  test('rejects invalid envelope shape', () => {
    const invalid = { ...envelopeFixture[0]!, sessionId: '', sequence: -1, createdAt: 'not-a-date' }
    const result = validateAgentStreamEnvelope(invalid)
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
  })

  test('adapts SDKMessage fixture into runtime events', () => {
    const events = sdkMessageFixture.flatMap((message) => adaptAgentStreamPayloadToRuntimeEvents({ kind: 'sdk_message', message }))
    expect(events.map((event) => event.type)).toEqual([
      'sdk_session',
      'assistant_message',
      'tool_started',
      'tool_completed',
      'usage_updated',
      'run_completed',
    ])
  })

  test('adapts legacy RV events for permission and AskUser', () => {
    const legacyEvents: RVInsightsEvent[] = [
      {
        type: 'permission_request',
        request: {
          requestId: 'permission-1',
          sessionId,
          toolName: 'Write',
          toolInput: { file_path: '/tmp/a.txt' },
          description: '写入文件',
          dangerLevel: 'dangerous',
        },
      },
      {
        type: 'ask_user_request',
        request: {
          requestId: 'ask-1',
          sessionId,
          questions: [{ question: '选择方案', options: [{ label: 'A' }, { label: 'B' }] }],
          toolInput: {},
        },
      },
    ]

    const payloads: AgentStreamPayload[] = legacyEvents.map((event) => ({ kind: 'rv_insights_event', event }))
    const runtimeTypes = payloads.flatMap(adaptAgentStreamPayloadToRuntimeEvents).map((event) => event.type)
    expect(runtimeTypes).toEqual(['permission_requested', 'ask_user_requested'])
  })

  test('adapts legacy AgentEvent usage, complete and error directly', () => {
    const legacyEvents: AgentEvent[] = [
      { type: 'usage_update', usage: { inputTokens: 10, outputTokens: 4 } },
      { type: 'complete', stopReason: 'completed', usage: { inputTokens: 10, outputTokens: 4 } },
      { type: 'error', message: '失败' },
    ]
    const runtimeTypes = legacyEvents.flatMap(adaptAgentEventToRuntimeEvent).map((event) => event.type)
    expect(runtimeTypes).toEqual(['usage_updated', 'run_completed', 'run_failed'])
  })

  test('replays envelopes with idempotent sequence handling', () => {
    const state = replayAgentStreamEnvelopes([...envelopeFixture, envelopeFixture[2]!])
    expect(state.textByMessageId['msg-1']).toBe('你好')
    expect(state.tools['tool-1']).toEqual({ name: 'Read', status: 'success', outputSummary: '文件内容' })
    expect(state.pendingPermissionRequestIds).toEqual([])
    expect(state.pendingAskUserRequestIds).toEqual([])
    expect(state.usage).toEqual({ inputTokens: 10, outputTokens: 4, cacheReadTokens: 2, costUsd: 0.001 })
    expect(state.terminal?.type).toBe('run_completed')
    expect(state.appliedSequences).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  test('adapts legacy text and tool events directly', () => {
    const events = adaptAgentEventToRuntimeEvent({ type: 'tool_result', toolUseId: 'tool-1', result: 'ok', isError: false })
    expect(events).toEqual([{ type: 'tool_completed', toolCallId: 'tool-1', status: 'success', outputSummary: 'ok' }])
  })
})

import { describe, expect, test } from 'bun:test'

import type { AgentEvent, AgentStreamPayload, CodeInsightsEvent, SDKMessage } from '../types/agent'
import {
  adaptAgentEventToRuntimeEvent,
  adaptAgentStreamPayloadToRuntimeEvents,
  adaptCodeInsightsEventToRuntimeEvent,
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
  envelope(5, { type: 'permission_requested', requestId: 'permission-1', toolName: 'Write', riskLevel: 'dangerous', inputSummary: '写入文件', scopeOptions: ['once', 'session'], request: { requestId: 'permission-1', sessionId, toolName: 'Write', toolInput: { file_path: '/tmp/a.txt' }, description: '写入文件', dangerLevel: 'dangerous' } }),
  envelope(6, { type: 'permission_resolved', requestId: 'permission-1', decision: 'allowed', decidedBy: 'user', scope: 'once' }),
  envelope(7, { type: 'ask_user_requested', requestId: 'ask-1', prompt: '选择方案', options: ['A', 'B'], request: { requestId: 'ask-1', sessionId, questions: [{ question: '选择方案', options: [{ label: 'A' }, { label: 'B' }] }], toolInput: {} } }),
  envelope(8, { type: 'ask_user_resolved', requestId: 'ask-1', response: 'A', answeredBy: 'user' }),
  envelope(9, { type: 'plan_mode_entered', requestId: 'plan-1', reason: '计划审批', request: { requestId: 'plan-1', sessionId, toolInput: {}, allowedPrompts: [] } }),
  envelope(10, { type: 'retry_scheduled', attempt: 1, maxAttempts: 3, reason: 'retrying', delayMs: 1000 }),
  envelope(11, { type: 'retry_attempt', attemptData: { attempt: 1, timestamp: 1, reason: 'retrying', errorMessage: 'a', delaySeconds: 1 } }),
  envelope(12, { type: 'retry_cleared' }),
  envelope(13, { type: 'retry_failed', attemptData: { attempt: 2, timestamp: 2, reason: 'failed', errorMessage: 'b', delaySeconds: 2 } }),
  envelope(14, { type: 'plan_mode_exited', requestId: 'plan-1', decision: 'approved', summary: '批准' }),
  envelope(15, { type: 'usage_updated', usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 2, costUsd: 0.001 } }),
  envelope(16, { type: 'run_completed', resultSubtype: 'success', terminalReason: 'completed', usage: { inputTokens: 10, outputTokens: 4 }, sdkSessionId: 'sdk-session-1' }),
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

  test('accepts legacy rv_insights event source for persisted envelopes', () => {
    const legacyEnvelope = {
      ...envelope(1, { type: 'assistant_delta', messageId: 'msg-legacy', delta: '旧事件' }),
      source: 'rv_insights',
    } as unknown as AgentStreamEnvelope

    expect(validateAgentStreamEnvelope(legacyEnvelope)).toEqual({ ok: true, errors: [] })
    expect(isAgentStreamEnvelope(legacyEnvelope)).toBe(true)
  })

  test('accepts Codex event sources and run_started runtime kind', () => {
    const codexEnvelope = createAgentStreamEnvelope({
      sessionId,
      runId,
      sequence: 1,
      createdAt,
      source: 'codex_sdk',
      event: {
        type: 'run_started',
        model: 'gpt-5.1-codex',
        cwd: '/tmp/workspace',
        permissionMode: 'auto',
        runtimeHash: 'hash-codex',
        runtimeKind: 'codex',
      },
    })

    expect(validateAgentStreamEnvelope(codexEnvelope)).toEqual({ ok: true, errors: [] })
    expect(validateAgentStreamEnvelope({ ...codexEnvelope, source: 'codex_cli' })).toEqual({ ok: true, errors: [] })
  })

  test('accepts opencode event sources and runtime metadata', () => {
    const opencodeEnvelope = createAgentStreamEnvelope({
      sessionId,
      runId,
      sequence: 2,
      createdAt,
      source: 'opencode_server',
      metadata: {
        runtimeKind: 'opencode',
        externalSessionId: 'ses_opencode',
        externalMessageId: 'msg_opencode',
        externalPartId: 'part_opencode',
        occurredAt: createdAt,
      },
      event: {
        type: 'run_started',
        model: 'codeinsights-openai-compatible/gpt-5.1-codex',
        cwd: '/tmp/workspace',
        permissionMode: 'auto',
        runtimeHash: 'hash-opencode',
        runtimeKind: 'opencode',
        agent: 'build',
      },
    })

    expect(validateAgentStreamEnvelope(opencodeEnvelope)).toEqual({ ok: true, errors: [] })
    expect(validateAgentStreamEnvelope({ ...opencodeEnvelope, source: 'opencode_cli' })).toEqual({ ok: true, errors: [] })
  })

  test('rejects invalid runtime metadata', () => {
    const invalid = createAgentStreamEnvelope({
      sessionId,
      runId,
      sequence: 3,
      createdAt,
      source: 'opencode_server',
      metadata: {
        runtimeKind: 'unknown-runtime',
        occurredAt: 'not-a-date',
      } as unknown as AgentStreamEnvelope['metadata'],
      event: { type: 'assistant_delta', messageId: 'msg-1', delta: 'x' },
    })

    const result = validateAgentStreamEnvelope(invalid)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('metadata.runtimeKind 非法')
    expect(result.errors).toContain('metadata.occurredAt 必须是有效 ISO 时间')
  })

  test('rejects invalid run_started runtime kind', () => {
    const invalid = envelope(1, {
      type: 'run_started',
      model: 'test',
      cwd: '/tmp/workspace',
      permissionMode: 'auto',
      runtimeHash: 'hash-1',
      runtimeKind: 'unknown-runtime',
    } as unknown as AgentRuntimeEvent)

    const result = validateAgentStreamEnvelope(invalid)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('run_started.runtimeKind 非法')
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
    const legacyEvents: CodeInsightsEvent[] = [
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

  test('adapts legacy retry lifecycle events', () => {
    const retryEvents: CodeInsightsEvent[] = [
      { type: 'retry', status: 'starting', attempt: 1, maxAttempts: 3, delaySeconds: 2, reason: 'network' },
      { type: 'retry', status: 'attempt', attemptData: { attempt: 1, timestamp: 1, reason: 'network', errorMessage: 'a', delaySeconds: 2 } },
      { type: 'retry', status: 'cleared' },
      { type: 'retry', status: 'failed', attemptData: { attempt: 2, timestamp: 2, reason: 'network', errorMessage: 'b', delaySeconds: 0 } },
    ]

    expect(retryEvents.flatMap(adaptCodeInsightsEventToRuntimeEvent).map((event) => event.type)).toEqual([
      'retry_scheduled',
      'retry_attempt',
      'retry_cleared',
      'retry_failed',
    ])
  })

  test('adapts legacy AgentEvent usage, complete and error directly', () => {
    const legacyEvents: AgentEvent[] = [
      { type: 'usage_update', usage: { inputTokens: 10, outputTokens: 4, reasoningOutputTokens: 2 } },
      { type: 'complete', stopReason: 'completed', usage: { inputTokens: 10, outputTokens: 4 } },
      { type: 'error', message: '失败' },
    ]
    const runtimeTypes = legacyEvents.flatMap(adaptAgentEventToRuntimeEvent).map((event) => event.type)
    expect(runtimeTypes).toEqual(['usage_updated', 'run_completed', 'run_failed'])
    expect(legacyEvents.flatMap(adaptAgentEventToRuntimeEvent)[0]).toEqual({
      type: 'usage_updated',
      usage: { inputTokens: 10, outputTokens: 4, reasoningOutputTokens: 2 },
    })
  })

  test('replays envelopes with idempotent sequence handling', () => {
    const state = replayAgentStreamEnvelopes([...envelopeFixture, envelopeFixture[2]!])
    expect(state.textByMessageId['msg-1']).toBe('你好')
    expect(state.tools['tool-1']).toEqual({ name: 'Read', status: 'success', outputSummary: '文件内容' })
    expect(state.pendingPermissionRequestIds).toEqual([])
    expect(state.pendingPermissionRequests).toEqual([])
    expect(state.pendingAskUserRequestIds).toEqual([])
    expect(state.pendingAskUserRequests).toEqual([])
    expect(state.pendingExitPlanRequestIds).toEqual([])
    expect(state.pendingExitPlanRequests).toEqual([])
    expect(state.planModeActive).toBe(false)
    expect(state.appliedSequences).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
    expect(state.usage).toEqual({ inputTokens: 10, outputTokens: 4, cacheReadTokens: 2, costUsd: 0.001 })
    expect(state.terminal?.type).toBe('run_completed')
  })

  test('replays unresolved pending interactions with original requests', () => {
    const state = replayAgentStreamEnvelopes(envelopeFixture.slice(0, 10))
    expect(state.pendingPermissionRequestIds).toEqual([])
    expect(state.pendingAskUserRequestIds).toEqual([])
    expect(state.pendingExitPlanRequestIds).toEqual(['plan-1'])
    expect(state.pendingExitPlanRequests[0]?.requestId).toBe('plan-1')

    const pendingState = replayAgentStreamEnvelopes([
      envelopeFixture[5]!,
      envelopeFixture[7]!,
      envelopeFixture[9]!,
    ])
    expect(pendingState.pendingPermissionRequests[0]?.toolName).toBe('Write')
    expect(pendingState.pendingAskUserRequests[0]?.questions[0]?.question).toBe('选择方案')
    expect(pendingState.pendingExitPlanRequests[0]?.requestId).toBe('plan-1')
    expect(pendingState.planModeActive).toBe(false)
  })

  test('supports retry lifecycle events', () => {
    const state = replayAgentStreamEnvelopes([
      envelope(0, { type: 'retry_scheduled', attempt: 1, maxAttempts: 3, reason: 'retrying', delayMs: 1000 }),
      envelope(1, { type: 'retry_attempt', attemptData: { attempt: 1, timestamp: 1, reason: 'retrying', errorMessage: 'a', delaySeconds: 1 } }),
      envelope(2, { type: 'retry_cleared' }),
      envelope(3, { type: 'retry_failed', attemptData: { attempt: 2, timestamp: 2, reason: 'failed', errorMessage: 'b', delaySeconds: 2 } }),
    ])
    expect(state.terminal).toBeUndefined()
    expect(state.appliedSequences).toEqual([0, 1, 2, 3])
  })

  test('adapts legacy text and tool events directly', () => {
    const events = adaptAgentEventToRuntimeEvent({ type: 'tool_result', toolUseId: 'tool-1', result: 'ok', isError: false })
    expect(events).toEqual([{ type: 'tool_completed', toolCallId: 'tool-1', status: 'success', outputSummary: 'ok' }])
  })
})

import { describe, expect, test } from 'bun:test'
import { createStore } from 'jotai/vanilla'
import { createAgentStreamEnvelope, type SDKMessage } from '@codeinsights/shared'
import type { AgentStreamState } from './agent-atoms'
import {
  agentAttachedDirectoriesMapAtom,
  agentSessionDraftsAtom,
  agentStreamingStatesAtom,
  applyAgentEvent,
  applyAgentStreamEnvelopeToState,
  createAgentStreamStateShadowSnapshot,
  liveMessagesMapAtom,
  sessionAttachedDirsFamily,
  sessionDraftFamily,
  sessionLiveMessagesFamily,
  sessionStreamingStateFamily,
} from './agent-atoms'

function createStreamState(model: string): AgentStreamState {
  return {
    running: false,
    content: '',
    toolActivities: [],
    teammates: [],
    model,
  }
}

function createUserMessage(text: string): SDKMessage {
  return {
    type: 'user',
    message: {
      content: [{ type: 'text', text }],
    },
    parent_tool_use_id: null,
    _createdAt: Date.now(),
  } as SDKMessage
}

describe('agent session scoped atoms', () => {
  test('无关 session 更新时保持当前 session 的派生引用稳定', () => {
    const store = createStore()
    const sessionAState = createStreamState('model-a')
    const sessionBState = createStreamState('model-b')

    store.set(agentStreamingStatesAtom, new Map([
      ['session-a', sessionAState],
      ['session-b', sessionBState],
    ]))

    const firstRead = store.get(sessionStreamingStateFamily('session-a'))

    store.set(agentStreamingStatesAtom, new Map([
      ['session-a', sessionAState],
      ['session-b', createStreamState('model-b-2')],
    ]))

    expect(store.get(sessionStreamingStateFamily('session-a'))).toBe(firstRead)
  })

  test('空 live messages、附加目录和草稿回退值保持稳定', () => {
    const store = createStore()

    const emptyLiveMessages = store.get(sessionLiveMessagesFamily('missing'))
    const emptyAttachedDirs = store.get(sessionAttachedDirsFamily('missing'))

    expect(store.get(sessionDraftFamily('missing'))).toBe('')

    store.set(liveMessagesMapAtom, new Map([
      ['other', [createUserMessage('hello')]],
    ]))
    store.set(agentAttachedDirectoriesMapAtom, new Map([
      ['other', ['/tmp/workspace']],
    ]))
    store.set(agentSessionDraftsAtom, new Map([
      ['other', 'draft'],
    ]))

    expect(store.get(sessionLiveMessagesFamily('missing'))).toBe(emptyLiveMessages)
    expect(store.get(sessionAttachedDirsFamily('missing'))).toBe(emptyAttachedDirs)
    expect(store.get(sessionDraftFamily('missing'))).toBe('')
  })
})

describe('agent runtime envelope reducer', () => {
  test('runtime envelope reducer keeps the same visible state as legacy event reducer', () => {
    const initial = createStreamState('deepseek-v4-flash')

    const legacyState = [
      { type: 'text_complete' as const, text: '你好', isIntermediate: false },
      { type: 'tool_start' as const, toolUseId: 'tool-1', toolName: 'Read', input: { file_path: '/tmp/a.txt' } },
      { type: 'tool_result' as const, toolUseId: 'tool-1', result: '文件内容', isError: false },
      { type: 'usage_update' as const, usage: { inputTokens: 10, outputTokens: 4 } },
    ].reduce(applyAgentEvent, initial)

    const envelopes = [
      createAgentStreamEnvelope({
        sessionId: 'session-a',
        runId: 'run-a',
        sequence: 0,
        source: 'claude_sdk',
        createdAt: '2026-05-18T00:00:00.000Z',
        event: { type: 'assistant_message', messageId: 'msg-1', contentBlocks: [{ type: 'text', text: '你好' }], status: 'complete' },
      }),
      createAgentStreamEnvelope({
        sessionId: 'session-a',
        runId: 'run-a',
        sequence: 1,
        source: 'claude_sdk',
        createdAt: '2026-05-18T00:00:00.000Z',
        event: { type: 'tool_started', toolCallId: 'tool-1', name: 'Read', inputSummary: '{"file_path":"/tmp/a.txt"}', riskLevel: 'safe' },
      }),
      createAgentStreamEnvelope({
        sessionId: 'session-a',
        runId: 'run-a',
        sequence: 2,
        source: 'claude_sdk',
        createdAt: '2026-05-18T00:00:00.000Z',
        event: { type: 'tool_completed', toolCallId: 'tool-1', status: 'success', outputSummary: '文件内容' },
      }),
      createAgentStreamEnvelope({
        sessionId: 'session-a',
        runId: 'run-a',
        sequence: 3,
        source: 'claude_sdk',
        createdAt: '2026-05-18T00:00:00.000Z',
        event: { type: 'usage_updated', usage: { inputTokens: 10, outputTokens: 4 } },
      }),
    ]
    const runtimeState = envelopes.reduce(applyAgentStreamEnvelopeToState, initial)

    expect(createAgentStreamStateShadowSnapshot(runtimeState)).toEqual(createAgentStreamStateShadowSnapshot(legacyState))
  })

  test('runtime envelope reducer preserves retry, compacting and teammate state', () => {
    const initial = { ...createStreamState('deepseek-v4-flash'), running: true }
    const attemptData = { attempt: 1, timestamp: 1, reason: 'network', errorMessage: 'a', delaySeconds: 1 }

    const legacyState = [
      { type: 'retrying' as const, attempt: 1, maxAttempts: 1, delaySeconds: 1, reason: 'network' },
      { type: 'retry_attempt' as const, attemptData },
      { type: 'retry_cleared' as const },
      { type: 'compacting' as const },
      { type: 'compact_complete' as const },
      { type: 'task_started' as const, taskId: 'task-1', toolUseId: 'tool-1', description: '检查代码' },
      { type: 'task_progress' as const, taskId: 'task-1', toolUseId: 'task-1', description: '读取文件', usage: { totalTokens: 0, toolUses: 0, durationMs: 0 } },
      { type: 'task_notification' as const, taskId: 'task-1', status: 'completed' as const, summary: '完成' },
    ].reduce(applyAgentEvent, initial)

    const envelopes = [
      createAgentStreamEnvelope({ sessionId: 'session-a', runId: 'run-a', sequence: 0, source: 'codeinsights', createdAt: '2026-05-18T00:00:00.000Z', event: { type: 'retry_scheduled', attempt: 1, maxAttempts: 3, reason: 'network', delayMs: 1000 } }),
      createAgentStreamEnvelope({ sessionId: 'session-a', runId: 'run-a', sequence: 1, source: 'codeinsights', createdAt: '2026-05-18T00:00:00.000Z', event: { type: 'retry_attempt', attemptData } }),
      createAgentStreamEnvelope({ sessionId: 'session-a', runId: 'run-a', sequence: 2, source: 'codeinsights', createdAt: '2026-05-18T00:00:00.000Z', event: { type: 'retry_cleared' } }),
      createAgentStreamEnvelope({ sessionId: 'session-a', runId: 'run-a', sequence: 3, source: 'claude_sdk', createdAt: '2026-05-18T00:00:00.000Z', event: { type: 'compact_started' } }),
      createAgentStreamEnvelope({ sessionId: 'session-a', runId: 'run-a', sequence: 4, source: 'claude_sdk', createdAt: '2026-05-18T00:00:00.000Z', event: { type: 'compact_completed' } }),
      createAgentStreamEnvelope({ sessionId: 'session-a', runId: 'run-a', sequence: 5, source: 'claude_sdk', createdAt: '2026-05-18T00:00:00.000Z', event: { type: 'agent_task_started', taskId: 'task-1', toolCallId: 'tool-1', description: '检查代码' } }),
      createAgentStreamEnvelope({ sessionId: 'session-a', runId: 'run-a', sequence: 6, source: 'claude_sdk', createdAt: '2026-05-18T00:00:00.000Z', event: { type: 'agent_task_progress', taskId: 'task-1', message: '读取文件', usage: { inputTokens: 0 } } }),
      createAgentStreamEnvelope({ sessionId: 'session-a', runId: 'run-a', sequence: 7, source: 'claude_sdk', createdAt: '2026-05-18T00:00:00.000Z', event: { type: 'agent_task_completed', taskId: 'task-1', status: 'completed', summary: '完成' } }),
    ]
    const runtimeState = envelopes.reduce(applyAgentStreamEnvelopeToState, initial)

    expect(createAgentStreamStateShadowSnapshot(runtimeState)).toEqual(createAgentStreamStateShadowSnapshot(legacyState))
    expect(runtimeState.retrying).toBeUndefined()
  })

  test('runtime retry_scheduled preserves maxAttempts when it differs from attempt', () => {
    const initial = { ...createStreamState('deepseek-v4-flash'), running: true }
    const runtimeState = applyAgentStreamEnvelopeToState(initial, createAgentStreamEnvelope({
      sessionId: 'session-a',
      runId: 'run-a',
      sequence: 0,
      source: 'codeinsights',
      createdAt: '2026-05-18T00:00:00.000Z',
      event: { type: 'retry_scheduled', attempt: 1, maxAttempts: 3, reason: 'network', delayMs: 1000 },
    }))

    expect(runtimeState.retrying?.currentAttempt).toBe(1)
    expect(runtimeState.retrying?.maxAttempts).toBe(3)
  })
})

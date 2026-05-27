import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  replayAgentStreamEnvelopes,
  validateAgentStreamEnvelope,
  type AgentRuntimeEvent,
  type AgentStreamEnvelope,
} from '@codeinsights/shared'
import {
  OPENCODE_EVENT_MAPPINGS,
  OpencodeEventAdapter,
  type OpencodeRawEvent,
} from './opencode-event-adapter'

const createdAt = '2026-05-27T00:00:00.000Z'
const fixtureRoot = new URL('./__fixtures__/opencode-events/', import.meta.url)

function readFixture(name: string): OpencodeRawEvent[] {
  const content = readFileSync(new URL(`${name}.jsonl`, fixtureRoot), 'utf8')
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OpencodeRawEvent)
}

function adaptFixture(name: string, options: { recovered?: boolean } = {}): AgentStreamEnvelope[] {
  const adapter = new OpencodeEventAdapter({
    sessionId: 'session-opencode',
    runId: `run-${name}`,
    createdAt: () => createdAt,
    promptSent: true,
  })
  return readFixture(name).flatMap((event) => adapter.adapt(event, options))
}

function adaptEvents(events: OpencodeRawEvent[]): AgentStreamEnvelope[] {
  const adapter = new OpencodeEventAdapter({
    sessionId: 'session-opencode',
    runId: 'run-direct',
    createdAt: () => createdAt,
    promptSent: true,
  })
  return events.flatMap((event) => adapter.adapt(event))
}

function runtimeEvents(envelopes: AgentStreamEnvelope[]): AgentRuntimeEvent[] {
  return envelopes.map((envelope) => envelope.event)
}

function eventsOfType<T extends AgentRuntimeEvent['type']>(
  events: AgentRuntimeEvent[],
  type: T,
): Array<Extract<AgentRuntimeEvent, { type: T }>> {
  return events.filter((event): event is Extract<AgentRuntimeEvent, { type: T }> => event.type === type)
}

describe('OpencodeEventAdapter', () => {
  test('声明覆盖 Phase 3 需要适配的 opencode event 类型', () => {
    expect(Object.keys(OPENCODE_EVENT_MAPPINGS).sort()).toEqual([
      'message.part.updated',
      'message.updated',
      'permission.replied',
      'permission.updated',
      'server.connected',
      'session.created',
      'session.error',
      'session.idle',
      'session.status',
      'todo.updated',
    ])
  })

  test('忽略 server.connected 与 user message，并将 session.created 映射为 sdk_session', () => {
    const events = runtimeEvents(adaptFixture('text-delta-snapshot'))

    expect(events[0]).toEqual({ type: 'sdk_session', sdkSessionId: 'ses_opencode_1' })
    expect(events.map((event) => event.type)).not.toContain('run_failed')
    expect(eventsOfType(events, 'assistant_delta')).toHaveLength(3)
    expect(eventsOfType(events, 'assistant_message')).toHaveLength(1)
  })

  test('将 text delta 与 completed snapshot 映射为不重复的 assistant transcript', () => {
    const envelopes = adaptFixture('text-delta-snapshot')
    const events = runtimeEvents(envelopes)

    expect(envelopes.every((envelope) => validateAgentStreamEnvelope(envelope).ok)).toBe(true)
    expect(envelopes.map((envelope) => envelope.source)).toEqual(envelopes.map(() => 'opencode_server'))
    expect(envelopes.every((envelope) => envelope.metadata?.runtimeKind === 'opencode')).toBe(true)
    expect(events.map((event) => event.type)).toEqual([
      'sdk_session',
      'assistant_delta',
      'assistant_delta',
      'assistant_delta',
      'assistant_message',
      'usage_updated',
      'run_completed',
    ])
    expect(eventsOfType(events, 'assistant_delta').map((event) => event.delta)).toEqual(['Hel', 'lo', ', opencode'])
    expect(eventsOfType(events, 'assistant_message')[0]).toEqual({
      type: 'assistant_message',
      messageId: 'msg_assistant_1',
      contentBlocks: [{ type: 'text', text: 'Hello, opencode' }],
      status: 'complete',
    })
    expect(eventsOfType(events, 'usage_updated')[0]?.usage).toEqual({
      inputTokens: 11,
      outputTokens: 5,
      reasoningOutputTokens: 2,
      cacheReadTokens: 3,
      cacheCreationTokens: 1,
      costUsd: 0.001,
    })
    expect(eventsOfType(events, 'run_completed')[0]).toMatchObject({
      type: 'run_completed',
      resultSubtype: 'success',
      sdkSessionId: 'ses_opencode_1',
    })

    const replay = replayAgentStreamEnvelopes(envelopes)
    expect(replay.textByMessageId.msg_assistant_1).toBe('Hello, opencode')
    expect(replay.terminal?.type).toBe('run_completed')
  })

  test('将 tool pending/running/completed/error 映射为工具活动并去重 started', () => {
    const events = runtimeEvents(adaptFixture('tool-lifecycle'))

    expect(events.map((event) => event.type)).toEqual([
      'sdk_session',
      'tool_started',
      'tool_progress',
      'tool_completed',
      'tool_started',
      'tool_completed',
      'run_completed',
    ])
    expect(eventsOfType(events, 'tool_started').map((event) => [event.toolCallId, event.name, event.riskLevel])).toEqual([
      ['call_bash_1', 'bash', 'dangerous'],
      ['call_edit_1', 'edit', 'dangerous'],
    ])
    expect(eventsOfType(events, 'tool_progress')[0]?.message).toBe('运行测试')
    expect(eventsOfType(events, 'tool_completed')).toEqual([
      { type: 'tool_completed', toolCallId: 'call_bash_1', status: 'success', outputSummary: '测试通过\n1 pass' },
      { type: 'tool_completed', toolCallId: 'call_edit_1', status: 'error', outputSummary: 'permission denied' },
    ])
  })

  test('将 reasoning、patch、agent、subtask 与 todo 映射为任务和 PatchApply 活动', () => {
    const events = runtimeEvents(adaptFixture('tasks-patch-todo'))

    expect(eventsOfType(events, 'tool_started')[0]).toMatchObject({
      type: 'tool_started',
      toolCallId: 'part_patch_1',
      name: 'PatchApply',
    })
    expect(eventsOfType(events, 'tool_completed')[0]?.outputSummary).toContain('src/new-file.ts')
    expect(eventsOfType(events, 'agent_task_started').map((event) => event.taskId)).toEqual([
      'part_reasoning_1',
      'part_agent_1',
      'part_subtask_1',
      'todo_1',
      'todo_2',
      'todo_3',
    ])
    expect(eventsOfType(events, 'agent_task_completed')).toEqual(expect.arrayContaining([
      { type: 'agent_task_completed', taskId: 'part_reasoning_1', status: 'completed', summary: '分析需求并制定计划' },
      { type: 'agent_task_completed', taskId: 'part_agent_1', status: 'completed', summary: 'build' },
      { type: 'agent_task_completed', taskId: 'part_subtask_1', status: 'completed', summary: '运行测试并汇报' },
      { type: 'agent_task_completed', taskId: 'todo_1', status: 'completed', summary: '阅读 runtime events 契约' },
      { type: 'agent_task_completed', taskId: 'todo_2', status: 'completed', summary: '实现 opencode adapter' },
      { type: 'agent_task_completed', taskId: 'todo_3', status: 'stopped', summary: '补充 fixtures' },
    ]))
  })

  test('将 permission updated/replied 映射为 PermissionBanner 可用字段', () => {
    const events = runtimeEvents(adaptFixture('permission'))
    const request = eventsOfType(events, 'permission_requested')[0]
    const reply = eventsOfType(events, 'permission_resolved')[0]

    expect(request).toMatchObject({
      type: 'permission_requested',
      requestId: 'perm_bash_1',
      toolName: 'bash',
      riskLevel: 'dangerous',
      inputSummary: '运行 bun test',
      scopeOptions: ['once', 'session'],
    })
    expect(request?.request).toMatchObject({
      requestId: 'perm_bash_1',
      sessionId: 'session-opencode',
      toolName: 'bash',
      command: 'bun test',
      sdkTitle: '运行 bun test',
    })
    expect(reply).toEqual({
      type: 'permission_resolved',
      requestId: 'perm_bash_1',
      decision: 'allowed',
      decidedBy: 'user',
      scope: 'once',
    })
  })

  test('abort/session error 映射为 run_stopped，迟到 idle 不覆盖终态', () => {
    const events = runtimeEvents(adaptFixture('abort-stop-race'))
    const terminalEvents = events.filter((event) => event.type === 'run_completed' || event.type === 'run_failed' || event.type === 'run_stopped')

    expect(terminalEvents).toEqual([{ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' }])
    expect(eventsOfType(events, 'run_completed')).toEqual([])
  })

  test('外部 stop 标记后迟到 session.idle 改写为 run_stopped', () => {
    const adapter = new OpencodeEventAdapter({
      sessionId: 'session-opencode',
      runId: 'run-stop',
      externalSessionId: 'ses_stop',
      createdAt: () => createdAt,
      promptSent: true,
    })
    adapter.markStopped('user_abort', 'user')
    const envelopes = adapter.adapt({ type: 'session.idle', properties: { sessionID: 'ses_stop' } })

    expect(runtimeEvents(envelopes)).toEqual([{ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' }])
  })

  test('session.error 按 opencode 错误类型分类', () => {
    const providerAuth = runtimeEvents(adaptEvents([{
      type: 'session.error',
      properties: {
        sessionID: 'ses_error',
        error: { name: 'ProviderAuthError', data: { providerID: 'anthropic', message: 'missing api key' } },
      },
    }]))
    expect(eventsOfType(providerAuth, 'run_failed')[0]).toMatchObject({
      recoverable: true,
      error: {
        code: 'opencode_provider_auth_error',
        retryable: false,
        message: 'missing api key',
      },
    })

    const apiError = runtimeEvents(adaptEvents([{
      type: 'session.error',
      properties: {
        sessionID: 'ses_error',
        error: { name: 'APIError', data: { message: 'rate limited', statusCode: 429, isRetryable: true } },
      },
    }]))
    expect(eventsOfType(apiError, 'run_failed')[0]).toMatchObject({
      recoverable: true,
      error: {
        code: 'opencode_api_error_429',
        retryable: true,
        message: 'rate limited',
      },
    })
  })

  test('补读 message part 生成 recovered metadata，并与已有 delta 共存', () => {
    const envelopes = adaptFixture('recovered-message', { recovered: true })

    expect(envelopes.every((envelope) => envelope.metadata?.recovered === true)).toBe(true)
    expect(envelopes.find((envelope) => envelope.event.type === 'assistant_message')?.metadata).toMatchObject({
      runtimeKind: 'opencode',
      externalSessionId: 'ses_opencode_recovered',
      externalMessageId: 'msg_assistant_recovered',
      externalPartId: 'part_text_recovered',
      recovered: true,
    })
    expect(replayAgentStreamEnvelopes(envelopes).textByMessageId.msg_assistant_recovered).toBe('Recovered answer')
  })
})

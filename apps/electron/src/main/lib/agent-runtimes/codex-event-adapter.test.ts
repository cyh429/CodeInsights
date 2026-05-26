import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import type { ThreadEvent } from '@openai/codex-sdk'
import {
  replayAgentStreamEnvelopes,
  validateAgentStreamEnvelope,
  type AgentRuntimeEvent,
  type AgentStreamEnvelope,
} from '@codeinsights/shared'
import {
  CODEX_THREAD_ITEM_MAPPINGS,
  CodexEventAdapter,
} from './codex-event-adapter'

const createdAt = '2026-05-25T00:00:00.000Z'
const fixtureRoot = new URL('./__fixtures__/codex-events/', import.meta.url)

function readFixture(name: string): ThreadEvent[] {
  const content = readFileSync(new URL(`${name}.jsonl`, fixtureRoot), 'utf8')
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ThreadEvent)
}

function adaptFixture(name: string): AgentStreamEnvelope[] {
  return adaptEvents(readFixture(name), name)
}

function adaptEvents(events: ThreadEvent[], runName = 'direct'): AgentStreamEnvelope[] {
  const adapter = new CodexEventAdapter({
    sessionId: 'session-codex',
    runId: `run-${runName}`,
    createdAt: () => createdAt,
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

describe('CodexEventAdapter', () => {
  test('声明覆盖 Codex SDK 当前公开 ThreadItem 类型', () => {
    expect(Object.keys(CODEX_THREAD_ITEM_MAPPINGS).sort()).toEqual([
      'agent_message',
      'command_execution',
      'error',
      'file_change',
      'mcp_tool_call',
      'reasoning',
      'todo_list',
      'web_search',
    ])
  })

  test('将 agent_message 流式文本映射为 append-only delta 与最终 assistant_message', () => {
    const envelopes = adaptFixture('agent-message-stream')
    const events = runtimeEvents(envelopes)

    expect(envelopes.every((envelope) => validateAgentStreamEnvelope(envelope).ok)).toBe(true)
    expect(envelopes.map((envelope) => envelope.source)).toEqual(envelopes.map(() => 'codex_sdk'))
    expect(events.map((event) => event.type)).toEqual([
      'sdk_session',
      'assistant_delta',
      'assistant_delta',
      'assistant_delta',
      'assistant_message',
      'usage_updated',
      'run_completed',
    ])
    expect(eventsOfType(events, 'assistant_delta').map((event) => event.delta)).toEqual(['Hel', 'lo', ', Codex'])
    expect(eventsOfType(events, 'assistant_message')[0]).toEqual({
      type: 'assistant_message',
      messageId: 'msg-1',
      contentBlocks: [{ type: 'text', text: 'Hello, Codex' }],
      status: 'complete',
    })
    expect(eventsOfType(events, 'usage_updated')[0]?.usage).toEqual({
      inputTokens: 11,
      cacheReadTokens: 3,
      outputTokens: 5,
      reasoningOutputTokens: 2,
    })
    expect(eventsOfType(events, 'run_completed')[0]).toMatchObject({
      type: 'run_completed',
      resultSubtype: 'success',
      terminalReason: 'completed',
      sdkSessionId: 'thread-agent-message',
    })

    const replay = replayAgentStreamEnvelopes(envelopes)
    expect(replay.textByMessageId['msg-1']).toBe('Hello, Codex')
    expect(replay.terminal?.type).toBe('run_completed')
  })

  test('非 append-only 文本更新退化为完整 assistant_message 覆盖', () => {
    const envelopes = adaptEvents([
      { type: 'item.started', item: { id: 'msg-rewrite', type: 'agent_message', text: 'alpha beta' } },
      { type: 'item.updated', item: { id: 'msg-rewrite', type: 'agent_message', text: 'alpha' } },
    ])
    const events = runtimeEvents(envelopes)

    expect(events.map((event) => event.type)).toEqual(['assistant_delta', 'assistant_message'])
    expect(eventsOfType(events, 'assistant_delta')[0]?.delta).toBe('alpha beta')
    expect(eventsOfType(events, 'assistant_message')[0]?.contentBlocks).toEqual([{ type: 'text', text: 'alpha' }])
  })

  test('将成功命令执行映射为 Bash 工具活动并对累计输出做差分', () => {
    const events = runtimeEvents(adaptFixture('command-success'))

    expect(events.map((event) => event.type)).toEqual([
      'sdk_session',
      'tool_started',
      'tool_progress',
      'tool_completed',
      'usage_updated',
      'run_completed',
    ])
    expect(eventsOfType(events, 'tool_started')[0]).toMatchObject({
      type: 'tool_started',
      toolCallId: 'cmd-1',
      name: 'Bash',
      riskLevel: 'normal',
    })
    expect(eventsOfType(events, 'tool_started')[0]?.inputSummary).toContain('bun test')
    expect(eventsOfType(events, 'tool_progress')[0]?.message).toContain('1 pass')
    expect(eventsOfType(events, 'tool_completed')[0]).toMatchObject({
      type: 'tool_completed',
      toolCallId: 'cmd-1',
      status: 'success',
    })
    expect(eventsOfType(events, 'tool_completed')[0]?.outputSummary).toContain('exit_code=0')
  })

  test('将失败命令执行映射为 error 工具完成事件', () => {
    const events = runtimeEvents(adaptFixture('command-failed'))

    expect(eventsOfType(events, 'tool_completed')[0]).toMatchObject({
      type: 'tool_completed',
      toolCallId: 'cmd-err',
      status: 'error',
    })
    expect(eventsOfType(events, 'tool_completed')[0]?.outputSummary).toContain('exit_code=1')
    expect(eventsOfType(events, 'tool_completed')[0]?.outputSummary).toContain('not ok 1')
  })

  test('将 file_change 映射为 PatchApply 工具活动', () => {
    const events = runtimeEvents(adaptFixture('file-change'))

    expect(events.map((event) => event.type)).toEqual([
      'sdk_session',
      'tool_started',
      'tool_completed',
      'usage_updated',
      'run_completed',
    ])
    expect(eventsOfType(events, 'tool_started')[0]).toMatchObject({
      type: 'tool_started',
      toolCallId: 'patch-1',
      name: 'PatchApply',
    })
    expect(eventsOfType(events, 'tool_completed')[0]).toMatchObject({
      type: 'tool_completed',
      toolCallId: 'patch-1',
      status: 'success',
    })
    expect(eventsOfType(events, 'tool_completed')[0]?.outputSummary).toContain('src/new-file.ts')
  })

  test('将 MCP 工具调用成功和失败映射为 server.tool 工具活动', () => {
    const successEvents = runtimeEvents(adaptFixture('mcp-tool-call-success'))
    const failedEvents = runtimeEvents(adaptFixture('mcp-tool-call-failed'))

    expect(eventsOfType(successEvents, 'tool_started')[0]).toMatchObject({
      type: 'tool_started',
      toolCallId: 'mcp-1',
      name: 'github.search_issues',
    })
    expect(eventsOfType(successEvents, 'tool_completed')[0]?.outputSummary).toContain('issue-1')
    expect(eventsOfType(failedEvents, 'tool_started')[0]).toMatchObject({
      type: 'tool_started',
      toolCallId: 'mcp-err',
      name: 'linear.get_issue',
    })
    expect(eventsOfType(failedEvents, 'tool_completed')[0]).toMatchObject({
      type: 'tool_completed',
      toolCallId: 'mcp-err',
      status: 'error',
    })
    expect(eventsOfType(failedEvents, 'tool_completed')[0]?.outputSummary).toContain('MCP timeout')
  })

  test('将 web_search 映射为 WebSearch 工具活动', () => {
    const events = runtimeEvents(adaptFixture('web-search'))

    expect(eventsOfType(events, 'tool_started')[0]).toMatchObject({
      type: 'tool_started',
      toolCallId: 'web-1',
      name: 'WebSearch',
    })
    expect(eventsOfType(events, 'tool_started')[0]?.inputSummary).toContain('OpenAI Codex SDK')
    expect(eventsOfType(events, 'tool_completed')[0]).toMatchObject({
      type: 'tool_completed',
      toolCallId: 'web-1',
      status: 'success',
    })
  })

  test('将 reasoning 与 todo_list 映射为可折叠任务事件', () => {
    const events = runtimeEvents(adaptFixture('todo-list'))
    const taskStarted = eventsOfType(events, 'agent_task_started')
    const taskCompleted = eventsOfType(events, 'agent_task_completed')

    expect(taskStarted.map((event) => event.taskId)).toEqual([
      'reasoning-1',
      'todo-1:0',
      'todo-1:1',
    ])
    expect(eventsOfType(events, 'agent_task_progress').map((event) => event.taskId)).toContain('reasoning-1')
    expect(taskCompleted).toEqual(expect.arrayContaining([
      { type: 'agent_task_completed', taskId: 'reasoning-1', status: 'completed', summary: '分析需求，生成计划' },
      { type: 'agent_task_completed', taskId: 'todo-1:0', status: 'completed', summary: '阅读 runtime events 契约' },
      { type: 'agent_task_completed', taskId: 'todo-1:1', status: 'completed', summary: '实现 Codex adapter' },
    ]))
  })

  test('todo_list completed 时将仍未完成的任务标记为 stopped', () => {
    const events = runtimeEvents(adaptEvents([
      {
        type: 'item.completed',
        item: {
          id: 'todo-stopped',
          type: 'todo_list',
          items: [{ text: '等待真实 Codex 集成', completed: false }],
        },
      },
    ]))

    expect(eventsOfType(events, 'agent_task_completed')).toEqual([{
      type: 'agent_task_completed',
      taskId: 'todo-stopped:0',
      status: 'stopped',
      summary: '等待真实 Codex 集成',
    }])
  })

  test('turn.failed 和顶层 error 映射为 run_failed，不产生成功终态', () => {
    const failedEvents = runtimeEvents(adaptFixture('turn-failed'))
    expect(failedEvents.map((event) => event.type)).toEqual([
      'sdk_session',
      'assistant_message',
      'run_failed',
    ])
    expect(eventsOfType(failedEvents, 'run_failed')[0]).toMatchObject({
      type: 'run_failed',
      recoverable: false,
      error: { code: 'codex_turn_failed', message: 'Codex turn failed before completion' },
    })
    expect(eventsOfType(failedEvents, 'run_completed')).toEqual([])

    const streamErrorEvents = runtimeEvents(adaptEvents([{ type: 'error', message: 'stream disconnected' }]))
    expect(streamErrorEvents).toEqual([{
      type: 'run_failed',
      recoverable: false,
      error: {
        code: 'codex_stream_error',
        title: 'Codex 流式事件失败',
        message: 'stream disconnected',
        retryable: false,
      },
    }])
  })

  test('重连中的顶层 error 记录为进度事件，不提前终止 turn', () => {
    const events = runtimeEvents(adaptEvents([
      { type: 'thread.started', thread_id: 'thread-reconnect' },
      { type: 'turn.started' },
      { type: 'error', message: 'Reconnecting... 1/5 (stream disconnected)' },
      { type: 'item.completed', item: { id: 'msg-after-reconnect', type: 'agent_message', text: 'ok' } },
      {
        type: 'turn.completed',
        usage: {
          input_tokens: 1,
          cached_input_tokens: 0,
          output_tokens: 1,
          reasoning_output_tokens: 0,
        },
      },
    ]))

    expect(events.map((event) => event.type)).toEqual([
      'sdk_session',
      'agent_task_started',
      'agent_task_progress',
      'assistant_message',
      'usage_updated',
      'run_completed',
    ])
    expect(eventsOfType(events, 'run_failed')).toEqual([])
    expect(eventsOfType(events, 'agent_task_progress')[0]?.message).toContain('Reconnecting')
    expect(eventsOfType(events, 'run_completed')[0]?.sdkSessionId).toBe('thread-reconnect')
  })

  test('resume 模式可用初始 thread id 补齐 run_completed sdkSessionId', () => {
    const adapter = new CodexEventAdapter({
      sessionId: 'session-codex',
      runId: 'run-resume',
      initialThreadId: 'thread-resumed',
      createdAt: () => createdAt,
    })
    const envelopes = [
      ...adapter.adapt({ type: 'turn.started' }),
      ...adapter.adapt({
        type: 'turn.completed',
        usage: {
          input_tokens: 1,
          cached_input_tokens: 0,
          output_tokens: 1,
          reasoning_output_tokens: 0,
        },
      }),
    ]
    const events = runtimeEvents(envelopes)

    expect(eventsOfType(events, 'sdk_session')).toEqual([])
    expect(eventsOfType(events, 'run_completed')[0]?.sdkSessionId).toBe('thread-resumed')
  })

  test('非致命 error item 映射为工具错误而不是运行终态', () => {
    const events = runtimeEvents(adaptEvents([
      { type: 'item.completed', item: { id: 'nonfatal-1', type: 'error', message: 'lint warning' } },
    ]))

    expect(events.map((event) => event.type)).toEqual(['tool_started', 'tool_completed'])
    expect(eventsOfType(events, 'tool_completed')[0]).toMatchObject({
      type: 'tool_completed',
      toolCallId: 'nonfatal-1',
      status: 'error',
      outputSummary: 'lint warning',
    })
  })

  test('终态事件去重，completed 后到达的 abort/failure 不覆盖成功结果', () => {
    const envelopes = adaptFixture('abort-after-completed-race')
    const terminalEvents = runtimeEvents(envelopes).filter((event) => event.type === 'run_completed' || event.type === 'run_failed' || event.type === 'run_stopped')

    expect(terminalEvents).toHaveLength(1)
    expect(terminalEvents[0]?.type).toBe('run_completed')
    expect(replayAgentStreamEnvelopes(envelopes).terminal?.type).toBe('run_completed')
  })
})

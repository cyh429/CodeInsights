import { describe, expect, test } from 'bun:test'
import type { AgentProviderAdapter, AgentQueryInput, SDKMessage, SDKSystemMessage } from '@codeinsights/shared'
import type { ClaudeAgentQueryOptions } from '../adapters/claude-agent-adapter'
import {
  TeamsCoordinator,
  type TeamInboxMessage,
  type TeamsCoordinatorDeps,
} from './teams-coordinator'

function systemMessage(input: Omit<SDKSystemMessage, 'type'>): SDKSystemMessage {
  return { type: 'system', ...input }
}

function createBaseQueryOptions(): ClaudeAgentQueryOptions {
  return {
    sessionId: 'session-1',
    prompt: '原始 prompt',
    model: 'claude-test',
    cwd: '/tmp/workspace',
    sdkCliPath: '/tmp/claude',
    env: {},
    sdkPermissionMode: 'default',
    allowDangerouslySkipPermissions: true,
    systemPrompt: 'system prompt',
  }
}

function createAdapter(
  messages: SDKMessage[],
  onQuery?: (input: AgentQueryInput) => void,
): AgentProviderAdapter {
  return {
    async *query(input: AgentQueryInput): AsyncIterable<SDKMessage> {
      onQuery?.(input)
      for (const message of messages) {
        yield message
      }
    },
    abort: () => {},
    dispose: () => {},
  }
}

describe('TeamsCoordinator', () => {
  test('追踪 task_started / task_notification 并判断 result 延迟与 Watchdog 检查', () => {
    const coordinator = new TeamsCoordinator('sdk-session-1')

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'task-1',
      task_type: 'local_agent',
    }))
    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'task-2',
      task_type: 'remote_agent',
    }))
    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'ignored-task',
      task_type: 'other',
    }))

    expect(coordinator.startedTaskCount).toBe(2)
    expect(coordinator.shouldDeferResultMessage()).toBe(true)
    expect(coordinator.shouldCheckWorkerIdle()).toBe(true)

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_notification',
      task_id: 'task-1',
      status: 'completed',
      summary: '第一项任务完成',
      output_file: '/tmp/task-1.md',
    }))

    expect(coordinator.summaryCount).toBe(1)
    expect(coordinator.shouldCheckWorkerIdle()).toBe(true)

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_notification',
      task_id: 'task-2',
      status: 'completed',
    }))

    expect(coordinator.summaryCount).toBe(1)
    expect(coordinator.shouldCheckWorkerIdle()).toBe(false)
  })

  test('Watchdog idle 检查使用捕获到的 SDK session 和 started task 数量', async () => {
    const calls: Array<{ sdkSessionId: string; startedCount: number }> = []
    const coordinator = new TeamsCoordinator('sdk-session-1', {
      areAllWorkersIdle: async (sdkSessionId, startedCount) => {
        calls.push({ sdkSessionId, startedCount })
        return true
      },
    })

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'task-1',
      task_type: 'local_agent',
    }))

    await expect(coordinator.areWorkersIdle()).resolves.toBe(true)
    expect(calls).toEqual([{ sdkSessionId: 'sdk-session-1', startedCount: 1 }])
  })

  test('构造 resume prompt 时优先使用 inbox 并标记已读', async () => {
    const markedPaths: string[] = []
    const inboxMessages: TeamInboxMessage[] = [
      { from: 'worker-1', text: '完整结果', summary: '摘要' },
    ]
    const deps: TeamsCoordinatorDeps = {
      findTeamLeadInboxPath: async () => ({ teamName: 'alpha', inboxPath: '/tmp/inbox.json' }),
      pollInboxWithRetry: async () => inboxMessages,
      markInboxAsRead: async (inboxPath) => {
        markedPaths.push(inboxPath)
      },
      formatInboxPrompt: (messages) => `inbox:${messages.length}:${messages[0]?.text ?? ''}`,
      formatSummaryFallbackPrompt: () => 'summary:fallback',
    }
    const coordinator = new TeamsCoordinator('sdk-session-1', deps)

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'task-1',
      task_type: 'local_agent',
    }))
    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_notification',
      task_id: 'task-1',
      status: 'completed',
      summary: '摘要 fallback',
    }))

    const result = await coordinator.buildResumePrompt()

    expect(result).toEqual({
      prompt: 'inbox:1:完整结果',
      source: 'inbox',
      teamName: 'alpha',
      inboxMessageCount: 1,
      summaryCount: 1,
    })
    expect(markedPaths).toEqual(['/tmp/inbox.json'])
  })

  test('inbox 为空时使用 task_notification summaries 作为 fallback', async () => {
    const deps: TeamsCoordinatorDeps = {
      findTeamLeadInboxPath: async () => ({ teamName: 'alpha', inboxPath: '/tmp/inbox.json' }),
      pollInboxWithRetry: async () => [],
      markInboxAsRead: async () => {
        throw new Error('不应标记空 inbox')
      },
      formatSummaryFallbackPrompt: (summaries) => `summary:${summaries.length}:${summaries[0]?.summary ?? ''}`,
    }
    const coordinator = new TeamsCoordinator('sdk-session-1', deps)

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'task-1',
      task_type: 'remote_agent',
    }))
    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_notification',
      task_id: 'task-1',
      status: 'completed',
      summary: '完成摘要',
    }))

    const result = await coordinator.buildResumePrompt()

    expect(result).toEqual({
      prompt: 'summary:1:完成摘要',
      source: 'summary',
      teamName: 'alpha',
      inboxMessageCount: 0,
      summaryCount: 1,
    })
  })

  test('runResumeQuery 构造 resume options，推送所有消息并只收集可持久化消息', async () => {
    const capturedQueryOptions: ClaudeAgentQueryOptions[] = []
    const emittedMessages: SDKMessage[] = []
    const assistantMessage: SDKMessage = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: '新回复' }] },
      parent_tool_use_id: null,
    }
    const replayMessage = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'replay' }] },
      parent_tool_use_id: null,
      isReplay: true,
    } as unknown as SDKMessage
    const userMessage: SDKMessage = {
      type: 'user',
      message: { content: [{ type: 'tool_result', content: 'ok' }] },
      parent_tool_use_id: null,
    }
    const compactBoundary: SDKMessage = systemMessage({ subtype: 'compact_boundary' })
    const initSystem: SDKMessage = systemMessage({ subtype: 'init' })
    const resultMessage: SDKMessage = {
      type: 'result',
      subtype: 'success',
      usage: { input_tokens: 1, output_tokens: 1 },
    }
    const coordinator = new TeamsCoordinator('sdk-session-1')

    const persistedMessages = await coordinator.runResumeQuery({
      adapter: createAdapter(
        [assistantMessage, replayMessage, userMessage, compactBoundary, initSystem, resultMessage],
        (input) => {
          capturedQueryOptions.push(input as ClaudeAgentQueryOptions)
        },
      ),
      baseQueryOptions: createBaseQueryOptions(),
      prompt: 'resume prompt',
      resumeSessionId: 'sdk-session-1',
      sessionId: 'session-1',
      isSessionActive: () => true,
      emitSdkMessage: (message) => {
        emittedMessages.push(message)
      },
    })

    expect(capturedQueryOptions[0]).toMatchObject({
      sessionId: 'session-1',
      prompt: 'resume prompt',
      resumeSessionId: 'sdk-session-1',
      model: 'claude-test',
      cwd: '/tmp/workspace',
      sdkCliPath: '/tmp/claude',
      sdkPermissionMode: 'default',
      allowDangerouslySkipPermissions: true,
      systemPrompt: 'system prompt',
    })
    expect(persistedMessages).toEqual([assistantMessage, userMessage, compactBoundary])
    expect(emittedMessages).toEqual([
      assistantMessage,
      replayMessage,
      userMessage,
      compactBoundary,
      initSystem,
      resultMessage,
    ])
  })

  test('runResumeQuery 在会话失活后停止收集和推送', async () => {
    const emittedMessages: SDKMessage[] = []
    let activeChecks = 0
    const firstMessage: SDKMessage = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: '第一条' }] },
      parent_tool_use_id: null,
    }
    const secondMessage: SDKMessage = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: '第二条' }] },
      parent_tool_use_id: null,
    }
    const coordinator = new TeamsCoordinator('sdk-session-1')

    const persistedMessages = await coordinator.runResumeQuery({
      adapter: createAdapter([firstMessage, secondMessage]),
      baseQueryOptions: createBaseQueryOptions(),
      prompt: 'resume prompt',
      resumeSessionId: 'sdk-session-1',
      sessionId: 'session-1',
      isSessionActive: () => activeChecks++ === 0,
      emitSdkMessage: (message) => {
        emittedMessages.push(message)
      },
    })

    expect(persistedMessages).toEqual([firstMessage])
    expect(emittedMessages).toEqual([firstMessage])
  })
})

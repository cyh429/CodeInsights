import { describe, expect, test } from 'bun:test'
import type { AgentStreamEnvelope, SDKMessage } from '@rv-insights/shared'
import type { ClaudeAgentQueryOptions } from './adapters/claude-agent-adapter'
import { InProcessAgentRuntimeRunner } from './agent-runtime-runner'
import type { AgentRuntimeRunInput } from './agent-runtime-types'

const baseTime = '2026-05-18T00:00:00.000Z'

describe('InProcessAgentRuntimeRunner', () => {
  test('发送消息时输出 run_started、SDK envelopes 并通过 store 写 SDKMessage', async () => {
    const stored: SDKMessage[] = []
    const emitted: SDKMessage[] = []
    const runner = new InProcessAgentRuntimeRunner({
      createRunId: () => 'run-send',
      now: () => baseTime,
      query: async function* () {
        yield assistantTextMessage('你好')
        yield resultMessage({ sessionId: 'sdk-1' })
      },
      store: {
        appendMessages: (_sessionId, messages) => {
          stored.push(...messages)
        },
      },
      onSdkMessage: (_sessionId, message) => {
        emitted.push(message)
      },
    })

    const envelopes = await collect(runner.run(createRunInput({ sessionId: 'session-send', resumeFrom: undefined })))

    expect(envelopes.map((envelope) => envelope.event.type)).toEqual([
      'run_started',
      'assistant_message',
      'usage_updated',
      'run_completed',
    ])
    expect(envelopes.map((envelope) => envelope.sequence)).toEqual([0, 1, 2, 3])
    expect(stored.map((message) => message.type)).toEqual(['assistant', 'result'])
    expect(emitted.map((message) => message.type)).toEqual(['assistant', 'result'])
  })

  test('resume 时输出 sdk_session 并保留 resumeFrom', async () => {
    const runner = new InProcessAgentRuntimeRunner({
      createRunId: () => 'run-resume',
      now: () => baseTime,
      query: async function* () {
        yield resultMessage({ sessionId: 'sdk-existing' })
      },
      store: { appendMessages: () => {} },
    })

    const envelopes = await collect(runner.run(createRunInput({ sessionId: 'session-resume', resumeFrom: 'sdk-existing' })))
    expect(envelopes[1]?.event).toEqual({
      type: 'sdk_session',
      sdkSessionId: 'sdk-existing',
      resumeFrom: 'sdk-existing',
    })
  })

  test('abortSignal 已中止时输出 run_stopped 终态', async () => {
    const abortController = new AbortController()
    const runner = new InProcessAgentRuntimeRunner({
      createRunId: () => 'run-stop',
      now: () => baseTime,
      query: async function* () {
        abortController.abort()
        yield assistantTextMessage('不会继续')
      },
      store: { appendMessages: () => {} },
    })

    const envelopes = await collect(runner.run(createRunInput({ sessionId: 'session-stop', abortSignal: abortController.signal })))
    expect(lastEvent(envelopes)).toEqual({ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' })
  })

  test('权限通过 callback 请求并输出 requested/resolved', async () => {
    let capturedRequestId = ''
    const runner = new InProcessAgentRuntimeRunner({
      createRunId: () => 'run-permission',
      now: () => baseTime,
      query: async function* (options) {
        await options.canUseTool?.('Write', { file_path: 'a.txt' }, createCanUseToolOptions())
        yield resultMessage({ sessionId: 'sdk-permission' })
      },
      interactions: {
        requestPermission: async (input) => {
          capturedRequestId = input.requestId
          return { result: { behavior: 'allow', updatedInput: input.toolInput }, scope: 'once' }
        },
      },
      store: { appendMessages: () => {} },
    })

    const envelopes = await collect(runner.run(createRunInput({ sessionId: 'session-permission' })))
    expect(capturedRequestId).toBeTruthy()
    expect(envelopes.map((envelope) => envelope.event.type)).toContain('permission_requested')
    expect(envelopes.map((envelope) => envelope.event.type)).toContain('permission_resolved')
  })

  test('AskUser 通过 callback 请求并输出 requested/resolved', async () => {
    let capturedRequestId = ''
    const runner = new InProcessAgentRuntimeRunner({
      createRunId: () => 'run-ask-user',
      now: () => baseTime,
      query: async function* (options) {
        await options.canUseTool?.('AskUserQuestion', {
          questions: [{ question: '请选择目标分支' }],
        }, createCanUseToolOptions())
        yield resultMessage({ sessionId: 'sdk-ask-user' })
      },
      interactions: {
        askUser: async (input) => {
          capturedRequestId = input.requestId
          return {
            response: 'main',
            result: { behavior: 'allow', updatedInput: { ...input.toolInput, answers: { branch: 'main' } } },
          }
        },
      },
      store: { appendMessages: () => {} },
    })

    const envelopes = await collect(runner.run(createRunInput({ sessionId: 'session-ask-user' })))
    expect(capturedRequestId).toBeTruthy()
    expect(envelopes.map((envelope) => envelope.event.type)).toContain('ask_user_requested')
    expect(envelopes.map((envelope) => envelope.event.type)).toContain('ask_user_resolved')
  })

  test('SDK stream 抛错时输出 run_failed 并保存已累积消息和错误消息', async () => {
    const stored: SDKMessage[] = []
    const emitted: SDKMessage[] = []
    const runner = new InProcessAgentRuntimeRunner({
      createRunId: () => 'run-error',
      now: () => baseTime,
      query: async function* () {
        yield assistantTextMessage('部分输出')
        throw new Error('上游失败')
      },
      store: {
        appendMessages: (_sessionId, messages) => {
          stored.push(...messages)
        },
      },
      onSdkMessage: (_sessionId, message) => {
        emitted.push(message)
      },
    })

    const envelopes = await collect(runner.run(createRunInput({ sessionId: 'session-error' })))
    expect(lastEvent(envelopes)).toMatchObject({
      type: 'run_failed',
      error: { message: '上游失败' },
    })
    expect(stored.map((message) => message.type)).toEqual(['assistant', 'assistant'])
    expect((stored[1] as { _errorCode?: string } | undefined)?._errorCode).toBe('unknown_error')
    expect(emitted.map((message) => message.type)).toEqual(['assistant', 'assistant'])
  })

  test('可重试 catch 错误会沿用同一 runId 重试并在成功后清理 retry 状态', async () => {
    const stored: SDKMessage[] = []
    let calls = 0
    const runner = new InProcessAgentRuntimeRunner({
      createRunId: () => 'run-retry',
      now: () => baseTime,
      retryDelayMs: () => 0,
      query: async function* () {
        calls += 1
        if (calls === 1) throw new Error('ECONNRESET')
        yield assistantTextMessage('重试后成功')
        yield resultMessage({ sessionId: 'sdk-retry' })
      },
      store: {
        appendMessages: (_sessionId, messages) => {
          stored.push(...messages)
        },
      },
    })

    const envelopes = await collect(runner.run(createRunInput({ sessionId: 'session-retry' })))

    expect(calls).toBe(2)
    expect(envelopes.map((envelope) => envelope.runId).every((runId) => runId === 'run-retry')).toBe(true)
    expect(envelopes.map((envelope) => envelope.event.type)).toEqual([
      'run_started',
      'retry_scheduled',
      'retry_attempt',
      'assistant_message',
      'usage_updated',
      'run_completed',
      'retry_cleared',
    ])
    expect(stored.map((message) => message.type)).toEqual(['assistant', 'result'])
  })

  test('不可重试 assistant typed error 会持久化 typed error SDKMessage', async () => {
    const stored: SDKMessage[] = []
    const runner = new InProcessAgentRuntimeRunner({
      createRunId: () => 'run-typed-error',
      now: () => baseTime,
      query: async function* () {
        yield assistantErrorMessage('authentication_failed', 'API key 无效')
      },
      store: {
        appendMessages: (_sessionId, messages) => {
          stored.push(...messages)
        },
      },
    })

    const envelopes = await collect(runner.run(createRunInput({ sessionId: 'session-typed-error' })))

    expect(lastEvent(envelopes)).toMatchObject({
      type: 'run_failed',
      error: { code: 'invalid_api_key', retryable: true },
    })
    expect(stored.map((message) => message.type)).toEqual(['assistant'])
    expect((stored[0] as { _errorCode?: string } | undefined)?._errorCode).toBe('invalid_api_key')
  })
})

function createRunInput(overrides: Partial<AgentRuntimeRunInput> = {}): AgentRuntimeRunInput {
  const sessionId = overrides.sessionId ?? 'session'
  const queryOptions = {
    sessionId,
    prompt: '你好',
    model: 'claude-sonnet-4-6',
    cwd: '/tmp/rv-insights',
    sdkCliPath: '/tmp/claude',
    env: {},
    sdkPermissionMode: 'auto',
    allowDangerouslySkipPermissions: false,
    systemPrompt: 'system',
    resumeSessionId: overrides.resumeFrom,
  } satisfies ClaudeAgentQueryOptions

  return {
    sessionId,
    prompt: '你好',
    model: 'claude-sonnet-4-6',
    cwd: '/tmp/rv-insights',
    permissionMode: 'auto',
    queryOptions,
    ...overrides,
  }
}

function assistantTextMessage(text: string): SDKMessage {
  return {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text }],
    },
    parent_tool_use_id: null,
    uuid: `assistant-${text}`,
  } as SDKMessage
}

function assistantErrorMessage(errorType: string, message: string): SDKMessage {
  return {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: message }],
    },
    parent_tool_use_id: null,
    error: { errorType, message },
  } as SDKMessage
}

function resultMessage(input: { sessionId: string }): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    session_id: input.sessionId,
    usage: {
      input_tokens: 1,
      output_tokens: 2,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    total_cost_usd: 0.01,
    terminal_reason: 'completed',
  } as SDKMessage
}

function createCanUseToolOptions(): Parameters<NonNullable<ClaudeAgentQueryOptions['canUseTool']>>[2] {
  return {
    signal: new AbortController().signal,
    toolUseID: 'tool-1',
  }
}

async function collect(iterable: AsyncIterable<AgentStreamEnvelope>): Promise<AgentStreamEnvelope[]> {
  const envelopes: AgentStreamEnvelope[] = []
  for await (const envelope of iterable) envelopes.push(envelope)
  return envelopes
}

function lastEvent(envelopes: AgentStreamEnvelope[]): AgentStreamEnvelope['event'] | undefined {
  return envelopes[envelopes.length - 1]?.event
}

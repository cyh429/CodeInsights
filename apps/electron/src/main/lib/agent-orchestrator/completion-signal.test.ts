import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentMessage, AgentProviderAdapter, AgentQueryInput, AgentSendInput, SDKAssistantMessage, SDKMessage, SDKResultMessage } from '@rv-insights/shared'
import type { ClaudeAgentQueryOptions } from '../adapters/claude-agent-adapter'
import type { AgentOrchestrator as AgentOrchestratorInstance, SessionCallbacks } from '../agent-orchestrator'

mock.module('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '',
  },
  BrowserWindow: {
    getFocusedWindow: () => null,
    getAllWindows: () => [],
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

const { AgentEventBus } = await import('../agent-event-bus')
const { AgentOrchestrator } = await import('../agent-orchestrator')
const { agentRuntimeRunnerV2 } = await import('../agent-runtime-types')
const {
  createAgentSession,
  getAgentSessionSDKMessages,
  getAgentSessionRuntimeEvents,
  updateAgentSessionMeta,
} = await import('../agent-session-manager')
const { createAgentWorkspace } = await import('../agent-workspace-manager')
const { createChannel } = await import('../channel-manager')

interface CompletionCall {
  messages?: AgentMessage[]
  opts?: { stoppedByUser?: boolean; startedAt?: number; resultSubtype?: string }
  persistedTypes: string[]
}

interface CallbackRecorder {
  errors: string[]
  titles: string[]
  completes: CompletionCall[]
  callbacks: SessionCallbacks
}

interface AdapterHarness {
  adapter: AgentProviderAdapter
  queryCalls: ClaudeAgentQueryOptions[]
  abortedSessions: string[]
}

let currentConfigDir: string | undefined

beforeEach(() => {
  currentConfigDir = mkdtempSync(join(tmpdir(), 'rv-completion-signal-'))
  process.env.RV_INSIGHTS_CONFIG_DIR = currentConfigDir
})

afterEach(() => {
  agentRuntimeRunnerV2.enabled = false
  if (currentConfigDir) {
    rmSync(currentConfigDir, { recursive: true, force: true })
  }
  delete process.env.RV_INSIGHTS_CONFIG_DIR
  currentConfigDir = undefined
})

function createRecorder(sessionId: string): CallbackRecorder {
  const recorder: CallbackRecorder = {
    errors: [],
    titles: [],
    completes: [],
    callbacks: {
      onError: (error) => {
        recorder.errors.push(error)
      },
      onComplete: (messages, opts) => {
        recorder.completes.push({
          messages,
          opts,
          persistedTypes: getAgentSessionSDKMessages(sessionId).map((message) => message.type),
        })
      },
      onTitleUpdated: (title) => {
        recorder.titles.push(title)
      },
    },
  }
  return recorder
}

function createAdapterHarness(
  query: (input: ClaudeAgentQueryOptions) => AsyncIterable<SDKMessage>,
): AdapterHarness {
  const queryCalls: ClaudeAgentQueryOptions[] = []
  const abortedSessions: string[] = []

  return {
    queryCalls,
    abortedSessions,
    adapter: {
      query(input: AgentQueryInput): AsyncIterable<SDKMessage> {
        const options = input as ClaudeAgentQueryOptions
        queryCalls.push({ ...options })
        return query(options)
      },
      abort: (sessionId) => {
        abortedSessions.push(sessionId)
      },
      dispose: () => {},
    },
  }
}

function assistantTextMessage(text: string): SDKAssistantMessage {
  return {
    type: 'assistant',
    message: {
      content: [{ type: 'text', text }],
      model: 'claude-test',
    },
    parent_tool_use_id: null,
  }
}

function assistantErrorMessage(errorType: string, message: string): SDKAssistantMessage {
  return {
    type: 'assistant',
    message: {
      content: [{ type: 'text', text: message }],
    },
    parent_tool_use_id: null,
    error: { errorType, message },
  }
}

function resultMessage(subtype: SDKResultMessage['subtype'] = 'success'): SDKResultMessage {
  return {
    type: 'result',
    subtype,
    usage: {
      input_tokens: 1,
      output_tokens: 1,
    },
    total_cost_usd: 0,
  }
}

function createRunnableInput(startedAt = 123_456): AgentSendInput {
  const workspace = createAgentWorkspace('Completion Signal Workspace')
  const channel = createChannel({
    name: 'Completion Signal Channel',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKey: 'test-key',
    enabled: true,
    models: [{ id: 'claude-test', name: 'Claude Test', enabled: true }],
  })
  const session = createAgentSession('新 Agent 会话', channel.id, workspace.id)

  return {
    sessionId: session.id,
    userMessage: '测试完成信号',
    channelId: channel.id,
    modelId: 'claude-test',
    workspaceId: workspace.id,
    startedAt,
  }
}

function createMissingChannelInput(startedAt = 223_344): AgentSendInput {
  const session = createAgentSession('新 Agent 会话')
  return {
    sessionId: session.id,
    userMessage: '测试 preflight',
    channelId: 'missing-channel',
    modelId: 'claude-test',
    startedAt,
  }
}

async function withImmediateTimers<T>(action: () => Promise<T>): Promise<T> {
  const originalSetTimeout = globalThis.setTimeout
  const immediateSetTimeout = ((
    handler: Parameters<typeof setTimeout>[0],
    _timeout?: number,
    ...args: unknown[]
  ) => originalSetTimeout(handler, 0, ...args)) as unknown as typeof setTimeout
  globalThis.setTimeout = immediateSetTimeout
  try {
    return await action()
  } finally {
    globalThis.setTimeout = originalSetTimeout
  }
}

describe('AgentOrchestrator completion signal', () => {
  test('并发拒绝先发送错误，再用输入 startedAt 完成且不持久化消息', async () => {
    const input = createMissingChannelInput(1_001)
    const harness = createAdapterHarness(async function* () {})
    const orchestrator = new AgentOrchestrator(harness.adapter, new AgentEventBus())
    const activeSessions = (orchestrator as unknown as { activeSessions: Map<string, number> }).activeSessions
    activeSessions.set(input.sessionId, 1)
    const recorder = createRecorder(input.sessionId)

    await orchestrator.sendMessage(input, recorder.callbacks)

    expect(recorder.errors).toEqual(['上一条消息仍在处理中，请稍候再试'])
    expect(recorder.completes).toHaveLength(1)
    expect(recorder.completes[0]?.messages).toEqual([])
    expect(recorder.completes[0]?.opts).toEqual({ startedAt: 1_001 })
    expect(recorder.completes[0]?.persistedTypes).toEqual([])
    expect(harness.queryCalls).toHaveLength(0)
  })

  test('preflight 渠道不存在时先持久化 TypedError，再完成空消息列表', async () => {
    const input = createMissingChannelInput(2_002)
    const harness = createAdapterHarness(async function* () {})
    const orchestrator = new AgentOrchestrator(harness.adapter, new AgentEventBus())
    const recorder = createRecorder(input.sessionId)

    await orchestrator.sendMessage(input, recorder.callbacks)

    expect(recorder.errors[0]).toContain('渠道不存在')
    expect(recorder.completes).toHaveLength(1)
    expect(recorder.completes[0]?.messages).toEqual([])
    expect(recorder.completes[0]?.opts).toEqual({ startedAt: 2_002 })
    expect(recorder.completes[0]?.persistedTypes).toEqual(['assistant'])
    const persisted = getAgentSessionSDKMessages(input.sessionId)
    expect(persisted[0]).toMatchObject({
      type: 'assistant',
      _errorCode: 'channel_not_found',
    })
    expect(harness.queryCalls).toHaveLength(0)
  })

  test('正常 result 完成时带 startedAt / resultSubtype，且完成前已持久化 assistant 与 result', async () => {
    const input = createRunnableInput(3_003)
    const harness = createAdapterHarness(async function* () {
      yield assistantTextMessage('助手回答')
      yield resultMessage('error_max_turns')
    })
    const orchestrator = new AgentOrchestrator(harness.adapter, new AgentEventBus())
    const recorder = createRecorder(input.sessionId)

    await orchestrator.sendMessage(input, recorder.callbacks)

    expect(recorder.errors).toEqual([])
    expect(recorder.completes).toHaveLength(1)
    expect(recorder.completes[0]?.opts).toEqual({
      startedAt: 3_003,
      resultSubtype: 'error_max_turns',
    })
    expect(recorder.completes[0]?.persistedTypes).toEqual(['user', 'assistant', 'result'])
    expect(getAgentSessionRuntimeEvents(input.sessionId).map((event) => event.event.type)).toEqual([
      'run_started',
      'assistant_message',
      'usage_updated',
      'run_failed',
    ])
  })

  test('assistant TypedError 不可重试时持久化错误消息后完成', async () => {
    const input = createRunnableInput(4_004)
    const harness = createAdapterHarness(async function* () {
      yield assistantErrorMessage('billing_error', 'Billing issue')
    })
    const orchestrator = new AgentOrchestrator(harness.adapter, new AgentEventBus())
    const recorder = createRecorder(input.sessionId)

    await orchestrator.sendMessage(input, recorder.callbacks)

    expect(recorder.errors).toEqual([])
    expect(recorder.completes).toHaveLength(1)
    expect(recorder.completes[0]?.opts).toEqual({ startedAt: 4_004 })
    expect(recorder.completes[0]?.persistedTypes).toEqual(['user', 'assistant'])
    const persisted = getAgentSessionSDKMessages(input.sessionId)
    expect(persisted[1]).toMatchObject({
      type: 'assistant',
      _errorCode: 'billing_error',
    })
  })

  test('assistant 可重试 TypedError 耗尽后只发送 retry exhausted 完成信号', async () => {
    const input = createRunnableInput(4_808)
    const harness = createAdapterHarness(async function* () {
      yield assistantErrorMessage('rate_limited', 'Rate limited')
    })
    const orchestrator = new AgentOrchestrator(harness.adapter, new AgentEventBus())
    const recorder = createRecorder(input.sessionId)

    await withImmediateTimers(() => orchestrator.sendMessage(input, recorder.callbacks))

    expect(harness.queryCalls).toHaveLength(9)
    expect(recorder.errors).toEqual(['重试 8 次后仍然失败: 请求频率限制: Rate limited'])
    expect(recorder.completes).toHaveLength(1)
    expect(recorder.completes[0]?.opts).toEqual({ startedAt: 4_808 })
    expect(recorder.completes[0]?.persistedTypes).toEqual(['user', 'assistant'])
    const persisted = getAgentSessionSDKMessages(input.sessionId)
    expect(persisted[1]).toMatchObject({
      type: 'assistant',
      _errorTitle: '重试失败',
    })
  })

  test('用户中止 catch 分支完成时传递 stoppedByUser 并保留 startedAt', async () => {
    const input = createRunnableInput(5_005)
    let orchestrator: AgentOrchestratorInstance
    const harness = createAdapterHarness(() => {
      orchestrator.stop(input.sessionId)
      throw new Error('Aborted by test')
    })
    orchestrator = new AgentOrchestrator(harness.adapter, new AgentEventBus())
    const recorder = createRecorder(input.sessionId)

    await orchestrator.sendMessage(input, recorder.callbacks)

    expect(harness.abortedSessions).toEqual([input.sessionId])
    expect(recorder.errors).toEqual([])
    expect(recorder.completes).toHaveLength(1)
    expect(recorder.completes[0]?.opts).toEqual({
      stoppedByUser: true,
      startedAt: 5_005,
    })
    expect(recorder.completes[0]?.persistedTypes).toEqual(['user'])
  })

  test('用户中止后 iterator 正常结束时也会补写 run_stopped', async () => {
    const input = createRunnableInput(5_015)
    let resolveStop: (() => void) | undefined
    const stopPromise = new Promise<void>((resolve) => {
      resolveStop = resolve
    })
    const harness = createAdapterHarness(async function* () {
      yield assistantTextMessage('先输出一点内容')
      await stopPromise
    })
    const orchestrator = new AgentOrchestrator(harness.adapter, new AgentEventBus())
    const recorder = createRecorder(input.sessionId)

    const runPromise = orchestrator.sendMessage(input, recorder.callbacks)

    await Promise.resolve()
    await Promise.resolve()
    orchestrator.stop(input.sessionId)
    resolveStop?.()
    await runPromise

    expect(recorder.errors).toEqual([])
    expect(recorder.completes).toHaveLength(1)
    expect(recorder.completes[0]?.opts).toEqual({
      stoppedByUser: true,
      startedAt: 5_015,
    })
    expect(recorder.completes[0]?.persistedTypes).toEqual(['user', 'assistant'])
    expect(getAgentSessionRuntimeEvents(input.sessionId).map((event) => event.event.type)).toEqual([
      'run_started',
      'assistant_message',
      'run_stopped',
    ])
  })

  test('Runner v2 用户中止后正常结束时也会补写 run_stopped', async () => {
    agentRuntimeRunnerV2.enabled = true
    const input = createRunnableInput(5_025)
    let resolveStop: (() => void) | undefined
    const stopPromise = new Promise<void>((resolve) => {
      resolveStop = resolve
    })
    const harness = createAdapterHarness(async function* () {
      yield assistantTextMessage('runner v2 先输出一点内容')
      await stopPromise
    })
    const orchestrator = new AgentOrchestrator(harness.adapter, new AgentEventBus())
    const recorder = createRecorder(input.sessionId)

    const runPromise = orchestrator.sendMessage(input, recorder.callbacks)

    await Promise.resolve()
    await Promise.resolve()
    orchestrator.stop(input.sessionId)
    resolveStop?.()
    await runPromise

    expect(recorder.errors).toEqual([])
    expect(recorder.completes).toHaveLength(1)
    expect(recorder.completes[0]?.opts).toEqual({
      stoppedByUser: true,
      startedAt: 5_025,
    })
    expect(recorder.completes[0]?.persistedTypes).toEqual(['user', 'assistant'])
    expect(getAgentSessionRuntimeEvents(input.sessionId).map((event) => event.event.type)).toEqual([
      'run_started',
      'assistant_message',
      'run_stopped',
    ])
  })

  test('Runner v2 会继续向 UI 推送 sdk_message payload', async () => {
    agentRuntimeRunnerV2.enabled = true
    const input = createRunnableInput(5_035)
    const harness = createAdapterHarness(async function* () {
      yield assistantTextMessage('runner v2 UI 可见内容')
      yield resultMessage('success')
    })
    const eventBus = new AgentEventBus()
    const sdkPayloadTypes: string[] = []
    eventBus.on((sessionId, payload) => {
      if (sessionId === input.sessionId && payload.kind === 'sdk_message') {
        sdkPayloadTypes.push(payload.message.type)
      }
    })
    const orchestrator = new AgentOrchestrator(harness.adapter, eventBus)
    const recorder = createRecorder(input.sessionId)

    await orchestrator.sendMessage(input, recorder.callbacks)

    expect(recorder.errors).toEqual([])
    expect(recorder.completes).toHaveLength(1)
    expect(sdkPayloadTypes).toEqual(['assistant', 'result'])
    expect(recorder.completes[0]?.persistedTypes).toEqual(['user', 'assistant', 'result'])
  })

  test('catch 不可重试错误只完成一次，并在完成前持久化错误消息', async () => {
    const input = createRunnableInput(5_505)
    const harness = createAdapterHarness(() => {
      throw new Error('Permanent failure')
    })
    const orchestrator = new AgentOrchestrator(harness.adapter, new AgentEventBus())
    const recorder = createRecorder(input.sessionId)

    await withImmediateTimers(() => orchestrator.sendMessage(input, recorder.callbacks))

    expect(harness.queryCalls).toHaveLength(1)
    expect(recorder.errors).toHaveLength(1)
    expect(recorder.errors[0]).toContain('Permanent failure')
    expect(recorder.completes).toHaveLength(1)
    expect(recorder.completes[0]?.opts).toEqual({ startedAt: 5_505 })
    expect(recorder.completes[0]?.persistedTypes).toEqual(['user', 'assistant'])
    const persisted = getAgentSessionSDKMessages(input.sessionId)
    expect(persisted[1]).toMatchObject({
      type: 'assistant',
      _errorCode: 'unknown_error',
      _errorTitle: '执行错误',
    })
  })

  test('catch 可重试错误耗尽后只发送 retry exhausted 完成信号', async () => {
    const input = createRunnableInput(5_808)
    const harness = createAdapterHarness(() => {
      throw new Error('fetch failed ECONNRESET')
    })
    const orchestrator = new AgentOrchestrator(harness.adapter, new AgentEventBus())
    const recorder = createRecorder(input.sessionId)

    await withImmediateTimers(() => orchestrator.sendMessage(input, recorder.callbacks))

    expect(harness.queryCalls).toHaveLength(9)
    expect(recorder.errors).toEqual(['重试 8 次后仍然失败: fetch failed ECONNRESET'])
    expect(recorder.completes).toHaveLength(1)
    expect(recorder.completes[0]?.opts).toEqual({ startedAt: 5_808 })
    expect(recorder.completes[0]?.persistedTypes).toEqual(['user', 'assistant'])
    const persisted = getAgentSessionSDKMessages(input.sessionId)
    expect(persisted[1]).toMatchObject({
      type: 'assistant',
      _errorTitle: '重试失败',
    })
  })

  test('session-not-found 恢复只在重试成功后完成一次', async () => {
    const input = createRunnableInput(6_006)
    updateAgentSessionMeta(input.sessionId, { sdkSessionId: 'expired-sdk-session' })
    let queryCount = 0
    const harness = createAdapterHarness(async function* () {
      queryCount += 1
      if (queryCount === 1) {
        yield assistantErrorMessage('unknown_error', 'No conversation found with session expired-sdk-session')
        return
      }
      yield resultMessage('success')
    })
    const orchestrator = new AgentOrchestrator(harness.adapter, new AgentEventBus())
    const recorder = createRecorder(input.sessionId)

    await orchestrator.sendMessage(input, recorder.callbacks)

    expect(queryCount).toBe(2)
    expect(recorder.completes).toHaveLength(1)
    expect(recorder.completes[0]?.opts).toEqual({
      startedAt: 6_006,
      resultSubtype: 'success',
    })
    expect(harness.queryCalls).toHaveLength(2)
    expect(harness.queryCalls[0]?.resumeSessionId).toBe('expired-sdk-session')
    expect(harness.queryCalls[1]?.resumeSessionId).toBeUndefined()
  })
})

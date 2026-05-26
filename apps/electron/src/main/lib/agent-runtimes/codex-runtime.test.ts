import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  validateAgentStreamEnvelope,
  type AgentRuntimeEvent,
  type AgentStreamEnvelope,
} from '@codeinsights/shared'
import type {
  CodexOptions,
  Input,
  ThreadEvent,
  ThreadOptions,
  TurnOptions,
} from '@openai/codex-sdk'
import { CodexAgentRuntime } from './codex-runtime'
import type {
  CodexAgentRuntimeDeps,
} from './codex-runtime'
import type {
  CodexSdkClientLike,
  CodexSdkThreadLike,
} from '../codex-runtime/codex-sdk-client'

const createdAt = '2026-05-25T00:00:00.000Z'

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

interface MockCodexRuntime {
  runtime: CodexAgentRuntime
  calls: {
    clientOptions: CodexOptions[]
    startThreadOptions: ThreadOptions[]
    resumeThreadCalls: Array<{ id: string; options?: ThreadOptions }>
    runStreamedCalls: Array<{ input: Input; options?: TurnOptions }>
    guardCalls: Array<{ repositoryRoot?: string; env: Record<string, string> }>
    cleanupCount: number
  }
}

function usage(): Extract<ThreadEvent, { type: 'turn.completed' }>['usage'] {
  return {
    input_tokens: 10,
    cached_input_tokens: 2,
    output_tokens: 5,
    reasoning_output_tokens: 1,
  }
}

function successEvents(threadId = 'thread-started'): ThreadEvent[] {
  return [
    { type: 'thread.started', thread_id: threadId },
    { type: 'turn.started' },
    { type: 'item.started', item: { id: 'msg-1', type: 'agent_message', text: '你好' } },
    { type: 'item.completed', item: { id: 'msg-1', type: 'agent_message', text: '你好，Codex' } },
    { type: 'turn.completed', usage: usage() },
  ]
}

async function* streamEvents(events: ThreadEvent[]): AsyncGenerator<ThreadEvent> {
  for (const event of events) {
    yield event
  }
}

async function collect(iterable: AsyncIterable<AgentStreamEnvelope>): Promise<AgentStreamEnvelope[]> {
  const envelopes: AgentStreamEnvelope[] = []
  for await (const envelope of iterable) {
    envelopes.push(envelope)
  }
  return envelopes
}

function runtimeEvents(envelopes: AgentStreamEnvelope[]): AgentRuntimeEvent[] {
  return envelopes.map((envelope) => envelope.event)
}

function lastEvent(envelopes: AgentStreamEnvelope[]): AgentRuntimeEvent | undefined {
  return envelopes.at(-1)?.event
}

function createMockRuntime(
  streamFactory: (options?: TurnOptions) => AsyncGenerator<ThreadEvent>,
  deps: Partial<CodexAgentRuntimeDeps> = {},
): MockCodexRuntime {
  const calls: MockCodexRuntime['calls'] = {
    clientOptions: [],
    startThreadOptions: [],
    resumeThreadCalls: [],
    runStreamedCalls: [],
    guardCalls: [],
    cleanupCount: 0,
  }

  const thread: CodexSdkThreadLike = {
    id: null,
    async runStreamed(input: Input, options?: TurnOptions) {
      calls.runStreamedCalls.push({ input, options })
      return { events: streamFactory(options) }
    },
  }
  const client: CodexSdkClientLike = {
    startThread(options?: ThreadOptions) {
      calls.startThreadOptions.push(options ?? {})
      return thread
    },
    resumeThread(id: string, options?: ThreadOptions) {
      calls.resumeThreadCalls.push({ id, options })
      return thread
    },
  }

  return {
    runtime: new CodexAgentRuntime({
      createCodexClient: async (options) => {
        calls.clientOptions.push(options)
        return client
      },
      buildCodexEnv: async () => ({
        PATH: '/usr/bin',
        CODEX_API_KEY: 'test-codex-key',
        CODEX_HOME: '/ambient/codex-home',
      }),
      resolveCodexRuntime: () => ({
        apiKey: 'channel-codex-key',
        baseUrl: 'https://codex.example.test/v1',
        model: 'channel-codex-model',
      }),
      resolveCodexAuth: () => ({ kind: 'api_key' }),
      createExecutionGuard: async (env, repositoryRoot) => {
        calls.guardCalls.push({ repositoryRoot, env })
        return {
          env: {
            ...env,
            CODEX_HOME: '/isolated/codex-home',
          },
          cleanup: async () => {
            calls.cleanupCount += 1
          },
        }
      },
      resolveCodexCliPath: () => '/mock/bin/codex',
      createRunId: () => 'run-codex-test',
      now: () => createdAt,
      ...deps,
    }),
    calls,
  }
}

describe('CodexAgentRuntime', () => {
  test('mock startThread 成功并输出 Codex runtime envelopes', async () => {
    const { runtime, calls } = createMockRuntime(() => streamEvents(successEvents()))
    const envelopes = await collect(runtime.run({
      sessionId: 'session-1',
      prompt: '实现 Phase 4',
      model: 'gpt-5.1-codex',
      workingDirectory: '/repo',
      additionalDirectories: ['/repo/packages/shared'],
      permissionMode: 'auto',
      modelReasoningEffort: 'high',
      networkAccessEnabled: true,
      webSearchMode: 'cached',
      channelId: 'agent-codex-channel',
    }))
    const events = runtimeEvents(envelopes)

    expect(envelopes.every((envelope) => validateAgentStreamEnvelope(envelope).ok)).toBe(true)
    expect(events.map((event) => event.type)).toEqual([
      'run_started',
      'sdk_session',
      'assistant_delta',
      'assistant_delta',
      'assistant_message',
      'usage_updated',
      'run_completed',
    ])
    expect(events[0]).toMatchObject({
      type: 'run_started',
      model: 'gpt-5.1-codex',
      cwd: '/repo',
      permissionMode: 'auto',
      runtimeKind: 'codex',
      runnerMode: 'runner-v2',
    })
    expect(events[1]).toEqual({ type: 'sdk_session', sdkSessionId: 'thread-started' })
    expect(lastEvent(envelopes)).toMatchObject({
      type: 'run_completed',
      sdkSessionId: 'thread-started',
    })
    expect(calls.clientOptions).toEqual([{
      codexPathOverride: '/mock/bin/codex',
      apiKey: 'channel-codex-key',
      baseUrl: 'https://codex.example.test/v1',
      env: {
        PATH: '/usr/bin',
        CODEX_HOME: '/isolated/codex-home',
      },
    }])
    expect(calls.startThreadOptions).toEqual([{
      model: 'gpt-5.1-codex',
      sandboxMode: 'workspace-write',
      workingDirectory: '/repo',
      skipGitRepoCheck: true,
      modelReasoningEffort: 'high',
      networkAccessEnabled: false,
      webSearchMode: 'cached',
      approvalPolicy: 'never',
      additionalDirectories: ['/repo/packages/shared'],
    }])
    expect(calls.runStreamedCalls[0]?.input).toBe('实现 Phase 4')
    expect(calls.runStreamedCalls[0]?.options?.signal).toBeInstanceOf(AbortSignal)
    expect(calls.guardCalls[0]?.repositoryRoot).toBe('/repo')
    expect(calls.cleanupCount).toBe(1)
  })

  test('未显式传入 model 时 run_started 使用实际渠道模型', async () => {
    const { runtime } = createMockRuntime(() => streamEvents(successEvents()))

    const events = runtimeEvents(await collect(runtime.run({
      sessionId: 'session-channel-model',
      prompt: '使用渠道模型',
      workingDirectory: '/repo',
      permissionMode: 'auto',
    })))

    expect(events[0]).toMatchObject({
      type: 'run_started',
      model: 'channel-codex-model',
    })
  })

  test('mock resumeThread 成功并暴露 resume external session id', async () => {
    const { runtime, calls } = createMockRuntime(() => streamEvents([
      { type: 'turn.started' },
      { type: 'item.completed', item: { id: 'msg-resume', type: 'agent_message', text: '继续完成' } },
      { type: 'turn.completed', usage: usage() },
    ]))

    const events = runtimeEvents(await collect(runtime.run({
      sessionId: 'session-resume',
      prompt: '继续',
      model: 'gpt-5.1-codex',
      workingDirectory: '/repo',
      permissionMode: 'auto',
      externalSessionId: 'thread-existing',
    })))

    expect(calls.startThreadOptions).toEqual([])
    expect(calls.resumeThreadCalls).toEqual([{ id: 'thread-existing', options: calls.resumeThreadCalls[0]?.options }])
    expect(events.map((event) => event.type)).toEqual([
      'run_started',
      'sdk_session',
      'assistant_message',
      'usage_updated',
      'run_completed',
    ])
    expect(events[1]).toEqual({
      type: 'sdk_session',
      sdkSessionId: 'thread-existing',
      resumeFrom: 'thread-existing',
    })
  })

  test('Agent Git 快照拦截 Codex 运行期间创建的真实 commit', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-codex-runtime-git-guard-'))
    try {
      git(repoRoot, ['init'])
      git(repoRoot, ['config', 'user.email', 'codex-runtime@example.test'])
      git(repoRoot, ['config', 'user.name', 'Codex Runtime'])
      writeFileSync(join(repoRoot, 'tracked.txt'), 'before\n', 'utf-8')
      git(repoRoot, ['add', 'tracked.txt'])
      git(repoRoot, ['commit', '-m', 'initial'])
      const initialHead = git(repoRoot, ['rev-parse', 'HEAD'])
      const { runtime } = createMockRuntime(async function* () {
        yield { type: 'thread.started', thread_id: 'thread-git-guard' }
        writeFileSync(join(repoRoot, 'tracked.txt'), 'after\n', 'utf-8')
        execFileSync('git', ['-C', repoRoot, 'add', 'tracked.txt'], { stdio: 'ignore' })
        execFileSync('git', ['-C', repoRoot, 'commit', '-m', 'bypass guard'], { stdio: 'ignore' })
        yield { type: 'turn.completed', usage: usage() }
      })

      const terminal = lastEvent(await collect(runtime.run({
        sessionId: 'session-git-guard',
        prompt: '尝试 commit',
        model: 'gpt-5.1-codex',
        workingDirectory: repoRoot,
        repositoryRoot: repoRoot,
        permissionMode: 'auto',
      })))

      expect(terminal).toMatchObject({
        type: 'run_failed',
        error: {
          code: 'codex_git_guard_violation',
        },
      })
      expect(git(repoRoot, ['rev-parse', 'HEAD'])).toBe(initialHead)
      expect(git(repoRoot, ['diff', '--name-only', 'HEAD'])).toBe('tracked.txt')
      expect(git(repoRoot, ['diff', '--cached', '--name-only'])).toBe('')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('mock stream throw 映射 run_failed', async () => {
    const { runtime } = createMockRuntime(async function* () {
      yield { type: 'thread.started', thread_id: 'thread-throw' }
      throw new Error('stream boom')
    })

    const terminal = lastEvent(await collect(runtime.run({
      sessionId: 'session-throw',
      prompt: '触发异常',
      model: 'gpt-5.1-codex',
      workingDirectory: '/repo',
      permissionMode: 'auto',
    })))

    expect(terminal).toMatchObject({
      type: 'run_failed',
      recoverable: false,
      error: {
        code: 'codex_stream_error',
        message: 'stream boom',
      },
    })
  })

  test('mock turn.failed 映射 run_failed', async () => {
    const { runtime } = createMockRuntime(() => streamEvents([
      { type: 'thread.started', thread_id: 'thread-failed' },
      { type: 'turn.failed', error: { message: 'Codex turn failed' } },
    ]))

    const terminal = lastEvent(await collect(runtime.run({
      sessionId: 'session-turn-failed',
      prompt: '失败',
      model: 'gpt-5.1-codex',
      workingDirectory: '/repo',
      permissionMode: 'auto',
    })))

    expect(terminal).toMatchObject({
      type: 'run_failed',
      recoverable: false,
      error: {
        code: 'codex_turn_failed',
        message: 'Codex turn failed',
      },
    })
  })

  test('abort before stream 映射 run_stopped 且不创建 Codex client', async () => {
    const controller = new AbortController()
    controller.abort()
    const { runtime, calls } = createMockRuntime(() => streamEvents(successEvents()))

    const events = runtimeEvents(await collect(runtime.run({
      sessionId: 'session-aborted-before',
      prompt: '不会执行',
      model: 'gpt-5.1-codex',
      workingDirectory: '/repo',
      permissionMode: 'auto',
      abortSignal: controller.signal,
    })))

    expect(events.map((event) => event.type)).toEqual(['run_started', 'run_stopped'])
    expect(events[1]).toEqual({ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' })
    expect(calls.clientOptions).toEqual([])
    expect(calls.cleanupCount).toBe(0)
  })

  test('run_started 后立即调用 runtime.abort 不会启动 Codex client', async () => {
    const { runtime, calls } = createMockRuntime(() => streamEvents(successEvents()))
    const envelopes: AgentStreamEnvelope[] = []

    for await (const envelope of runtime.run({
      sessionId: 'session-aborted-after-start',
      prompt: '不会创建 client',
      model: 'gpt-5.1-codex',
      workingDirectory: '/repo',
      permissionMode: 'auto',
    })) {
      envelopes.push(envelope)
      if (envelope.event.type === 'run_started') {
        runtime.abort('session-aborted-after-start')
      }
    }

    expect(runtimeEvents(envelopes).map((event) => event.type)).toEqual(['run_started', 'run_stopped'])
    expect(calls.clientOptions).toEqual([])
    expect(calls.cleanupCount).toBe(0)
  })

  test('abort during stream 映射 run_stopped', async () => {
    const controller = new AbortController()
    const { runtime } = createMockRuntime(async function* () {
      yield { type: 'thread.started', thread_id: 'thread-abort-during' }
      controller.abort()
      yield { type: 'item.completed', item: { id: 'msg-late', type: 'agent_message', text: 'late' } }
    })

    const events = runtimeEvents(await collect(runtime.run({
      sessionId: 'session-aborted-during',
      prompt: '中止',
      model: 'gpt-5.1-codex',
      workingDirectory: '/repo',
      permissionMode: 'auto',
      abortSignal: controller.signal,
    })))

    expect(events.map((event) => event.type)).toEqual(['run_started', 'sdk_session', 'run_stopped'])
  })

  test('stream 正常结束但 signal 已 aborted 时优先 run_stopped', async () => {
    const controller = new AbortController()
    const { runtime } = createMockRuntime(async function* () {
      yield { type: 'thread.started', thread_id: 'thread-normal-abort' }
      controller.abort()
    })

    const events = runtimeEvents(await collect(runtime.run({
      sessionId: 'session-normal-abort',
      prompt: '停止',
      model: 'gpt-5.1-codex',
      workingDirectory: '/repo',
      permissionMode: 'auto',
      abortSignal: controller.signal,
    })))

    expect(events.map((event) => event.type)).toEqual(['run_started', 'sdk_session', 'run_stopped'])
  })

  test('runtime.abort 会中止正在等待下一条事件的 stream', async () => {
    const { runtime } = createMockRuntime(async function* (options?: TurnOptions) {
      yield { type: 'thread.started', thread_id: 'thread-runtime-abort' }
      await new Promise<void>((resolve) => {
        options?.signal?.addEventListener('abort', () => resolve(), { once: true })
      })
      yield { type: 'item.completed', item: { id: 'msg-after-abort', type: 'agent_message', text: 'late' } }
    })

    const envelopes: AgentStreamEnvelope[] = []
    for await (const envelope of runtime.run({
      sessionId: 'session-runtime-abort',
      prompt: '等待中止',
      model: 'gpt-5.1-codex',
      workingDirectory: '/repo',
      permissionMode: 'auto',
    })) {
      envelopes.push(envelope)
      if (envelope.event.type === 'sdk_session') {
        runtime.abort('session-runtime-abort')
      }
    }

    expect(runtimeEvents(envelopes).map((event) => event.type)).toEqual([
      'run_started',
      'sdk_session',
      'run_stopped',
    ])
  })

  test('abort 后不会再启动下一次 SDK iterator 读取', async () => {
    let nextCalls = 0
    const customStream: AsyncGenerator<ThreadEvent> = {
      async next() {
        nextCalls += 1
        if (nextCalls === 1) {
          return {
            done: false,
            value: { type: 'thread.started', thread_id: 'thread-no-extra-next' },
          }
        }
        return {
          done: false,
          value: { type: 'item.completed', item: { id: 'msg-extra', type: 'agent_message', text: 'should not read' } },
        }
      },
      async return() {
        return { done: true, value: undefined as never }
      },
      async throw(error?: unknown) {
        throw error
      },
      [Symbol.asyncIterator]() {
        return this
      },
      async [Symbol.asyncDispose]() {},
    }
    const { runtime } = createMockRuntime(() => customStream)
    const envelopes: AgentStreamEnvelope[] = []

    for await (const envelope of runtime.run({
      sessionId: 'session-no-extra-next',
      prompt: '中止后不再读取',
      model: 'gpt-5.1-codex',
      workingDirectory: '/repo',
      permissionMode: 'auto',
    })) {
      envelopes.push(envelope)
      if (envelope.event.type === 'sdk_session') {
        runtime.abort('session-no-extra-next')
      }
    }

    expect(runtimeEvents(envelopes).map((event) => event.type)).toEqual([
      'run_started',
      'sdk_session',
      'run_stopped',
    ])
    expect(nextCalls).toBe(1)
  })

  test('同一 SDK 事件内 abort 时不会在 usage_updated 后继续输出 run_completed', async () => {
    const { runtime } = createMockRuntime(() => streamEvents([
      { type: 'thread.started', thread_id: 'thread-abort-before-terminal' },
      { type: 'turn.completed', usage: usage() },
    ]))
    const envelopes: AgentStreamEnvelope[] = []

    for await (const envelope of runtime.run({
      sessionId: 'session-abort-before-terminal',
      prompt: '终态前中止',
      model: 'gpt-5.1-codex',
      workingDirectory: '/repo',
      permissionMode: 'auto',
    })) {
      envelopes.push(envelope)
      if (envelope.event.type === 'usage_updated') {
        runtime.abort('session-abort-before-terminal')
      }
    }

    expect(runtimeEvents(envelopes).map((event) => event.type)).toEqual([
      'run_started',
      'sdk_session',
      'usage_updated',
      'run_stopped',
    ])
  })

  test('unsupported capability 返回结构化结果', async () => {
    const { runtime } = createMockRuntime(() => streamEvents(successEvents()))

    await expect(runtime.queueMessage({
      sessionId: 'session-unsupported',
      userMessage: '追加消息',
    })).resolves.toEqual({
      ok: false,
      code: 'runtime_capability_unsupported',
      runtimeKind: 'codex',
      capability: 'queueMessage',
      message: 'Codex Runtime 暂不支持 queueMessage。',
    })

    await expect(runtime.setPermissionMode('session-unsupported', 'plan')).resolves.toEqual({
      ok: false,
      code: 'runtime_capability_unsupported',
      runtimeKind: 'codex',
      capability: 'setPermissionMode',
      message: 'Codex Runtime 暂不支持 setPermissionMode。',
    })
  })
})

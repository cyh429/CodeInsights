import { describe, expect, test } from 'bun:test'
import {
  validateAgentStreamEnvelope,
  type AgentRuntimeEvent,
  type AgentStreamEnvelope,
} from '@codeinsights/shared'
import {
  OpencodeAgentRuntime,
  type OpencodeRuntimeClientLike,
  type OpencodeRuntimeClientStreamInput,
  type OpencodeRuntimeServerLease,
  type OpencodeRuntimeServerManagerLike,
} from './opencode-runtime'
import type { OpencodeRawEvent } from './opencode-event-adapter'

const createdAt = '2026-05-27T00:00:00.000Z'

interface MockRuntime {
  runtime: OpencodeAgentRuntime
  calls: {
    ensure: Array<{ sessionId: string; workingDirectory: string; model?: string; agent?: string; channelId?: string | null }>
    stream: OpencodeRuntimeClientStreamInput[]
    abort: Array<{ sessionId: string; externalSessionId?: string }>
    release: OpencodeRuntimeServerLease[]
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

function createMockRuntime(
  streamFactory: (input: OpencodeRuntimeClientStreamInput) => AsyncIterable<OpencodeRawEvent>,
): MockRuntime {
  const calls: MockRuntime['calls'] = {
    ensure: [],
    stream: [],
    abort: [],
    release: [],
  }
  const serverManager: OpencodeRuntimeServerManagerLike = {
    async ensure(input) {
      calls.ensure.push({
        sessionId: input.sessionId,
        workingDirectory: input.workingDirectory,
        model: input.model,
        agent: input.agent,
        channelId: input.channelId,
      })
      return { key: `server-${input.sessionId}`, endpoint: 'mock://opencode', version: '1.15.11' }
    },
    abort(input) {
      calls.abort.push(input)
    },
    release(lease) {
      calls.release.push(lease)
    },
  }
  const client: OpencodeRuntimeClientLike = {
    stream(input) {
      calls.stream.push(input)
      return streamFactory(input)
    },
  }
  return {
    runtime: new OpencodeAgentRuntime({
      serverManager,
      client,
      createRunId: () => 'run-opencode-test',
      now: () => createdAt,
    }),
    calls,
  }
}

async function* streamEvents(events: OpencodeRawEvent[]): AsyncIterable<OpencodeRawEvent> {
  for (const event of events) {
    yield event
  }
}

function successEvents(sessionId = 'ses_opencode_start'): OpencodeRawEvent[] {
  return [
    {
      id: 'evt-session-created',
      type: 'session.created',
      properties: {
        info: {
          id: sessionId,
          directory: '/repo',
          title: 'opencode mock',
          version: '1.15.11',
          time: { created: 1790400000000 },
        },
      },
    },
    {
      id: 'evt-text',
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'part_text_1',
          sessionID: sessionId,
          messageID: 'msg_assistant_1',
          type: 'text',
          text: 'Hello from opencode',
          time: { start: 1790400000100, end: 1790400000200 },
        },
        delta: 'Hello from opencode',
      },
    },
    {
      id: 'evt-usage',
      type: 'message.updated',
      properties: {
        info: {
          id: 'msg_assistant_1',
          sessionID: sessionId,
          role: 'assistant',
          time: { created: 1790400000100, completed: 1790400000200 },
          modelID: 'model',
          providerID: 'provider',
          cost: 0,
          tokens: {
            input: 10,
            output: 5,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          finish: 'stop',
        },
      },
    },
    {
      id: 'evt-idle',
      type: 'session.idle',
      properties: { sessionID: sessionId },
    },
  ]
}

describe('OpencodeAgentRuntime', () => {
  test('mock start 成功并复用 OpencodeEventAdapter 输出 runtime envelopes', async () => {
    const { runtime, calls } = createMockRuntime(() => streamEvents(successEvents()))

    const envelopes = await collect(runtime.run({
      sessionId: 'session-opencode-start',
      prompt: '实现 Phase 4',
      model: 'provider/model',
      agent: 'build',
      channelId: 'opencode-channel',
      workingDirectory: '/repo',
      permissionMode: 'auto',
    }))
    const events = runtimeEvents(envelopes)

    expect(envelopes.every((envelope) => validateAgentStreamEnvelope(envelope).ok)).toBe(true)
    expect(events.map((event) => event.type)).toEqual([
      'run_started',
      'sdk_session',
      'assistant_delta',
      'assistant_message',
      'usage_updated',
      'run_completed',
    ])
    expect(events[0]).toMatchObject({
      type: 'run_started',
      model: 'provider/model',
      cwd: '/repo',
      permissionMode: 'auto',
      runnerMode: 'runner-v2',
      runtimeKind: 'opencode',
    })
    expect(events[1]).toEqual({ type: 'sdk_session', sdkSessionId: 'ses_opencode_start' })
    expect(events.at(-1)).toMatchObject({
      type: 'run_completed',
      sdkSessionId: 'ses_opencode_start',
    })
    expect(envelopes.slice(1).every((envelope) => envelope.metadata?.runtimeKind === 'opencode')).toBe(true)
    expect(calls.ensure).toEqual([{
      sessionId: 'session-opencode-start',
      workingDirectory: '/repo',
      model: 'provider/model',
      agent: 'build',
      channelId: 'opencode-channel',
    }])
    expect(calls.stream[0]).toMatchObject({
      sessionId: 'session-opencode-start',
      prompt: '实现 Phase 4',
      model: 'provider/model',
      agent: 'build',
      workingDirectory: '/repo',
      permissionMode: 'auto',
    })
    expect(calls.release).toHaveLength(1)
  })

  test('已有 externalSessionId 时先暴露 resume sdk_session 且不等待 session.created', async () => {
    const { runtime } = createMockRuntime((input) => streamEvents(successEvents(input.externalSessionId)))

    const events = runtimeEvents(await collect(runtime.run({
      sessionId: 'session-opencode-resume',
      prompt: '继续',
      model: 'provider/old-model',
      agent: 'review',
      externalSessionId: 'ses_opencode_existing',
      workingDirectory: '/repo',
      permissionMode: 'plan',
    })))

    expect(events.slice(0, 2)).toEqual([
      {
        type: 'run_started',
        model: 'provider/old-model',
        cwd: '/repo',
        permissionMode: 'plan',
        runtimeHash: 'opencode-agent-runtime-mock',
        runnerMode: 'runner-v2',
        runtimeKind: 'opencode',
      },
      {
        type: 'sdk_session',
        sdkSessionId: 'ses_opencode_existing',
        resumeFrom: 'ses_opencode_existing',
      },
    ])
  })

  test('abort before stream 映射 run_stopped 且不启动 fake server', async () => {
    const controller = new AbortController()
    controller.abort()
    const { runtime, calls } = createMockRuntime(() => streamEvents(successEvents()))

    const events = runtimeEvents(await collect(runtime.run({
      sessionId: 'session-opencode-abort-before',
      prompt: '不会执行',
      model: 'provider/model',
      workingDirectory: '/repo',
      permissionMode: 'auto',
      abortSignal: controller.signal,
    })))

    expect(events.map((event) => event.type)).toEqual(['run_started', 'run_stopped'])
    expect(events[1]).toEqual({ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' })
    expect(calls.ensure).toEqual([])
    expect(calls.stream).toEqual([])
  })

  test('runtime.abort 会中止等待中的 fake stream 并输出 run_stopped', async () => {
    const { runtime, calls } = createMockRuntime(async function* (input) {
      yield successEvents('ses_opencode_abort')[0]!
      await new Promise<void>((resolve) => {
        input.signal.addEventListener('abort', () => resolve(), { once: true })
      })
      yield successEvents('ses_opencode_abort')[1]!
    })
    const envelopes: AgentStreamEnvelope[] = []

    for await (const envelope of runtime.run({
      sessionId: 'session-opencode-runtime-abort',
      prompt: '等待停止',
      model: 'provider/model',
      workingDirectory: '/repo',
      permissionMode: 'auto',
    })) {
      envelopes.push(envelope)
      if (envelope.event.type === 'sdk_session') {
        runtime.abort('session-opencode-runtime-abort')
      }
    }

    expect(runtimeEvents(envelopes).map((event) => event.type)).toEqual([
      'run_started',
      'sdk_session',
      'run_stopped',
    ])
    expect(calls.abort).toEqual([{ sessionId: 'session-opencode-runtime-abort' }])
  })

  test('stream 正常结束但没有终态时写入可解释 run_failed', async () => {
    const { runtime } = createMockRuntime(() => streamEvents([
      successEvents('ses_opencode_no_terminal')[0]!,
    ]))

    const terminal = runtimeEvents(await collect(runtime.run({
      sessionId: 'session-opencode-no-terminal',
      prompt: '缺少终态',
      model: 'provider/model',
      workingDirectory: '/repo',
      permissionMode: 'auto',
    }))).at(-1)

    expect(terminal).toMatchObject({
      type: 'run_failed',
      error: {
        code: 'opencode_stream_ended_without_terminal',
      },
    })
  })

  test('unsupported capability 返回结构化结果', async () => {
    const { runtime } = createMockRuntime(() => streamEvents(successEvents()))

    await expect(runtime.queueMessage({
      sessionId: 'session-opencode-unsupported',
      userMessage: '追加消息',
    })).resolves.toEqual({
      ok: false,
      code: 'runtime_capability_unsupported',
      runtimeKind: 'opencode',
      capability: 'queueMessage',
      message: 'opencode Runtime 暂不支持 queueMessage。',
    })

    await expect(runtime.setPermissionMode('session-opencode-unsupported', 'plan')).resolves.toEqual({
      ok: false,
      code: 'runtime_capability_unsupported',
      runtimeKind: 'opencode',
      capability: 'setPermissionMode',
      message: 'opencode Runtime 暂不支持 setPermissionMode。',
    })
  })
})

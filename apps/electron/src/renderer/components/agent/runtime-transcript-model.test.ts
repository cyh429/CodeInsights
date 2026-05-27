import { describe, expect, test } from 'bun:test'
import { createAgentStreamEnvelope, type SDKMessage } from '@codeinsights/shared'
import { selectRuntimeTranscript } from './runtime-transcript-model'

function userMessage(text: string, uuid: string, createdAt: number): SDKMessage {
  return {
    type: 'user',
    uuid,
    message: {
      content: [{ type: 'text', text }],
    },
    parent_tool_use_id: null,
    _createdAt: createdAt,
  } as SDKMessage
}

describe('runtime-transcript-model', () => {
  test('merges user messages with runtime assistant and tool events', () => {
    const runtimeEvents = [
      createAgentStreamEnvelope({
        sessionId: 's1',
        runId: 'run-1',
        sequence: 0,
        source: 'runtime_service',
        createdAt: '2026-05-25T00:00:00.000Z',
        event: { type: 'run_started', model: 'codex', cwd: '/tmp/project', permissionMode: 'auto', runtimeHash: 'hash', runtimeKind: 'codex' },
      }),
      createAgentStreamEnvelope({
        sessionId: 's1',
        runId: 'run-1',
        sequence: 1,
        source: 'codex_sdk',
        createdAt: '2026-05-25T00:00:01.000Z',
        event: { type: 'tool_started', toolCallId: 'tool-1', name: 'read_file', inputSummary: '{"path":"README.md"}', riskLevel: 'safe' },
      }),
      createAgentStreamEnvelope({
        sessionId: 's1',
        runId: 'run-1',
        sequence: 2,
        source: 'codex_sdk',
        createdAt: '2026-05-25T00:00:02.000Z',
        event: { type: 'tool_completed', toolCallId: 'tool-1', status: 'success', outputSummary: 'README 内容' },
      }),
      createAgentStreamEnvelope({
        sessionId: 's1',
        runId: 'run-1',
        sequence: 3,
        source: 'codex_sdk',
        createdAt: '2026-05-25T00:00:03.000Z',
        event: { type: 'assistant_message', messageId: 'assistant-1', contentBlocks: [{ type: 'text', text: '已阅读 README。' }], status: 'complete' },
      }),
    ]

    const selection = selectRuntimeTranscript({
      runtimeEvents,
      sdkMessages: [userMessage('请阅读 README', 'user-1', 1)],
    })

    expect(selection.items.map((item) => item.kind)).toEqual(['user', 'tool', 'assistant'])
    expect(selection.items[0]).toMatchObject({ kind: 'user', text: '请阅读 README' })
    expect(selection.items[1]).toMatchObject({ kind: 'tool', name: 'read_file', status: 'success', outputSummary: 'README 内容' })
    expect(selection.items[2]).toMatchObject({ kind: 'assistant', text: '已阅读 README。' })
  })

  test('assistant deltas are folded into one transcript item', () => {
    const selection = selectRuntimeTranscript({
      runtimeEvents: [
        createAgentStreamEnvelope({
          sessionId: 's1',
          runId: 'run-1',
          sequence: 0,
          source: 'codex_sdk',
          createdAt: '2026-05-25T00:00:00.000Z',
          event: { type: 'assistant_delta', messageId: 'a1', delta: '你' },
        }),
        createAgentStreamEnvelope({
          sessionId: 's1',
          runId: 'run-1',
          sequence: 1,
          source: 'codex_sdk',
          createdAt: '2026-05-25T00:00:00.000Z',
          event: { type: 'assistant_delta', messageId: 'a1', delta: '好' },
        }),
      ],
      sdkMessages: [],
    })

    expect(selection.items).toEqual([
      { kind: 'assistant', id: 'a1', text: '你好', createdAt: Date.parse('2026-05-25T00:00:00.000Z') },
    ])
  })

  test('multiple runs keep input order and bind one user prompt per run', () => {
    const runtimeEvents = [
      createAgentStreamEnvelope({
        sessionId: 's1',
        runId: 'run-1',
        sequence: 0,
        source: 'runtime_service',
        createdAt: '2026-05-25T00:00:00.000Z',
        event: { type: 'run_started', model: 'codex', cwd: '/tmp/project', permissionMode: 'auto', runtimeHash: 'hash-1', runtimeKind: 'codex' },
      }),
      createAgentStreamEnvelope({
        sessionId: 's1',
        runId: 'run-1',
        sequence: 1,
        source: 'codex_sdk',
        createdAt: '2026-05-25T00:00:00.000Z',
        event: { type: 'assistant_delta', messageId: 'a1', delta: '第一轮' },
      }),
      createAgentStreamEnvelope({
        sessionId: 's1',
        runId: 'run-2',
        sequence: 0,
        source: 'runtime_service',
        createdAt: '2026-05-25T00:00:00.000Z',
        event: { type: 'run_started', model: 'codex', cwd: '/tmp/project', permissionMode: 'auto', runtimeHash: 'hash-2', runtimeKind: 'codex' },
      }),
      createAgentStreamEnvelope({
        sessionId: 's1',
        runId: 'run-2',
        sequence: 1,
        source: 'codex_sdk',
        createdAt: '2026-05-25T00:00:00.000Z',
        event: { type: 'assistant_delta', messageId: 'a2', delta: '第二轮' },
      }),
    ]

    const selection = selectRuntimeTranscript({
      runtimeEvents,
      sdkMessages: [
        userMessage('第一轮问题', 'user-1', 1),
        userMessage('第二轮问题', 'user-2', 2),
      ],
    })

    expect(selection.items.map((item) => item.kind)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(selection.items[0]).toMatchObject({ kind: 'user', text: '第一轮问题' })
    expect(selection.items[2]).toMatchObject({ kind: 'user', text: '第二轮问题' })
    expect(selection.items[1]).toMatchObject({ kind: 'assistant', text: '第一轮' })
    expect(selection.items[3]).toMatchObject({ kind: 'assistant', text: '第二轮' })
  })

  test('missing runtime events is explicit in the selector result', () => {
    expect(selectRuntimeTranscript({ runtimeEvents: [], sdkMessages: [] }).hasRuntimeEvents).toBe(false)
  })

  test('opencode server events replay without a live opencode server dependency', () => {
    const selection = selectRuntimeTranscript({
      runtimeEvents: [
        createAgentStreamEnvelope({
          sessionId: 's-opencode',
          runId: 'run-opencode',
          sequence: 0,
          source: 'runtime_service',
          createdAt: '2026-05-27T00:00:00.000Z',
          event: {
            type: 'run_started',
            model: 'anthropic/claude-sonnet-4-5',
            cwd: '/tmp/project',
            permissionMode: 'auto',
            runtimeHash: 'hash',
            runtimeKind: 'opencode',
          },
        }),
        createAgentStreamEnvelope({
          sessionId: 's-opencode',
          runId: 'run-opencode',
          sequence: 1,
          source: 'opencode_server',
          createdAt: '2026-05-27T00:00:01.000Z',
          event: {
            type: 'assistant_message',
            messageId: 'msg-opencode',
            contentBlocks: [{ type: 'text', text: 'opencode 历史内容' }],
            status: 'complete',
          },
        }),
      ],
      sdkMessages: [userMessage('读取历史', 'user-opencode', 1)],
    })

    expect(selection.hasRuntimeEvents).toBe(true)
    expect(selection.items.map((item) => item.kind)).toEqual(['user', 'assistant'])
    expect(selection.items[1]).toMatchObject({ kind: 'assistant', text: 'opencode 历史内容' })
  })
})

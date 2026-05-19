import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SDKMessage } from '@rv-insights/shared'

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

const { getAgentSessionEventsPath } = await import('./config-paths')
const { getAgentSessionRuntimeEvents } = await import('./agent-session-manager')
const {
  appendAskUserResolvedRuntimeEvent,
  appendPermissionResolvedRuntimeEvent,
  finishAgentRuntimeEventLogRun,
  startAgentRuntimeEventLogRun,
} = await import('./agent-runtime-event-log')

let currentConfigDir: string | undefined

beforeEach(() => {
  currentConfigDir = mkdtempSync(join(tmpdir(), 'rv-agent-event-log-'))
  process.env.RV_INSIGHTS_CONFIG_DIR = currentConfigDir
})

afterEach(() => {
  if (currentConfigDir) {
    rmSync(currentConfigDir, { recursive: true, force: true })
  }
  delete process.env.RV_INSIGHTS_CONFIG_DIR
  currentConfigDir = undefined
})

describe('Agent runtime event log', () => {
  test('写入旁路 events JSONL 并分配 per-run sequence', () => {
    const sessionId = 'session-event-log-1'
    const writer = startAgentRuntimeEventLogRun({
      sessionId,
      model: 'claude-test',
      cwd: '/tmp/workspace',
      permissionMode: 'auto',
      resumeFrom: 'sdk-session-1',
    })

    const assistant: SDKMessage = {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: '你好' }],
      },
      parent_tool_use_id: null,
      uuid: 'assistant-1',
    } as unknown as SDKMessage
    writer.appendSDKMessage(assistant)

    const events = getAgentSessionRuntimeEvents(sessionId)
    expect(existsSync(getAgentSessionEventsPath(sessionId))).toBe(true)
    expect(events.map((event) => event.sequence)).toEqual([0, 1, 2])
    expect(events.map((event) => event.event.type)).toEqual(['run_started', 'sdk_session', 'assistant_message'])
    expect(events.every((event) => event.runId === writer.runId)).toBe(true)
  })

  test('同一 run 只写入一个终态', () => {
    const sessionId = 'session-event-log-terminal'
    const writer = startAgentRuntimeEventLogRun({
      sessionId,
      model: 'claude-test',
      cwd: '/tmp/workspace',
      permissionMode: 'auto',
    })

    writer.completeIfMissing({
      type: 'run_stopped',
      reason: 'user_abort',
      stoppedBy: 'user',
    })
    writer.completeIfMissing({
      type: 'run_completed',
      resultSubtype: 'success',
      usage: {},
    })

    const terminalEvents = getAgentSessionRuntimeEvents(sessionId).filter((event) => event.event.type.startsWith('run_') && event.event.type !== 'run_started')
    expect(terminalEvents.map((event) => event.event.type)).toEqual(['run_stopped'])
  })

  test('同一 run 内重复 sdk_session 只写入一次', () => {
    const sessionId = 'session-event-log-sdk-session-dedupe'
    const writer = startAgentRuntimeEventLogRun({
      sessionId,
      model: 'claude-test',
      cwd: '/tmp/workspace',
      permissionMode: 'auto',
    })

    writer.appendRuntimeEvent('claude_sdk', { type: 'sdk_session', sdkSessionId: 'sdk-session-1' })
    writer.appendRuntimeEvent('claude_sdk', { type: 'sdk_session', sdkSessionId: 'sdk-session-1' })
    writer.appendRuntimeEvent('claude_sdk', { type: 'sdk_session', sdkSessionId: 'sdk-session-2' })

    const sdkSessionEvents = getAgentSessionRuntimeEvents(sessionId)
      .map((event) => ({ sequence: event.sequence, event: event.event }))
      .filter((entry): entry is { sequence: number; event: { type: 'sdk_session'; sdkSessionId: string } } => entry.event.type === 'sdk_session')
    expect(sdkSessionEvents.map((event) => event.sequence)).toEqual([1, 2])
    expect(sdkSessionEvents.map((event) => event.event.sdkSessionId)).toEqual(['sdk-session-1', 'sdk-session-2'])
  })

  test('SDK result 同时写入 usage 与终态', () => {
    const sessionId = 'session-event-log-usage'
    const writer = startAgentRuntimeEventLogRun({
      sessionId,
      model: 'claude-test',
      cwd: '/tmp/workspace',
      permissionMode: 'auto',
    })

    writer.appendSDKMessage({
      type: 'result',
      subtype: 'success',
      session_id: 'sdk-session-usage',
      usage: {
        input_tokens: 12,
        output_tokens: 5,
      },
      total_cost_usd: 0.01,
    } as unknown as SDKMessage)

    expect(getAgentSessionRuntimeEvents(sessionId).map((event) => event.event.type)).toEqual([
      'run_started',
      'usage_updated',
      'run_completed',
    ])
  })

  test('权限和 AskUser resolved 写入活跃 run', () => {
    const sessionId = 'session-event-log-interactions'
    const writer = startAgentRuntimeEventLogRun({
      sessionId,
      model: 'claude-test',
      cwd: '/tmp/workspace',
      permissionMode: 'auto',
    })

    writer.appendStreamPayload({
      kind: 'rv_insights_event',
      event: {
        type: 'permission_request',
        request: {
          requestId: 'permission-1',
          sessionId,
          toolName: 'Write',
          toolInput: { file_path: 'a.txt' },
          description: '写入文件',
          dangerLevel: 'dangerous',
        },
      },
    })
    appendPermissionResolvedRuntimeEvent(sessionId, 'permission-1', 'allow')

    writer.appendStreamPayload({
      kind: 'rv_insights_event',
      event: {
        type: 'ask_user_request',
        request: {
          requestId: 'ask-1',
          sessionId,
          questions: [{ question: '继续吗？', options: [], multiSelect: false }],
          toolInput: {},
        },
      },
    })
    appendAskUserResolvedRuntimeEvent(sessionId, 'ask-1', { answer: '继续' })
    finishAgentRuntimeEventLogRun(sessionId, writer)

    expect(getAgentSessionRuntimeEvents(sessionId).map((event) => event.event.type)).toEqual([
      'run_started',
      'permission_requested',
      'permission_resolved',
      'ask_user_requested',
      'ask_user_resolved',
    ])
  })
})

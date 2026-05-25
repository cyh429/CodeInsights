import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentProviderAdapter, AgentSessionMeta, AgentStreamEnvelope, CodeInsightsPermissionMode, SDKMessage } from '@codeinsights/shared'
import { createAgentStreamEnvelope } from '@codeinsights/shared'
import {
  CodingAgentRuntimeRegistry,
  resolveAgentRuntimeSelection,
} from './agent-runtimes/coding-agent-runtime-registry'
import type {
  CodingAgentRuntime,
  CodingAgentRuntimeCapabilities,
  CodingAgentRuntimeRunInput,
  UnsupportedRuntimeCapabilityResult,
} from './agent-runtimes/coding-agent-runtime-types'

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

const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
const originalCodexRuntimeFlag = process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME
let tempConfigDir = ''

beforeEach(() => {
  tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-agent-orchestrator-'))
  process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
  delete process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME
})

afterEach(() => {
  if (originalConfigDir === undefined) {
    delete process.env.CODEINSIGHTS_CONFIG_DIR
  } else {
    process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
  }
  if (originalCodexRuntimeFlag === undefined) {
    delete process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME
  } else {
    process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME = originalCodexRuntimeFlag
  }
  if (tempConfigDir) {
    rmSync(tempConfigDir, { recursive: true, force: true })
    tempConfigDir = ''
  }
})

describe('AgentOrchestrator runtime routing selection', () => {
  test('Claude Code remains the default runtime', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: session({ runtimeKind: 'claude-code' }),
      settings: {},
    })).toEqual({
      kind: 'claude-code',
      source: 'default',
    })
  })

  test('new unbound session follows Codex settings despite legacy default runtimeKind', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: session({ runtimeKind: 'claude-code' }),
      settings: {
        agentRuntimeKind: 'codex',
        agentCodexChannelId: 'codex-channel',
        agentCodexModelId: 'gpt-5.1-codex',
      },
    })).toEqual({
      kind: 'codex',
      source: 'settings',
      channelId: 'codex-channel',
      model: 'gpt-5.1-codex',
    })
  })

  test('legacy sdkSessionId keeps existing Claude session on Claude runtime', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: session({ sdkSessionId: 'claude-sdk-session' }),
      settings: { agentRuntimeKind: 'codex' },
    })).toEqual({
      kind: 'claude-code',
      source: 'legacy-sdk-session',
      externalSessionId: 'claude-sdk-session',
    })
  })

  test('bound Codex runtime session keeps its thread even when settings changes', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: session({
        runtimeKind: 'codex',
        runtimeSession: {
          kind: 'codex',
          externalSessionId: 'codex-thread-1',
          createdAt: 100,
          updatedAt: 200,
        },
      }),
      settings: { agentRuntimeKind: 'claude-code' },
    })).toEqual({
      kind: 'codex',
      source: 'session',
      externalSessionId: 'codex-thread-1',
    })
  })
})

describe('AgentOrchestrator Codex runtime routing', () => {
  test('Codex feature flag 关闭时主进程阻止继续执行既有 Codex 会话', async () => {
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const {
      createAgentSession,
      getAgentSessionRuntimeEvents,
      getAgentSessionSDKMessages,
      updateAgentSessionMeta,
    } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({ agentRuntimeKind: 'claude-code' })
    const session = createAgentSession('Codex 已关闭会话')
    updateAgentSessionMeta(session.id, {
      runtimeKind: 'codex',
      runtimeSession: {
        kind: 'codex',
        externalSessionId: 'codex-thread-disabled',
        createdAt: 100,
        updatedAt: 100,
      },
    })
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus())
    const errors: string[] = []
    const completions: unknown[] = []

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: (error) => errors.push(error),
      onComplete: (_messages, opts) => completions.push(opts ?? {}),
      onTitleUpdated: () => {},
    })

    expect(errors[0]).toContain('Codex Runtime 已关闭')
    expect(completions).toHaveLength(1)
    expect(getAgentSessionRuntimeEvents(session.id)).toEqual([])
    const sdkMessages = getAgentSessionSDKMessages(session.id)
    expect(sdkMessages).toHaveLength(1)
    expect((sdkMessages[0] as unknown as { _errorCode?: string })._errorCode).toBe('codex_runtime_disabled')
  })

  test('settings 选择 Codex 时持久化 runtimeSession 并写 runtime event log', async () => {
    process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession, getAgentSessionMeta, getAgentSessionRuntimeEvents } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({
      agentRuntimeKind: 'codex',
      agentCodexChannelId: 'codex-channel-1',
      agentCodexModelId: 'codex-mock-model',
    })
    const session = createAgentSession('Codex 测试会话')
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createFakeCodexRuntime([
      { type: 'run_started' },
      { type: 'sdk_session', id: 'codex-thread-1' },
      { type: 'assistant_message' },
      { type: 'run_completed' },
    ]))
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })
    const completions: Array<{ stoppedByUser?: boolean; resultSubtype?: string }> = []

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: () => {},
      onComplete: (_messages, opts) => completions.push(opts ?? {}),
      onTitleUpdated: () => {},
    })

    const meta = getAgentSessionMeta(session.id)
    expect(meta?.runtimeKind).toBe('codex')
    expect(meta?.runtimeSession?.externalSessionId).toBe('codex-thread-1')
    expect(meta?.runtimeSession?.channelId).toBe('codex-channel-1')
    expect(meta?.runtimeSession?.model).toBe('codex-mock-model')
    expect(meta?.sdkSessionId).toBeUndefined()
    expect(completions[0]?.resultSubtype).toBe('success')
    expect(getAgentSessionRuntimeEvents(session.id).map((event) => event.event.type)).toEqual([
      'run_started',
      'sdk_session',
      'assistant_message',
      'run_completed',
    ])
  })

  test('stop 后 Codex runtime 的 late run_completed 不会落入 event log', async () => {
    process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession, getAgentSessionRuntimeEvents } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({ agentRuntimeKind: 'codex' })
    const session = createAgentSession('Codex 停止会话')
    const registry = new CodingAgentRuntimeRegistry()
    let orchestrator: InstanceType<typeof AgentOrchestrator>
    registry.register(createFakeCodexRuntime([
      { type: 'run_started' },
      { type: 'sdk_session', id: 'codex-thread-stop' },
      { type: 'late_run_completed_after_stop' },
    ], () => orchestrator.stop(session.id)))
    orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })
    const completions: Array<{ stoppedByUser?: boolean }> = []

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: () => {},
      onComplete: (_messages, opts) => completions.push(opts ?? {}),
      onTitleUpdated: () => {},
    })

    const terminalEvents = getAgentSessionRuntimeEvents(session.id)
      .map((event) => event.event.type)
      .filter((type) => type === 'run_completed' || type === 'run_stopped')
    expect(terminalEvents).toEqual(['run_stopped'])
    expect(completions[0]?.stoppedByUser).toBe(true)
  })
})

function session(overrides: Partial<AgentSessionMeta>): AgentSessionMeta {
  return {
    id: 'session-runtime-routing',
    title: 'Runtime Routing',
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  }
}

function createSendInput(sessionId: string) {
  return {
    sessionId,
    userMessage: '请运行 Codex mock',
    channelId: 'unused-claude-channel',
  }
}

function createUnusedAdapter(): AgentProviderAdapter {
  return {
    query: async function* (): AsyncIterable<SDKMessage> {
      throw new Error('Claude adapter should not be used in Codex routing tests')
    },
    abort: () => {},
    dispose: () => {},
  }
}

type FakeCodexStep =
  | { type: 'run_started' }
  | { type: 'sdk_session'; id: string }
  | { type: 'assistant_message' }
  | { type: 'run_completed' }
  | { type: 'late_run_completed_after_stop' }

function createFakeCodexRuntime(
  steps: FakeCodexStep[],
  afterSdkSession?: () => void,
): CodingAgentRuntime {
  return {
    kind: 'codex',
    getCapabilities: () => codexCapabilities(),
    run: async function* (input: CodingAgentRuntimeRunInput): AsyncIterable<AgentStreamEnvelope> {
      let sequence = 0
      const nextEnvelope = (event: AgentStreamEnvelope['event']): AgentStreamEnvelope => createAgentStreamEnvelope({
        sessionId: input.sessionId,
        runId: 'run-codex-test',
        sequence: sequence++,
        source: event.type === 'sdk_session' || event.type === 'assistant_message' ? 'codex_sdk' : 'runtime_service',
        createdAt: '2026-05-25T00:00:00.000Z',
        event,
      })

      for (const step of steps) {
        if (step.type === 'run_started') {
          yield nextEnvelope({
            type: 'run_started',
            model: input.model ?? 'codex-mock-model',
            cwd: input.workingDirectory,
            permissionMode: input.permissionMode,
            runtimeHash: 'codex-test',
            runnerMode: 'runner-v2',
            runtimeKind: 'codex',
          })
        } else if (step.type === 'sdk_session') {
          yield nextEnvelope({ type: 'sdk_session', sdkSessionId: step.id })
          afterSdkSession?.()
        } else if (step.type === 'assistant_message') {
          yield nextEnvelope({
            type: 'assistant_message',
            messageId: 'codex-message-1',
            contentBlocks: [{ type: 'text', text: 'Codex mock response' }],
            status: 'complete',
          })
        } else {
          yield nextEnvelope({
            type: 'run_completed',
            resultSubtype: 'success',
            terminalReason: 'completed',
            usage: {},
            sdkSessionId: 'codex-thread-1',
          })
        }
      }
    },
    abort: () => {},
    queueMessage: async () => unsupported('queueMessage'),
    setPermissionMode: async (_sessionId: string, _mode: CodeInsightsPermissionMode) => unsupported('setPermissionMode'),
    dispose: () => {},
  }
}

function codexCapabilities(): CodingAgentRuntimeCapabilities {
  return {
    runtimeKind: 'codex',
    supportsStreamEvents: true,
    supportsResumeThread: true,
    supportsAbort: true,
    supportsQueueMessage: false,
    supportsSetPermissionMode: false,
    supportsPerToolPermission: false,
  }
}

function unsupported(capability: 'queueMessage' | 'setPermissionMode'): UnsupportedRuntimeCapabilityResult {
  return {
    ok: false,
    code: 'runtime_capability_unsupported',
    runtimeKind: 'codex',
    capability,
    message: 'unsupported',
  }
}

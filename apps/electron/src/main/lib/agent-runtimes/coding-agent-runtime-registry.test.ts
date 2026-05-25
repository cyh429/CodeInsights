import { describe, expect, test } from 'bun:test'
import type { AgentSessionMeta } from '@codeinsights/shared'
import {
  CodingAgentRuntimeRegistry,
  resolveAgentRuntimeSelection,
} from './coding-agent-runtime-registry'
import type {
  CodingAgentRuntime,
  CodingAgentRuntimeCapabilities,
} from './coding-agent-runtime-types'

describe('CodingAgentRuntimeRegistry', () => {
  test('注册、获取并列出 runtime capabilities', () => {
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createRuntime('claude-code'))
    registry.register(createRuntime('codex'))

    expect(registry.require('claude-code').kind).toBe('claude-code')
    expect(registry.require('codex').kind).toBe('codex')
    expect(registry.listCapabilities().map((item) => item.runtimeKind).sort()).toEqual(['claude-code', 'codex'])
  })

  test('dispose 会释放所有 runtime 并清空注册表', () => {
    const disposed: string[] = []
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createRuntime('claude-code', disposed))
    registry.register(createRuntime('codex', disposed))

    registry.dispose()

    expect(disposed.sort()).toEqual(['claude-code', 'codex'])
    expect(() => registry.require('claude-code')).toThrow('未注册 Coding Agent Runtime')
  })
})

describe('resolveAgentRuntimeSelection', () => {
  test('默认选择 Claude Code runtime', () => {
    expect(resolveAgentRuntimeSelection({})).toEqual({
      kind: 'claude-code',
      source: 'default',
    })
  })

  test('legacy sdkSessionId 强制选择 Claude Code', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: createSession({ sdkSessionId: 'sdk-session-1' }),
      settings: { agentRuntimeKind: 'codex', agentCodexChannelId: 'codex-channel' },
    })).toEqual({
      kind: 'claude-code',
      source: 'legacy-sdk-session',
      externalSessionId: 'sdk-session-1',
    })
  })

  test('settings 选择 Codex 时未绑定新会话使用 Codex', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: createSession({ runtimeKind: 'claude-code' }),
      settings: {
        agentRuntimeKind: 'codex',
        agentCodexChannelId: null,
        agentCodexModelId: 'gpt-5.1-codex',
      },
    })).toEqual({
      kind: 'codex',
      source: 'settings',
      channelId: null,
      model: 'gpt-5.1-codex',
    })
  })

  test('已绑定 Claude session 不被 settings 切到 Codex', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: createSession({
        runtimeKind: 'claude-code',
        runtimeSession: {
          kind: 'claude-code',
          externalSessionId: 'sdk-session-bound',
          createdAt: 100,
          updatedAt: 200,
        },
      }),
      settings: { agentRuntimeKind: 'codex' },
    })).toEqual({
      kind: 'claude-code',
      source: 'session',
      externalSessionId: 'sdk-session-bound',
    })
  })

  test('已绑定 Codex session 不被 settings 切到 Claude', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: createSession({
        runtimeKind: 'codex',
        runtimeSession: {
          kind: 'codex',
          externalSessionId: 'codex-thread-bound',
          channelId: 'codex-channel-bound',
          model: 'gpt-5.1-codex-bound',
          createdAt: 100,
          updatedAt: 200,
        },
      }),
      settings: { agentRuntimeKind: 'claude-code' },
    })).toEqual({
      kind: 'codex',
      source: 'session',
      externalSessionId: 'codex-thread-bound',
      channelId: 'codex-channel-bound',
      model: 'gpt-5.1-codex-bound',
    })
  })
})

function createRuntime(
  kind: 'claude-code' | 'codex',
  disposed: string[] = [],
): CodingAgentRuntime {
  const capabilities: CodingAgentRuntimeCapabilities = {
    runtimeKind: kind,
    supportsStreamEvents: true,
    supportsResumeThread: true,
    supportsAbort: true,
    supportsQueueMessage: kind === 'claude-code',
    supportsSetPermissionMode: kind === 'claude-code',
    supportsPerToolPermission: kind === 'claude-code',
  }

  return {
    kind,
    getCapabilities: () => capabilities,
    run: async function* () {},
    abort: () => {},
    queueMessage: async () => ({
      ok: false,
      code: 'runtime_capability_unsupported',
      runtimeKind: kind,
      capability: 'queueMessage',
      message: 'unsupported',
    }),
    setPermissionMode: async () => ({
      ok: false,
      code: 'runtime_capability_unsupported',
      runtimeKind: kind,
      capability: 'setPermissionMode',
      message: 'unsupported',
    }),
    dispose: () => {
      disposed.push(kind)
    },
  }
}

function createSession(overrides: Partial<AgentSessionMeta>): AgentSessionMeta {
  return {
    id: 'session-1',
    title: 'Agent 会话',
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  }
}

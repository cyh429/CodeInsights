import { describe, expect, test } from 'bun:test'
import type { AgentSessionMeta, Channel } from '@codeinsights/shared'
import {
  cleanupAgentCodexChannelId,
  getCodexCompatibleChannels,
  isAgentCodexRuntimeFeatureEnabled,
  isAgentOpencodeRuntimeFeatureEnabled,
  resolveEnabledAgentRuntimeKind,
  resolveAgentSessionRuntimeKind,
  shouldUseRuntimeTranscript,
} from './agent-runtime-ui'

function channel(input: Partial<Channel> & Pick<Channel, 'id' | 'provider'>): Channel {
  return {
    id: input.id,
    name: input.name ?? input.id,
    provider: input.provider,
    baseUrl: input.baseUrl ?? '',
    apiKey: input.apiKey ?? 'encrypted',
    models: input.models ?? [],
    enabled: input.enabled ?? true,
    createdAt: input.createdAt ?? 1,
    updatedAt: input.updatedAt ?? 1,
  }
}

describe('agent-runtime-ui', () => {
  test('Codex runtime feature flag is closed by default', () => {
    expect(isAgentCodexRuntimeFeatureEnabled()).toBe(false)
    expect(isAgentCodexRuntimeFeatureEnabled(true)).toBe(true)
    expect(isAgentOpencodeRuntimeFeatureEnabled()).toBe(false)
    expect(isAgentOpencodeRuntimeFeatureEnabled(true)).toBe(true)
    expect(resolveEnabledAgentRuntimeKind('opencode', { codex: false, opencode: false })).toBe('claude-code')
    expect(resolveEnabledAgentRuntimeKind('opencode', { codex: false, opencode: true })).toBe('opencode')
  })

  test('Codex channel dropdown only keeps enabled OpenAI or Custom channels', () => {
    const channels = [
      channel({ id: 'openai', provider: 'openai' }),
      channel({ id: 'custom', provider: 'custom' }),
      channel({ id: 'disabled', provider: 'openai', enabled: false }),
      channel({ id: 'anthropic', provider: 'anthropic' }),
    ]

    expect(getCodexCompatibleChannels(channels).map((item) => item.id)).toEqual(['openai', 'custom'])
  })

  test('invalid agentCodexChannelId is cleaned while native auth is preserved', () => {
    const channels = [channel({ id: 'codex-channel', provider: 'custom' })]

    expect(cleanupAgentCodexChannelId('codex-channel', channels)).toBe('codex-channel')
    expect(cleanupAgentCodexChannelId('missing', channels)).toBeUndefined()
    expect(cleanupAgentCodexChannelId(null, channels)).toBeNull()
    expect(cleanupAgentCodexChannelId(undefined, channels)).toBeUndefined()
  })

  test('session runtime binding wins over current settings', () => {
    const codexSession: AgentSessionMeta = {
      id: 's1',
      title: 'Codex',
      runtimeKind: 'codex',
      runtimeSession: {
        kind: 'codex',
        externalSessionId: 'thread-1',
        createdAt: 1,
        updatedAt: 1,
      },
      createdAt: 1,
      updatedAt: 1,
    }

    expect(resolveAgentSessionRuntimeKind(codexSession, 'claude-code')).toBe('codex')
    expect(shouldUseRuntimeTranscript(codexSession, 'claude-code')).toBe(true)
    expect(resolveAgentSessionRuntimeKind({
      id: 's-opencode',
      title: 'opencode',
      runtimeKind: 'opencode',
      runtimeSession: {
        kind: 'opencode',
        externalSessionId: 'ses_1',
        createdAt: 1,
        updatedAt: 1,
      },
      createdAt: 1,
      updatedAt: 1,
    }, 'claude-code')).toBe('opencode')
    expect(resolveAgentSessionRuntimeKind(undefined, 'claude-code')).toBe('claude-code')
    expect(resolveAgentSessionRuntimeKind({
      id: 's2',
      title: 'New session',
      runtimeKind: 'claude-code',
      createdAt: 1,
      updatedAt: 1,
    }, 'codex')).toBe('codex')
  })
})

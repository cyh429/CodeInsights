import { describe, expect, test } from 'bun:test'
import {
  buildOpencodeChannelApiKeyEnvName,
  createOpencodeAuthState,
  createOpencodeSecretFingerprint,
} from './opencode-auth'

describe('opencode-auth', () => {
  test('为 channel key 生成稳定 scoped env 名称且不包含 secret', () => {
    const envName = buildOpencodeChannelApiKeyEnvName({
      channelId: 'channel-1',
      providerId: 'custom',
      modelId: 'gpt-5.1-codex',
    })

    expect(envName).toStartWith('CODEINSIGHTS_OPENCODE_CHANNEL_CUSTOM_')
    expect(envName).toEndWith('_API_KEY')
    expect(envName).not.toContain('secret')
  })

  test('channel auth 只在 env 中携带 secret，summary 与 hash 不输出原文', () => {
    const state = createOpencodeAuthState({
      source: 'channel',
      channelId: 'channel-1',
      providerId: 'custom',
      baseUrl: 'https://api.example.test/v1',
      modelId: 'gpt-5.1-codex',
      apiKey: 'sk-secret-value',
    })

    expect(state.source).toBe('channel')
    expect(state.env[state.apiKeyEnvName ?? '']).toBe('sk-secret-value')
    expect(state.authSourceHash).toStartWith('sha256:')
    expect(state.redactedSummary).toEqual({
      source: 'channel',
      channelId: 'channel-1',
      providerId: 'custom',
      baseUrl: 'https://api.example.test/v1',
      apiKeyFingerprint: createOpencodeSecretFingerprint('sk-secret-value'),
    })
    expect(JSON.stringify(state.redactedSummary)).not.toContain('sk-secret-value')
    expect(state.authSourceHash).not.toContain('sk-secret-value')
  })

  test('native auth 不注入 channel secret', () => {
    const state = createOpencodeAuthState({
      source: 'native',
      modelId: 'anthropic/claude-sonnet',
    })

    expect(state.source).toBe('native')
    expect(state.env).toEqual({})
    expect(state.apiKeyEnvName).toBeUndefined()
    expect(state.redactedSummary).toEqual({ source: 'native' })
  })
})

import { describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

mock.module('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
  app: {
    isPackaged: false,
    getPath: () => '',
  },
}))

const { providerSupportsCodexChannel, resolveCodexRuntime } = await import('./codex-channel')
const { createChannel } = await import('../channel-manager')

describe('codex-channel', () => {
  test('仅支持 OpenAI 和 Custom OpenAI 兼容渠道', () => {
    expect(providerSupportsCodexChannel('openai')).toBe(true)
    expect(providerSupportsCodexChannel('custom')).toBe(true)
    expect(providerSupportsCodexChannel('anthropic')).toBe(false)
  })

  test('读取 OpenAI 渠道 apiKey/baseUrl/model', () => {
    const previousConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-codex-channel-openai-'))
    process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
    try {
      const channel = createChannel({
        name: 'OpenAI 渠道',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai-test',
        enabled: true,
        models: [
          { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', enabled: false },
          { id: 'gpt-5.4', name: 'GPT-5.4', enabled: true },
        ],
      })

      expect(resolveCodexRuntime(channel.id)).toEqual({
        apiKey: 'sk-openai-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.4',
      })
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.CODEINSIGHTS_CONFIG_DIR
      } else {
        process.env.CODEINSIGHTS_CONFIG_DIR = previousConfigDir
      }
      rmSync(tempConfigDir, { recursive: true, force: true })
    }
  })

  test('读取 Custom 渠道并拒绝非 OpenAI 兼容或禁用渠道', () => {
    const previousConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-codex-channel-custom-'))
    process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
    try {
      const customChannel = createChannel({
        name: 'Custom 渠道',
        provider: 'custom',
        baseUrl: 'https://llm.example.com/v1',
        apiKey: 'sk-custom-test',
        enabled: true,
        models: [{ id: 'custom-codex-model', name: 'Custom Codex', enabled: true }],
      })
      const anthropicChannel = createChannel({
        name: 'Claude 渠道',
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-test',
        enabled: true,
        models: [{ id: 'claude-sonnet-4-6', name: 'Claude', enabled: true }],
      })
      const disabledChannel = createChannel({
        name: '禁用渠道',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-disabled-test',
        enabled: false,
        models: [{ id: 'gpt-5.4', name: 'GPT-5.4', enabled: true }],
      })

      expect(resolveCodexRuntime(customChannel.id)).toMatchObject({
        apiKey: 'sk-custom-test',
        baseUrl: 'https://llm.example.com/v1',
        model: 'custom-codex-model',
      })
      expect(() => resolveCodexRuntime(anthropicChannel.id)).toThrow(/OpenAI 或 Custom 渠道/)
      expect(() => resolveCodexRuntime(disabledChannel.id)).toThrow(/Codex 渠道已禁用/)
      expect(() => resolveCodexRuntime('missing-channel')).toThrow(/未找到 Codex 渠道/)
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.CODEINSIGHTS_CONFIG_DIR
      } else {
        process.env.CODEINSIGHTS_CONFIG_DIR = previousConfigDir
      }
      rmSync(tempConfigDir, { recursive: true, force: true })
    }
  })
})

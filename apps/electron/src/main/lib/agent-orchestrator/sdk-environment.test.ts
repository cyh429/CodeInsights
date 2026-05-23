import { describe, expect, mock, test } from 'bun:test'
import { join } from 'node:path'

mock.module('electron', () => ({
  app: {
    isPackaged: false,
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
  },
}))

const { buildSdkEnv, resolveSDKCliPath } = await import('../agent-sdk-env')

const baseEnv = {
  PATH: '/usr/bin',
  HOME: '/Users/tester',
  ANTHROPIC_AUTH_TOKEN: 'leaked-token',
  ANTHROPIC_MODEL: 'leaked-model',
  ANTHROPIC_CUSTOM_HEADERS: 'leaked-header',
}

describe('buildSdkEnv', () => {
  test('普通 Provider 使用 API Key 并清理未显式管理的 ANTHROPIC 变量', async () => {
    const env = await buildSdkEnv(
      {
        apiKey: 'test-key',
        baseUrl: 'https://api.anthropic.com',
        provider: 'anthropic',
      },
      {
        env: baseEnv,
        platform: 'darwin',
        getEffectiveProxyUrl: async () => undefined,
        getRuntimeStatus: () => null,
        getSdkConfigDir: () => '/tmp/sdk-config',
      },
    )

    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/Users/tester')
    expect(env.CLAUDE_CONFIG_DIR).toBe('/tmp/sdk-config')
    expect(env.ANTHROPIC_API_KEY).toBe('test-key')
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('')
    expect(env.ANTHROPIC_MODEL).toBe('')
    expect(env.ANTHROPIC_CUSTOM_HEADERS).toBe('')
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined()
  })

  test('Kimi Coding 使用 Bearer 认证和 User-Agent，并覆盖泄漏的 API Key', async () => {
    const env = await buildSdkEnv(
      {
        apiKey: 'kimi-key',
        baseUrl: 'https://kimi.example.com/anthropic/',
        provider: 'kimi-coding',
      },
      {
        env: { ...baseEnv, ANTHROPIC_API_KEY: 'leaked-api-key' },
        platform: 'darwin',
        getEffectiveProxyUrl: async () => undefined,
        getRuntimeStatus: () => null,
        getSdkConfigDir: () => '/tmp/sdk-config',
        normalizeAnthropicBaseUrlForSdk: (baseUrl) => `normalized:${baseUrl}`,
      },
    )

    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('kimi-key')
    expect(env.ANTHROPIC_CUSTOM_HEADERS).toBe('User-Agent: KimiCLI/1.3')
    expect(env.ANTHROPIC_API_KEY).toBe('')
    expect(env.ANTHROPIC_MODEL).toBe('')
    expect(env.ANTHROPIC_BASE_URL).toBe('normalized:https://kimi.example.com/anthropic/')
  })

  test('注入代理和 Windows Git Bash shell 配置', async () => {
    const env = await buildSdkEnv(
      {
        apiKey: 'test-key',
        provider: 'anthropic',
      },
      {
        env: baseEnv,
        platform: 'win32',
        getEffectiveProxyUrl: async () => 'http://127.0.0.1:7890',
        getRuntimeStatus: () => ({
          shell: {
            gitBash: { available: true, path: 'C:\\Program Files\\Git\\bin\\bash.exe' },
            wsl: { available: false },
          },
        }),
        getSdkConfigDir: () => '/tmp/sdk-config',
      },
    )

    expect(env.HTTPS_PROXY).toBe('http://127.0.0.1:7890')
    expect(env.HTTP_PROXY).toBe('http://127.0.0.1:7890')
    expect(env.CLAUDE_CODE_SHELL).toBe('C:\\Program Files\\Git\\bin\\bash.exe')
    expect(env.CLAUDE_BASH_NO_LOGIN).toBe('1')
  })
})

describe('resolveSDKCliPath', () => {
  test('无法通过 require 解析时使用模块目录 fallback', () => {
    const moduleDir = '/Applications/CodeInsights.app/Contents/Resources/app/dist'
    const cliPath = resolveSDKCliPath({
      platform: 'win32',
      arch: 'x64',
      moduleFilename: join(moduleDir, 'main.cjs'),
      moduleDir,
      isPackaged: false,
      resolveWithCreateRequire: () => {
        throw new Error('createRequire unavailable')
      },
      resolveWithRequire: () => {
        throw new Error('require unavailable')
      },
    })

    expect(cliPath).toBe('/Applications/CodeInsights.app/Contents/Resources/app/node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe')
  })
})

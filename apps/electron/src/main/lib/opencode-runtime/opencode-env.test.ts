import { describe, expect, test } from 'bun:test'
import {
  buildOpencodeBaseEnv,
  isReservedOpencodeExternalEnvName,
  mergeOpencodeScopedSecretEnv,
} from './opencode-env'

describe('opencode-env', () => {
  test('base env 只保留运行所需变量并过滤宿主 secret', () => {
    const env = buildOpencodeBaseEnv({
      PATH: '/usr/bin',
      HOME: '/tmp/home',
      SHELL: '/bin/zsh',
      OPENCODE_CONFIG: '/bad/config',
      CODEINSIGHTS_GIT_DISABLED: '0',
      OPENAI_API_KEY: 'openai-secret',
      ANTHROPIC_AUTH_TOKEN: 'anthropic-secret',
      AWS_ACCESS_KEY_ID: 'aws-secret',
      HTTP_PROXY: 'http://proxy.example.test',
      GIT_DIR: '/bad/git',
    })

    expect(env).toEqual({
      PATH: '/usr/bin',
      HOME: '/tmp/home',
      SHELL: '/bin/zsh',
    })
  })

  test('scoped secret env 允许 CodeInsights opencode 命名空间', () => {
    const env = mergeOpencodeScopedSecretEnv(
      { PATH: '/usr/bin' },
      { CODEINSIGHTS_OPENCODE_CHANNEL_CUSTOM_12345678_API_KEY: 'secret' },
    )

    expect(env).toEqual({
      PATH: '/usr/bin',
      CODEINSIGHTS_OPENCODE_CHANNEL_CUSTOM_12345678_API_KEY: 'secret',
    })
  })

  test('拒绝覆盖 Git guard、proxy、OPENCODE 与非 scoped CODEINSIGHTS 变量', () => {
    for (const key of [
      'GIT_DIR',
      'GIT_CONFIG_COUNT',
      'HTTP_PROXY',
      'HTTPS_PROXY',
      'ALL_PROXY',
      'OPENCODE_CONFIG',
      'OPENCODE_SERVER_PASSWORD',
      'CODEINSIGHTS_GIT_DISABLED',
      'PATH',
    ]) {
      expect(isReservedOpencodeExternalEnvName(key)).toBe(true)
      expect(() => mergeOpencodeScopedSecretEnv({}, { [key]: 'bad' })).toThrow(/禁止注入 opencode 外部环境变量/)
    }
  })
})

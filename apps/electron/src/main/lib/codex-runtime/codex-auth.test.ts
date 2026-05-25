import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getNativeCodexAuthPath,
  resolveCodexAuth,
  resolveNativeCodexHome,
} from './codex-auth'

describe('codex-auth', () => {
  test('channel API key 优先进入 api_key 模式', () => {
    const env = {
      CODEX_HOME: '/ambient/codex',
      CODEX_API_KEY: 'ambient-key',
    }

    expect(resolveCodexAuth({ apiKey: 'channel-key' }, env)).toEqual({ kind: 'api_key' })
  })

  test('native auth 使用显式 CODEX_HOME/auth.json', () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'codeinsights-codex-auth-'))
    const codexHome = join(tempHome, 'custom-codex-home')
    try {
      mkdirSync(codexHome, { recursive: true })
      writeFileSync(join(codexHome, 'auth.json'), '{}\n', 'utf-8')

      const env = { CODEX_HOME: codexHome, CODEX_API_KEY: 'ambient-key' }

      expect(resolveNativeCodexHome(env)).toBe(codexHome)
      expect(getNativeCodexAuthPath(env)).toBe(join(codexHome, 'auth.json'))
      expect(resolveCodexAuth({}, env)).toEqual({
        kind: 'native',
        codexHome,
      })
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('无 native auth 时可使用 env CODEX_API_KEY', () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'codeinsights-codex-auth-env-key-'))
    try {
      expect(resolveCodexAuth({}, {
        HOME: tempHome,
        USERPROFILE: tempHome,
        CODEX_API_KEY: 'env-key',
      })).toEqual({ kind: 'api_key' })
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('无渠道、无 env key、无 native auth 时 fail-fast', () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'codeinsights-codex-auth-missing-'))
    try {
      expect(() => resolveCodexAuth({}, {
        HOME: tempHome,
        USERPROFILE: tempHome,
      })).toThrow(/未配置 Pipeline Codex 渠道/)
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })
})

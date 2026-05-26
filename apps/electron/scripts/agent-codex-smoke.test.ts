import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  copyNativeCodexSource,
  resolveNativeCodexSource,
} from './agent-codex-smoke'

describe('agent-codex-smoke native config isolation', () => {
  test('复制 native auth 时保留同源 config.toml 中转配置', async () => {
    const root = mkdtempSync(join(tmpdir(), 'codeinsights-codex-smoke-config-'))
    const sourceCodexHome = join(root, 'source-codex')
    const targetCodexHome = join(root, 'target-codex')
    try {
      mkdirSync(sourceCodexHome, { recursive: true })
      writeFileSync(join(sourceCodexHome, 'auth.json'), '{}\n', 'utf-8')
      writeFileSync(
        join(sourceCodexHome, 'config.toml'),
        [
          'model_provider = "cch"',
          '[model_providers.cch]',
          'base_url = "https://relay.example/v1"',
          'wire_api = "responses"',
          '',
        ].join('\n'),
        'utf-8',
      )

      const source = resolveNativeCodexSource({ CODEX_HOME: sourceCodexHome })
      expect(source).toEqual({
        authPath: join(sourceCodexHome, 'auth.json'),
        configPath: join(sourceCodexHome, 'config.toml'),
      })

      await copyNativeCodexSource(source!, targetCodexHome)

      expect(await readFile(join(targetCodexHome, 'auth.json'), 'utf-8')).toBe('{}\n')
      expect(await readFile(join(targetCodexHome, 'config.toml'), 'utf-8')).toContain('base_url = "https://relay.example/v1"')
      expect(statSync(join(targetCodexHome, 'auth.json')).mode & 0o777).toBe(0o600)
      expect(statSync(join(targetCodexHome, 'config.toml')).mode & 0o777).toBe(0o600)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('缺少 config.toml 时只复制 auth.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'codeinsights-codex-smoke-auth-only-'))
    const sourceCodexHome = join(root, 'home', '.codex')
    const targetCodexHome = join(root, 'target-codex')
    try {
      mkdirSync(sourceCodexHome, { recursive: true })
      writeFileSync(join(sourceCodexHome, 'auth.json'), '{}\n', 'utf-8')

      const source = resolveNativeCodexSource({ HOME: join(root, 'home') })
      expect(source).toEqual({
        authPath: join(sourceCodexHome, 'auth.json'),
        configPath: undefined,
      })

      await copyNativeCodexSource(source!, targetCodexHome)

      expect(await readFile(join(targetCodexHome, 'auth.json'), 'utf-8')).toBe('{}\n')
      expect(existsSync(join(targetCodexHome, 'config.toml'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

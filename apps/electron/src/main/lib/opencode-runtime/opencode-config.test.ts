import { lstat, mkdtemp, readFile, stat, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  applyOpencodeRuntimeConfigEnv,
  buildOpencodeConfig,
  buildOpencodeInlinePolicy,
  buildOpencodePermissionPolicy,
  writeOpencodeRuntimeConfig,
} from './opencode-config'

describe('opencode-config', () => {
  test('构建 channel provider config 时只写 env placeholder，不写 API key', () => {
    const result = buildOpencodeConfig({
      modelId: 'gpt-5.1-codex',
      agentName: 'build',
      auth: {
        source: 'channel',
        providerId: 'custom',
        baseUrl: 'https://api.example.test/v1',
        apiKeyEnvName: 'CODEINSIGHTS_OPENCODE_CHANNEL_CUSTOM_ABCD1234_API_KEY',
      },
      permissionMode: 'auto',
      mcp: { mcp: {} },
      opencodeVersion: '1.15.11',
    })

    const serialized = JSON.stringify(result.config)
    expect(result.config.model).toBe('codeinsights-openai-compatible/gpt-5.1-codex')
    expect(result.config.enabled_providers).toEqual(['codeinsights-openai-compatible'])
    expect(serialized).toContain('{env:CODEINSIGHTS_OPENCODE_CHANNEL_CUSTOM_ABCD1234_API_KEY}')
    expect(serialized).not.toContain('sk-')
    expect(result.redactedSummary).toEqual({
      model: 'codeinsights-openai-compatible/gpt-5.1-codex',
      agentName: 'build',
      authSource: 'channel',
      providerIds: ['codeinsights-openai-compatible'],
      mcpServerCount: 0,
      permissionMode: 'auto',
    })
  })

  test('permission 与 inline policy 默认拒绝危险行为并禁用 share/autoupdate', () => {
    expect(buildOpencodePermissionPolicy('plan').edit).toBe('deny')
    expect(buildOpencodePermissionPolicy('auto').doom_loop).toBe('deny')
    expect(buildOpencodeInlinePolicy()).toEqual({
      share: 'disabled',
      autoupdate: false,
      server: { hostname: '127.0.0.1', cors: [] },
      permission: { doom_loop: 'deny' },
    })
  })

  test('写入 config 时创建 0700 目录、0600 文件与私有 config-dir 资产目录', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'codeinsights-opencode-config-'))
    const built = buildOpencodeConfig({
      modelId: 'anthropic/claude-sonnet',
      agentName: 'plan',
      auth: { source: 'native' },
      permissionMode: 'plan',
      mcp: { mcp: {} },
      opencodeVersion: '1.15.11',
    })

    const written = await writeOpencodeRuntimeConfig({ rootDir, built })

    expect(await readFile(written.configPath, 'utf-8')).toBe(written.configContent)
    expect((await stat(written.configPath)).mode & 0o777).toBe(0o600)
    expect((await stat(written.configDir)).mode & 0o777).toBe(0o700)
    for (const name of ['agents', 'commands', 'plugins', 'skills', 'tools']) {
      expect((await stat(join(written.configDir, name))).mode & 0o777).toBe(0o700)
    }
    expect(written.runtimeConfigHash).toStartWith('sha256:')
  })

  test('运行环境默认不注入 OPENCODE_CONFIG_DIR，避免 Phase 5 空 assets 目录卡住 server mutating API', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'codeinsights-opencode-config-'))
    const built = buildOpencodeConfig({
      modelId: 'anthropic/claude-sonnet',
      agentName: 'build',
      auth: { source: 'native' },
      permissionMode: 'auto',
      mcp: { mcp: {} },
      opencodeVersion: '1.15.11',
    })
    const written = await writeOpencodeRuntimeConfig({ rootDir, built })

    const defaultEnv = applyOpencodeRuntimeConfigEnv({
      env: { PATH: '/usr/bin' },
      configPath: written.configPath,
      configDir: written.configDir,
      inlinePolicyContent: written.inlinePolicyContent,
    })
    const configDirEnv = applyOpencodeRuntimeConfigEnv({
      env: { PATH: '/usr/bin' },
      configPath: written.configPath,
      configDir: written.configDir,
      inlinePolicyContent: written.inlinePolicyContent,
      includeConfigDir: true,
    })

    expect(defaultEnv).toEqual({
      PATH: '/usr/bin',
      OPENCODE_CONFIG: written.configPath,
      OPENCODE_CONFIG_CONTENT: written.inlinePolicyContent,
    })
    expect(configDirEnv.OPENCODE_CONFIG_DIR).toBe(written.configDir)
  })

  test('写入前拒绝 symlink 父路径', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'codeinsights-opencode-config-'))
    const outside = await mkdtemp(join(tmpdir(), 'codeinsights-opencode-outside-'))
    await symlink(outside, join(rootDir, 'runtime'))

    const built = buildOpencodeConfig({
      modelId: 'anthropic/claude-sonnet',
      agentName: 'build',
      auth: { source: 'native' },
      permissionMode: 'auto',
      mcp: { mcp: {} },
      opencodeVersion: '1.15.11',
    })

    expect((await lstat(join(rootDir, 'runtime'))).isSymbolicLink()).toBe(true)
    await expect(writeOpencodeRuntimeConfig({ rootDir, built })).rejects.toThrow(/符号链接/)
  })
})

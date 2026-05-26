import { describe, expect, test } from 'bun:test'
import type { WorkspaceMcpConfig } from '@codeinsights/shared'
import { buildCodexMcpConfigFromWorkspace } from './codex-mcp-config'

describe('buildCodexMcpConfigFromWorkspace', () => {
  test('将启用的 stdio MCP 映射为 Codex mcp_servers 配置且不把 env secret 放入 config', () => {
    const result = buildCodexMcpConfigFromWorkspace({
      servers: {
        docs: {
          type: 'stdio',
          command: 'node',
          args: ['server.mjs'],
          env: { DOCS_TOKEN: 'secret' },
          timeout: 12,
          enabled: true,
        },
      },
    }, { pathEnv: '/usr/bin' })

    const serverConfig = result.config?.mcp_servers as Record<string, {
      args?: string[]
      command?: string
      enabled?: boolean
      env?: Record<string, string>
      env_vars?: string[]
      required?: boolean
      startup_timeout_sec?: number
    }> | undefined

    expect(result.serverCount).toBe(1)
    expect(result.skipped).toEqual([])
    expect(result.env).toEqual({ DOCS_TOKEN: 'secret' })
    expect(serverConfig?.docs).toEqual({
      command: 'node',
      args: ['server.mjs'],
      env_vars: ['PATH', 'DOCS_TOKEN'],
      enabled: true,
      required: false,
      startup_timeout_sec: 12,
    })
    expect(serverConfig?.docs?.env).toBeUndefined()
    expect(JSON.stringify(result.config)).not.toContain('secret')
  })

  test('stdio MCP 未设置 timeout 时保持 CodeInsights 默认 30 秒语义', () => {
    const result = buildCodexMcpConfigFromWorkspace({
      servers: {
        docs: {
          type: 'stdio',
          command: 'node',
          enabled: true,
        },
      },
    })

    expect(result).toEqual({
      env: {},
      serverCount: 1,
      skipped: [],
      config: {
        mcp_servers: {
          docs: {
            command: 'node',
            enabled: true,
            required: false,
            startup_timeout_sec: 30,
          },
        },
      },
    })
  })

  test('将 http MCP headers 映射到 Codex env_http_headers 且不把 header secret 放入 config', () => {
    const result = buildCodexMcpConfigFromWorkspace({
      servers: {
        search: {
          type: 'http',
          url: 'https://mcp.example.test/mcp',
          headers: { Authorization: 'Bearer token' },
          enabled: true,
        },
      },
    })

    const serverConfig = result.config?.mcp_servers as Record<string, {
      enabled?: boolean
      env_http_headers?: Record<string, string>
      http_headers?: Record<string, string>
      required?: boolean
      url?: string
    }> | undefined
    const headerEnvName = serverConfig?.search?.env_http_headers?.Authorization
    if (!headerEnvName) throw new Error('缺少 HTTP header env 映射')

    expect(result.config).toEqual({
      mcp_servers: {
        search: {
          url: 'https://mcp.example.test/mcp',
          env_http_headers: { Authorization: headerEnvName },
          enabled: true,
          required: false,
        },
      },
    })
    expect(headerEnvName).toStartWith('CODEINSIGHTS_MCP_SEARCH_HEADER_AUTHORIZATION_')
    expect(result.env).toEqual({ [headerEnvName ?? '']: 'Bearer token' })
    expect(result.serverCount).toBe(1)
    expect(serverConfig?.search?.http_headers).toBeUndefined()
    expect(JSON.stringify(result.config)).not.toContain('Bearer token')
  })

  test('跳过禁用、无效名称和 Codex 暂不支持的 legacy SSE MCP', () => {
    const workspaceConfig: WorkspaceMcpConfig = {
      servers: {
        disabled: { type: 'stdio', command: 'node', enabled: false },
        'bad.name': { type: 'stdio', command: 'node', enabled: true },
        legacy_sse: { type: 'sse', url: 'https://mcp.example.test/sse', enabled: true },
      },
    }

    const result = buildCodexMcpConfigFromWorkspace(workspaceConfig)

    expect(result.serverCount).toBe(0)
    expect(result.config).toBeUndefined()
    expect(result.env).toEqual({})
    expect(result.skipped).toEqual([
      { name: 'bad.name', reason: 'invalid_name' },
      { name: 'legacy_sse', reason: 'unsupported_transport' },
    ])
  })

  test('跳过缺少 command 或 url 的启用项', () => {
    const result = buildCodexMcpConfigFromWorkspace({
      servers: {
        broken_stdio: { type: 'stdio', enabled: true },
        broken_http: { type: 'http', enabled: true },
      },
    })

    expect(result.serverCount).toBe(0)
    expect(result.env).toEqual({})
    expect(result.skipped).toEqual([
      { name: 'broken_stdio', reason: 'missing_command' },
      { name: 'broken_http', reason: 'missing_url' },
    ])
  })

  test('跳过会污染 Codex 子进程的保留 env 名称', () => {
    const result = buildCodexMcpConfigFromWorkspace({
      servers: {
        codex_key: {
          type: 'stdio',
          command: 'node',
          env: { CODEX_API_KEY: 'server-secret' },
          enabled: true,
        },
        git_dir: {
          type: 'stdio',
          command: 'node',
          env: { GIT_DIR: '/repo/.git' },
          enabled: true,
        },
        git_config: {
          type: 'stdio',
          command: 'node',
          env: { GIT_CONFIG_COUNT: '1' },
          enabled: true,
        },
        proxy: {
          type: 'stdio',
          command: 'node',
          env: { ALL_PROXY: 'http://proxy.example.test' },
          enabled: true,
        },
      },
    })

    expect(result.serverCount).toBe(0)
    expect(result.config).toBeUndefined()
    expect(result.env).toEqual({})
    expect(result.skipped).toEqual([
      { name: 'codex_key', reason: 'reserved_env_name' },
      { name: 'git_dir', reason: 'reserved_env_name' },
      { name: 'git_config', reason: 'reserved_env_name' },
      { name: 'proxy', reason: 'reserved_env_name' },
    ])
  })

  test('跳过 Codex SDK dotted config 无法安全表达的 HTTP header 名称', () => {
    const result = buildCodexMcpConfigFromWorkspace({
      servers: {
        search: {
          type: 'http',
          url: 'https://mcp.example.test/mcp',
          headers: { 'X.Api': 'secret' },
          enabled: true,
        },
      },
    })

    expect(result.serverCount).toBe(0)
    expect(result.config).toBeUndefined()
    expect(result.env).toEqual({})
    expect(result.skipped).toEqual([{ name: 'search', reason: 'invalid_header_name' }])
  })

  test('跳过 env 名称冲突且不复用错误 secret', () => {
    const result = buildCodexMcpConfigFromWorkspace({
      servers: {
        first: {
          type: 'stdio',
          command: 'node',
          env: { DOCS_TOKEN: 'first-secret' },
          enabled: true,
        },
        second: {
          type: 'stdio',
          command: 'node',
          env: { DOCS_TOKEN: 'second-secret' },
          enabled: true,
        },
      },
    })

    expect(result.serverCount).toBe(1)
    expect(result.env).toEqual({ DOCS_TOKEN: 'first-secret' })
    expect(result.config?.mcp_servers).toHaveProperty('first')
    expect(result.config?.mcp_servers).not.toHaveProperty('second')
    expect(result.skipped).toEqual([{ name: 'second', reason: 'env_name_conflict' }])
  })
})

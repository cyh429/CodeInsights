import { describe, expect, test } from 'bun:test'
import type { WorkspaceMcpConfig } from '@codeinsights/shared'
import { buildOpencodeMcpConfigFromWorkspace, sanitizeOpencodeMcpName } from './opencode-mcp-config'

describe('opencode-mcp-config', () => {
  test('将 stdio MCP 映射为 local config，env 使用 placeholder 且不泄露 secret', () => {
    const result = buildOpencodeMcpConfigFromWorkspace({
      servers: {
        docs: {
          type: 'stdio',
          command: 'node',
          args: ['server.mjs'],
          env: { DOCS_TOKEN: 'secret-token' },
          timeout: 12,
          enabled: true,
        },
      },
    })

    const docs = result.config.mcp.docs
    expect(result.serverCount).toBe(1)
    expect(result.skipped).toEqual([])
    expect(docs).toEqual({
      type: 'local',
      command: ['node', 'server.mjs'],
      enabled: true,
      timeout: 12,
      environment: {
        DOCS_TOKEN: `{env:${Object.keys(result.env)[0]}}`,
      },
    })
    expect(Object.values(result.env)).toEqual(['secret-token'])
    expect(JSON.stringify(result.config)).not.toContain('secret-token')
  })

  test('将 remote MCP headers 映射为 env placeholder', () => {
    const result = buildOpencodeMcpConfigFromWorkspace({
      servers: {
        github: {
          type: 'http',
          url: 'https://mcp.example.test/mcp',
          headers: { Authorization: 'Bearer gh-secret' },
          enabled: true,
        },
      },
    })

    if (result.config.mcp.github?.type !== 'remote') throw new Error('github MCP 未生成 remote 配置')
    const headerValue = result.config.mcp.github.headers?.Authorization
    expect(headerValue).toMatch(/^Bearer \{env:CODEINSIGHTS_OPENCODE_MCP_GITHUB_HEADER_AUTHORIZATION_[A-F0-9]{8}\}$/)
    expect(Object.values(result.env)).toEqual(['gh-secret'])
    expect(JSON.stringify(result.config)).not.toContain('gh-secret')
  })

  test('清理 MCP name 并检测冲突', () => {
    expect(sanitizeOpencodeMcpName('docs.search')).toBe('docs_search')

    const workspaceConfig: WorkspaceMcpConfig = {
      servers: {
        'docs.search': { type: 'stdio', command: 'node', enabled: true },
        docs_search: { type: 'stdio', command: 'node', enabled: true },
      },
    }
    const result = buildOpencodeMcpConfigFromWorkspace(workspaceConfig)

    expect(result.serverCount).toBe(1)
    expect(result.config.mcp).toHaveProperty('docs_search')
    expect(result.skipped).toEqual([{ name: 'docs_search', reason: 'name_conflict' }])
  })

  test('跳过会覆盖保留 env 的 local MCP', () => {
    const result = buildOpencodeMcpConfigFromWorkspace({
      servers: {
        git: { type: 'stdio', command: 'node', env: { GIT_DIR: '/bad' }, enabled: true },
        proxy: { type: 'stdio', command: 'node', env: { HTTP_PROXY: 'http://proxy' }, enabled: true },
      },
    })

    expect(result.serverCount).toBe(0)
    expect(result.env).toEqual({})
    expect(result.skipped).toEqual([
      { name: 'git', reason: 'reserved_env_name' },
      { name: 'proxy', reason: 'reserved_env_name' },
    ])
  })
})

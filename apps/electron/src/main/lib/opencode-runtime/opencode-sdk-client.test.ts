import { describe, expect, test } from 'bun:test'
import {
  buildOpencodeBasicAuthHeader,
  createBasicAuthFetch,
  createOpencodeClientWrapper,
  redactOpencodeClientLog,
} from './opencode-sdk-client'

describe('opencode-sdk-client', () => {
  test('fetch wrapper 注入 Basic Auth 并解析 health JSON', async () => {
    const requests: Array<{ url: string; authorization?: string }> = []
    const client = createOpencodeClientWrapper({
      baseUrl: 'http://127.0.0.1:4101',
      auth: { username: 'opencode', password: 'server-password' },
      fetchImpl: async (url, init) => {
        const headers = new Headers(init?.headers)
        requests.push({ url: String(url), authorization: headers.get('Authorization') ?? undefined })
        return new Response(JSON.stringify({ healthy: true, version: '1.15.11' }), { status: 200 })
      },
    })

    await expect(client.getHealth()).resolves.toEqual({ healthy: true, version: '1.15.11' })
    expect(requests).toEqual([{
      url: 'http://127.0.0.1:4101/global/health',
      authorization: buildOpencodeBasicAuthHeader('opencode', 'server-password'),
    }])
  })

  test('错误分类与日志脱敏不输出 password 或 request body secret', async () => {
    const client = createOpencodeClientWrapper({
      baseUrl: 'http://127.0.0.1:4101',
      auth: { username: 'opencode', password: 'server-password' },
      fetchImpl: async () => new Response('unauthorized server-password', { status: 401 }),
    })

    await expect(client.getHealth()).rejects.toMatchObject({
      code: 'runtime_server_auth_failed',
      message: 'opencode server 鉴权失败',
    })

    const redacted = redactOpencodeClientLog({
      url: 'http://127.0.0.1:4101/session',
      headers: { Authorization: buildOpencodeBasicAuthHeader('opencode', 'server-password') },
      body: { apiKey: 'sk-secret', prompt: 'hello' },
    })

    expect(JSON.stringify(redacted)).not.toContain('server-password')
    expect(JSON.stringify(redacted)).not.toContain('sk-secret')
    expect(redacted.headers.Authorization).toBe('[REDACTED]')
    expect(redacted.body).toEqual({ apiKey: '[REDACTED]', prompt: 'hello' })
  })

  test('SDK fetch wrapper 注入 Basic Auth 且保留调用方 header', async () => {
    const requests: Array<{ authorization?: string; trace?: string }> = []
    const fetchWithAuth = createBasicAuthFetch({
      auth: { username: 'opencode', password: 'server-password' },
      fetchImpl: async (request) => {
        const headers = request instanceof Request
          ? request.headers
          : new Headers()
        requests.push({
          authorization: headers.get('Authorization') ?? undefined,
          trace: headers.get('X-CodeInsights-Trace') ?? undefined,
        })
        return new Response('{}', { status: 200 })
      },
    })

    await fetchWithAuth(new Request('http://127.0.0.1:4101/session', {
      method: 'POST',
      headers: { 'X-CodeInsights-Trace': 'smoke' },
      body: '{}',
    }))

    expect(requests).toEqual([{
      authorization: buildOpencodeBasicAuthHeader('opencode', 'server-password'),
      trace: 'smoke',
    }])
  })

  test('config 与 MCP status 摘要不透传 header/env secret', async () => {
    const client = createOpencodeClientWrapper({
      baseUrl: 'http://127.0.0.1:4101',
      fetchImpl: async (url) => {
        if (String(url).endsWith('/mcp')) {
          return new Response(JSON.stringify({
            docs: { status: 'connected' },
            remote: { status: 'failed', error: 'Bearer remote-secret' },
          }), { status: 200 })
        }
        return new Response(JSON.stringify({
          model: 'anthropic/claude-sonnet',
          mcp: {
            docs: {
              type: 'remote',
              headers: { Authorization: 'Bearer remote-secret' },
            },
          },
        }), { status: 200 })
      },
    })

    await expect(client.getConfigSummary()).resolves.toMatchObject({
      mcp: {
        configuredCount: 1,
        serverNames: ['docs'],
      },
    })
    const mcpStatus = await client.getMcpStatusSummary()
    expect(mcpStatus).toMatchObject({
      configuredCount: 0,
      statusCount: 2,
      connectedCount: 1,
      statuses: {
        docs: 'connected',
        remote: 'failed',
      },
    })
    expect(JSON.stringify(mcpStatus)).not.toContain('remote-secret')
  })
})

import { describe, expect, test } from 'bun:test'
import type { ProviderAdapter, ProviderRequest, StreamEvent } from './types.ts'
import { fetchTitle, streamSSE } from './sse-reader.ts'

const testRequest: ProviderRequest = {
  url: 'https://example.com/v1/messages',
  headers: {
    'content-type': 'application/json',
  },
  body: '{"prompt":"hello"}',
}

const testAdapter: ProviderAdapter = {
  providerType: 'openai',
  buildStreamRequest: () => testRequest,
  parseSSELine: () => [],
  buildTitleRequest: () => testRequest,
  parseTitleResponse: (body: unknown) => {
    const title = (body as { title?: string }).title
    return typeof title === 'string' ? title : null
  },
}

function createAbortAwareHangingFetch(): typeof globalThis.fetch {
  return (async (_input: string | URL | Request, init?: RequestInit) => {
    return await new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (signal?.aborted) {
        reject(signal.reason ?? new Error('aborted'))
        return
      }
      signal?.addEventListener(
        'abort',
        () => {
          reject(signal.reason ?? new Error('aborted'))
        },
        { once: true },
      )
    })
  }) as typeof globalThis.fetch
}

function collectEvents(events: StreamEvent[]): (event: StreamEvent) => void {
  return (event) => {
    events.push(event)
  }
}

describe('streamSSE timeout', () => {
  test('超时时抛出可识别错误', async () => {
    const events: StreamEvent[] = []

    try {
      await streamSSE({
        request: testRequest,
        adapter: testAdapter,
        onEvent: collectEvents(events),
        fetchFn: createAbortAwareHangingFetch(),
        requestTimeoutMs: 10,
      })
      throw new Error('expected timeout')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('API 请求超时')
      expect((error as Error).message).toContain('10ms')
      expect(events).toHaveLength(0)
    }
  })

  test('外部 AbortSignal 仍优先保留原始中止语义', async () => {
    const controller = new AbortController()
    controller.abort(new Error('manual abort'))

    try {
      await streamSSE({
        request: testRequest,
        adapter: testAdapter,
        onEvent: () => {},
        fetchFn: createAbortAwareHangingFetch(),
        signal: controller.signal,
        requestTimeoutMs: 100,
      })
      throw new Error('expected abort')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).not.toContain('请求超时')
    }
  })
})

describe('fetchTitle timeout', () => {
  test('超时时返回 null', async () => {
    const title = await fetchTitle(
      testRequest,
      testAdapter,
      createAbortAwareHangingFetch(),
      { requestTimeoutMs: 10 },
    )

    expect(title).toBeNull()
  })

  test('成功响应时返回解析后的标题', async () => {
    const fetchFn: typeof globalThis.fetch = (async () =>
      new Response(JSON.stringify({ title: '测试标题' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })) as unknown as typeof globalThis.fetch

    const title = await fetchTitle(testRequest, testAdapter, fetchFn, {
      requestTimeoutMs: 10,
    })

    expect(title).toBe('测试标题')
  })
})

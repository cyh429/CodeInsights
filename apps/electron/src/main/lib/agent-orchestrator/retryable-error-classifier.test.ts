import { describe, expect, test } from 'bun:test'
import type { TypedError } from '@codeinsights/shared'
import {
  isAutoRetryableCatchError,
  isAutoRetryableTypedError,
} from './retryable-error-classifier'

function createTypedError(code: TypedError['code']): TypedError {
  return {
    code,
    title: '测试错误',
    message: '测试错误消息',
    actions: [],
    canRetry: false,
  }
}

describe('isAutoRetryableTypedError', () => {
  test('允许自动重试限流、服务端和网络类 typed error', () => {
    const retryableCodes: Array<TypedError['code']> = [
      'rate_limited',
      'provider_error',
      'service_error',
      'service_unavailable',
      'network_error',
    ]

    for (const code of retryableCodes) {
      expect(isAutoRetryableTypedError(createTypedError(code))).toBe(true)
    }
  })

  test('拒绝凭证、请求和上下文类 typed error 自动重试', () => {
    const nonRetryableCodes: Array<TypedError['code']> = [
      'invalid_api_key',
      'invalid_request',
      'prompt_too_long',
      'billing_error',
      'unknown_error',
    ]

    for (const code of nonRetryableCodes) {
      expect(isAutoRetryableTypedError(createTypedError(code))).toBe(false)
    }
  })
})

describe('isAutoRetryableCatchError', () => {
  test('HTTP 429 和 5xx 错误允许自动重试', () => {
    expect(isAutoRetryableCatchError({ statusCode: 429, message: 'Too Many Requests' })).toBe(true)
    expect(isAutoRetryableCatchError({ statusCode: 500, message: 'Internal Server Error' })).toBe(true)
    expect(isAutoRetryableCatchError({ statusCode: 503, message: 'Service Unavailable' })).toBe(true)
  })

  test('普通 4xx API 错误不自动重试', () => {
    expect(isAutoRetryableCatchError({ statusCode: 400, message: 'Bad Request' })).toBe(false)
    expect(isAutoRetryableCatchError({ statusCode: 401, message: 'Unauthorized' })).toBe(false)
  })

  test('识别无状态码的 context_management 可恢复错误', () => {
    expect(isAutoRetryableCatchError(null, 'SDK error: context_management compact failed')).toBe(true)
  })

  test('识别 raw message 和 stderr 中的瞬时网络错误', () => {
    expect(isAutoRetryableCatchError(null, 'fetch failed: ECONNRESET')).toBe(true)
    expect(isAutoRetryableCatchError(null, undefined, 'stream closed prematurely')).toBe(true)
  })

  test('没有 API 错误和已知模式时不自动重试', () => {
    expect(isAutoRetryableCatchError(null)).toBe(false)
    expect(isAutoRetryableCatchError(null, 'invalid tool input')).toBe(false)
  })
})

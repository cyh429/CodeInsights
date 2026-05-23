import type { TypedError } from '@codeinsights/shared'
import { isTransientNetworkError } from '../error-patterns'

export interface RetryableApiError {
  statusCode: number
  message: string
}

/** 可自动重试的 TypedError 错误码 */
const AUTO_RETRYABLE_ERROR_CODES: ReadonlySet<TypedError['code']> = new Set([
  'rate_limited',
  'provider_error',      // overloaded 映射为 provider_error
  'service_error',
  'service_unavailable',
  'network_error',
])

/** 判断 typed_error 事件是否可自动重试 */
export function isAutoRetryableTypedError(error: TypedError): boolean {
  return AUTO_RETRYABLE_ERROR_CODES.has(error.code)
}

/** 判断 catch 块中的 API 错误是否可自动重试（HTTP 429 / 5xx / 已知可恢复错误模式 / 瞬时网络错误） */
export function isAutoRetryableCatchError(
  apiError: RetryableApiError | null,
  rawErrorMessage?: string,
  stderr?: string,
): boolean {
  if (apiError) {
    if (apiError.statusCode === 429 || apiError.statusCode >= 500) return true
  }

  // 已知的可恢复错误模式（无 HTTP 状态码但可重试）
  if (rawErrorMessage) {
    if (rawErrorMessage.includes('context_management')) return true
  }

  // 瞬时网络错误（terminated / ECONNRESET / socket hang up 等）
  if (isTransientNetworkError(rawErrorMessage, stderr)) return true

  return false
}

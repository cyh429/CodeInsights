import { describe, expect, test } from 'bun:test'
import type { TypedError } from '@codeinsights/shared'
import {
  createCatchErrorSDKMessage,
  createRetryExhaustedSDKMessage,
  createTypedErrorSDKMessage,
  formatTypedErrorContent,
} from './agent-error-message'

function createTypedError(overrides: Partial<TypedError> = {}): TypedError {
  return {
    code: 'api_key_decrypt_failed',
    title: 'API Key 解密失败',
    message: '无法解密此渠道的 API Key',
    actions: [
      { key: 's', label: '打开渠道设置', action: 'open_channel_settings' },
    ],
    canRetry: false,
    details: ['safeStorage unavailable'],
    ...overrides,
  }
}

describe('agent-error-message', () => {
  test('TypedError 消息保留用户可见格式和 metadata', () => {
    const typedError = createTypedError()

    const message = createTypedErrorSDKMessage(typedError, { now: 1000 })

    expect(message).toEqual({
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'API Key 解密失败: 无法解密此渠道的 API Key' }],
      },
      parent_tool_use_id: null,
      error: { message: '无法解密此渠道的 API Key', errorType: 'api_key_decrypt_failed' },
      _createdAt: 1000,
      _errorCode: 'api_key_decrypt_failed',
      _errorTitle: 'API Key 解密失败',
      _errorDetails: ['safeStorage unavailable'],
      _errorCanRetry: false,
      _errorActions: [
        { key: 's', label: '打开渠道设置', action: 'open_channel_settings' },
      ],
    })
  })

  test('TypedError 无标题时只使用 message 作为文本', () => {
    const typedError = createTypedError({
      title: '',
      message: '渠道配置异常',
      code: 'channel_not_found',
      details: undefined,
    })

    expect(formatTypedErrorContent(typedError)).toBe('渠道配置异常')
    expect(createTypedErrorSDKMessage(typedError, { now: 1000 })).toMatchObject({
      message: {
        content: [{ type: 'text', text: '渠道配置异常' }],
      },
      error: { message: '渠道配置异常', errorType: 'channel_not_found' },
      _errorTitle: '',
    })
  })

  test('catch prompt_too_long 使用专用用户可见文案', () => {
    const message = createCatchErrorSDKMessage({
      userFacingError: 'API 错误：prompt is too long',
      isPromptTooLong: true,
      now: 1000,
    })

    expect(message).toEqual({
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: '上下文过长：当前对话的上下文已超出模型限制，请压缩上下文或开启新会话' }],
      },
      parent_tool_use_id: null,
      error: { message: 'API 错误：prompt is too long', errorType: 'prompt_too_long' },
      _createdAt: 1000,
      _errorCode: 'prompt_too_long',
      _errorTitle: '上下文过长',
    })
  })

  test('catch 普通错误使用 unknown_error metadata', () => {
    const message = createCatchErrorSDKMessage({
      userFacingError: '网络连接失败',
      isPromptTooLong: false,
      now: 1000,
    })

    expect(message).toEqual({
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: '网络连接失败' }],
      },
      parent_tool_use_id: null,
      error: { message: '网络连接失败', errorType: 'unknown_error' },
      _createdAt: 1000,
      _errorCode: 'unknown_error',
      _errorTitle: '执行错误',
    })
  })

  test('重试耗尽消息保留旧文案和 metadata', () => {
    const message = createRetryExhaustedSDKMessage({
      maxAttempts: 8,
      lastRetryableError: 'SDK 响应超时',
      now: 1000,
    })

    expect(message).toEqual({
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: '重试 8 次后仍然失败: SDK 响应超时' }],
      },
      parent_tool_use_id: null,
      error: { message: '重试 8 次后仍然失败: SDK 响应超时', errorType: 'unknown_error' },
      _createdAt: 1000,
      _errorCode: 'unknown_error',
      _errorTitle: '重试失败',
    })
  })
})

import type { SDKMessage, TypedError } from '@codeinsights/shared'

export interface AgentErrorMessageOptions {
  now?: number
}

export interface CatchErrorMessageInput extends AgentErrorMessageOptions {
  userFacingError: string
  isPromptTooLong: boolean
}

export interface RetryExhaustedMessageInput extends AgentErrorMessageOptions {
  maxAttempts: number
  lastRetryableError: string
}

const PROMPT_TOO_LONG_TEXT = '上下文过长：当前对话的上下文已超出模型限制，请压缩上下文或开启新会话'

export function formatTypedErrorContent(typedError: TypedError): string {
  return typedError.title
    ? `${typedError.title}: ${typedError.message}`
    : typedError.message
}

export function createTypedErrorSDKMessage(
  typedError: TypedError,
  options: AgentErrorMessageOptions = {},
): SDKMessage {
  const errorContent = formatTypedErrorContent(typedError)
  return {
    type: 'assistant',
    message: {
      content: [{ type: 'text', text: errorContent }],
    },
    parent_tool_use_id: null,
    error: { message: typedError.message, errorType: typedError.code },
    _createdAt: options.now ?? Date.now(),
    _errorCode: typedError.code,
    _errorTitle: typedError.title,
    _errorDetails: typedError.details,
    _errorCanRetry: typedError.canRetry,
    _errorActions: typedError.actions,
  } as SDKMessage
}

export function createCatchErrorSDKMessage(input: CatchErrorMessageInput): SDKMessage {
  const errorType = input.isPromptTooLong ? 'prompt_too_long' : 'unknown_error'
  return {
    type: 'assistant',
    message: {
      content: [{
        type: 'text',
        text: input.isPromptTooLong ? PROMPT_TOO_LONG_TEXT : input.userFacingError,
      }],
    },
    parent_tool_use_id: null,
    error: { message: input.userFacingError, errorType },
    _createdAt: input.now ?? Date.now(),
    _errorCode: errorType,
    _errorTitle: input.isPromptTooLong ? '上下文过长' : '执行错误',
  } as SDKMessage
}

export function createRetryExhaustedSDKMessage(input: RetryExhaustedMessageInput): SDKMessage {
  const retryErrorContent = `重试 ${input.maxAttempts} 次后仍然失败: ${input.lastRetryableError}`
  return {
    type: 'assistant',
    message: {
      content: [{ type: 'text', text: retryErrorContent }],
    },
    parent_tool_use_id: null,
    error: { message: retryErrorContent, errorType: 'unknown_error' },
    _createdAt: input.now ?? Date.now(),
    _errorCode: 'unknown_error',
    _errorTitle: '重试失败',
  } as SDKMessage
}

import type { SDKMessage, SDKSystemMessage } from '@codeinsights/shared'

export interface SdkMessageAccumulationOptions {
  channelModelId?: string
}

export interface SdkMessagePersistenceOptions {
  durationMs?: number
  now?: number
}

/**
 * 判断 SDKMessage 是否应进入本轮持久化累积队列。
 */
export function shouldAccumulateSdkMessage(message: SDKMessage): boolean {
  return shouldPersistSdkMessage(message)
}

/**
 * 准备用于累积的 SDKMessage。
 *
 * assistant 消息需要补充渠道模型 ID，但不能原地修改 SDK 原始消息对象。
 */
export function prepareSdkMessageForAccumulation(
  message: SDKMessage,
  options: SdkMessageAccumulationOptions = {},
): SDKMessage | null {
  if (!shouldAccumulateSdkMessage(message)) return null

  if (message.type === 'assistant' && options.channelModelId) {
    return {
      ...message,
      _channelModelId: options.channelModelId,
    } as SDKMessage
  }

  return message
}

/**
 * 判断 SDKMessage 是否应该写入 JSONL。
 */
export function shouldPersistSdkMessage(message: SDKMessage): boolean {
  if (isReplayMessage(message)) return false

  if (message.type === 'assistant' || message.type === 'result') return true
  if (message.type === 'user') return hasToolResultBlock(message)
  if (message.type === 'system') return isCompactBoundarySystemMessage(message)

  return false
}

/**
 * 过滤并补齐持久化 metadata，保持输入数组和消息对象不被原地修改。
 */
export function prepareSdkMessagesForPersistence(
  messages: SDKMessage[],
  options: SdkMessagePersistenceOptions = {},
): SDKMessage[] {
  const toPersist = messages.filter(shouldPersistSdkMessage)
  if (toPersist.length === 0) return []

  const now = options.now ?? Date.now()
  return toPersist.map((message) => withPersistenceMetadata(message, { ...options, now }))
}

/**
 * 为没有 _createdAt 的消息补时间戳，并为 result 消息记录本轮耗时。
 */
export function withPersistenceMetadata(
  message: SDKMessage,
  options: SdkMessagePersistenceOptions = {},
): SDKMessage {
  const messageRecord = message as Record<string, unknown>
  if (typeof messageRecord._createdAt === 'number') return message

  const createdAt = options.now ?? Date.now()
  if (message.type === 'result' && options.durationMs != null) {
    return {
      ...message,
      _createdAt: createdAt,
      _durationMs: options.durationMs,
    } as SDKMessage
  }

  return {
    ...message,
    _createdAt: createdAt,
  } as SDKMessage
}

function isReplayMessage(message: SDKMessage): boolean {
  return Boolean((message as Record<string, unknown>).isReplay)
}

function hasToolResultBlock(message: SDKMessage): boolean {
  const content = (message as { message?: { content?: Array<{ type?: string }> } }).message?.content
  return Array.isArray(content) && content.some((block) => block.type === 'tool_result')
}

function isCompactBoundarySystemMessage(message: SDKMessage): boolean {
  return (message as SDKSystemMessage).subtype === 'compact_boundary'
}

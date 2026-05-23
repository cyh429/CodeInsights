import type { SDKMessage, SDKUserMessageInput } from '@codeinsights/shared'

export interface CreateQueuedUserMessageInputOptions {
  sessionId: string
  text: string
  presetUuid?: string
  createUuid: () => string
}

export interface QueuedUserMessageInputResult {
  uuid: string
  sdkInput: SDKUserMessageInput
}

export interface CreatePersistedQueuedUserMessageOptions {
  uuid: string
  text: string
  now?: number
}

/**
 * 构造注入 SDK 队列的用户消息。
 */
export function createQueuedUserMessageInput(
  input: CreateQueuedUserMessageInputOptions,
): QueuedUserMessageInputResult {
  const uuid = input.presetUuid || input.createUuid()

  return {
    uuid,
    sdkInput: {
      type: 'user',
      message: { role: 'user', content: input.text },
      parent_tool_use_id: null,
      priority: 'now',
      uuid,
      session_id: input.sessionId,
    },
  }
}

/**
 * 构造本地 JSONL 持久化的 queueMessage 用户消息。
 */
export function createPersistedQueuedUserMessage(
  input: CreatePersistedQueuedUserMessageOptions,
): SDKMessage {
  return {
    type: 'user',
    uuid: input.uuid,
    message: {
      content: [{ type: 'text', text: input.text }],
    },
    parent_tool_use_id: null,
    _createdAt: input.now ?? Date.now(),
  } as SDKMessage
}

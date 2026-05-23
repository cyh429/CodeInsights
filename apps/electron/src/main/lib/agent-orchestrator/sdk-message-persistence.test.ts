import { describe, expect, test } from 'bun:test'
import type { SDKMessage, SDKSystemMessage } from '@codeinsights/shared'
import {
  prepareSdkMessageForAccumulation,
  prepareSdkMessagesForPersistence,
  shouldAccumulateSdkMessage,
  shouldPersistSdkMessage,
} from './sdk-message-persistence'

interface MessageMetadata {
  _createdAt?: number
  _durationMs?: number
  _channelModelId?: string
  isReplay?: boolean
}

function assistantMessage(text: string, metadata: MessageMetadata = {}): SDKMessage {
  return {
    type: 'assistant',
    message: { content: [{ type: 'text', text }] },
    parent_tool_use_id: null,
    ...metadata,
  } as SDKMessage
}

function userMessage(content: Array<{ type: string; [key: string]: unknown }>, metadata: MessageMetadata = {}): SDKMessage {
  return {
    type: 'user',
    message: { content },
    parent_tool_use_id: null,
    ...metadata,
  } as SDKMessage
}

function resultMessage(metadata: MessageMetadata = {}): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    usage: { input_tokens: 1, output_tokens: 2 },
    ...metadata,
  } as SDKMessage
}

function systemMessage(input: Omit<SDKSystemMessage, 'type'>): SDKMessage {
  return { type: 'system', ...input }
}

describe('sdk-message-persistence', () => {
  test('跳过 replay 消息，避免 resume 重复写入', () => {
    const replayAssistant = assistantMessage('历史消息', { isReplay: true })

    expect(shouldAccumulateSdkMessage(replayAssistant)).toBe(false)
    expect(shouldPersistSdkMessage(replayAssistant)).toBe(false)
    expect(prepareSdkMessageForAccumulation(replayAssistant, { channelModelId: 'claude-test' })).toBeNull()
    expect(prepareSdkMessagesForPersistence([replayAssistant], { now: 1000 })).toEqual([])
  })

  test('保留包含 tool_result 的 user 消息', () => {
    const toolResultUser = userMessage([
      { type: 'tool_result', tool_use_id: 'tool-1', content: 'ok' },
    ])

    expect(shouldAccumulateSdkMessage(toolResultUser)).toBe(true)
    expect(shouldPersistSdkMessage(toolResultUser)).toBe(true)
    expect(prepareSdkMessageForAccumulation(toolResultUser)).toBe(toolResultUser)
    expect(prepareSdkMessagesForPersistence([toolResultUser], { now: 1000 })).toEqual([
      { ...toolResultUser, _createdAt: 1000 },
    ])
  })

  test('过滤 SDK 内部 user 文本消息', () => {
    const syntheticUserText = userMessage([{ type: 'text', text: 'Skill 展开的 prompt' }])

    expect(shouldAccumulateSdkMessage(syntheticUserText)).toBe(false)
    expect(shouldPersistSdkMessage(syntheticUserText)).toBe(false)
    expect(prepareSdkMessageForAccumulation(syntheticUserText)).toBeNull()
    expect(prepareSdkMessagesForPersistence([syntheticUserText], { now: 1000 })).toEqual([])
  })

  test('保留 compact_boundary system 消息并过滤普通 system 消息', () => {
    const compactBoundary = systemMessage({ subtype: 'compact_boundary' })
    const initSystem = systemMessage({ subtype: 'init', model: 'claude-test' })

    expect(shouldAccumulateSdkMessage(compactBoundary)).toBe(true)
    expect(shouldPersistSdkMessage(compactBoundary)).toBe(true)
    expect(prepareSdkMessageForAccumulation(compactBoundary)).toBe(compactBoundary)

    expect(shouldAccumulateSdkMessage(initSystem)).toBe(false)
    expect(shouldPersistSdkMessage(initSystem)).toBe(false)
    expect(prepareSdkMessageForAccumulation(initSystem)).toBeNull()

    expect(prepareSdkMessagesForPersistence([compactBoundary, initSystem], { now: 1000 })).toEqual([
      { ...compactBoundary, _createdAt: 1000 },
    ])
  })

  test('为 result 消息附加时间戳和 duration metadata', () => {
    const result = resultMessage()

    expect(prepareSdkMessagesForPersistence([result], { now: 1000, durationMs: 2500 })).toEqual([
      { ...result, _createdAt: 1000, _durationMs: 2500 },
    ])
    expect((result as MessageMetadata)._createdAt).toBeUndefined()
    expect((result as MessageMetadata)._durationMs).toBeUndefined()
  })

  test('已有 _createdAt 时不覆盖 metadata', () => {
    const result = resultMessage({ _createdAt: 500 })

    const preparedMessages = prepareSdkMessagesForPersistence([result], { now: 1000, durationMs: 2500 })

    expect(preparedMessages).toEqual([result])
    expect(preparedMessages[0]).toBe(result)
  })

  test('assistant 注入 _channelModelId 时不原地修改输入消息', () => {
    const assistant = assistantMessage('新回复')

    const prepared = prepareSdkMessageForAccumulation(assistant, { channelModelId: 'claude-sonnet' })

    expect(prepared).toEqual({ ...assistant, _channelModelId: 'claude-sonnet' })
    expect(prepared).not.toBe(assistant)
    expect((assistant as MessageMetadata)._channelModelId).toBeUndefined()
  })
})

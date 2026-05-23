import { describe, expect, test } from 'bun:test'
import {
  createPersistedQueuedUserMessage,
  createQueuedUserMessageInput,
} from './queued-message'

describe('queued-message', () => {
  test('preset uuid 优先且不调用自动生成器', () => {
    let generated = false

    const result = createQueuedUserMessageInput({
      sessionId: 'session-1',
      text: '继续执行',
      presetUuid: 'preset-uuid',
      createUuid: () => {
        generated = true
        return 'generated-uuid'
      },
    })

    expect(generated).toBe(false)
    expect(result.uuid).toBe('preset-uuid')
    expect(result.sdkInput).toEqual({
      type: 'user',
      message: { role: 'user', content: '继续执行' },
      parent_tool_use_id: null,
      priority: 'now',
      uuid: 'preset-uuid',
      session_id: 'session-1',
    })
  })

  test('未传 preset uuid 时使用注入的生成器自动生成 uuid', () => {
    const result = createQueuedUserMessageInput({
      sessionId: 'session-2',
      text: '新的问题',
      createUuid: () => 'generated-uuid',
    })

    expect(result.uuid).toBe('generated-uuid')
    expect(result.sdkInput.uuid).toBe('generated-uuid')
  })

  test('preset uuid 为空字符串时保持旧语义并回退自动生成 uuid', () => {
    const result = createQueuedUserMessageInput({
      sessionId: 'session-2',
      text: '新的问题',
      presetUuid: '',
      createUuid: () => 'generated-uuid',
    })

    expect(result.uuid).toBe('generated-uuid')
    expect(result.sdkInput.uuid).toBe('generated-uuid')
  })

  test('SDK input 固定 now priority 并写入 session_id', () => {
    const result = createQueuedUserMessageInput({
      sessionId: 'active-session',
      text: '插队消息',
      presetUuid: 'message-uuid',
      createUuid: () => 'unused',
    })

    expect(result.sdkInput.priority).toBe('now')
    expect(result.sdkInput.session_id).toBe('active-session')
  })

  test('持久化消息写入文本、uuid 和 _createdAt', () => {
    const message = createPersistedQueuedUserMessage({
      uuid: 'message-uuid',
      text: '写入本地记录',
      now: 1000,
    })

    expect(message).toEqual({
      type: 'user',
      uuid: 'message-uuid',
      message: {
        content: [{ type: 'text', text: '写入本地记录' }],
      },
      parent_tool_use_id: null,
      _createdAt: 1000,
    })
  })
})

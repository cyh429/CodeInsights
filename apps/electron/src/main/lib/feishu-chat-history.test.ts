import { describe, expect, test } from 'bun:test'
import type { FeishuChatMessage } from '@codeinsights/shared'
import {
  formatFeishuChatHistoryContext,
  parseFeishuChatMessageContent,
} from './feishu-chat-history'

describe('feishu-chat-history', () => {
  test('解析文本消息内容', () => {
    const result = parseFeishuChatMessageContent('text', JSON.stringify({ text: '你好 CodeInsights' }))

    expect(result).toBe('你好 CodeInsights')
  })

  test('解析富文本消息标题和文本行，忽略非文本节点', () => {
    const result = parseFeishuChatMessageContent('post', JSON.stringify({
      title: '本周进展',
      content: [
        [
          { tag: 'text', text: '第一行' },
          { tag: 'a', text: '链接不应保留' },
          { tag: 'text', text: '继续' },
        ],
        [{ tag: 'img', image_key: 'img-key' }],
        [{ tag: 'text', text: '第二行' }],
      ],
    }))

    expect(result).toBe('本周进展\n第一行继续\n第二行')
  })

  test('富文本没有可读文本时回退为富文本占位', () => {
    const result = parseFeishuChatMessageContent('post', JSON.stringify({
      content: [[{ tag: 'img', image_key: 'img-key' }]],
    }))

    expect(result).toBe('[富文本消息]')
  })

  test('空内容、非法 JSON 和未知类型使用旧占位语义', () => {
    expect(parseFeishuChatMessageContent('text')).toBe('[空消息]')
    expect(parseFeishuChatMessageContent('text', '{bad json')).toBe('[text]')
    expect(parseFeishuChatMessageContent('custom_type', '{}')).toBe('[custom_type]')
  })

  test('常见非文本消息类型映射为中文占位', () => {
    expect(parseFeishuChatMessageContent('interactive', '{}')).toBe('[交互卡片]')
    expect(parseFeishuChatMessageContent('image', '{}')).toBe('[图片]')
    expect(parseFeishuChatMessageContent('file', '{}')).toBe('[文件]')
    expect(parseFeishuChatMessageContent('audio', '{}')).toBe('[语音]')
    expect(parseFeishuChatMessageContent('media', '{}')).toBe('[视频]')
    expect(parseFeishuChatMessageContent('sticker', '{}')).toBe('[表情]')
    expect(parseFeishuChatMessageContent('share_chat', '{}')).toBe('[群名片]')
    expect(parseFeishuChatMessageContent('share_user', '{}')).toBe('[个人名片]')
  })

  test('格式化群聊历史上下文并保留 Bot 角色和发送者 fallback', () => {
    const messages: FeishuChatMessage[] = [
      {
        messageId: 'm1',
        senderId: 'ou_user_1234567890',
        senderType: 'user',
        senderName: 'Alice',
        msgType: 'text',
        content: '第一条',
        createTime: 1000,
      },
      {
        messageId: 'm2',
        senderId: 'ou_user_without_name',
        senderType: 'user',
        msgType: 'text',
        content: '第二条',
        createTime: 2000,
      },
      {
        messageId: 'm3',
        senderId: 'cli_app',
        senderType: 'app',
        msgType: 'text',
        content: 'Bot 回复',
        createTime: 3000,
      },
    ]

    const result = formatFeishuChatHistoryContext(messages, {
      formatTime: (timestamp) => `T${timestamp}`,
    })

    expect(result).toBe([
      '--- 群聊历史消息（最近） ---',
      '[T1000] Alice: 第一条',
      '[T2000] ou_user_: 第二条',
      '[T3000] Bot: Bot 回复',
      '--- 历史消息结束 ---',
    ].join('\n'))
  })

  test('空历史格式化为空字符串', () => {
    expect(formatFeishuChatHistoryContext([])).toBe('')
  })
})

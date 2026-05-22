/**
 * 飞书群聊历史消息解析与格式化
 *
 * 只包含纯函数，供 Bridge 拉取历史后转换为 Agent 可读上下文。
 */

import type { FeishuChatMessage } from '@codeinsights/shared'

interface FeishuTextContent {
  text?: string
}

interface FeishuPostNode {
  tag: string
  text?: string
}

interface FeishuPostContent {
  title?: string
  content?: FeishuPostNode[][]
}

export interface FormatFeishuChatHistoryOptions {
  formatTime?: (createTime: number) => string
}

/**
 * 解析飞书消息内容为可读文本。
 */
export function parseFeishuChatMessageContent(msgType: string, rawContent?: string): string {
  if (!rawContent) return '[空消息]'

  try {
    switch (msgType) {
      case 'text': {
        const parsed = JSON.parse(rawContent) as FeishuTextContent
        return parsed.text ?? ''
      }
      case 'post': {
        const parsed = JSON.parse(rawContent) as FeishuPostContent
        const parts: string[] = []
        if (parsed.title) parts.push(parsed.title)
        for (const line of parsed.content ?? []) {
          const lineText = line
            .filter((el) => el.tag === 'text' && el.text)
            .map((el) => el.text)
            .join('')
          if (lineText) parts.push(lineText)
        }
        return parts.join('\n') || '[富文本消息]'
      }
      case 'interactive':
        return '[交互卡片]'
      case 'image':
        return '[图片]'
      case 'file':
        return '[文件]'
      case 'audio':
        return '[语音]'
      case 'media':
        return '[视频]'
      case 'sticker':
        return '[表情]'
      case 'share_chat':
        return '[群名片]'
      case 'share_user':
        return '[个人名片]'
      default:
        return `[${msgType}]`
    }
  } catch {
    return `[${msgType}]`
  }
}

/**
 * 将消息历史格式化为 Agent 可读的上下文文本。
 */
export function formatFeishuChatHistoryContext(
  messages: FeishuChatMessage[],
  options: FormatFeishuChatHistoryOptions = {},
): string {
  if (messages.length === 0) return ''

  const formatTime = options.formatTime ?? defaultFormatTime
  const lines = messages.map((msg) => {
    const time = formatTime(msg.createTime)
    const sender = msg.senderName ?? msg.senderId.slice(0, 8)
    const role = msg.senderType === 'app' ? 'Bot' : sender
    return `[${time}] ${role}: ${msg.content}`
  })

  return [
    '--- 群聊历史消息（最近） ---',
    ...lines,
    '--- 历史消息结束 ---',
  ].join('\n')
}

function defaultFormatTime(createTime: number): string {
  return new Date(createTime).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

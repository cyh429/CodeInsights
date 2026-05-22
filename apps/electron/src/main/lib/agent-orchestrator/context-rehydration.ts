import type { SDKMessage } from '@codeinsights/shared'

export const MAX_CONTEXT_MESSAGES = 20
export const MAX_TOOL_SUMMARY_LENGTH = 200

export interface ContextRehydrationSessionHint {
  agentCwd: string
  configDirName: string
}

export interface BuildContextPromptInput {
  sessionId: string
  currentUserMessage: string
  messages: SDKMessage[]
  sessionHint?: ContextRehydrationSessionHint
}

export interface ContextPromptBuildResult {
  prompt: string
  totalMessageCount: number
  injectedHistoryCount: number
  hasSessionInfo: boolean
}

export interface SDKToolSummaryInput {
  file_path?: unknown
  command?: unknown
  path?: unknown
  query?: unknown
}

export interface SDKToolSummaryBlock {
  type: string
  text?: string
  name?: string
  input?: SDKToolSummaryInput
}

interface SDKMessageWithContent {
  type: string
  message?: {
    content?: SDKToolSummaryBlock[]
  }
}

/**
 * 从 SDKMessage assistant 消息的 content 中提取工具活动摘要。
 */
export function extractSDKToolSummary(content: SDKToolSummaryBlock[]): string {
  const summaries: string[] = []
  for (const block of content) {
    if (block.type === 'tool_use' && block.name) {
      const input = block.input ?? {}
      const keyParam = input.file_path ?? input.command ?? input.path ?? input.query ?? ''
      const paramStr = keyParam ? `: ${String(keyParam).slice(0, 100)}` : ''
      summaries.push(`[tool: ${block.name}${paramStr}]`)
    }
  }
  if (summaries.length === 0) return ''
  const joined = summaries.join(' ')
  return joined.length > MAX_TOOL_SUMMARY_LENGTH
    ? `${joined.slice(0, MAX_TOOL_SUMMARY_LENGTH)}...`
    : joined
}

/**
 * 基于已读取的 SDKMessage 构建上下文回填 prompt。
 *
 * 调用方仍负责读取 JSONL、决定调用时机和记录日志，避免移动执行链路。
 */
export function buildContextPromptFromSDKMessages(input: BuildContextPromptInput): ContextPromptBuildResult {
  const { sessionId, currentUserMessage, messages, sessionHint } = input
  if (messages.length === 0) {
    return emptyContextResult(currentUserMessage, messages.length)
  }

  // 排除最后一条：当前用户消息刚写入 JSONL，不能重复回填。
  const history = messages.slice(0, -1)
  if (history.length === 0) {
    return emptyContextResult(currentUserMessage, messages.length)
  }

  const lines = history
    .slice(-MAX_CONTEXT_MESSAGES)
    .filter((message) => message.type === 'user' || message.type === 'assistant')
    .map((message) => buildHistoryLine(message))
    .filter(isHistoryLine)

  if (lines.length === 0) {
    return emptyContextResult(currentUserMessage, messages.length)
  }

  const sessionInfoBlock = sessionHint
    ? `\n<session_info>\nSession ID: ${sessionId}\nSession CWD: ${sessionHint.agentCwd}\nNote: 上方为近期对话摘要。如需更多上下文，可读取 ~/${sessionHint.configDirName}/agent-sessions/${sessionId}.jsonl 获取完整历史。\n</session_info>\n`
    : ''

  return {
    prompt: `<conversation_history>${sessionInfoBlock}\n${lines.join('\n')}\n</conversation_history>\n\n${currentUserMessage}`,
    totalMessageCount: messages.length,
    injectedHistoryCount: lines.length,
    hasSessionInfo: Boolean(sessionHint),
  }
}

function emptyContextResult(prompt: string, totalMessageCount: number): ContextPromptBuildResult {
  return {
    prompt,
    totalMessageCount,
    injectedHistoryCount: 0,
    hasSessionInfo: false,
  }
}

function buildHistoryLine(message: SDKMessage): string | null {
  const content = (message as SDKMessageWithContent).message?.content
  if (!Array.isArray(content)) return null

  const textParts = content
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text!)
  const text = textParts.join('\n')
  if (!text) return null

  let line = `[${message.type}]: ${text}`
  if (message.type === 'assistant') {
    const toolSummary = extractSDKToolSummary(content)
    if (toolSummary) {
      line += `\n  工具活动: ${toolSummary}`
    }
  }
  return line
}

function isHistoryLine(value: string | null): value is string {
  return value !== null
}

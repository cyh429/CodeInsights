import { describe, expect, test } from 'bun:test'
import type { SDKMessage } from '@codeinsights/shared'
import {
  MAX_CONTEXT_MESSAGES,
  buildContextPromptFromSDKMessages,
  extractSDKToolSummary,
} from './context-rehydration'

interface ToolUseInput {
  file_path?: string
  command?: string
  path?: string
  query?: string
}

function userMessage(text: string): SDKMessage {
  return {
    type: 'user',
    message: {
      content: [{ type: 'text', text }],
    },
    parent_tool_use_id: null,
  }
}

function assistantMessage(content: Array<{ type: string; text?: string; name?: string; input?: ToolUseInput }>): SDKMessage {
  return {
    type: 'assistant',
    message: { content },
    parent_tool_use_id: null,
  }
}

function resultMessage(): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    usage: { input_tokens: 1, output_tokens: 1 },
  }
}

describe('context-rehydration', () => {
  test('没有可回填历史时直接返回当前消息', () => {
    const result = buildContextPromptFromSDKMessages({
      sessionId: 'session-1',
      currentUserMessage: '当前问题',
      messages: [],
    })

    expect(result).toEqual({
      prompt: '当前问题',
      totalMessageCount: 0,
      injectedHistoryCount: 0,
      hasSessionInfo: false,
    })
  })

  test('排除最后一条刚追加的当前用户消息', () => {
    const result = buildContextPromptFromSDKMessages({
      sessionId: 'session-1',
      currentUserMessage: '动态上下文\n\n当前问题',
      messages: [
        userMessage('上一轮问题'),
        assistantMessage([{ type: 'text', text: '上一轮回答' }]),
        userMessage('当前问题'),
      ],
    })

    expect(result.prompt).toContain('[user]: 上一轮问题')
    expect(result.prompt).toContain('[assistant]: 上一轮回答')
    expect(result.prompt).not.toContain('[user]: 当前问题')
    expect(result.prompt).toEndWith('\n\n动态上下文\n\n当前问题')
    expect(result.injectedHistoryCount).toBe(2)
  })

  test('最多只回填最近 20 条历史消息', () => {
    const history = Array.from({ length: 25 }, (_, index) => userMessage(`历史 ${index}`))

    const result = buildContextPromptFromSDKMessages({
      sessionId: 'session-1',
      currentUserMessage: '当前问题',
      messages: [...history, userMessage('当前问题')],
    })

    expect(result.injectedHistoryCount).toBe(MAX_CONTEXT_MESSAGES)
    expect(result.prompt).not.toContain('[user]: 历史 4')
    expect(result.prompt).toContain('[user]: 历史 5')
    expect(result.prompt).toContain('[user]: 历史 24')
  })

  test('只注入 user/assistant 文本，并为 assistant 文本附加工具摘要', () => {
    const result = buildContextPromptFromSDKMessages({
      sessionId: 'session-1',
      currentUserMessage: '当前问题',
      messages: [
        resultMessage(),
        userMessage('用户文本'),
        assistantMessage([
          { type: 'thinking', text: '内部思考不应出现' },
          { type: 'text', text: '助手文本' },
          { type: 'tool_use', name: 'Read', input: { file_path: '/tmp/a.ts' } },
        ]),
        assistantMessage([{ type: 'tool_use', name: 'Bash', input: { command: 'git status' } }]),
        userMessage('当前问题'),
      ],
    })

    expect(result.prompt).toContain('[user]: 用户文本')
    expect(result.prompt).toContain('[assistant]: 助手文本\n  工具活动: [tool: Read: /tmp/a.ts]')
    expect(result.prompt).not.toContain('内部思考不应出现')
    expect(result.prompt).not.toContain('[tool: Bash: git status]')
    expect(result.injectedHistoryCount).toBe(2)
  })

  test('带 session hint 时注入 session_info', () => {
    const result = buildContextPromptFromSDKMessages({
      sessionId: 'session-1',
      currentUserMessage: '当前问题',
      messages: [userMessage('历史'), userMessage('当前问题')],
      sessionHint: {
        agentCwd: '/tmp/workspace',
        configDirName: '.codeinsights-test',
      },
    })

    expect(result.hasSessionInfo).toBe(true)
    expect(result.prompt).toContain('<session_info>')
    expect(result.prompt).toContain('Session ID: session-1')
    expect(result.prompt).toContain('Session CWD: /tmp/workspace')
    expect(result.prompt).toContain('~/.codeinsights-test/agent-sessions/session-1.jsonl')
  })

  test('完整 prompt 格式保持与旧上下文回填一致', () => {
    const result = buildContextPromptFromSDKMessages({
      sessionId: 'session-1',
      currentUserMessage: '动态上下文\n\n当前问题',
      messages: [
        userMessage('上一轮问题'),
        assistantMessage([
          { type: 'text', text: '上一轮回答' },
          { type: 'tool_use', name: 'Read', input: { file_path: '/tmp/a.ts' } },
        ]),
        userMessage('当前问题'),
      ],
      sessionHint: {
        agentCwd: '/tmp/workspace',
        configDirName: '.codeinsights-test',
      },
    })

    expect(result.prompt).toBe(
      '<conversation_history>\n<session_info>\nSession ID: session-1\nSession CWD: /tmp/workspace\nNote: 上方为近期对话摘要。如需更多上下文，可读取 ~/.codeinsights-test/agent-sessions/session-1.jsonl 获取完整历史。\n</session_info>\n\n[user]: 上一轮问题\n[assistant]: 上一轮回答\n  工具活动: [tool: Read: /tmp/a.ts]\n</conversation_history>\n\n动态上下文\n\n当前问题',
    )
  })

  test('工具摘要提取关键参数并限制长度', () => {
    const longPath = `/tmp/${'a'.repeat(240)}.ts`

    const summary = extractSDKToolSummary(Array.from({ length: 3 }, () => (
      { type: 'tool_use', name: 'Read', input: { file_path: longPath } }
    )))

    expect(summary).toStartWith('[tool: Read: /tmp/')
    expect(summary).toEndWith('...')
    expect(summary.length).toBe(203)
  })
})

import { describe, expect, test } from 'bun:test'
import { createAgentStreamEnvelope, type AgentRuntimeEvent, type AgentStreamEnvelope } from '@rv-insights/shared'
import { FeishuChannelAdapter } from './feishu-channel-adapter'

describe('FeishuChannelAdapter', () => {
  test('throttles assistant delta and sends final markdown from runtime events', async () => {
    const deltas: Array<{ chatId: string; text: string }> = []
    const finals: Array<{ chatId: string; markdown: string; tools: string[] }> = []
    const adapter = new FeishuChannelAdapter({
      botId: 'bot-a',
      deltaThrottleMs: 0,
      callbacks: {
        sendAssistantDelta: (chatId, text) => {
          deltas.push({ chatId, text })
        },
        sendFinalMarkdown: (chatId, markdown, summary) => {
          finals.push({ chatId, markdown, tools: summary.toolNames })
        },
      },
    })

    adapter.bindSession({
      channelType: 'feishu',
      channelId: 'bot-a',
      targetId: 'chat-a',
      sessionId: 'session-a',
    })

    await adapter.consumeEnvelope(envelope(0, { type: 'assistant_delta', messageId: 'm1', delta: '你好，' }))
    await adapter.consumeEnvelope(envelope(1, { type: 'assistant_delta', messageId: 'm1', delta: '这是结果。' }))
    await adapter.consumeEnvelope(envelope(2, { type: 'tool_started', toolCallId: 'tool-1', name: 'Read', inputSummary: '{}', riskLevel: 'safe' }))
    await adapter.consumeEnvelope(envelope(3, { type: 'run_completed', resultSubtype: 'success', terminalReason: 'completed', usage: {} }))

    expect(deltas.map((item) => item.text).join('')).toContain('你好，这是结果。')
    expect(finals).toHaveLength(1)
    expect(finals[0]).toMatchObject({
      chatId: 'chat-a',
      markdown: '你好，这是结果。',
      tools: ['Read'],
    })
  })

  test('queues permission requests to desktop instead of auto approving', async () => {
    const queued: Array<{ sessionId: string; requestId: string; toolName: string }> = []
    const adapter = new FeishuChannelAdapter({
      botId: 'bot-a',
      callbacks: {
        sendFinalMarkdown: () => undefined,
        queuePermissionToDesktop: (sessionId, requestId, toolName) => {
          queued.push({ sessionId, requestId, toolName })
        },
      },
    })

    adapter.bindSession({
      channelType: 'feishu',
      channelId: 'bot-a',
      targetId: 'chat-a',
      sessionId: 'session-a',
    })

    await adapter.consumeEnvelope(envelope(0, {
      type: 'permission_requested',
      requestId: 'permission-a',
      toolName: 'Write',
      riskLevel: 'dangerous',
      inputSummary: '{}',
      scopeOptions: ['once'],
    }))

    expect(queued).toEqual([{ sessionId: 'session-a', requestId: 'permission-a', toolName: 'Write' }])
  })

  test('uses assistant_message as conservative fallback when no delta exists', async () => {
    const finals: string[] = []
    const adapter = new FeishuChannelAdapter({
      botId: 'bot-a',
      callbacks: {
        sendFinalMarkdown: (_chatId, markdown) => {
          finals.push(markdown)
        },
      },
    })

    adapter.bindSession({
      channelType: 'feishu',
      channelId: 'bot-a',
      targetId: 'chat-a',
      sessionId: 'session-a',
    })

    await adapter.consumeEnvelope(envelope(0, {
      type: 'assistant_message',
      messageId: 'm1',
      status: 'complete',
      contentBlocks: [{ type: 'text', text: '完整回复' }],
    }))
    await adapter.consumeEnvelope(envelope(1, {
      type: 'assistant_message',
      messageId: 'm2',
      status: 'complete',
      contentBlocks: [{ type: 'text', text: '第二段' }],
    }))
    await adapter.consumeEnvelope(envelope(2, { type: 'run_completed', resultSubtype: 'success', terminalReason: 'completed', usage: {} }))

    expect(finals).toEqual(['完整回复第二段'])
  })
})

function envelope(sequence: number, event: AgentRuntimeEvent): AgentStreamEnvelope {
  return createAgentStreamEnvelope({
    sessionId: 'session-a',
    runId: 'run-a',
    sequence,
    source: 'claude_sdk',
    event,
    createdAt: '2026-05-18T00:00:00.000Z',
  })
}

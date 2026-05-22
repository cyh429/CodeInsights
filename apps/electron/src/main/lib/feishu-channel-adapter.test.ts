import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAgentStreamEnvelope, type AgentRuntimeEvent, type AgentStreamEnvelope } from '@rv-insights/shared'

const originalChannelsV2Env = process.env.RV_AGENT_RUNTIME_CHANNELS_V2
delete process.env.RV_AGENT_RUNTIME_CHANNELS_V2

const agentChannelModule = await import('./agent-channel')
const { FeishuChannelAdapter } = await import('./feishu-channel-adapter')

if (originalChannelsV2Env == null) {
  delete process.env.RV_AGENT_RUNTIME_CHANNELS_V2
} else {
  process.env.RV_AGENT_RUNTIME_CHANNELS_V2 = originalChannelsV2Env
}

const {
  agentRuntimeChannelsV2,
  resolveAgentRuntimeChannelsV2Enabled,
} = agentChannelModule

const agentChannelUrl = new URL('./agent-channel.ts', import.meta.url).href

function assertChannelsV2ImportFlag(
  envValue: string | undefined,
  expectedEnabled: boolean,
): void {
  const tempDir = mkdtempSync(join(tmpdir(), 'rv-agent-channel-env-'))
  const testPath = join(tempDir, 'agent-channel-env.test.ts')
  writeFileSync(testPath, `
import { expect, test } from 'bun:test'

test('channels v2 import flag', async () => {
  const mod = await import(${JSON.stringify(agentChannelUrl)})
  expect(mod.agentRuntimeChannelsV2.enabled).toBe(${JSON.stringify(expectedEnabled)})
})
`, 'utf-8')

  try {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      RV_INSIGHTS_CONFIG_DIR: tempDir,
    }
    if (envValue === undefined) {
      delete env.RV_AGENT_RUNTIME_CHANNELS_V2
    } else {
      env.RV_AGENT_RUNTIME_CHANNELS_V2 = envValue
    }
    execFileSync(process.execPath, ['test', testPath], {
      cwd: process.cwd(),
      env,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('FeishuChannelAdapter', () => {
  test('Channels v2 未设置 env 时默认启用', () => {
    expect(resolveAgentRuntimeChannelsV2Enabled(undefined)).toBe(true)
    expect(resolveAgentRuntimeChannelsV2Enabled('')).toBe(true)
    expect(agentRuntimeChannelsV2.enabled).toBe(true)
  })

  test('Channels v2 显式关闭 env 会回到旧 Feishu bridge 路径', () => {
    for (const value of ['0', 'false', 'off', 'no', 'disabled']) {
      expect(resolveAgentRuntimeChannelsV2Enabled(value)).toBe(false)
      expect(resolveAgentRuntimeChannelsV2Enabled(` ${value.toUpperCase()} `)).toBe(false)
    }
  })

  test('Channels v2 显式开启 env 会强制 AgentChannel 路径', () => {
    for (const value of ['1', 'true', 'on', 'yes', 'enabled']) {
      expect(resolveAgentRuntimeChannelsV2Enabled(value)).toBe(true)
      expect(resolveAgentRuntimeChannelsV2Enabled(` ${value.toUpperCase()} `)).toBe(true)
    }
  })

  test('Channels v2 模块导入时遵守 env 默认与回滚开关', () => {
    assertChannelsV2ImportFlag(undefined, true)
    assertChannelsV2ImportFlag('0', false)
    assertChannelsV2ImportFlag('1', true)
  })

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

import type { AgentStreamEnvelope } from '@rv-insights/shared'
import type { AgentChannel, AgentChannelRunContext } from './agent-channel'

export type FeishuPermissionStrategy = 'queue_to_desktop'
export type FeishuOutputStrategy = 'markdown' | 'interactive_card_stub'

export interface FeishuChannelAdapterCallbacks {
  sendAssistantDelta?(chatId: string, text: string): void | Promise<void>
  sendFinalMarkdown(chatId: string, markdown: string, summary: FeishuChannelRunSummary): void | Promise<void>
  queuePermissionToDesktop?(sessionId: string, requestId: string, toolName: string): void | Promise<void>
  sendError?(chatId: string, message: string): void | Promise<void>
}

export interface FeishuChannelRunSummary {
  durationMs: number
  toolNames: string[]
  permissionStrategy: FeishuPermissionStrategy
  outputStrategy: FeishuOutputStrategy
}

interface FeishuRunBuffer {
  chatId: string
  sessionId: string
  startedAt: number
  assistantText: string
  pendingDelta: string
  hasDelta: boolean
  lastDeltaSentAt: number
  toolNames: Set<string>
}

export interface FeishuChannelAdapterOptions {
  botId: string
  deltaThrottleMs?: number
  outputStrategy?: FeishuOutputStrategy
  callbacks: FeishuChannelAdapterCallbacks
}

/**
 * 飞书 channel adapter。
 *
 * 只消费 AgentStreamEnvelope，不读取 SDKMessage 内部结构。输出策略保持保守：
 * - assistant_delta 仅做节流增量提示；
 * - run_completed 拼接最终 Markdown；
 * - permission_requested 默认排队到桌面端，不在飞书侧自动 approve/bypass。
 */
export class FeishuChannelAdapter implements AgentChannel {
  readonly type = 'feishu' as const
  readonly id: string

  private readonly buffers = new Map<string, FeishuRunBuffer>()
  private readonly deltaThrottleMs: number

  constructor(private readonly options: FeishuChannelAdapterOptions) {
    this.id = `feishu:${options.botId}`
    this.deltaThrottleMs = options.deltaThrottleMs ?? 1200
  }

  bindSession(context: AgentChannelRunContext): void {
    if (!context.targetId) {
      throw new Error('Feishu channel 需要 targetId 作为 chatId')
    }
    this.buffers.set(context.sessionId, {
      chatId: context.targetId,
      sessionId: context.sessionId,
      startedAt: context.startedAt ?? Date.now(),
      assistantText: '',
      pendingDelta: '',
      hasDelta: false,
      lastDeltaSentAt: 0,
      toolNames: new Set(),
    })
  }

  async consumeEnvelope(envelope: AgentStreamEnvelope): Promise<void> {
    const buffer = this.buffers.get(envelope.sessionId)
    if (!buffer) return

    switch (envelope.event.type) {
      case 'assistant_delta':
        buffer.hasDelta = true
        buffer.assistantText += envelope.event.delta
        buffer.pendingDelta += envelope.event.delta
        await this.flushDeltaIfDue(buffer)
        break
      case 'assistant_message':
        this.mergeAssistantMessage(buffer, envelope.event.contentBlocks)
        break
      case 'tool_started':
        buffer.toolNames.add(envelope.event.name)
        break
      case 'permission_requested':
        await this.options.callbacks.queuePermissionToDesktop?.(
          envelope.sessionId,
          envelope.event.requestId,
          envelope.event.toolName,
        )
        break
      case 'run_completed':
        await this.flushDelta(buffer, true)
        await this.options.callbacks.sendFinalMarkdown(
          buffer.chatId,
          this.buildFinalMarkdown(buffer),
          this.buildSummary(buffer),
        )
        this.buffers.delete(envelope.sessionId)
        break
      case 'run_failed':
        await this.options.callbacks.sendError?.(buffer.chatId, envelope.event.error.message)
        this.buffers.delete(envelope.sessionId)
        break
      case 'run_stopped':
        await this.options.callbacks.sendError?.(buffer.chatId, 'Agent 已停止')
        this.buffers.delete(envelope.sessionId)
        break
      default:
        break
    }
  }

  private mergeAssistantMessage(buffer: FeishuRunBuffer, contentBlocks: unknown[]): void {
    if (buffer.hasDelta) return
    const textParts: string[] = []
    for (const block of contentBlocks) {
      if (!isRecord(block)) continue
      if (block.type === 'text' && typeof block.text === 'string') {
        textParts.push(block.text)
      }
    }
    if (textParts.length > 0) {
      const text = textParts.join('')
      buffer.assistantText += text
      buffer.pendingDelta += text
    }
  }

  private async flushDeltaIfDue(buffer: FeishuRunBuffer): Promise<void> {
    if (!this.options.callbacks.sendAssistantDelta) return
    const now = Date.now()
    if (now - buffer.lastDeltaSentAt < this.deltaThrottleMs) return
    await this.flushDelta(buffer, false)
  }

  private async flushDelta(buffer: FeishuRunBuffer, force: boolean): Promise<void> {
    if (!this.options.callbacks.sendAssistantDelta) return
    const text = buffer.pendingDelta.trim()
    if (!text) return
    if (!force && text.length < 24) return
    buffer.pendingDelta = ''
    buffer.lastDeltaSentAt = Date.now()
    await this.options.callbacks.sendAssistantDelta(buffer.chatId, text)
  }

  private buildFinalMarkdown(buffer: FeishuRunBuffer): string {
    const text = buffer.assistantText.trim()
    return text || 'Agent 已完成（无文本输出）'
  }

  private buildSummary(buffer: FeishuRunBuffer): FeishuChannelRunSummary {
    return {
      durationMs: Date.now() - buffer.startedAt,
      toolNames: Array.from(buffer.toolNames),
      permissionStrategy: 'queue_to_desktop',
      outputStrategy: this.options.outputStrategy ?? 'markdown',
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

import type { WebContents } from 'electron'
import { AGENT_IPC_CHANNELS } from '@rv-insights/shared'
import type {
  AgentStreamCompletePayload,
  AgentStreamEnvelope,
  AgentStreamEvent,
  AgentStreamPayload,
} from '@rv-insights/shared'

const CHANNELS_V2_DISABLED_VALUES = new Set(['0', 'false', 'off', 'no', 'disabled'])
const CHANNELS_V2_ENABLED_VALUES = new Set(['1', 'true', 'on', 'yes', 'enabled'])

export function resolveAgentRuntimeChannelsV2Enabled(
  value = process.env.RV_AGENT_RUNTIME_CHANNELS_V2,
): boolean {
  if (value === undefined) return true
  const normalized = value.trim().toLowerCase()
  if (normalized === '') return true
  if (CHANNELS_V2_DISABLED_VALUES.has(normalized)) return false
  if (CHANNELS_V2_ENABLED_VALUES.has(normalized)) return true
  return true
}

export const agentRuntimeChannelsV2 = {
  enabled: resolveAgentRuntimeChannelsV2Enabled(),
}

export type AgentChannelType = 'electron' | 'feishu'

export interface AgentChannelRunContext {
  channelType: AgentChannelType
  channelId: string
  sessionId: string
  runId?: string
  targetId?: string
  startedAt?: number
  metadata?: Record<string, string>
}

export interface AgentChannel {
  readonly type: AgentChannelType
  readonly id: string
  bindSession(context: AgentChannelRunContext): void | Promise<void>
  consumeEnvelope(envelope: AgentStreamEnvelope): void | Promise<void>
  complete?(sessionId: string, payload?: AgentStreamCompletePayload): void | Promise<void>
  error?(sessionId: string, error: string): void | Promise<void>
  titleUpdated?(sessionId: string, title: string): void | Promise<void>
}

export interface ElectronAgentChannelOptions {
  webContents: WebContents
}

/**
 * 桌面端 channel adapter。
 *
 * 阶段 9 只建立统一 channel 边界；Electron UI 仍消费现有 IPC payload，
 * 因此这里保持原有 STREAM_EVENT / STREAM_COMPLETE / STREAM_ERROR 行为不变。
 */
export class ElectronAgentChannel implements AgentChannel {
  readonly type = 'electron' as const
  readonly id = 'electron'

  constructor(private readonly options: ElectronAgentChannelOptions) {}

  bindSession(_context: AgentChannelRunContext): void {
    // Electron 绑定仍由 agent-service 的 sessionWebContents Map 管理。
  }

  consumePayload(sessionId: string, payload: AgentStreamPayload): void {
    const webContents = this.options.webContents
    if (webContents.isDestroyed()) return
    webContents.send(AGENT_IPC_CHANNELS.STREAM_EVENT, { sessionId, payload } as AgentStreamEvent)
  }

  consumeEnvelope(_envelope: AgentStreamEnvelope): void {
    // Electron 当前主路径已经在 Renderer 内部从旧 payload 生成 envelope。
    // 这里保留接口，避免改变桌面 UI 的可见事件顺序。
  }

  complete(sessionId: string, payload?: AgentStreamCompletePayload): void {
    const webContents = this.options.webContents
    if (webContents.isDestroyed()) return
    webContents.send(AGENT_IPC_CHANNELS.STREAM_COMPLETE, {
      sessionId,
      messages: payload?.messages ?? [],
      stoppedByUser: payload?.stoppedByUser ?? false,
      startedAt: payload?.startedAt,
      resultSubtype: payload?.resultSubtype,
    })
  }

  error(sessionId: string, error: string): void {
    const webContents = this.options.webContents
    if (webContents.isDestroyed()) return
    webContents.send(AGENT_IPC_CHANNELS.STREAM_ERROR, { sessionId, error })
  }

  titleUpdated(sessionId: string, title: string): void {
    const webContents = this.options.webContents
    if (webContents.isDestroyed()) return
    webContents.send(AGENT_IPC_CHANNELS.TITLE_UPDATED, { sessionId, title })
  }
}

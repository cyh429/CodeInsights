import type {
  AgentWorkspace,
  Channel,
  PipelinePreflightAcknowledgement,
  PipelinePreflightResult,
} from '@codeinsights/shared'
import { isAgentCompatibleProvider } from '@codeinsights/shared'
import type { SettingsTab } from '@/atoms/settings-tab'

export interface PipelineRunConfig {
  channelId: string
  workspaceId: string
}

export interface PipelinePreflightError {
  message: string
  settingsTab: SettingsTab
}

export const PIPELINE_PREFLIGHT_RESULT_TTL_MS = 60_000

export interface ResolvePipelineRunConfigInput {
  sessionChannelId?: string
  sessionWorkspaceId?: string
  fallbackChannelId?: string
  fallbackWorkspaceId?: string
  pipelineCodexChannelId?: string
  channels: Channel[]
  workspaces: AgentWorkspace[]
}

export type ResolvePipelineRunConfigResult =
  | {
      ok: true
      config: PipelineRunConfig
    }
  | {
      ok: false
      error: PipelinePreflightError
    }

export function resolvePipelineRunConfig(
  input: ResolvePipelineRunConfigInput,
): ResolvePipelineRunConfigResult {
  if (input.pipelineCodexChannelId) {
    const codexChannel = input.channels.find((item) => item.id === input.pipelineCodexChannelId)
    if (!codexChannel) {
      return {
        ok: false,
        error: {
          message: 'Pipeline Codex 渠道不存在，请重新选择。',
          settingsTab: 'channels',
        },
      }
    }
    if (!codexChannel.enabled) {
      return {
        ok: false,
        error: {
          message: `Pipeline Codex 渠道 ${codexChannel.name} 已被禁用，请启用后再启动。`,
          settingsTab: 'channels',
        },
      }
    }
    if (codexChannel.provider !== 'openai' && codexChannel.provider !== 'custom') {
      return {
        ok: false,
        error: {
          message: `Pipeline Codex 渠道 ${codexChannel.name} 不是 OpenAI 兼容供应商。`,
          settingsTab: 'channels',
        },
      }
    }
  }

  const channelId = input.sessionChannelId ?? input.fallbackChannelId
  if (!channelId) {
    return {
      ok: false,
      error: {
        message: '请先在 Agent 配置中选择默认渠道，再启动 Pipeline。',
        settingsTab: 'agent',
      },
    }
  }

  const channel = input.channels.find((item) => item.id === channelId)
  if (!channel) {
    return {
      ok: false,
      error: {
        message: '当前 Pipeline 所需渠道不存在，请重新选择默认渠道。',
        settingsTab: 'channels',
      },
    }
  }

  if (!channel.enabled) {
    return {
      ok: false,
      error: {
        message: `渠道 ${channel.name} 已被禁用，请启用后再启动 Pipeline。`,
        settingsTab: 'channels',
      },
    }
  }

  if (!isAgentCompatibleProvider(channel.provider)) {
    return {
      ok: false,
      error: {
        message: `渠道 ${channel.name} 不是 Agent 兼容供应商，无法用于 Pipeline。`,
        settingsTab: 'channels',
      },
    }
  }

  const workspaceId = input.sessionWorkspaceId ?? input.fallbackWorkspaceId
  if (!workspaceId) {
    return {
      ok: false,
      error: {
        message: '请先在 Agent 配置中选择默认工作区，再启动 Pipeline。',
        settingsTab: 'agent',
      },
    }
  }

  const workspace = input.workspaces.find((item) => item.id === workspaceId)
  if (!workspace) {
    return {
      ok: false,
      error: {
        message: '当前 Pipeline 所需工作区不存在，请重新选择默认工作区。',
        settingsTab: 'agent',
      },
    }
  }

  return {
    ok: true,
    config: {
      channelId,
      workspaceId,
    },
  }
}

export function createPipelinePreflightAcknowledgement(
  result: PipelinePreflightResult,
  acknowledgedAt = Date.now(),
): PipelinePreflightAcknowledgement {
  return {
    fingerprint: result.fingerprint,
    acceptedWarningCodes: result.warnings.map((warning) => warning.code),
    acknowledgedAt,
  }
}

export function isPipelinePreflightAcknowledged(
  result: PipelinePreflightResult,
  acknowledgement: PipelinePreflightAcknowledgement | null | undefined,
): boolean {
  if (result.warnings.length === 0) return true
  if (!acknowledgement || acknowledgement.fingerprint !== result.fingerprint) return false

  const acceptedCodes = new Set(acknowledgement.acceptedWarningCodes)
  return result.warnings.every((warning) => acceptedCodes.has(warning.code))
}

export function shouldBlockPipelineStartForPreflight(
  result: PipelinePreflightResult | null | undefined,
  acknowledgement: PipelinePreflightAcknowledgement | null | undefined,
): boolean {
  if (!result) return false
  if (result.blockers.length > 0) return true
  return result.warnings.length > 0 && !isPipelinePreflightAcknowledged(result, acknowledgement)
}

export type PipelinePreflightRefreshReason = 'stale' | 'workspace_changed'

export interface PipelinePreflightRefreshStateInput {
  result: PipelinePreflightResult | null | undefined
  acknowledgement: PipelinePreflightAcknowledgement | null | undefined
  checkedWorkspaceId?: string
  currentWorkspaceId?: string
  now?: number
  ttlMs?: number
}

export interface PipelinePreflightRefreshState {
  refreshRequired: boolean
  reason: PipelinePreflightRefreshReason | null
  acknowledgement: PipelinePreflightAcknowledgement | null
  message: string | null
}

export function getPipelinePreflightRefreshState({
  result,
  acknowledgement,
  checkedWorkspaceId,
  currentWorkspaceId,
  now = Date.now(),
  ttlMs = PIPELINE_PREFLIGHT_RESULT_TTL_MS,
}: PipelinePreflightRefreshStateInput): PipelinePreflightRefreshState {
  if (!result) {
    return {
      refreshRequired: false,
      reason: null,
      acknowledgement: acknowledgement ?? null,
      message: null,
    }
  }

  if (checkedWorkspaceId && currentWorkspaceId && checkedWorkspaceId !== currentWorkspaceId) {
    return {
      refreshRequired: true,
      reason: 'workspace_changed',
      acknowledgement: null,
      message: '当前工作区已变化，请重新执行启动前检查。',
    }
  }

  if (now - result.checkedAt > ttlMs) {
    return {
      refreshRequired: true,
      reason: 'stale',
      acknowledgement: null,
      message: '启动前检查已超过 60 秒，请重新检查。',
    }
  }

  return {
    refreshRequired: false,
    reason: null,
    acknowledgement: acknowledgement ?? null,
    message: null,
  }
}

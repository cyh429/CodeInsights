import type { ActivityStatus } from '@/atoms/agent-atoms'
import type { AgentRuntimeRunnerMode, CodingAgentRuntimeKind, DangerLevel } from '@codeinsights/shared'

export type AgentBannerTone = 'neutral' | 'waiting' | 'danger' | 'planning'

export interface AgentHeaderMetaInput {
  workspaceName?: string | null
  modelName?: string | null
  permissionMode?: string | null
  streaming?: boolean
  planMode?: boolean
  runtimeKind?: CodingAgentRuntimeKind
}

export interface AgentHeaderMetaItem {
  key: 'runtime' | 'workspace' | 'model' | 'permission' | 'state'
  label: string
  value: string
  tone: 'neutral' | 'running' | 'waiting'
}

export function buildAgentHeaderMeta(input: AgentHeaderMetaInput): AgentHeaderMetaItem[] {
  const items: AgentHeaderMetaItem[] = [
    {
      key: 'runtime',
      label: 'Runtime',
      value: formatRuntimeKind(input.runtimeKind),
      tone: input.runtimeKind === 'codex' ? 'running' : 'neutral',
    },
    {
      key: 'workspace',
      label: '工作区',
      value: input.workspaceName?.trim() || '未选择工作区',
      tone: input.workspaceName ? 'neutral' : 'waiting',
    },
    {
      key: 'model',
      label: '模型',
      value: input.modelName?.trim() || '未选择模型',
      tone: input.modelName ? 'neutral' : 'waiting',
    },
    {
      key: 'permission',
      label: '权限',
      value: formatPermissionMode(input.permissionMode),
      tone: input.permissionMode === 'plan' ? 'waiting' : 'neutral',
    },
  ]

  if (input.streaming || input.planMode) {
    items.push({
      key: 'state',
      label: '状态',
      value: input.planMode ? '规划中' : '生成中',
      tone: input.planMode ? 'waiting' : 'running',
    })
  }

  return items
}

export function formatRuntimeKind(kind?: CodingAgentRuntimeKind | null): string {
  return kind === 'codex' ? 'Codex' : 'Claude Code'
}

export function formatPermissionMode(mode?: string | null): string {
  if (mode === 'plan') return 'Plan'
  if (mode === 'bypassPermissions') return 'Allow all'
  if (mode === 'default') return 'Ask'
  if (mode === 'acceptEdits') return 'Auto edits'
  return 'Ask'
}

export function getBannerToneForPermission(dangerLevel: DangerLevel): AgentBannerTone {
  return dangerLevel === 'dangerous' ? 'danger' : 'waiting'
}

export function getToolActivityTone(status: ActivityStatus): 'running' | 'success' | 'danger' | 'waiting' | 'neutral' {
  if (status === 'running') return 'running'
  if (status === 'backgrounded') return 'waiting'
  if (status === 'error') return 'danger'
  if (status === 'completed') return 'success'
  return 'neutral'
}

export interface AgentRunnerModeControlState {
  label: string
  description: string
  nextMode: AgentRuntimeRunnerMode
  disabled: boolean
}

export function buildAgentRunnerModeControl(
  mode: AgentRuntimeRunnerMode,
  streaming: boolean,
): AgentRunnerModeControlState {
  if (mode === 'legacy') {
    return {
      label: 'Legacy',
      description: '旧主循环',
      nextMode: 'runner-v2',
      disabled: streaming,
    }
  }

  return {
    label: 'Runner v2',
    description: '重构链路',
    nextMode: 'legacy',
    disabled: streaming,
  }
}

export interface AgentComposerStateInput {
  hasChannel: boolean
  hasAvailableModel: boolean
  interactionLocked: boolean
  streaming: boolean
  hasTextInput: boolean
  queueUnsupported?: boolean
}

export interface AgentInteractionLockInput {
  pendingPermissionCount: number
  pendingAskUserCount: number
  pendingExitPlanCount: number
}

export type ActiveAgentBanner = 'permission' | 'ask-user' | 'exit-plan' | null

export interface AgentComposerState {
  disabled: boolean
  canSend: boolean
  notice: string | null
}

export function hasPendingAgentInteraction(input: AgentInteractionLockInput): boolean {
  return input.pendingPermissionCount > 0 || input.pendingAskUserCount > 0 || input.pendingExitPlanCount > 0
}

export function getActiveAgentBanner(input: AgentInteractionLockInput): ActiveAgentBanner {
  if (input.pendingPermissionCount > 0) return 'permission'
  if (input.pendingAskUserCount > 0) return 'ask-user'
  if (input.pendingExitPlanCount > 0) return 'exit-plan'
  return null
}

export function buildAgentComposerState(input: AgentComposerStateInput): AgentComposerState {
  if (!input.hasChannel) {
    return {
      disabled: true,
      canSend: false,
      notice: '请在设置中选择 Agent 供应商',
    }
  }

  if (!input.hasAvailableModel) {
    return {
      disabled: true,
      canSend: false,
      notice: '暂无可用模型，请在设置中启用 Agent 渠道并配置模型',
    }
  }

  if (input.interactionLocked) {
    return {
      disabled: true,
      canSend: false,
      notice: '请先处理上方交互请求',
    }
  }

  if (input.streaming && input.hasTextInput && input.queueUnsupported) {
    return {
      disabled: true,
      canSend: false,
      notice: 'Codex Runtime 暂不支持运行中追加消息，请先停止或等待完成',
    }
  }

  return {
    disabled: false,
    canSend: !input.streaming || input.hasTextInput,
    notice: null,
  }
}

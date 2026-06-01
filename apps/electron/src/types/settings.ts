/**
 * 应用设置类型
 *
 * 主题模式、IPC 通道等设置相关定义。
 */

import type { EnvironmentCheckResult, CodeInsightsPermissionMode, ThinkingConfig, AgentEffort, AgentRuntimeRunnerMode, CodingAgentRuntimeKind } from '@codeinsights/shared'

/** 通知音场景类型 */
export type NotificationSoundType = 'taskComplete' | 'permissionRequest' | 'exitPlanMode'

/** 可选通知音 ID */
export type NotificationSoundId = 'ding' | 'ding-dong' | 'discord' | 'done' | 'down-power' | 'food' | 'lite' | 'quiet' | 'none'

/** 各场景通知音配置 */
export interface NotificationSoundSettings {
  /** 任务完成 */
  taskComplete?: NotificationSoundId
  /** 权限审批（含 AskUser） */
  permissionRequest?: NotificationSoundId
  /** 计划审批 */
  exitPlanMode?: NotificationSoundId
}

/** 用户自定义快捷键覆盖（持久化到 settings.json） */
export interface ShortcutOverrides {
  [shortcutId: string]: {
    mac?: string
    win?: string
  }
}

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'system' | 'special'

/** 特殊风格主题 */
export type ThemeStyle = 'default' | 'ocean-light' | 'ocean-dark' | 'forest-light' | 'forest-dark' | 'slate-light' | 'slate-dark'

/** 默认主题模式 */
export const DEFAULT_THEME_MODE: ThemeMode = 'dark'

/** 默认特殊风格 */
export const DEFAULT_THEME_STYLE: ThemeStyle = 'default'

/** 默认 Agent Runtime */
export const DEFAULT_AGENT_RUNTIME_KIND: CodingAgentRuntimeKind = 'claude-code'

/** Codex 推理深度 */
export type AgentCodexReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

/** Codex Web Search 模式 */
export type AgentCodexWebSearchMode = 'disabled' | 'cached' | 'live'

/** opencode 认证来源 */
export type AgentOpencodeAuthSource = 'native' | 'channel'

/** 应用设置 */
export interface AppSettings {
  /** 主题模式 */
  themeMode: ThemeMode
  /** 特殊风格主题 */
  themeStyle?: ThemeStyle
  /** Agent 默认渠道 ID（仅限 Anthropic 渠道） — 当前选中的渠道 */
  agentChannelId?: string
  /** Agent 默认模型 ID */
  agentModelId?: string
  /** Agent 启用的渠道 ID 列表（多选，Switch 开关） */
  agentChannelIds?: string[]
  /** Agent 当前工作区 ID */
  agentWorkspaceId?: string
  /** 是否已完成 Onboarding 流程 */
  onboardingCompleted?: boolean
  /** 是否跳过了环境检测 */
  environmentCheckSkipped?: boolean
  /** 最后一次环境检测结果（缓存） */
  lastEnvironmentCheck?: EnvironmentCheckResult
  /** 是否启用桌面通知 */
  notificationsEnabled?: boolean
  /** 是否启用通知提示音（阻塞 Hook 触发时播放） */
  notificationSoundEnabled?: boolean
  /** 各场景通知音选择 */
  notificationSounds?: NotificationSoundSettings
  /** 标签页持久化状态（重启恢复） */
  tabState?: PersistedTabSettings
  /** Agent 权限模式（全局默认，工作区级覆盖此值） */
  agentPermissionMode?: CodeInsightsPermissionMode
  /** Agent 思考模式 */
  agentThinking?: ThinkingConfig
  /** Agent 推理深度 */
  agentEffort?: AgentEffort
  /** Agent 最大预算（美元/次） */
  agentMaxBudgetUsd?: number
  /** Agent 最大轮次（0 或 undefined = SDK 默认） */
  agentMaxTurns?: number
  /** Agent Runtime Runner 执行链路 */
  agentRuntimeRunnerMode?: AgentRuntimeRunnerMode
  /** Agent Coding Runtime 类型 */
  agentRuntimeKind?: CodingAgentRuntimeKind
  /** Agent Codex 渠道 ID；null 表示显式使用本机 Codex auth / CODEX_API_KEY */
  agentCodexChannelId?: string | null
  /** Agent Codex 默认模型 ID */
  agentCodexModelId?: string
  /** Agent Codex 推理深度 */
  agentCodexReasoningEffort?: AgentCodexReasoningEffort
  /** Agent Codex 是否允许网络访问 */
  agentCodexNetworkAccessEnabled?: boolean
  /** Agent Codex Web Search 模式 */
  agentCodexWebSearchMode?: AgentCodexWebSearchMode
  /** Agent opencode 渠道 ID；null 表示显式使用本机 opencode auth */
  agentOpencodeChannelId?: string | null
  /** Agent opencode 默认模型 ID，格式由 opencode runtime 解释 */
  agentOpencodeModelId?: string
  /** Agent opencode agent 名称 */
  agentOpencodeAgentName?: string
  /** Agent opencode 是否显式使用本机认证；true 时不读取 channel secret */
  agentOpencodeUseNativeAuth?: boolean
  /** Agent opencode 是否允许 runtime 自身更新 */
  agentOpencodeAutoupdate?: boolean
  /** Agent opencode 是否启用 workspace snapshot */
  agentOpencodeSnapshotEnabled?: boolean
  /** Pipeline Codex 节点使用的 OpenAI / Custom 渠道 ID；null 表示显式使用本机 Codex auth / CODEX_API_KEY */
  pipelineCodexChannelId?: string | null
  /** 教程推荐横幅是否已关闭 */
  tutorialBannerDismissed?: boolean
  /** 自动归档天数（0 = 禁用，默认 7） */
  archiveAfterDays?: number
  /** 发送消息快捷键模式：true = Cmd/Ctrl+Enter 发送，false(默认) = Enter 发送 */
  sendWithCmdEnter?: boolean
  /** 用户自定义快捷键覆盖 */
  shortcutOverrides?: ShortcutOverrides
  /** 是否显示用户消息悬浮置顶条（默认 true） */
  stickyUserMessageEnabled?: boolean
  /** 应用图标变体 ID（dock + window icon），'default' 或 logo 变体 id */
  appIconVariant?: string
}

/** 持久化的标签页状态 */
export interface PersistedTabSettings {
  tabs: Array<{
    id: string
    type: 'pipeline' | 'chat' | 'agent' | 'scan'
    sessionId: string
    title: string
  }>
  activeTabId: string | null
}

/** 设置 IPC 通道 */
export const SETTINGS_IPC_CHANNELS = {
  GET: 'settings:get',
  UPDATE: 'settings:update',
  UPDATE_SYNC: 'settings:update-sync',
  GET_SYSTEM_THEME: 'settings:get-system-theme',
  ON_SYSTEM_THEME_CHANGED: 'settings:system-theme-changed',
  /** 用户手动切换主题时广播给所有窗口 */
  ON_THEME_SETTINGS_CHANGED: 'settings:theme-settings-changed',
} as const

/** 应用图标 IPC 通道 */
export const APP_ICON_IPC_CHANNELS = {
  /** 设置应用图标（variant ID） */
  SET: 'app-icon:set',
} as const

/** 快速任务窗口 IPC 通道 */
export const QUICK_TASK_IPC_CHANNELS = {
  /** 提交快速任务（渲染进程 → 主进程） */
  SUBMIT: 'quick-task:submit',
  /** 隐藏快速任务窗口 */
  HIDE: 'quick-task:hide',
  /** 通知渲染进程聚焦输入框 */
  FOCUS: 'quick-task:focus',
  /** 重新注册全局快捷键（设置变更后） */
  REREGISTER_GLOBAL_SHORTCUTS: 'quick-task:reregister-global-shortcuts',
} as const

/** 快速任务提交输入 */
export interface QuickTaskSubmitInput {
  /** 任务文本内容 */
  text: string
  /** 目标模式 */
  mode: 'chat' | 'agent'
  /** 附件列表（base64 编码） */
  files?: QuickTaskFile[]
}

/** 快速任务附件 */
export interface QuickTaskFile {
  filename: string
  mediaType: string
  base64: string
  size: number
}

/** 主窗口接收的快速任务打开会话数据 */
export interface QuickTaskOpenSessionData {
  mode: 'chat' | 'agent'
  text: string
  files?: QuickTaskFile[]
}

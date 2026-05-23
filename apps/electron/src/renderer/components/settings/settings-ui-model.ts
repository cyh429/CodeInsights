export interface SettingsNavStatusInput {
  tabId: string
  hasUpdate: boolean
  hasEnvironmentIssues: boolean
}

export type SettingsNavStatus =
  | { kind: 'none' }
  | { kind: 'issue'; label: string }
  | { kind: 'update'; label: string }

export function resolveSettingsNavStatus(input: SettingsNavStatusInput): SettingsNavStatus {
  if (input.tabId !== 'about') return { kind: 'none' }
  if (input.hasEnvironmentIssues) return { kind: 'issue', label: '环境存在问题' }
  if (input.hasUpdate) return { kind: 'update', label: '有可用更新' }
  return { kind: 'none' }
}

export interface SettingsDeleteDialogCopy {
  title: string
  description: string
}

export function getSettingsDeleteDialogCopy(target: {
  kind: 'mcp' | 'skill'
  name: string
}): SettingsDeleteDialogCopy {
  if (target.kind === 'mcp') {
    return {
      title: '删除 MCP 服务器？',
      description: `将从当前工作区移除 MCP 服务器「${target.name}」。不会删除其他工作区配置，但新的 Agent 会话将不再加载它。`,
    }
  }

  return {
    title: '删除 Skill？',
    description: `将从当前工作区删除 Skill「${target.name}」。如果它是从其他工作区导入的，源工作区不受影响。`,
  }
}

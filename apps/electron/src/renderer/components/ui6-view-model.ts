import type { AppMode } from '@/atoms/app-mode'

export interface WelcomeAction {
  id: 'pipeline' | 'agent' | 'settings'
  label: string
  description: string
  mode?: AppMode
}

export type ChatToolTone = 'running' | 'success' | 'danger'

export function getWelcomeActions(): WelcomeAction[] {
  return [
    {
      id: 'pipeline',
      label: '进入 Pipeline',
      description: '从贡献任务开始，让 Agent 分阶段探索、计划和审核。',
      mode: 'pipeline',
    },
    {
      id: 'agent',
      label: '进入 Agent',
      description: '直接进入工作区，让 Agent 读取文件并执行本地任务。',
      mode: 'agent',
    },
    {
      id: 'settings',
      label: '打开设置',
      description: '配置模型渠道、工作区和运行环境。',
    },
  ]
}

export function getChatToolTone(isCompleted: boolean, isError: boolean): ChatToolTone {
  if (!isCompleted) return 'running'
  return isError ? 'danger' : 'success'
}

export function getPathDisplay(path: string, maxSegments = 3): string {
  if (!path) return ''
  const normalized = path.replace(/[/\\]+$/, '')
  const parts = normalized.split(/[/\\]/).filter(Boolean)
  if (parts.length <= maxSegments) return normalized
  return `.../${parts.slice(-maxSegments).join('/')}`
}

export function getParentPath(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index > 0 ? path.slice(0, index) : ''
}

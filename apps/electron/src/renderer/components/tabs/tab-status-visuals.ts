import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'
import type { TabItem } from '@/atoms/tab-atoms'

export interface TabStatusVisuals {
  lineClassName?: string
  dotClassName?: string
  label?: string
  tooltip?: string
  pulsing: boolean
}

export function getTabStatusVisuals(
  status: SessionIndicatorStatus,
  type: TabItem['type'],
): TabStatusVisuals {
  switch (status) {
    case 'running':
      return {
        lineClassName: type === 'chat' ? 'bg-status-success' : 'bg-status-running',
        dotClassName: type === 'chat' ? 'bg-status-success' : 'bg-status-running',
        label: '运行中',
        tooltip: '后台会话正在运行',
        pulsing: true,
      }
    case 'blocked':
      return {
        lineClassName: 'bg-status-waiting',
        dotClassName: 'bg-status-waiting',
        label: '待处理',
        tooltip: '后台会话等待你处理权限或审核',
        pulsing: true,
      }
    case 'failed':
      return {
        lineClassName: 'bg-status-danger',
        dotClassName: 'bg-status-danger',
        label: '失败',
        tooltip: '后台会话发生错误，切换到该标签查看详情',
        pulsing: false,
      }
    case 'completed':
      return {
        lineClassName: 'bg-status-success',
        dotClassName: 'bg-status-success',
        label: '已完成',
        tooltip: '后台会话已完成，切换后会清除提示',
        pulsing: false,
      }
    case 'idle':
    default:
      return { pulsing: false }
  }
}

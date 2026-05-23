import type { TabItem } from '@/atoms/tab-atoms'

export interface TabCloseConfirmCopy {
  title: string
  description: string
  confirmLabel: string
}

export function buildTabCloseConfirmCopy(tab: TabItem | undefined): TabCloseConfirmCopy {
  if (tab?.type === 'pipeline') {
    const subject = tab.title ? `「${tab.title}」` : '该 Pipeline'
    return {
      title: 'Pipeline 还在运行',
      description: `${subject}还在运行，关闭标签页将立即中止当前 Pipeline。已完成的记录会保留，当前节点会停止。`,
      confirmLabel: '关闭并中止 Pipeline',
    }
  }

  const subject = tab?.title ? `「${tab.title}」` : '该 Agent'
  return {
    title: 'Agent 还在执行任务',
    description: `${subject}还在运行，关闭标签页将立即中止当前任务，未保存的进度可能会丢失。`,
    confirmLabel: '关闭并中止',
  }
}

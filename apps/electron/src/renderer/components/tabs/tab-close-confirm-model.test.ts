import { describe, expect, test } from 'bun:test'
import type { TabItem } from '@/atoms/tab-atoms'
import { buildTabCloseConfirmCopy } from './tab-close-confirm-model'

function makeTab(type: TabItem['type'], patch: Partial<TabItem> = {}): TabItem {
  return {
    id: `${type}-1`,
    type,
    sessionId: `${type}-1`,
    title: type === 'pipeline' ? '修复 Pipeline' : 'Agent 任务',
    ...patch,
  }
}

describe('buildTabCloseConfirmCopy', () => {
  test('Pipeline 关闭确认使用独立文案', () => {
    expect(buildTabCloseConfirmCopy(makeTab('pipeline'))).toEqual({
      title: 'Pipeline 还在运行',
      description: '「修复 Pipeline」还在运行，关闭标签页将立即中止当前 Pipeline。已完成的记录会保留，当前节点会停止。',
      confirmLabel: '关闭并中止 Pipeline',
    })
  })

  test('Agent 关闭确认保留 Agent 语义', () => {
    expect(buildTabCloseConfirmCopy(makeTab('agent'))).toEqual({
      title: 'Agent 还在执行任务',
      description: '「Agent 任务」还在运行，关闭标签页将立即中止当前任务，未保存的进度可能会丢失。',
      confirmLabel: '关闭并中止',
    })
  })
})

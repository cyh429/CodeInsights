import { describe, expect, test } from 'bun:test'
import { closeTab, openTab, type TabItem } from './tab-atoms'

describe('tab-atoms pipeline support', () => {
  test('openTab 支持创建 pipeline 标签并复用已存在标签', () => {
    const initial: TabItem[] = []
    const first = openTab(initial, {
      type: 'pipeline',
      sessionId: 'pipeline-1',
      title: 'Pipeline 1',
    })

    expect(first.tabs).toHaveLength(1)
    expect(first.activeTabId).toBe('pipeline-1')

    const second = openTab(first.tabs, {
      type: 'pipeline',
      sessionId: 'pipeline-1',
      title: 'Pipeline 1',
    })

    expect(second.tabs).toHaveLength(1)
    expect(second.activeTabId).toBe('pipeline-1')
  })

  test('closeTab 关闭 pipeline 标签后会选择相邻标签', () => {
    const tabs: TabItem[] = [
      { id: 'pipeline-1', type: 'pipeline', sessionId: 'pipeline-1', title: 'Pipeline 1' },
      { id: 'agent-1', type: 'agent', sessionId: 'agent-1', title: 'Agent 1' },
    ]

    const result = closeTab(tabs, 'pipeline-1', 'pipeline-1')
    expect(result.tabs).toHaveLength(1)
    expect(result.activeTabId).toBe('agent-1')
  })
})

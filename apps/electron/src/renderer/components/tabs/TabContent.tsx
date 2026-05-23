/**
 * TabContent — 标签内容渲染器
 *
 * 根据标签类型渲染参数化的 ChatView 或 AgentView。
 * 直接传递 sessionId/conversationId prop，无需桥接全局 atoms。
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { tabsAtom } from '@/atoms/tab-atoms'
import { ChatView } from '@/components/chat'
import { AgentView } from '@/components/agent'
import { PipelineView } from '@/components/pipeline'
import { TabErrorBoundary } from './TabErrorBoundary'

export interface TabContentProps {
  tabId: string
}

export function TabContent({ tabId }: TabContentProps): React.ReactElement {
  const tabs = useAtomValue(tabsAtom)
  const tab = tabs.find((t) => t.id === tabId)

  // [FLASH-DEBUG] 监控 tab 查找失败（说明 tabId 指向了不存在的标签）
  React.useEffect(() => {
    if (!tab) {
      console.warn(`[FLASH-DEBUG] TabContent: tab not found for tabId="${tabId}"`, { tabIds: tabs.map(t => t.id) })
    }
  }, [tab, tabId, tabs])

  if (!tab) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-text-tertiary">
        <div className="rounded-panel border border-border-subtle/60 bg-surface-card/80 px-4 py-3 shadow-card">
          标签页不存在
        </div>
      </div>
    )
  }

  if (tab.type === 'pipeline') {
    return (
      <TabErrorBoundary key={tab.sessionId} sessionId={tab.sessionId}>
        <PipelineView sessionId={tab.sessionId} />
      </TabErrorBoundary>
    )
  }

  if (tab.type === 'chat') {
    return (
      <TabErrorBoundary key={tab.sessionId} sessionId={tab.sessionId}>
        <ChatView conversationId={tab.sessionId} />
      </TabErrorBoundary>
    )
  }

  return (
    <TabErrorBoundary key={tab.sessionId} sessionId={tab.sessionId}>
      <AgentView sessionId={tab.sessionId} />
    </TabErrorBoundary>
  )
}

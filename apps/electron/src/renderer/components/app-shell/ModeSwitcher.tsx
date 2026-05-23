/**
 * ModeSwitcher - Chat/Agent 模式切换（带滑动指示器）
 *
 * 切换模式时自动恢复上一次在该模式下查看的对话/会话：
 * 1. 优先恢复上次选中的对话 ID
 * 2. 其次查找已打开的同类型 Tab
 * 3. 兜底打开最近的对话/会话（列表首项）
 * 4. 都没有则仅切换模式
 */

import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { appModeAtom, type AppMode } from '@/atoms/app-mode'
import { conversationsAtom, currentConversationIdAtom } from '@/atoms/chat-atoms'
import { pipelineSessionsAtom, currentPipelineSessionIdAtom } from '@/atoms/pipeline-atoms'
import { agentSessionsAtom, currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { tabsAtom } from '@/atoms/tab-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import { Bot, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'

const modes: { value: AppMode; label: string; icon: React.ReactNode }[] = [
  { value: 'agent', label: 'Agent', icon: <Bot size={15} /> },
  { value: 'pipeline', label: 'Pipeline', icon: <GitBranch size={15} /> },
]

export function ModeSwitcher(): React.ReactElement {
  const [mode, setMode] = useAtom(appModeAtom)
  const openSession = useOpenSession()
  const pipelineSessions = useAtomValue(pipelineSessionsAtom)
  const conversations = useAtomValue(conversationsAtom)
  const agentSessions = useAtomValue(agentSessionsAtom)
  const currentPipelineSessionId = useAtomValue(currentPipelineSessionIdAtom)
  const currentConversationId = useAtomValue(currentConversationIdAtom)
  const currentAgentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const tabs = useAtomValue(tabsAtom)

  /** 尝试恢复目标模式下的上一个对话/会话，按优先级 fallback */
  const restoreSession = React.useCallback((targetMode: AppMode) => {
    const sessions = targetMode === 'pipeline'
      ? pipelineSessions
      : targetMode === 'chat'
        ? conversations
        : agentSessions
    const lastId = targetMode === 'pipeline'
      ? currentPipelineSessionId
      : targetMode === 'chat'
        ? currentConversationId
        : currentAgentSessionId

    // 1. 上次选中的对话仍存在 → 恢复
    if (lastId) {
      const match = sessions.find((s) => s.id === lastId)
      if (match) {
        openSession(targetMode, match.id, match.title)
        return
      }
    }
    // 2. 已打开的同类型 Tab → 聚焦
    const tab = tabs.find((t) => t.type === targetMode)
    if (tab) {
      openSession(targetMode, tab.sessionId, tab.title)
      return
    }
    // 3. 最近的未归档对话/会话 → 打开
    const recent = sessions.find((s) => !s.archived)
    if (recent) {
      openSession(targetMode, recent.id, recent.title)
      return
    }
    // 4. 无任何对话，仅切换模式
    setMode(targetMode)
  }, [openSession, conversations, agentSessions, currentConversationId, currentAgentSessionId, tabs, setMode])

  const handleModeSwitch = React.useCallback((targetMode: AppMode) => {
    if (targetMode === mode) return
    restoreSession(targetMode)
  }, [mode, restoreSession])

  return (
    <div className="pt-1">
      <div className="mode-switcher-glass relative flex min-w-0 overflow-hidden rounded-[18px] border border-white/10 bg-gradient-to-br from-white/12 via-white/6 to-white/[0.03] p-1 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        {/* 滑动背景指示器 */}
        <div
          className={cn(
            'mode-slider absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-[14px] shadow-[0_10px_22px_-16px_rgba(15,23,42,0.75)] transition-transform duration-normal ease-out',
            mode === 'agent' ? 'translate-x-0' : 'translate-x-full'
          )}
        />
        {modes.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => handleModeSwitch(value)}
            className={cn(
              'mode-btn relative z-[1] flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[14px] px-2.5 py-1.5 text-[12px] font-medium transition-[color,transform] duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              mode === value
                ? 'mode-btn-selected text-primary-foreground'
                : 'text-text-secondary hover:text-text-primary'
            )}
            aria-pressed={mode === value}
          >
            <span
              className={cn(
                'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] transition-colors',
                mode === value && 'border-white/18 bg-white/14 text-primary-foreground'
              )}
            >
              {icon}
            </span>
            <span className="min-w-0 truncate tracking-[0.01em]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

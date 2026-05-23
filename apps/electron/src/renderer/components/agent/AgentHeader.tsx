/**
 * AgentHeader — Agent 会话头部
 *
 * 显示会话标题（可点击编辑）。
 * 参照 ChatHeader 的编辑模式。
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Pencil, Check, X, PanelRight, Bot, Cpu, Folder, Radio, ShieldCheck, Waypoints, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  agentSessionsAtom,
  agentSidePanelOpenMapAtom,
  agentWorkspacesAtom,
  workspaceFilesVersionAtom,
} from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/chat-atoms'
import { cn } from '@/lib/utils'
import { resolveModelDisplayName } from '@/lib/model-logo'
import { buildAgentHeaderMeta } from './agent-ui-model'

/** AgentHeader 属性接口 */
interface AgentHeaderProps {
  sessionId: string
  channelId?: string | null
  modelId?: string | null
  permissionMode?: string | null
  streaming?: boolean
  planMode?: boolean
}

export function AgentHeader({
  sessionId,
  channelId,
  modelId,
  permissionMode,
  streaming = false,
  planMode = false,
}: AgentHeaderProps): React.ReactElement | null {
  const sessions = useAtomValue(agentSessionsAtom)
  const session = sessions.find((s) => s.id === sessionId) ?? null
  const setAgentSessions = useSetAtom(agentSessionsAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const channels = useAtomValue(channelsAtom)
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 文件面板切换状态
  const sidePanelOpenMap = useAtomValue(agentSidePanelOpenMapAtom)
  const setSidePanelOpenMap = useSetAtom(agentSidePanelOpenMapAtom)
  const filesVersion = useAtomValue(workspaceFilesVersionAtom)
  const isPanelOpen = sidePanelOpenMap.get(sessionId) ?? true
  const hasFileChanges = filesVersion > 0
  const workspaceName = React.useMemo(() => {
    if (!session?.workspaceId) return null
    const workspace = workspaces.find((w) => w.id === session.workspaceId)
    return workspace?.name || workspace?.slug || session.workspaceId
  }, [session?.workspaceId, workspaces])
  const modelName = React.useMemo(() => {
    if (modelId) return resolveModelDisplayName(modelId, channels)
    if (channelId) return channels.find((c) => c.id === channelId)?.name ?? null
    return null
  }, [channelId, channels, modelId])
  const metaItems = React.useMemo(() => buildAgentHeaderMeta({
    workspaceName,
    modelName,
    permissionMode,
    streaming,
    planMode,
  }), [modelName, permissionMode, planMode, streaming, workspaceName])
  const missionState = streaming ? '同步中' : planMode ? '规划中' : '待命'
  const missionStateTone = streaming ? 'running' : planMode ? 'waiting' : 'neutral'

  const togglePanel = React.useCallback(() => {
    setSidePanelOpenMap((prev) => {
      const map = new Map(prev)
      map.set(sessionId, !(map.get(sessionId) ?? true))
      return map
    })
  }, [sessionId, setSidePanelOpenMap])

  if (!session) return null

  /** 进入编辑模式 */
  const startEdit = (): void => {
    setEditTitle(session.title)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  /** 保存标题 */
  const saveTitle = async (): Promise<void> => {
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === session.title) {
      setEditing(false)
      return
    }

    try {
      await window.electronAPI.updateAgentSessionTitle(session.id, trimmed)
      // 刷新会话列表以同步侧边栏
      const sessions = await window.electronAPI.listAgentSessions()
      setAgentSessions(sessions)
    } catch (error) {
      console.error('[AgentHeader] 更新标题失败:', error)
    }
    setEditing(false)
  }

  /** 键盘事件 */
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  return (
    <div className="agent-mission-strip agent-mission-strip--command agent-mission-strip--compact relative z-[51] mx-3 mt-3 flex min-h-[76px] items-center gap-3 overflow-hidden rounded-panel border border-border-subtle/65 bg-surface-card/85 px-3 py-2.5 shadow-card backdrop-blur titlebar-drag-region md:mx-5 md:min-h-[82px] md:px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--status-running)/0.10),transparent_32%),radial-gradient(circle_at_bottom_right,hsl(var(--status-waiting)/0.06),transparent_28%)]" aria-hidden="true" />
      <div className="agent-mission-scanline" aria-hidden="true" />
      <div className="agent-mission-corner agent-mission-corner--tl" aria-hidden="true" />
      <div className="agent-mission-corner agent-mission-corner--br" aria-hidden="true" />
      {editing ? (
        <div className="relative z-10 flex flex-1 min-w-0 items-center gap-1.5 titlebar-no-drag">
          <label htmlFor={`agent-title-${session.id}`} className="sr-only">编辑 Agent 会话标题</label>
          <input
            id={`agent-title-${session.id}`}
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveTitle}
            className="flex-1 min-w-0 border-b border-primary/50 bg-transparent px-0 py-0.5 text-sm font-medium outline-none focus-visible:ring-0"
            maxLength={100}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={saveTitle}
                className="inline-flex size-7 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="保存标题"
              >
                <Check className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">保存标题</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEditing(false)}
                className="inline-flex size-7 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="取消编辑标题"
              >
                <X className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">取消编辑</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <>
          <div className="relative z-10 hidden size-11 shrink-0 items-center justify-center rounded-control border border-border-subtle/70 bg-background/55 shadow-inner agent-status-orb sm:flex" data-state={missionStateTone === 'neutral' ? 'idle' : 'active'}>
            <div className="agent-status-orb__ring" aria-hidden="true" />
            <div className="absolute inset-1.5 rounded-full border border-current/20 opacity-70" aria-hidden="true" />
            {streaming ? (
              <Radio className="size-4 text-status-running-fg" />
            ) : planMode ? (
              <Waypoints className="size-4 text-status-waiting-fg" />
            ) : (
              <Bot className="size-4 text-text-secondary" />
            )}
          </div>
          <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="agent-kicker text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Agent Mission</div>
                <h1 className="truncate text-[16px] font-semibold leading-5 text-text-primary md:text-[17px]">
                  {session.title}
                </h1>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={startEdit}
                    className="titlebar-no-drag inline-flex size-7 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    aria-label="编辑标题"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </TooltipTrigger>
              <TooltipContent side="bottom">编辑标题</TooltipContent>
            </Tooltip>
            </div>
            <div className="agent-mission-metrics flex min-w-0 items-center gap-1.5 overflow-hidden">
              <span
                className={cn(
                  'agent-meta-chip agent-meta-chip--state inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] leading-4',
                  missionStateTone === 'running' && 'border-status-running-border text-status-running-fg',
                  missionStateTone === 'waiting' && 'border-status-waiting-border text-status-waiting-fg',
                  missionStateTone === 'neutral' && 'border-border-subtle text-text-secondary',
                )}
              >
                <Radio className={cn('size-3.5', streaming && 'animate-pulse')} />
                <span className="font-medium">{missionState}</span>
              </span>
              {metaItems.map((item) => (
                <span
                  key={item.key}
                  className={cn(
                    'agent-meta-chip inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] leading-4 whitespace-nowrap',
                    item.key === 'workspace' && 'max-w-[150px] 2xl:max-w-[190px]',
                    item.key === 'model' && 'max-w-[180px] 2xl:max-w-[220px]',
                    item.key === 'permission' && 'max-w-[112px] 2xl:max-w-[150px]',
                    item.tone === 'running' && 'border-status-running-border bg-status-running-bg text-status-running-fg',
                    item.tone === 'waiting' && 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg',
                    item.tone === 'neutral' && 'border-border-subtle text-text-secondary',
                  )}
                  title={`${item.label}: ${item.value}`}
                >
                  {item.key === 'workspace' && <Folder className="size-3.5 shrink-0" />}
                  {item.key === 'model' && <Cpu className="size-3.5 shrink-0" />}
                  {item.key === 'permission' && <ShieldCheck className="size-3.5 shrink-0" />}
                  <span className="hidden shrink-0 text-current/65 2xl:inline">{item.label}</span>
                  <span className="min-w-0 truncate font-medium">{item.value}</span>
                </span>
              ))}
              <span className="agent-header-hud inline-flex shrink-0 items-center gap-1 rounded-full border border-border-subtle/60 bg-background/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                <span className={cn('size-1.5 rounded-full', streaming ? 'bg-status-running shadow-[0_0_14px_hsl(var(--status-running)/0.6)]' : 'bg-status-neutral')} />
                {streaming ? 'Live Lane' : planMode ? 'Planning Lane' : 'Idle Lane'}
              </span>
              <span className="agent-hud-signal hidden shrink-0 items-center gap-1 rounded-full border border-border-subtle/60 bg-background/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-text-tertiary xl:inline-flex">
                <Activity className="size-3" />
                Telemetry
              </span>
            </div>
          </div>
          {/* 文件面板打开按钮（仅面板关闭时显示） */}
          {!isPanelOpen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="relative titlebar-no-drag h-9 w-9 flex-shrink-0 rounded-control border border-border-subtle bg-background/35"
                  onClick={togglePanel}
                  aria-label="打开文件面板"
                >
                  <PanelRight className="size-3.5" />
                  {hasFileChanges && (
                    <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary animate-pulse" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>打开文件面板</p>
              </TooltipContent>
            </Tooltip>
          )}
        </>
      )}
    </div>
  )
}

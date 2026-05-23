import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  Archive,
  ArchiveRestore,
  AlertCircle,
  ArrowLeft,
  Clock3,
  Command,
  FolderKanban,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Radar,
  Settings,
  Zap,
  Plug,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { appModeAtom } from '@/atoms/app-mode'
import { activeViewAtom } from '@/atoms/active-view'
import { searchDialogOpenAtom } from '@/atoms/search-atoms'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import {
  agentChannelIdAtom,
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
  workspaceCapabilitiesVersionAtom,
} from '@/atoms/agent-atoms'
import {
  currentPipelineSessionIdAtom,
  pipelineSidebarViewModeAtom,
  pipelineSessionIndicatorMapAtom,
  pipelineSessionsAtom,
} from '@/atoms/pipeline-atoms'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import { activeTabIdAtom, closeTab, sidebarCollapsedAtom, tabsAtom, updateTabTitle } from '@/atoms/tab-atoms'
import { userProfileAtom } from '@/atoms/user-profile'
import { hasUpdateAtom } from '@/atoms/updater'
import { hasEnvironmentIssuesAtom } from '@/atoms/environment'
import { useOpenSession } from '@/hooks/useOpenSession'
import { useSyncActiveTabSideEffects } from '@/hooks/useSyncActiveTabSideEffects'
import { ModeSwitcher } from '@/components/app-shell/ModeSwitcher'
import { SearchDialog } from '@/components/app-shell/SearchDialog'
import { UserAvatar } from '@/components/chat/UserAvatar'
import { WorkspaceSelector } from '@/components/agent/WorkspaceSelector'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import type { PipelineSessionMeta, WorkspaceCapabilities } from '@codeinsights/shared'
import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'
import {
  buildPipelineSidebarSections,
  buildPipelineSidebarSessionSummary,
  type PipelineSidebarSessionTone,
} from './pipeline-session-sidebar-model'

type SessionLeftAccent = 'running' | 'waiting' | 'success' | 'danger'

const SESSION_LEFT_ACCENT_CLASS: Record<SessionLeftAccent, string> = {
  running: 'bg-status-running',
  waiting: 'bg-status-waiting',
  success: 'bg-status-success',
  danger: 'bg-status-danger',
}

const SESSION_DOT_CLASS: Record<SessionLeftAccent, string> = {
  running: 'bg-status-running shadow-[0_0_12px_hsl(var(--status-running)/0.75)] pipeline-status-pulse',
  waiting: 'bg-status-waiting shadow-[0_0_12px_hsl(var(--status-waiting)/0.65)]',
  success: 'bg-status-success shadow-[0_0_12px_hsl(var(--status-success)/0.65)]',
  danger: 'bg-status-danger shadow-[0_0_12px_hsl(var(--status-danger)/0.65)]',
}

const SUMMARY_SIGNAL_CLASS: Record<PipelineSidebarSessionTone, string> = {
  neutral: 'bg-status-neutral-bg text-status-neutral-fg',
  running: 'bg-status-running-bg text-status-running-fg',
  waiting: 'bg-status-waiting-bg text-status-waiting-fg',
  failed: 'bg-status-danger-bg text-status-danger-fg',
  success: 'bg-status-success-bg text-status-success-fg',
}

const SUMMARY_SIGNAL_BORDER_CLASS: Record<PipelineSidebarSessionTone, string> = {
  neutral: 'border-status-neutral-border',
  running: 'border-status-running-border',
  waiting: 'border-status-waiting-border',
  failed: 'border-status-danger-border',
  success: 'border-status-success-border',
}

const SESSION_CARD_TONE_CLASS: Record<PipelineSidebarSessionTone, string> = {
  neutral: 'border-border-subtle/45 bg-surface-card/45 hover:border-border-subtle hover:bg-surface-card/70',
  running: 'border-status-running-border bg-status-running-bg shadow-[0_0_22px_hsl(var(--status-running)/0.10)] hover:shadow-[0_0_28px_hsl(var(--status-running)/0.16)]',
  waiting: 'border-status-waiting-border bg-status-waiting-bg shadow-[0_0_20px_hsl(var(--status-waiting)/0.09)]',
  failed: 'border-status-danger-border bg-status-danger-bg shadow-[0_0_20px_hsl(var(--status-danger)/0.09)]',
  success: 'border-status-success-border bg-status-success-bg shadow-[0_0_18px_hsl(var(--status-success)/0.08)]',
}

const SESSION_ORB_CLASS: Record<PipelineSidebarSessionTone, string> = {
  neutral: 'border-border-subtle bg-surface-muted text-text-tertiary',
  running: 'border-status-running-border bg-status-running-bg text-status-running-fg shadow-[0_0_18px_hsl(var(--status-running)/0.22)]',
  waiting: 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg shadow-[0_0_16px_hsl(var(--status-waiting)/0.18)]',
  failed: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg shadow-[0_0_16px_hsl(var(--status-danger)/0.18)]',
  success: 'border-status-success-border bg-status-success-bg text-status-success-fg shadow-[0_0_16px_hsl(var(--status-success)/0.16)]',
}

const CONTRIBUTION_PIPELINE_VERSION = 2

export interface PipelineSidebarProps {
  width?: number
}

function indicatorToAccent(indicator: SessionIndicatorStatus): SessionLeftAccent | undefined {
  switch (indicator) {
    case 'running':
      return 'running'
    case 'blocked':
      return 'waiting'
    case 'failed':
      return 'danger'
    case 'completed':
      return 'success'
    default:
      return undefined
  }
}

interface PipelineSessionItemProps {
  session: PipelineSessionMeta
  active: boolean
  hovered: boolean
  indicatorStatus: SessionIndicatorStatus
  showPinIcon?: boolean
  onSelect: () => void
  onRename: (id: string, title: string) => Promise<void>
  onTogglePin: (id: string) => Promise<void>
  onToggleArchive: (id: string) => Promise<void>
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function PipelineSessionItem({
  session,
  active,
  hovered,
  indicatorStatus,
  showPinIcon,
  onSelect,
  onRename,
  onTogglePin,
  onToggleArchive,
  onMouseEnter,
  onMouseLeave,
}: PipelineSessionItemProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const justStartedEditing = React.useRef(false)
  const leftAccent = indicatorToAccent(indicatorStatus)
  const summary = React.useMemo(() => buildPipelineSidebarSessionSummary(session), [session])
  const SignalIcon = summary.tone === 'running'
    ? Loader2
    : summary.tone === 'waiting'
      ? Clock3
      : summary.tone === 'failed'
        ? AlertCircle
        : null
  const StatusIcon = SignalIcon ?? Command

  const startEdit = (): void => {
    setEditTitle(session.title)
    setEditing(true)
    justStartedEditing.current = true
    setTimeout(() => {
      justStartedEditing.current = false
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 300)
  }

  const saveTitle = async (): Promise<void> => {
    if (justStartedEditing.current) return
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === session.title) {
      setEditing(false)
      return
    }
    await onRename(session.id, trimmed)
    setEditing(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void saveTitle()
    } else if (event.key === 'Escape') {
      setEditing(false)
    }
  }

  const handleRowKeyDown = (event: React.KeyboardEvent): void => {
    if (editing) return
    if (event.currentTarget !== event.target) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleRowKeyDown}
      onDoubleClick={(event) => {
        event.stopPropagation()
        startEdit()
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'group relative w-full min-h-[68px] flex items-stretch gap-2 overflow-hidden rounded-card border px-2.5 py-2 text-left titlebar-no-drag transition-[background-color,border-color,box-shadow,transform] duration-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        active
          ? 'pipeline-session-selected border-status-running-border bg-status-running-bg shadow-[inset_0_0_0_1px_hsl(var(--status-running)/0.16),0_0_28px_hsl(var(--status-running)/0.16)]'
          : SESSION_CARD_TONE_CLASS[summary.tone],
        !active ? 'hover:-translate-y-0.5' : '',
      )}
    >
      {active ? (
        <>
          <span className="pipeline-scanline pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden="true" />
          <span className="pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full bg-status-running shadow-[0_0_18px_hsl(var(--status-running)/0.70)]" aria-hidden="true" />
        </>
      ) : null}
      {leftAccent ? (
        <span
          className={cn(
            'absolute left-0.5 top-2 bottom-2 w-[2px] rounded-full pointer-events-none',
            SESSION_LEFT_ACCENT_CLASS[leftAccent],
          )}
        />
      ) : null}

      <div className="relative flex w-8 flex-shrink-0 items-start justify-center pt-1">
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-full border transition-transform duration-normal group-hover:scale-105',
            SESSION_ORB_CLASS[summary.tone],
          )}
          aria-hidden="true"
        >
          <StatusIcon size={14} className={summary.tone === 'running' ? 'animate-spin' : ''} />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => void saveTitle()}
            onClick={(event) => event.stopPropagation()}
            className="mt-1 w-full bg-transparent text-[13px] leading-5 text-foreground border-b border-primary/50 outline-none px-0 py-0"
            maxLength={100}
          />
        ) : (
          <>
            <div
              className={cn(
                'truncate text-[13px] leading-5 flex items-center gap-1.5 font-semibold',
                active ? 'text-foreground' : 'text-foreground/80',
              )}
            >
              {showPinIcon ? <Pin size={11} className="flex-shrink-0 text-primary/60" /> : null}
              {leftAccent ? (
                <span className={cn('size-1.5 flex-shrink-0 rounded-full', SESSION_DOT_CLASS[leftAccent])} aria-hidden="true" />
              ) : null}
              <span className="truncate">{session.title}</span>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-foreground/50">
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-surface-muted/60 px-1.5 py-0.5">
                <Command size={10} className="flex-shrink-0 text-foreground/35" aria-hidden="true" />
                <span className="truncate">{summary.detailLabel}</span>
              </span>
              {summary.signalLabel ? (
                <span
                  className={cn(
                    'inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                    SUMMARY_SIGNAL_CLASS[summary.tone],
                    SUMMARY_SIGNAL_BORDER_CLASS[summary.tone],
                  )}
                >
                  {SignalIcon ? (
                    <SignalIcon size={10} className={summary.tone === 'running' ? 'animate-spin' : ''} />
                  ) : null}
                  {summary.signalLabel}
                </span>
              ) : (
                <span className="truncate">{summary.statusLabel}</span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1" aria-hidden="true">
              <span className={cn('h-1 rounded-full', active ? 'bg-status-running' : 'bg-foreground/12')} />
              <span className={cn('h-1 rounded-full', summary.tone === 'success' ? 'bg-status-success' : 'bg-foreground/10')} />
              <span className={cn('h-1 rounded-full', summary.tone === 'failed' ? 'bg-status-danger' : 'bg-foreground/10')} />
            </div>
          </>
        )}
      </div>

      <div
        className={cn(
          'flex items-center gap-0.5 flex-shrink-0 transition-all duration-fast overflow-hidden',
          hovered && !editing ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none',
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(event) => {
                event.stopPropagation()
                void onTogglePin(session.id)
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={session.pinned ? `取消置顶 Pipeline：${session.title}` : `置顶 Pipeline：${session.title}`}
            >
              {session.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{session.pinned ? '取消置顶' : '置顶会话'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(event) => {
                event.stopPropagation()
                startEdit()
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={`重命名 Pipeline：${session.title}`}
            >
              <Pencil size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">重命名</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(event) => {
                event.stopPropagation()
                void onToggleArchive(session.id)
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={session.archived ? `取消归档 Pipeline：${session.title}` : `归档 Pipeline：${session.title}`}
            >
              {session.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{session.archived ? '取消归档' : '归档'}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export function PipelineSidebar({ width }: PipelineSidebarProps): React.ReactElement {
  const [userProfile, setUserProfile] = useAtom(userProfileAtom)
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom)
  const [tabs, setTabs] = useAtom(tabsAtom)
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom)
  const [viewMode, setViewMode] = useAtom(pipelineSidebarViewModeAtom)
  const sessions = useAtomValue(pipelineSessionsAtom)
  const draftSessionIds = useAtomValue(draftSessionIdsAtom)
  const currentPipelineSessionId = useAtomValue(currentPipelineSessionIdAtom)
  const currentChannelId = useAtomValue(agentChannelIdAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const indicatorMap = useAtomValue(pipelineSessionIndicatorMapAtom)
  const capabilitiesVersion = useAtomValue(workspaceCapabilitiesVersionAtom)
  const hasUpdate = useAtomValue(hasUpdateAtom)
  const hasEnvironmentIssues = useAtomValue(hasEnvironmentIssuesAtom)
  const setCurrentPipelineSessionId = useSetAtom(currentPipelineSessionIdAtom)
  const setAppMode = useSetAtom(appModeAtom)
  const setActiveView = useSetAtom(activeViewAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const setSearchOpen = useSetAtom(searchDialogOpenAtom)
  const setSessions = useSetAtom(pipelineSessionsAtom)
  const openSession = useOpenSession()
  const syncActiveTabSideEffects = useSyncActiveTabSideEffects()
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)
  const [capabilities, setCapabilities] = React.useState<WorkspaceCapabilities | null>(null)

  React.useEffect(() => {
    window.electronAPI.getUserProfile().then(setUserProfile).catch(console.error)
  }, [setUserProfile])

  React.useEffect(() => {
    if (!currentPipelineSessionId) return
    requestAnimationFrame(() => {
      const element = document.querySelector('.pipeline-session-selected')
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [currentPipelineSessionId])

  const currentWorkspaceSlug = React.useMemo(() => {
    if (!currentWorkspaceId) return null
    return workspaces.find((workspace) => workspace.id === currentWorkspaceId)?.slug ?? null
  }, [currentWorkspaceId, workspaces])

  React.useEffect(() => {
    if (!currentWorkspaceSlug) {
      setCapabilities(null)
      return
    }
    window.electronAPI
      .getWorkspaceCapabilities(currentWorkspaceSlug)
      .then(setCapabilities)
      .catch(console.error)
  }, [capabilitiesVersion, currentWorkspaceSlug])

  const sessionSections = React.useMemo(
    () => buildPipelineSidebarSections({
      sessions,
      currentWorkspaceId,
      draftSessionIds,
      viewMode,
    }),
    [currentWorkspaceId, draftSessionIds, sessions, viewMode],
  )

  const archivedSessionCount = React.useMemo(
    () => sessions.filter((session) =>
      session.archived
      && !draftSessionIds.has(session.id)
      && (!currentWorkspaceId || session.workspaceId === currentWorkspaceId),
    ).length,
    [currentWorkspaceId, draftSessionIds, sessions],
  )

  const hasVisibleSessions = sessionSections.length > 0

  const handleCreate = React.useCallback(async () => {
    const meta = await window.electronAPI.createPipelineSession(
      undefined,
      currentChannelId ?? undefined,
      currentWorkspaceId ?? undefined,
      CONTRIBUTION_PIPELINE_VERSION,
    )
    setSessions((prev) => [meta, ...prev])
    setCurrentPipelineSessionId(meta.id)
    setViewMode('active')
    setAppMode('pipeline')
    setActiveView('conversations')
    openSession('pipeline', meta.id, meta.title)
  }, [currentChannelId, currentWorkspaceId, openSession, setActiveView, setAppMode, setCurrentPipelineSessionId, setSessions, setViewMode])

  const handleSelectSession = React.useCallback((sessionId: string, title: string): void => {
    setCurrentPipelineSessionId(sessionId)
    setAppMode('pipeline')
    setActiveView('conversations')
    openSession('pipeline', sessionId, title)
  }, [openSession, setActiveView, setAppMode, setCurrentPipelineSessionId])

  const handleRename = React.useCallback(async (sessionId: string, title: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.updatePipelineTitle(sessionId, title)
      setSessions((prev) => prev.map((session) => (session.id === updated.id ? updated : session)))
      setTabs((prev) => updateTabTitle(prev, sessionId, title))
    } catch (error) {
      console.error('[PipelineSidebar] 重命名 Pipeline 会话失败:', error)
    }
  }, [setSessions, setTabs])

  const handleTogglePin = React.useCallback(async (sessionId: string): Promise<void> => {
    try {
      const original = sessions.find((session) => session.id === sessionId)
      const updated = await window.electronAPI.togglePinPipelineSession(sessionId)
      setSessions((prev) =>
        prev
          .map((session) => (session.id === updated.id ? updated : session))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      )
      if (original?.archived && updated.pinned && !updated.archived) {
        toast.success('已取消归档并置顶')
      }
    } catch (error) {
      console.error('[PipelineSidebar] 切换 Pipeline 会话置顶失败:', error)
    }
  }, [sessions, setSessions])

  const handleToggleArchive = React.useCallback(async (sessionId: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.toggleArchivePipelineSession(sessionId)
      setSessions((prev) =>
        prev
          .map((session) => (session.id === updated.id ? updated : session))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      )

      if (updated.archived) {
        const wasActive = activeTabId === sessionId
        const tabResult = closeTab(tabs, activeTabId, sessionId)
        setTabs(tabResult.tabs)
        setActiveTabId(tabResult.activeTabId)
        if (wasActive) {
          const nextActiveTab = tabResult.activeTabId
            ? tabResult.tabs.find((tab) => tab.id === tabResult.activeTabId) ?? null
            : null
          syncActiveTabSideEffects(nextActiveTab)
        }
      }

      toast.success(updated.archived ? '已归档' : '已取消归档')
    } catch (error) {
      console.error('[PipelineSidebar] 切换 Pipeline 会话归档失败:', error)
    }
  }, [activeTabId, setActiveTabId, setSessions, setTabs, syncActiveTabSideEffects, tabs])

  if (sidebarCollapsed) {
    return (
      <div
        className="relative h-full flex flex-col items-center overflow-hidden rounded-panel border border-status-running-border bg-surface-panel shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_24px_56px_-36px_hsl(var(--status-running)/0.42)] transition-[width] duration-normal"
        style={{ width: 48, flexShrink: 0 }}
      >
        <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-status-running/70" aria-hidden="true" />
        <span className="pointer-events-none absolute -left-12 top-20 size-24 rounded-full bg-status-running/10 blur-2xl" aria-hidden="true" />
        <div className="pt-[50px]" />

        <div className="relative z-10 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="flex size-9 items-center justify-center rounded-card border border-border-subtle/60 bg-surface-card/70 text-text-secondary shadow-card transition-[background-color,border-color,color,transform] titlebar-no-drag hover:-translate-y-0.5 hover:border-status-running-border hover:bg-status-running-bg hover:text-status-running-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="展开侧边栏"
              >
                <PanelLeftOpen size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">展开侧边栏</TooltipContent>
          </Tooltip>
        </div>

        <div className="relative z-10 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => void handleCreate()}
                className="pipeline-new-button flex size-9 items-center justify-center rounded-card border border-status-running-border bg-status-running-bg text-status-running-fg shadow-[0_0_22px_hsl(var(--status-running)/0.24)] transition-[background-color,box-shadow,transform] titlebar-no-drag hover:-translate-y-0.5 hover:bg-status-running-bg hover:shadow-[0_0_30px_hsl(var(--status-running)/0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="新建贡献 Pipeline v2"
              >
                <Plus size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">新建贡献 Pipeline v2</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1" />

        <div className="relative z-10 pb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSettingsOpen(true)}
                className="relative rounded-card border border-border-subtle/55 bg-surface-card/70 p-1 shadow-card transition-[background-color,border-color,transform] titlebar-no-drag hover:-translate-y-0.5 hover:border-border-subtle hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="打开设置"
              >
                <UserAvatar avatar={userProfile.avatar} size={28} />
                {(hasUpdate || hasEnvironmentIssues) ? (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-status-danger" />
                ) : null}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">设置</TooltipContent>
          </Tooltip>
        </div>

        <SearchDialog />
      </div>
    )
  }

  return (
    <div
      className="relative h-full flex flex-col overflow-hidden rounded-panel border border-border-subtle/55 bg-surface-panel shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_28px_70px_-42px_hsl(var(--status-running)/0.40)] transition-[width] duration-normal"
      style={{ width: width ?? 280, minWidth: 260, flexShrink: 1 }}
    >
      <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-status-running/70" aria-hidden="true" />
      <span className="pointer-events-none absolute -left-16 top-24 size-40 rounded-full bg-status-running/10 blur-3xl" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-20 bottom-12 size-36 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />

      <div className="relative z-10 pt-[30px]">
        <div className="flex items-start gap-1.5 px-3">
          <div className="min-w-0 flex-1 rounded-card border border-border-subtle/45 bg-surface-card/55 px-1 pb-1 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]">
            <ModeSwitcher />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="mt-2 size-9 flex-shrink-0 flex items-center justify-center rounded-card border border-border-subtle/45 bg-surface-card/65 text-text-tertiary shadow-card transition-[background-color,border-color,color,transform] titlebar-no-drag hover:-translate-y-0.5 hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="收起侧边栏"
              >
                <PanelLeftClose size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">收起侧边栏</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="relative z-10 px-3 pt-2">
        <div className="rounded-card border border-border-subtle/45 bg-surface-card/45 p-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)]">
          <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold text-foreground/45">
            <FolderKanban size={12} className="text-status-running-fg" aria-hidden="true" />
            <span>工作区控制台</span>
          </div>
          <WorkspaceSelector />
        </div>
      </div>

      <div className="relative z-10 px-3 pt-2 flex items-center gap-1.5">
        <button
          onClick={() => void handleCreate()}
          className="pipeline-new-button relative flex min-h-11 flex-1 items-center gap-2 overflow-hidden rounded-full border border-status-running-border bg-status-running-bg px-3 py-2 text-[13px] font-semibold text-status-running-fg shadow-[0_0_24px_hsl(var(--status-running)/0.20)] transition-[background-color,border-color,box-shadow,transform] duration-normal titlebar-no-drag hover:-translate-y-0.5 hover:bg-status-running-bg hover:shadow-[0_0_34px_hsl(var(--status-running)/0.30)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="新建贡献 Pipeline v2"
        >
          <span className="pipeline-scanline pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden="true" />
          <Plus size={14} />
          <span>新建贡献 Pipeline</span>
          <span className="ml-auto rounded-full border border-status-running-border bg-surface-card/70 px-1.5 py-0.5 text-[10px] font-medium text-status-running-fg">
            v2
          </span>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex-shrink-0 size-11 flex items-center justify-center rounded-full text-text-tertiary bg-surface-card/70 hover:bg-primary/10 hover:text-status-running-fg transition-[background-color,border-color,color,transform] duration-fast titlebar-no-drag border border-dashed border-[hsl(var(--dashed-border))] hover:-translate-y-0.5 hover:border-[hsl(var(--dashed-border-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label="搜索 Pipeline 会话"
            >
              <Radar size={16} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">搜索 (⌘F)</TooltipContent>
        </Tooltip>
      </div>

      {viewMode === 'archived' ? (
        <div className="relative z-10 px-6 pt-3 pb-1">
          <div className="text-[12px] font-semibold text-foreground/45">
            已归档 Pipeline
          </div>
        </div>
      ) : null}

      <div className="relative z-10 flex-1 overflow-y-auto px-3 pt-2 pb-3 scrollbar-none min-h-0">
        {sessionSections.map((section) => (
          <div key={section.id} className="mb-2">
            <div className="flex items-center gap-2 px-1.5 pt-2 pb-1.5 text-[11px] font-semibold text-foreground/45 select-none">
              <span>{section.label}</span>
              <span className="h-px flex-1 bg-border-subtle/45" aria-hidden="true" />
              <span className="rounded-full border border-border-subtle/45 bg-surface-card/65 px-1.5 py-0.5 text-[10px] tabular-nums text-foreground/45">
                {section.sessions.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {section.sessions.map((session) => (
                <PipelineSessionItem
                  key={`${section.id}-${session.id}`}
                  session={session}
                  active={session.id === currentPipelineSessionId}
                  hovered={session.id === hoveredId}
                  indicatorStatus={indicatorMap.get(session.id) ?? 'idle'}
                  showPinIcon={!!session.pinned}
                  onSelect={() => handleSelectSession(session.id, session.title)}
                  onRename={handleRename}
                  onTogglePin={handleTogglePin}
                  onToggleArchive={handleToggleArchive}
                  onMouseEnter={() => setHoveredId(session.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              ))}
            </div>
          </div>
        ))}

        {!hasVisibleSessions ? (
          <div className="mt-3 rounded-card border border-dashed border-[hsl(var(--dashed-border))] bg-surface-card/35 px-3 py-5 text-center text-[11px] text-foreground/40 select-none">
            <Command size={18} className="mx-auto mb-2 text-foreground/30" aria-hidden="true" />
            <div>{viewMode === 'archived' ? '暂无已归档 Pipeline' : '暂无 Pipeline 会话'}</div>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 px-3 pb-1">
        {viewMode === 'active' ? (
          archivedSessionCount > 0 ? (
            <button
              onClick={() => setViewMode('archived')}
              className="w-full flex items-center gap-2 rounded-card border border-border-subtle/35 bg-surface-card/35 px-3 py-2 text-[12px] text-text-tertiary transition-[background-color,border-color,color] titlebar-no-drag hover:border-border-subtle hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Archive size={13} className="text-foreground/30" />
              <span>已归档 ({archivedSessionCount})</span>
            </button>
          ) : null
        ) : (
          <button
            onClick={() => setViewMode('active')}
            className="w-full flex items-center gap-2 rounded-card border border-border-subtle/45 bg-surface-muted px-3 py-2 text-[12px] text-text-secondary transition-colors titlebar-no-drag hover:bg-surface-muted/80 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ArrowLeft size={13} className="text-foreground/50" />
            <span>返回活跃 Pipeline</span>
          </button>
        )}
      </div>

      {capabilities ? (
        <div className="relative z-10 px-3 pb-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  setSettingsTab('agent')
                  setSettingsOpen(true)
                }}
                className="w-full flex items-center gap-2 rounded-card border border-border-subtle/40 bg-surface-card/45 px-2.5 py-2 text-[12px] text-text-secondary shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)] transition-[background-color,border-color,color] titlebar-no-drag hover:border-status-running-border hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="配置 MCP 与 Skills"
              >
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
                  <span className="flex min-w-0 items-center justify-center gap-1 rounded-full border border-border-subtle/45 bg-surface-muted/60 px-2 py-1">
                    <Plug size={13} className="text-status-running-fg" />
                    <span className="tabular-nums">{capabilities.mcpServers.filter((server) => server.enabled).length}</span>
                    <span className="text-foreground/45">MCP</span>
                  </span>
                  <span className="flex min-w-0 items-center justify-center gap-1 rounded-full border border-border-subtle/45 bg-surface-muted/60 px-2 py-1">
                    <Zap size={13} className="text-status-waiting-fg" />
                    <span className="tabular-nums">{capabilities.skills.length}</span>
                    <span className="text-foreground/45">Skills</span>
                  </span>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">点击配置 MCP 与 Skills</TooltipContent>
          </Tooltip>
        </div>
      ) : null}

      <div className="relative z-10 px-3 pb-3">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-3 rounded-card border border-border-subtle/45 bg-surface-card/55 px-3 py-2 text-text-primary shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05),0_10px_24px_-22px_hsl(var(--foreground)/0.40)] transition-[background-color,border-color,transform] titlebar-no-drag hover:-translate-y-0.5 hover:border-border-subtle hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <UserAvatar avatar={userProfile.avatar} size={28} />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-semibold">{userProfile.userName}</span>
            <span className="block truncate text-[10px] text-foreground/40">Pipeline Dock</span>
          </span>
          <div className="relative flex-shrink-0 text-foreground/40">
            <Settings size={16} />
            {(hasUpdate || hasEnvironmentIssues) ? (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-status-danger" />
            ) : null}
          </div>
        </button>
      </div>

      <SearchDialog />
    </div>
  )
}

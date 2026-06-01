import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  Archive,
  ArchiveRestore,
  AlertCircle,
  ArrowLeft,
  Clock3,
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
  ShieldAlert,
  Plug,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { appModeAtom } from '@/atoms/app-mode'
import { activeViewAtom } from '@/atoms/active-view'
import { searchDialogOpenAtom } from '@/atoms/search-atoms'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import {
  currentScanSessionIdAtom,
  scanSidebarViewModeAtom,
  scanSessionsAtom,
} from '@/atoms/scan-atoms'
import { activeTabIdAtom, closeTab, sidebarCollapsedAtom, tabsAtom, updateTabTitle } from '@/atoms/tab-atoms'
import { userProfileAtom } from '@/atoms/user-profile'
import { hasUpdateAtom } from '@/atoms/updater'
import { hasEnvironmentIssuesAtom } from '@/atoms/environment'
import { useOpenSession } from '@/hooks/useOpenSession'
import { useSyncActiveTabSideEffects } from '@/hooks/useSyncActiveTabSideEffects'
import { ModeSwitcher } from '@/components/app-shell/ModeSwitcher'
import { SearchDialog } from '@/components/app-shell/SearchDialog'
import { UserAvatar } from '@/components/chat/UserAvatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import type { ScanSessionMeta } from '@codeinsights/shared'
import {
  buildDateSidebarSections,
  sortByUpdatedAtDesc,
} from '@/components/app-shell/sidebar-section-model'

type SessionLeftAccent = 'running' | 'success' | 'danger'

const SESSION_LEFT_ACCENT_CLASS: Record<SessionLeftAccent, string> = {
  running: 'bg-status-running',
  success: 'bg-status-success',
  danger: 'bg-status-danger',
}

const SESSION_DOT_CLASS: Record<SessionLeftAccent, string> = {
  running: 'bg-status-running shadow-[0_0_12px_hsl(var(--status-running)/0.75)] pipeline-status-pulse',
  success: 'bg-status-success shadow-[0_0_12px_hsl(var(--status-success)/0.65)]',
  danger: 'bg-status-danger shadow-[0_0_12px_hsl(var(--status-danger)/0.65)]',
}

const SESSION_CARD_TONE_CLASS: Record<SessionLeftAccent, string> = {
  running: 'border-status-running-border bg-status-running-bg shadow-[0_0_22px_hsl(var(--status-running)/0.10)] hover:shadow-[0_0_28px_hsl(var(--status-running)/0.16)]',
  success: 'border-status-success-border bg-status-success-bg shadow-[0_0_18px_hsl(var(--status-success)/0.08)]',
  danger: 'border-status-danger-border bg-status-danger-bg shadow-[0_0_20px_hsl(var(--status-danger)/0.09)]',
}

export interface ScanSidebarProps {
  width: number
}

export function ScanSidebar({ width }: ScanSidebarProps): React.ReactElement {
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom)
  const [viewMode, setViewMode] = useAtom(scanSidebarViewModeAtom)
  const sessions = useAtomValue(scanSessionsAtom)
  const setSessions = useSetAtom(scanSessionsAtom)
  const currentSessionId = useAtomValue(currentScanSessionIdAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const tabs = useAtomValue(tabsAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const setSearchOpen = useSetAtom(searchDialogOpenAtom)
  const setAppMode = useSetAtom(appModeAtom)
  const setActiveView = useSetAtom(activeViewAtom)
  const openSession = useOpenSession()
  const userProfile = useAtomValue(userProfileAtom)
  const hasUpdate = useAtomValue(hasUpdateAtom)
  const hasEnvIssues = useAtomValue(hasEnvironmentIssuesAtom)

  useSyncActiveTabSideEffects()

  // 过滤会话
  const filteredSessions = React.useMemo(() => {
    return sessions.filter((s) => {
      if (viewMode === 'archived') {
        return s.archived === true
      }
      return !s.archived
    })
  }, [sessions, viewMode])

  // 按时间分组
  const sections = React.useMemo(() => {
    return buildDateSidebarSections(filteredSessions, { now: Date.now() })
  }, [filteredSessions])

  const handleCreateSession = React.useCallback(() => {
    const title = `新扫描 - ${new Date().toLocaleDateString('zh-CN')}`
    window.electronAPI.createScanSession({
      title,
      target: '未指定项目',
      scanner: 'manual',
    }).then((session) => {
      // 更新 atoms 状态，使新创建的会话立即显示
      setSessions((prev) => [session, ...prev])
      openSession('scan', session.id, session.title)
      toast.success('已创建新扫描会话')
    }).catch((err) => {
      toast.error('创建扫描会话失败', { description: String(err) })
    })
  }, [openSession, setSessions])

  const handleSessionClick = React.useCallback((session: ScanSessionMeta) => {
    openSession('scan', session.id, session.title)
  }, [openSession])

  const handleTogglePin = React.useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // TODO: 实现置顶功能
    toast.info('置顶功能开发中')
  }, [])

  const handleToggleArchive = React.useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // TODO: 实现归档功能
    toast.info('归档功能开发中')
  }, [])

  const handleDeleteSession = React.useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('确定要删除此扫描会话吗？')) {
      window.electronAPI.deleteScanSession(sessionId).then(() => {
        // 更新 atoms 状态
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        // 关闭对应的标签页
        const tabToClose = tabs.find((t) => t.sessionId === sessionId)
        if (tabToClose) {
          // TODO: 关闭标签页需要 closeTab
        }
        toast.success('已删除扫描会话')
      }).catch((err) => {
        toast.error('删除失败', { description: String(err) })
      })
    }
  }, [tabs, setSessions])

  const getSessionAccent = React.useCallback((session: ScanSessionMeta): SessionLeftAccent => {
    if (session.status === 'running') return 'running'
    if (session.status === 'completed' || session.status === 'cancelled') return 'success'
    if (session.status === 'failed') return 'danger'
    return 'success'
  }, [])

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      idle: '空闲',
      running: '扫描中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
    }
    return labels[status] ?? status
  }

  if (collapsed) {
    return (
      <div
        className="flex h-full w-14 flex-col items-center gap-2 rounded-xl border border-border-subtle/60 bg-surface-panel/95 px-1.5 py-3 shadow-panel"
        style={{ width: 56 }}
      >
        {/* 顶部：新建按钮 */}
        <button
          onClick={handleCreateSession}
          className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-card/70 text-text-secondary transition-all hover:bg-surface-card hover:text-text-primary active:scale-95"
          title="新建扫描"
        >
          <Plus size={18} />
        </button>

        <div className="h-px w-full bg-border-subtle/50" />

        {/* 模式切换器 */}
        <ModeSwitcher />

        <div className="flex-1" />

        {/* 搜索按钮 */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover"
          title="搜索会话 (⌘K)"
        >
          <Radar size={18} />
        </button>

        {/* 设置按钮 */}
        <button
          onClick={() => {
            setSettingsTab('general')
            setSettingsOpen(true)
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover"
          title="设置"
        >
          <Settings size={18} />
        </button>

        <div className="h-px w-full bg-border-subtle/50" />

        {/* 用户头像 */}
        <button
          onClick={() => {
            setSettingsTab('general')
            setSettingsOpen(true)
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-hover"
        >
          <UserAvatar avatar={userProfile.avatar} size={28} />
        </button>

        {/* 展开按钮 */}
        <button
          onClick={() => setCollapsed(false)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover"
          title="展开侧边栏"
        >
          <PanelLeftOpen size={18} />
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-border-subtle/60 bg-surface-panel/95 shadow-panel"
      style={{ width }}
    >
      {/* 顶部区域 */}
      <div className="flex flex-col gap-2 px-3 pt-3">
        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-status-warning/20 to-status-warning/5">
              <ShieldAlert size={15} className="text-status-warning" />
            </div>
            <span className="text-sm font-medium text-text-primary">扫描工作台</span>
          </div>
          <div className="flex items-center gap-1">
            {hasEnvIssues && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setSettingsTab('about')
                      setSettingsOpen(true)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-status-warning transition-colors hover:bg-surface-hover"
                  >
                    <AlertCircle size={15} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">运行环境存在待处理问题</TooltipContent>
              </Tooltip>
            )}
            {hasUpdate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setSettingsTab('about')
                      setSettingsOpen(true)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-status-success transition-colors hover:bg-surface-hover"
                  >
                    <Plug size={15} className="animate-pulse" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">发现新版本</TooltipContent>
              </Tooltip>
            )}
            <button
              onClick={() => setCollapsed(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:text-text-secondary hover:bg-surface-hover"
              title="收起侧边栏"
            >
              <PanelLeftClose size={15} />
            </button>
          </div>
        </div>

        {/* 模式切换器 */}
        <div className="mt-1">
          <ModeSwitcher />
        </div>

        {/* 新建会话按钮 */}
        <button
          onClick={handleCreateSession}
          className="mt-1 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-status-warning/15 via-status-warning/10 to-transparent px-3 text-xs font-medium text-status-warning shadow-sm transition-all hover:from-status-warning/20 hover:via-status-warning/15 active:scale-[0.98]"
        >
          <Plus size={15} />
          <span>新建扫描</span>
        </button>

        {/* 视图切换 */}
        <div className="flex gap-1 rounded-lg bg-surface-app/60 p-0.5">
          <button
            onClick={() => setViewMode('active')}
            className={cn(
              'flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-all',
              viewMode === 'active'
                ? 'bg-surface-card text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            <FolderKanban size={12} />
            <span>进行中</span>
          </button>
          <button
            onClick={() => setViewMode('archived')}
            className={cn(
              'flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-all',
              viewMode === 'archived'
                ? 'bg-surface-card text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            <Archive size={12} />
            <span>已归档</span>
          </button>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="mx-3 mt-2 h-px bg-border-subtle/50" />

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 rounded-full bg-surface-app/60 p-3">
              <ShieldAlert size={24} className="text-text-tertiary/50" />
            </div>
            <div className="text-xs font-medium text-text-secondary">暂无扫描会话</div>
            <div className="mt-1 text-[11px] text-text-tertiary">点击上方按钮创建新扫描</div>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.id}>
                <div className="mb-1.5 flex items-center gap-1.5 px-1">
                  <Clock3 size={11} className="text-text-tertiary" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                    {section.label}
                  </span>
                  <span className="text-[10px] text-text-tertiary/70">({section.items.length})</span>
                </div>
                <div className="space-y-1">
                  {section.items.map((session) => {
                    const accent = getSessionAccent(session as ScanSessionMeta)
                    const isActive = session.id === currentSessionId
                    return (
                      <button
                        key={session.id}
                        onClick={() => handleSessionClick(session as ScanSessionMeta)}
                        className={cn(
                          'group relative w-full rounded-lg border p-2.5 text-left transition-all',
                          isActive
                            ? `${SESSION_CARD_TONE_CLASS[accent]} border-l-2`
                            : 'border-transparent bg-surface-card/30 hover:bg-surface-card/60',
                        )}
                        style={{
                          borderLeftColor: isActive ? 'currentColor' : undefined,
                        }}
                      >
                        {/* 左侧状态条 */}
                        {isActive && (
                          <div
                            className={cn(
                              'absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full',
                              SESSION_LEFT_ACCENT_CLASS[accent],
                            )}
                          />
                        )}

                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {session.status === 'running' && (
                                <Loader2 size={10} className="flex-shrink-0 animate-spin text-status-running" />
                              )}
                              <span className={cn(
                                'truncate text-xs font-medium',
                                isActive ? 'text-text-primary' : 'text-text-secondary',
                              )}>
                                {session.title}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-tertiary">
                              <span>{(session as ScanSessionMeta).target}</span>
                              {(session as ScanSessionMeta).totalFindings != null && (
                                <>
                                  <span>·</span>
                                  <span>{(session as ScanSessionMeta).totalFindings} 项</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!(session as ScanSessionMeta).pinned ? (
                              <button
                                onClick={(e) => handleTogglePin(session.id, e)}
                                className="flex h-6 w-6 items-center justify-center rounded text-text-tertiary hover:bg-surface-hover hover:text-text-secondary"
                                title="置顶"
                              >
                                <Pin size={12} />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => handleTogglePin(session.id, e)}
                                className="flex h-6 w-6 items-center justify-center rounded text-status-warning hover:bg-surface-hover"
                                title="取消置顶"
                              >
                                <PinOff size={12} />
                              </button>
                            )}
                            {viewMode !== 'archived' ? (
                              <button
                                onClick={(e) => handleToggleArchive(session.id, e)}
                                className="flex h-6 w-6 items-center justify-center rounded text-text-tertiary hover:bg-surface-hover hover:text-text-secondary"
                                title="归档"
                              >
                                <Archive size={12} />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => handleToggleArchive(session.id, e)}
                                className="flex h-6 w-6 items-center justify-center rounded text-text-tertiary hover:bg-surface-hover hover:text-text-secondary"
                                title="取消归档"
                              >
                                <ArchiveRestore size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部区域 */}
      <div className="border-t border-border-subtle/50 p-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setSettingsTab('general')
              setSettingsOpen(true)
            }}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-hover"
          >
            <UserAvatar avatar={userProfile.avatar} size={24} />
            <div className="text-left">
              <div className="text-[11px] font-medium text-text-primary">
                {userProfile?.userName || '未设置'}
              </div>
              <div className="text-[10px] text-text-tertiary">用户设置</div>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
              title="搜索 (⌘K)"
            >
              <Radar size={15} />
            </button>
            <button
              onClick={() => {
                setSettingsTab('general')
                setSettingsOpen(true)
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
              title="设置"
            >
              <Settings size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * LeftSidebar - 左侧导航栏
 *
 * 包含：
 * - Chat/Agent 模式切换器
 * - 导航菜单项（点击切换主内容区视图）
 * - 置顶对话区域（可展开/收起）
 * - 对话列表（新对话按钮 + 右键菜单 + 按 updatedAt 降序排列）
 */

import * as React from 'react'
import { useAtom, useSetAtom, useAtomValue } from 'jotai'
import { toast } from 'sonner'
import { Pin, PinOff, Settings, Plus, Trash2, Pencil, ChevronDown, ChevronRight, Plug, Zap, PanelLeftClose, PanelLeftOpen, ArrowRightLeft, Search, Archive, ArchiveRestore, ArrowLeft, Hammer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ModeSwitcher } from './ModeSwitcher'
import { SearchDialog } from './SearchDialog'
import { UserAvatar } from '@/components/chat/UserAvatar'
import { activeViewAtom } from '@/atoms/active-view'
import { appModeAtom } from '@/atoms/app-mode'
import { settingsTabAtom, settingsOpenAtom } from '@/atoms/settings-tab'
import {
  conversationsAtom,
  currentConversationIdAtom,
  selectedModelAtom,
  streamingConversationIdsAtom,
  conversationModelsAtom,
  conversationContextLengthAtom,
  conversationThinkingEnabledAtom,
  conversationParallelModeAtom,
} from '@/atoms/chat-atoms'
import {
  agentSessionsAtom,
  currentAgentSessionIdAtom,
  agentSessionIndicatorMapAtom,
  unviewedCompletedSessionIdsAtom,
  workingDoneSessionIdsAtom,
  agentChannelIdAtom,
  agentModelIdAtom,
  agentSessionChannelMapAtom,
  agentSessionModelMapAtom,
  currentAgentWorkspaceIdAtom,
  agentWorkspacesAtom,
  workspaceCapabilitiesVersionAtom,
  agentSidePanelOpenMapAtom,
} from '@/atoms/agent-atoms'
import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'
import {
  tabsAtom,
  activeTabIdAtom,
  sidebarCollapsedAtom,
  closeTab,
  updateTabTitle,
} from '@/atoms/tab-atoms'
import { userProfileAtom } from '@/atoms/user-profile'
import { sidebarViewModeAtom, agentSidebarTopHeightAtom } from '@/atoms/sidebar-atoms'
import { searchDialogOpenAtom } from '@/atoms/search-atoms'
import { hasUpdateAtom } from '@/atoms/updater'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import { workingSessionGroupsAtom, workingSessionIdsSetAtom } from '@/atoms/working-atoms'
import { hasEnvironmentIssuesAtom } from '@/atoms/environment'
import { promptConfigAtom, selectedPromptIdAtom, conversationPromptIdAtom } from '@/atoms/system-prompt-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import { useSyncActiveTabSideEffects } from '@/hooks/useSyncActiveTabSideEffects'
import { WorkspaceSelector } from '@/components/agent/WorkspaceSelector'
import { MoveSessionDialog } from '@/components/agent/MoveSessionDialog'
import { buildDateSidebarSections } from './sidebar-section-model'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ActiveView } from '@/atoms/active-view'
import type { ConversationMeta, AgentSessionMeta, WorkspaceCapabilities } from '@codeinsights/shared'

interface SidebarItemProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  /** 右侧额外元素（如展开/收起箭头） */
  suffix?: React.ReactNode
  onClick?: () => void
}

function SidebarItem({ icon, label, active, suffix, onClick }: SidebarItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-3 py-2 rounded-control text-[13px] transition-colors duration-fast titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        active
          ? 'bg-primary/10 text-text-primary shadow-card'
          : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 w-[18px] h-[18px]">{icon}</span>
        <span>{label}</span>
      </div>
      {suffix}
    </button>
  )
}

export interface LeftSidebarProps {
  /** 可选固定宽度，默认使用 CSS 响应式宽度 */
  width?: number
}

/** 侧边栏导航项标识 */
type SidebarItemId = 'pinned' | 'all-chats'

/** 导航项到视图的映射 */
const ITEM_TO_VIEW: Record<SidebarItemId, ActiveView> = {
  pinned: 'conversations',
  'all-chats': 'conversations',
}

export function LeftSidebar({ width }: LeftSidebarProps): React.ReactElement {
  const [activeView, setActiveView] = useAtom(activeViewAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const [activeItem, setActiveItem] = React.useState<SidebarItemId>('all-chats')
  const [conversations, setConversations] = useAtom(conversationsAtom)
  const [currentConversationId, setCurrentConversationId] = useAtom(currentConversationIdAtom)
  const draftSessionIds = useAtomValue(draftSessionIdsAtom)
  const setDraftSessionIds = useSetAtom(draftSessionIdsAtom)
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)

  // 窗口失焦时清除 hover 状态，防止 Tooltip 残留
  React.useEffect(() => {
    const handleBlur = (): void => setHoveredId(null)
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [])

  /** 待删除对话 ID，非空时显示确认弹窗 */
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)
  /** 待迁移会话 ID，非空时显示迁移对话框 */
  const [moveTargetId, setMoveTargetId] = React.useState<string | null>(null)
  /** 置顶区域展开/收起 */
  const [pinnedExpanded, setPinnedExpanded] = React.useState(true)
  /** Agent 上区子 Tab：'working' | 'pinned'，默认 working 在前 */
  const [agentSubTab, setAgentSubTab] = React.useState<'working' | 'pinned'>('working')
  const [userProfile, setUserProfile] = useAtom(userProfileAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
  const streamingIds = useAtomValue(streamingConversationIdsAtom)
  const mode = useAtomValue(appModeAtom)
  const hasUpdate = useAtomValue(hasUpdateAtom)
  const hasEnvironmentIssues = useAtomValue(hasEnvironmentIssuesAtom)
  const promptConfig = useAtomValue(promptConfigAtom)
  const setSelectedPromptId = useSetAtom(selectedPromptIdAtom)

  // Agent 模式状态
  const [agentSessions, setAgentSessions] = useAtom(agentSessionsAtom)
  const [currentAgentSessionId, setCurrentAgentSessionId] = useAtom(currentAgentSessionIdAtom)
  const agentIndicatorMap = useAtomValue(agentSessionIndicatorMapAtom)
  const setUnviewedCompleted = useSetAtom(unviewedCompletedSessionIdsAtom)
  const agentChannelId = useAtomValue(agentChannelIdAtom)
  const agentModelId = useAtomValue(agentModelIdAtom)
  const setSessionChannelMap = useSetAtom(agentSessionChannelMapAtom)
  const setSessionModelMap = useSetAtom(agentSessionModelMapAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)

  // 工作区能力（MCP + Skill 计数）
  const [capabilities, setCapabilities] = React.useState<WorkspaceCapabilities | null>(null)
  const capabilitiesVersion = useAtomValue(workspaceCapabilitiesVersionAtom)

  // Tab 状态
  const [tabs, setTabs] = useAtom(tabsAtom)
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom)
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom)
  const openSession = useOpenSession()
  const syncActiveTabSideEffects = useSyncActiveTabSideEffects()

  // 归档 & 搜索状态
  const [viewMode, setViewMode] = useAtom(sidebarViewModeAtom)
  const setSearchDialogOpen = useSetAtom(searchDialogOpenAtom)

  // Agent 模式上区（Working/置顶）可拖拽高度
  /** -1 表示未初始化，首次渲染时按容器 40% 计算 */
  const [agentTopHeight, setAgentTopHeight] = useAtom(agentSidebarTopHeightAtom)
  const agentSplitContainerRef = React.useRef<HTMLDivElement>(null)
  const agentTopResizing = React.useRef(false)
  const agentTopResizeCleanup = React.useRef<(() => void) | null>(null)

  React.useEffect(() => {
    return () => { agentTopResizeCleanup.current?.() }
  }, [])

  React.useEffect(() => {
    if (agentTopHeight > 0) return
    const el = agentSplitContainerRef.current
    if (!el) return
    const h = el.getBoundingClientRect().height
    if (h > 0) {
      setAgentTopHeight(Math.round(h * 0.4))
    }
  }, [agentTopHeight, setAgentTopHeight, mode, viewMode])

  const handleAgentTopResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const container = agentSplitContainerRef.current
      if (!container) return
      agentTopResizing.current = true
      const startY = e.clientY
      const startH = Math.max(0, agentTopHeight)
      const containerHeight = container.getBoundingClientRect().height
      const minH = 80
      const maxH = Math.max(minH, Math.floor(containerHeight * 0.7))

      const onMove = (ev: MouseEvent): void => {
        if (!agentTopResizing.current) return
        const delta = ev.clientY - startY
        const next = Math.min(maxH, Math.max(minH, startH + delta))
        setAgentTopHeight(next)
      }
      const onUp = (): void => {
        agentTopResizing.current = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        agentTopResizeCleanup.current = null
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
      agentTopResizeCleanup.current = onUp
    },
    [agentTopHeight, setAgentTopHeight],
  )

  // 当 activeTabId 变化时，自动滚动侧边栏使选中项可见
  React.useEffect(() => {
    if (!activeTabId) return
    requestAnimationFrame(() => {
      const el = document.querySelector('.session-item-selected')
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [activeTabId])

  // per-conversation/session Map atoms（删除时清理）
  const setConvModels = useSetAtom(conversationModelsAtom)
  const setConvContextLength = useSetAtom(conversationContextLengthAtom)
  const setConvThinking = useSetAtom(conversationThinkingEnabledAtom)
  const setConvParallel = useSetAtom(conversationParallelModeAtom)
  const setConvPromptId = useSetAtom(conversationPromptIdAtom)
  const setAgentSidePanelOpen = useSetAtom(agentSidePanelOpenMapAtom)
  const setWorkingDone = useSetAtom(workingDoneSessionIdsAtom)

  /** 清理 per-conversation/session Map atoms 条目 */
  const cleanupMapAtoms = React.useCallback((id: string) => {
    const deleteKey = <T,>(prev: Map<string, T>): Map<string, T> => {
      if (!prev.has(id)) return prev
      const map = new Map(prev)
      map.delete(id)
      return map
    }
    setConvModels(deleteKey)
    setConvContextLength(deleteKey)
    setConvThinking(deleteKey)
    setConvParallel(deleteKey)
    setConvPromptId(deleteKey)
    setAgentSidePanelOpen(deleteKey)
    setSessionChannelMap(deleteKey)
    setSessionModelMap(deleteKey)
  }, [setConvModels, setConvContextLength, setConvThinking, setConvParallel, setConvPromptId, setAgentSidePanelOpen, setSessionChannelMap, setSessionModelMap])

  const currentWorkspaceSlug = React.useMemo(() => {
    if (!currentWorkspaceId) return null
    return workspaces.find((w) => w.id === currentWorkspaceId)?.slug ?? null
  }, [currentWorkspaceId, workspaces])

  const workspaceNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const w of workspaces) map.set(w.id, w.name)
    return map
  }, [workspaces])

  React.useEffect(() => {
    if (!currentWorkspaceSlug || mode !== 'agent') {
      setCapabilities(null)
      return
    }
    window.electronAPI
      .getWorkspaceCapabilities(currentWorkspaceSlug)
      .then(setCapabilities)
      .catch(console.error)
  }, [currentWorkspaceSlug, mode, activeView, capabilitiesVersion])

  /** 置顶对话列表（仅活跃模式显示，排除 draft） */
  const pinnedConversations = React.useMemo(
    () => viewMode === 'active' ? conversations.filter((c) => c.pinned && !draftSessionIds.has(c.id)) : [],
    [conversations, viewMode, draftSessionIds]
  )

  /** Working 区域状态 */
  const workingGroups = useAtomValue(workingSessionGroupsAtom)
  const workingSessionIds = useAtomValue(workingSessionIdsSetAtom)
  const hasWorkingSessions = workingGroups.todo.length > 0 || workingGroups.running.length > 0 || workingGroups.done.length > 0

  /** 置顶 Agent 会话列表（仅活跃模式显示，按当前工作区过滤，排除 draft 和 Working） */
  const pinnedAgentSessions = React.useMemo(
    () => viewMode === 'active' ? agentSessions.filter((s) => s.pinned && !draftSessionIds.has(s.id) && !workingSessionIds.has(s.id) && (!currentWorkspaceId || s.workspaceId === currentWorkspaceId)) : [],
    [agentSessions, viewMode, draftSessionIds, currentWorkspaceId, workingSessionIds]
  )

  /** 顶部 TabBar 切换 tab 时，自动同步上区子 Tab 到对应分类 */
  const prevActiveTabIdForSubTab = React.useRef<string | null>(activeTabId)
  React.useEffect(() => {
    if (activeTabId === prevActiveTabIdForSubTab.current) return
    prevActiveTabIdForSubTab.current = activeTabId
    if (mode !== 'agent' || viewMode !== 'active' || !activeTabId) return
    if (pinnedAgentSessions.some((s) => s.id === activeTabId)) {
      setAgentSubTab('pinned')
    } else if (workingSessionIds.has(activeTabId)) {
      setAgentSubTab('working')
    }
  }, [activeTabId, mode, viewMode, pinnedAgentSessions, workingSessionIds])

  /** 对话按日期分组（根据 viewMode 过滤归档状态，排除 draft） */
  const conversationGroups = React.useMemo(
    () => {
      const filtered = viewMode === 'archived'
        ? conversations.filter((c) => c.archived && !draftSessionIds.has(c.id))
        : conversations.filter((c) => !c.archived && !c.pinned && !draftSessionIds.has(c.id))
      return buildDateSidebarSections(filtered)
    },
    [conversations, viewMode, draftSessionIds]
  )

  /** 已归档对话数量 */
  const archivedConversationCount = React.useMemo(
    () => conversations.filter((c) => c.archived).length,
    [conversations]
  )
  const activeConversationCount = React.useMemo(
    () => conversations.filter((c) => !c.archived).length,
    [conversations]
  )

  /** 已归档 Agent 会话数量（当前工作区） */
  const archivedAgentSessionCount = React.useMemo(
    () => agentSessions.filter((s) => s.archived && (!currentWorkspaceId || s.workspaceId === currentWorkspaceId)).length,
    [agentSessions, currentWorkspaceId]
  )
  const activeAgentSessionCount = React.useMemo(
    () => agentSessions.filter((s) => !s.archived && (!currentWorkspaceId || s.workspaceId === currentWorkspaceId)).length,
    [agentSessions, currentWorkspaceId]
  )
  const activeWorkingCount = workingGroups.todo.length + workingGroups.running.length + workingGroups.done.length

  // 初始加载对话列表 + 用户档案 + Agent 会话
  React.useEffect(() => {
    window.electronAPI
      .listConversations()
      .then((list) => {
        setConversations(list)
      })
      .catch(console.error)
    window.electronAPI
      .getUserProfile()
      .then(setUserProfile)
      .catch(console.error)
    window.electronAPI
      .listAgentSessions()
      .then(setAgentSessions)
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setConversations, setUserProfile, setAgentSessions])

  // 窗口聚焦时重新同步列表，修复长时间后前后端不一致
  React.useEffect(() => {
    const handleFocus = (): void => {
      window.electronAPI.listConversations().then(setConversations).catch(console.error)
      window.electronAPI.listAgentSessions().then(setAgentSessions).catch(console.error)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [setConversations, setAgentSessions])

  /** 处理导航项点击 */
  const handleItemClick = (item: SidebarItemId): void => {
    if (item === 'pinned') {
      // 置顶按钮仅切换展开/收起，不改变 activeView
      setPinnedExpanded((prev) => !prev)
      return
    }
    setActiveItem(item)
    setActiveView(ITEM_TO_VIEW[item])
  }

  // 切换模式时重置归档视图
  React.useEffect(() => {
    setViewMode('active')
  }, [mode, setViewMode])

  /** 创建新对话（继承当前选中的模型/渠道） */
  const handleNewConversation = async (): Promise<void> => {
    try {
      const meta = await window.electronAPI.createConversation(
        undefined,
        selectedModel?.modelId,
        selectedModel?.channelId,
      )
      setConversations((prev) => [meta, ...prev])
      // 打开新标签页
      openSession('chat', meta.id, meta.title)
      // 确保在对话视图
      setActiveView('conversations')
      setActiveItem('all-chats')
      // 根据默认提示词重置选中
      if (promptConfig.defaultPromptId) {
        setSelectedPromptId(promptConfig.defaultPromptId)
      }
    } catch (error) {
      console.error('[侧边栏] 创建对话失败:', error)
    }
  }

  /** 选择对话（打开或聚焦标签页） */
  const handleSelectConversation = (id: string, title: string): void => {
    openSession('chat', id, title)
    setActiveView('conversations')
    setActiveItem('all-chats')
  }

  /** 请求删除对话（弹出确认框） */
  const handleRequestDelete = (id: string): void => {
    setPendingDeleteId(id)
  }

  /** 重命名对话标题 */
  const handleRename = async (id: string, newTitle: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.updateConversationTitle(id, newTitle)
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      )
      // 同步更新标签页标题
      setTabs((prev) => updateTabTitle(prev, id, newTitle))
    } catch (error) {
      console.error('[侧边栏] 重命名对话失败:', error)
    }
  }

  /** 切换对话置顶状态 */
  const handleTogglePin = async (id: string): Promise<void> => {
    try {
      const original = conversations.find((c) => c.id === id)
      const updated = await window.electronAPI.togglePinConversation(id)
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      )
      // 归档会话被置顶时会自动取消归档
      if (original?.archived && updated.pinned && !updated.archived) {
        toast.success('已取消归档并置顶')
      }
    } catch (error) {
      console.error('[侧边栏] 切换置顶失败:', error)
    }
  }

  /** 切换对话归档状态 */
  const handleToggleArchive = async (id: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.toggleArchiveConversation(id)
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      )
      // 归档时自动关闭该对话的标签页，并同步新激活标签的副作用
      // （appMode、currentXxxId 等），避免文件面板/工具栏等 per-tab
      // 状态被遗留为旧值或被错误地置 null。
      if (updated.archived) {
        const wasActive = activeTabId === id
        const tabResult = closeTab(tabs, activeTabId, id)
        setTabs(tabResult.tabs)
        setActiveTabId(tabResult.activeTabId)
        cleanupMapAtoms(id)
        if (wasActive) {
          const newActiveTab = tabResult.activeTabId
            ? tabResult.tabs.find((t) => t.id === tabResult.activeTabId) ?? null
            : null
          syncActiveTabSideEffects(newActiveTab)
        }
      }
      toast.success(updated.archived ? '已归档' : '已取消归档')
    } catch (error) {
      console.error('[侧边栏] 切换归档失败:', error)
    }
  }

  /** 确认删除对话 */
  const handleConfirmDelete = async (): Promise<void> => {
    if (!pendingDeleteId) return

    // 关闭对应的标签页：setTabs 与 setActiveTabId 成组更新，便于阅读，
    // 也避免将来在两者之间意外插入 await 导致跨渲染状态不一致。
    // （React 18 在同一事件回调中会自动批处理多次 setState，所以单次渲染
    // 的一致性由 React 保证，这里只是保持代码组织清晰。）
    const wasActive = activeTabId === pendingDeleteId
    const tabResult = closeTab(tabs, activeTabId, pendingDeleteId)
    setTabs(tabResult.tabs)
    setActiveTabId(tabResult.activeTabId)

    // 若关闭的是当前活跃标签，同步新激活标签的副作用（appMode、
    // currentXxxId、以及右侧文件面板等 per-tab 状态），保持与 TabBar
    // 关闭逻辑一致，避免删除/归档当前会话后新标签状态缺失。
    if (wasActive) {
      const newActiveTab = tabResult.activeTabId
        ? tabResult.tabs.find((t) => t.id === tabResult.activeTabId) ?? null
        : null
      syncActiveTabSideEffects(newActiveTab)
    }

    // 清理 draft 标记（如有）
    setDraftSessionIds((prev: Set<string>) => {
      if (!prev.has(pendingDeleteId)) return prev
      const next = new Set(prev)
      next.delete(pendingDeleteId)
      return next
    })

    // 清理 per-conversation/session Map atoms 条目
    cleanupMapAtoms(pendingDeleteId)

    // 从 Working Done 集合移除
    setWorkingDone((prev) => {
      if (!prev.has(pendingDeleteId)) return prev
      const next = new Set(prev)
      next.delete(pendingDeleteId)
      return next
    })

    if (mode === 'agent') {
      // Agent 模式：删除 Agent 会话
      // 注意：当前会话指针（currentAgentSessionId）已由上面的
      // syncActiveTabSideEffects 在 wasActive 分支同步到新激活标签，
      // 这里不要再按旧闭包值强制置 null，否则会覆盖新 sessionId，
      // 导致 RightSidePanel 消失（依赖 currentAgentSessionIdAtom）。
      try {
        await window.electronAPI.deleteAgentSession(pendingDeleteId)
        // 全量刷新确保与后端同步
        const sessions = await window.electronAPI.listAgentSessions()
        setAgentSessions(sessions)
      } catch (error) {
        console.error('[侧边栏] 删除 Agent 会话失败:', error)
        // 即使后端报错，也从本地列表移除（可能是会话已不存在）
        setAgentSessions((prev) => prev.filter((s) => s.id !== pendingDeleteId))
      } finally {
        setPendingDeleteId(null)
      }
      return
    }

    try {
      await window.electronAPI.deleteConversation(pendingDeleteId)
      // 全量刷新确保与后端同步
      const conversations = await window.electronAPI.listConversations()
      setConversations(conversations)
    } catch (error) {
      console.error('[侧边栏] 删除对话失败:', error)
      // 即使后端报错，也从本地列表移除（可能是对话已不存在）
      setConversations((prev) => prev.filter((c) => c.id !== pendingDeleteId))
    } finally {
      setPendingDeleteId(null)
    }
  }

  /** 创建新 Agent 会话 */
  const handleNewAgentSession = async (): Promise<void> => {
    try {
      const meta = await window.electronAPI.createAgentSession(
        undefined,
        agentChannelId || undefined,
        currentWorkspaceId || undefined,
      )
      setAgentSessions((prev) => [meta, ...prev])
      // 从全局默认值初始化 per-session 渠道/模型配置
      if (agentChannelId) {
        setSessionChannelMap((prev) => {
          const map = new Map(prev)
          map.set(meta.id, agentChannelId)
          return map
        })
      }
      if (agentModelId) {
        setSessionModelMap((prev) => {
          const map = new Map(prev)
          map.set(meta.id, agentModelId)
          return map
        })
      }
      // 打开新标签页
      openSession('agent', meta.id, meta.title)
      setActiveView('conversations')
      setActiveItem('all-chats')
    } catch (error) {
      console.error('[侧边栏] 创建 Agent 会话失败:', error)
    }
  }

  /** 选择 Agent 会话（打开或聚焦标签页） */
  const handleSelectAgentSession = (id: string, title: string): void => {
    openSession('agent', id, title)
    setActiveView('conversations')
    setActiveItem('all-chats')
    // 清除该会话的"已完成未查看"标记
    setUnviewedCompleted((prev: Set<string>) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  /** 重命名 Agent 会话标题 */
  const handleAgentRename = async (id: string, newTitle: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.updateAgentSessionTitle(id, newTitle)
      setAgentSessions((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      )
      // 同步更新标签页标题
      setTabs((prev) => updateTabTitle(prev, id, newTitle))
    } catch (error) {
      console.error('[侧边栏] 重命名 Agent 会话失败:', error)
    }
  }

  /** 切换 Agent 会话置顶状态 */
  const handleTogglePinAgent = async (id: string): Promise<void> => {
    try {
      const original = agentSessions.find((s) => s.id === id)
      const updated = await window.electronAPI.togglePinAgentSession(id)
      setAgentSessions((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      )
      // 归档会话被置顶时会自动取消归档
      if (original?.archived && updated.pinned && !updated.archived) {
        toast.success('已取消归档并置顶')
      }
    } catch (error) {
      console.error('[侧边栏] 切换 Agent 会话置顶失败:', error)
    }
  }

  /** 切换 Agent 会话手动工作中状态 */
  const handleToggleManualWorkingAgent = async (id: string): Promise<void> => {
    try {
      const isCurrentlyInWorking = workingSessionIds.has(id)
      if (isCurrentlyInWorking) {
        // 从工作中移出：清除 manualWorking + 清除 workingDone
        const session = agentSessions.find((s) => s.id === id)
        if (session?.manualWorking) {
          const updated = await window.electronAPI.toggleManualWorkingAgentSession(id)
          setAgentSessions((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s))
          )
        }
        setWorkingDone((prev) => {
          if (!prev.has(id)) return prev
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } else {
        // 加入工作中
        const original = agentSessions.find((s) => s.id === id)
        const updated = await window.electronAPI.toggleManualWorkingAgentSession(id)
        setAgentSessions((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        )
        if (original?.archived && updated.manualWorking && !updated.archived) {
          toast.success('已取消归档并标记为工作中')
        }
      }
    } catch (error) {
      console.error('[Sidebar] Failed to toggle manual working:', error)
      toast.error('操作失败')
    }
  }

  /** 切换 Agent 会话归档状态 */
  const handleToggleArchiveAgent = async (id: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.toggleArchiveAgentSession(id)
      setAgentSessions((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      )
      // 归档时自动关闭该会话的标签页，并同步新激活标签的副作用，
      // 否则 RightSidePanel（依赖 currentAgentSessionIdAtom）会因为
      // 指针被错误置 null 而消失。
      if (updated.archived) {
        const wasActive = activeTabId === id
        const tabResult = closeTab(tabs, activeTabId, id)
        setTabs(tabResult.tabs)
        setActiveTabId(tabResult.activeTabId)
        cleanupMapAtoms(id)
        // 从 Working Done 集合移除
        setWorkingDone((prev) => {
          if (!prev.has(id)) return prev
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        if (wasActive) {
          const newActiveTab = tabResult.activeTabId
            ? tabResult.tabs.find((t) => t.id === tabResult.activeTabId) ?? null
            : null
          syncActiveTabSideEffects(newActiveTab)
        }
      }
      toast.success(updated.archived ? '已归档' : '已取消归档')
    } catch (error) {
      console.error('[侧边栏] 切换 Agent 会话归档失败:', error)
    }
  }

  /** 迁移会话到另一个工作区后的回调 */
  const handleSessionMoved = (updatedSession: AgentSessionMeta, targetWorkspaceName: string): void => {
    setAgentSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    )
    // 如果迁移的是当前选中的会话，取消选中并关闭标签页
    if (currentAgentSessionId === updatedSession.id) {
      const tabResult = closeTab(tabs, activeTabId, updatedSession.id)
      setTabs(tabResult.tabs)
      setActiveTabId(tabResult.activeTabId)
      setCurrentAgentSessionId(null)
      // 从 Working Done 集合移除
      setWorkingDone((prev) => {
        if (!prev.has(updatedSession.id)) return prev
        const next = new Set(prev)
        next.delete(updatedSession.id)
        return next
      })
    }
    setMoveTargetId(null)
    toast.success('会话已迁移', {
      description: `已迁移到「${targetWorkspaceName}」，请切换工作区查看`,
    })
  }

  /** Agent 会话按工作区过滤 + 归档过滤 + 排除 draft + 排除 Working */
  const filteredAgentSessions = React.useMemo(
    () => {
      const byWorkspace = agentSessions.filter((s) => s.workspaceId === currentWorkspaceId && !draftSessionIds.has(s.id))
      return viewMode === 'archived'
        ? byWorkspace.filter((s) => s.archived)
        : byWorkspace.filter((s) => !s.archived && !s.pinned && !workingSessionIds.has(s.id))
    },
    [agentSessions, currentWorkspaceId, viewMode, draftSessionIds, workingSessionIds]
  )

  /** Agent 会话按日期分组 */
  const agentSessionGroups = React.useMemo(
    () => buildDateSidebarSections(filteredAgentSessions),
    [filteredAgentSessions]
  )

  // 删除确认弹窗（collapsed/expanded 共享）
  const deleteDialog = (
    <AlertDialog
      open={pendingDeleteId !== null}
      onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
    >
      <AlertDialogContent
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleConfirmDelete()
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除对话</AlertDialogTitle>
          <AlertDialogDescription>
            删除后将无法恢复，确定要删除这个对话吗？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  // 迁移会话对话框（collapsed/expanded 共享）
  const moveDialog = (
    <MoveSessionDialog
      open={moveTargetId !== null}
      onOpenChange={(open) => { if (!open) setMoveTargetId(null) }}
      sessionId={moveTargetId ?? ''}
      currentWorkspaceId={currentWorkspaceId ?? undefined}
      workspaces={workspaces}
      onMoved={handleSessionMoved}
    />
  )

  // ===== 折叠状态：精简图标视图 =====
  if (sidebarCollapsed) {
    return (
      <div
        className="agent-resource-panel agent-cockpit-sidebar h-full flex flex-col items-center rounded-panel border border-border-subtle/55 transition-[width] duration-normal"
        style={{ width: 48, flexShrink: 0 }}
      >
        {/* 顶部留空，避开 macOS 红绿灯 */}
        <div className="pt-[50px]" />

        {/* 展开按钮 */}
        <div className="pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="agent-icon-launcher p-2 rounded-control text-text-secondary transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="展开侧边栏"
              >
                <PanelLeftOpen size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">展开侧边栏</TooltipContent>
          </Tooltip>
        </div>

        {/* 新对话/会话按钮 */}
        <div className="pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={mode === 'agent' ? handleNewAgentSession : handleNewConversation}
                className="agent-icon-launcher agent-icon-launcher--primary p-2 rounded-control text-text-primary transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label={mode === 'agent' ? '新建 Agent 会话' : '新建对话'}
              >
                <Plus size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {mode === 'agent' ? '新会话' : '新对话'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 弹性空间 */}
        <div className="flex-1" />

        {/* 用户头像（点击打开设置） */}
        <div className="pb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSettingsOpen(true)}
                className="agent-user-dock-button relative p-1 rounded-control transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="打开设置"
              >
                <UserAvatar avatar={userProfile.avatar} size={28} />
                {(hasUpdate || hasEnvironmentIssues) && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-status-danger" aria-hidden="true" />
                )}
                {(hasUpdate || hasEnvironmentIssues) && (
                  <span className="sr-only">有更新或环境问题需要处理</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">设置</TooltipContent>
          </Tooltip>
        </div>

        {deleteDialog}
        {moveDialog}
        <SearchDialog />
      </div>
    )
  }

  // ===== 展开状态：完整侧边栏 =====
  return (
    <div
      className="agent-resource-panel agent-cockpit-sidebar agent-cockpit-sidebar--command h-full flex flex-col rounded-panel border border-border-subtle/55 transition-[width] duration-normal"
      style={{ width: width ?? 280, minWidth: 260, flexShrink: 1 }}
    >
      <div className="pt-[30px] px-3">
        <ModeSwitcher />
        <div className="agent-sidebar-top-shell agent-sidebar-top-shell--hud mt-2 rounded-panel border border-border-subtle/55 bg-background/28 px-3 py-3 shadow-sm backdrop-blur-md">
          <div className="agent-sidebar-pulsebar" aria-hidden="true" />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-status-running-fg">Command Desk</div>
              <div className="mt-1 truncate text-[15px] font-semibold text-text-primary">
                {mode === 'agent' ? 'Agent Cockpit' : 'Conversation Deck'}
              </div>
              <div className="mt-1 truncate text-[11px] leading-4 text-text-tertiary">
                {mode === 'agent'
                  ? '工作区、会话与能力在同一层级中编排'
                  : '置顶、归档与最近会话保持统一视图'}
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="agent-icon-launcher mt-0.5 size-9 flex-shrink-0 flex items-center justify-center rounded-control text-text-tertiary transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  aria-label="收起侧边栏"
                >
                  <PanelLeftClose size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">收起侧边栏</TooltipContent>
            </Tooltip>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle/45 bg-surface-card/60 px-2.5 py-1 text-[10px] text-text-secondary">
              <Zap size={11} className="text-status-running-fg" />
              Live
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle/45 bg-surface-card/60 px-2.5 py-1 text-[10px] text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-status-running-fg" />
              {mode === 'agent' ? `${activeAgentSessionCount} active` : `${activeConversationCount} active`}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle/45 bg-surface-card/60 px-2.5 py-1 text-[10px] text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-status-neutral-fg" />
              {viewMode === 'archived' ? 'Archived view' : 'Live view'}
            </span>
          </div>
        </div>
      </div>

      {/* Agent 模式：工作区选择器 */}
      {mode === 'agent' && (
        <div className="px-3 pt-2">
          <div className="agent-sidebar-section-label mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-normal text-text-tertiary">Workspace Matrix</div>
          <WorkspaceSelector />
        </div>
      )}

      {/* 新对话/新会话按钮 + 搜索按钮 */}
      <div className="px-3 pt-2 flex items-center gap-1.5">
        <button
          onClick={mode === 'agent' ? handleNewAgentSession : handleNewConversation}
          className="agent-resource-well agent-primary-action flex-1 flex items-center gap-2 px-3 py-2.5 rounded-control text-[13px] font-semibold text-text-primary transition-colors duration-fast titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label={mode === 'agent' ? '新建 Agent 会话' : '新建对话'}
        >
          <Plus size={14} />
          <span>{mode === 'agent' ? '新会话' : '新对话'}</span>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setSearchDialogOpen(true)}
              className="agent-resource-well agent-icon-launcher flex-shrink-0 size-10 flex items-center justify-center rounded-control text-text-tertiary transition-colors duration-fast titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={mode === 'agent' ? '搜索 Agent 会话' : '搜索对话'}
            >
              <Search size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">搜索 (⌘F)</TooltipContent>
        </Tooltip>
      </div>

      {/* Chat 模式：导航菜单（置顶区域） */}
      {mode === 'chat' && (
        <div className="flex flex-col gap-1 pt-3 px-3">
          <SidebarItem
            icon={<Pin size={16} />}
            label="置顶对话"
            suffix={
              pinnedConversations.length > 0 ? (
                pinnedExpanded
                  ? <ChevronDown size={14} className="text-foreground/40" />
                  : <ChevronRight size={14} className="text-foreground/40" />
              ) : undefined
            }
            onClick={() => handleItemClick('pinned')}
          />
        </div>
      )}

      {/* Chat 模式：置顶对话区域 */}
      {mode === 'chat' && pinnedExpanded && pinnedConversations.length > 0 && (
        <div className="px-3 pt-1 pb-1">
          <div className="agent-section-stack flex flex-col gap-0.5 pl-1 ml-2">
            {pinnedConversations.map((conv) => (
              <ConversationItem
                key={`pinned-${conv.id}`}
                conversation={conv}
                active={conv.id === activeTabId}
                hovered={conv.id === hoveredId}
                streaming={streamingIds.has(conv.id)}
                showPinIcon={false}
                onSelect={() => handleSelectConversation(conv.id, conv.title)}
                onRequestDelete={() => handleRequestDelete(conv.id)}
                onRename={handleRename}
                onTogglePin={handleTogglePin}
                onToggleArchive={handleToggleArchive}
                onMouseEnter={() => setHoveredId(conv.id)}
                onMouseLeave={() => setHoveredId(null)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Agent 模式 active 视图：可拖拽双区（上 置顶+Working + 下 最近会话） */}
      {mode === 'agent' && viewMode === 'active' ? (
        <div ref={agentSplitContainerRef} className="flex-1 flex flex-col min-h-0">
          {(pinnedAgentSessions.length > 0 || hasWorkingSessions) && (
            <>
              {/* 上区：工作中 / 置顶 Tab 切换（高度可拖拽） */}
              <div
                style={{ height: agentTopHeight > 0 ? agentTopHeight : undefined }}
                className="flex flex-col min-h-0 flex-shrink-0 overflow-hidden"
              >
                {/* Tab 切换按钮 */}
                <div className="pt-2 px-3 flex-shrink-0">
                  <div className="agent-subtab-rail flex items-center gap-1 mb-0.5 rounded-card p-1">
                    <button
                      onClick={() => setAgentSubTab('working')}
                      className={cn(
                        'px-2.5 py-0.5 rounded-control text-[12px] font-medium transition-colors titlebar-no-drag inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                        agentSubTab === 'working'
                          ? 'bg-surface-card text-text-primary shadow-sm'
                          : 'text-text-tertiary hover:text-text-primary hover:bg-surface-card/75'
                      )}
                      aria-pressed={agentSubTab === 'working'}
                    >
                      工作中
                      {hasWorkingSessions && (
                        <span className={cn(
                          'ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px]',
                          agentSubTab === 'working'
                            ? 'bg-status-running-bg text-status-running-fg'
                            : 'bg-status-neutral-bg text-status-neutral-fg'
                        )}>
                          {activeWorkingCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setAgentSubTab('pinned')}
                      className={cn(
                        'px-2.5 py-0.5 rounded-control text-[12px] font-medium transition-colors titlebar-no-drag inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                        agentSubTab === 'pinned'
                          ? 'bg-surface-card text-text-primary shadow-sm'
                          : 'text-text-tertiary hover:text-text-primary hover:bg-surface-card/75'
                      )}
                      aria-pressed={agentSubTab === 'pinned'}
                    >
                      置顶
                      {pinnedAgentSessions.length > 0 && (
                        <span className={cn(
                          'ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px]',
                          agentSubTab === 'pinned'
                            ? 'bg-status-neutral-bg text-status-neutral-fg'
                            : 'bg-status-neutral-bg text-status-neutral-fg'
                        )}>
                          {pinnedAgentSessions.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Tab 内容（自己滚动） */}
                <div className="flex-1 overflow-y-auto scrollbar-none px-3 pb-1 min-h-0">
                  {agentSubTab === 'working' && (
                    <div className="pt-0.5 pb-0.5">
                      {hasWorkingSessions ? (() => {
                        const getTodoAccent = (sessionId: string): SessionLeftAccent =>
                          agentIndicatorMap.get(sessionId) === 'failed' ? 'danger' : 'waiting'
                        const workingItems: Array<{ session: AgentSessionMeta; accent: SessionLeftAccent; keyPrefix: string }> = [
                          ...workingGroups.todo.map((s) => ({ session: s, accent: getTodoAccent(s.id), keyPrefix: 'working-todo' })),
                          ...workingGroups.running.map((s) => ({ session: s, accent: 'running' as const, keyPrefix: 'working-running' })),
                          ...workingGroups.done.map((s) => ({ session: s, accent: 'success' as const, keyPrefix: 'working-done' })),
                        ]
                        return (
                          <div className="flex flex-col gap-0.5">
                            {workingItems.map(({ session, accent, keyPrefix }) => (
                              <AgentSessionItem
                                key={`${keyPrefix}-${session.id}`}
                                session={session}
                                active={session.id === activeTabId}
                                hovered={session.id === hoveredId}
                                indicatorStatus={agentIndicatorMap.get(session.id) ?? 'idle'}
                                isInWorkingSection={workingSessionIds.has(session.id)}
                                showPinIcon={false}
                                leftAccent={accent}
                                workspaceName={session.workspaceId ? workspaceNameMap.get(session.workspaceId) : undefined}
                                onSelect={() => handleSelectAgentSession(session.id, session.title)}
                                onRequestDelete={() => handleRequestDelete(session.id)}
                                onRequestMove={() => setMoveTargetId(session.id)}
                                onRename={handleAgentRename}
                                onTogglePin={handleTogglePinAgent}
                                onToggleManualWorking={handleToggleManualWorkingAgent}
                                onToggleArchive={handleToggleArchiveAgent}
                                onMouseEnter={() => setHoveredId(session.id)}
                                onMouseLeave={() => setHoveredId(null)}
                              />
                            ))}
                          </div>
                        )
                      })() : (
                        <div className="px-2 py-3 text-[11px] text-foreground/30 text-center select-none">
                          暂无进行中的会话
                        </div>
                      )}
                    </div>
                  )}

                  {agentSubTab === 'pinned' && (
                    <div className="pt-0.5 pb-0.5">
                      {pinnedAgentSessions.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {pinnedAgentSessions.map((session) => (
                            <AgentSessionItem
                              key={`pinned-${session.id}`}
                              session={session}
                              active={session.id === activeTabId}
                              hovered={session.id === hoveredId}
                              indicatorStatus={agentIndicatorMap.get(session.id) ?? 'idle'}
                              isInWorkingSection={workingSessionIds.has(session.id)}
                              showPinIcon={false}
                              onSelect={() => handleSelectAgentSession(session.id, session.title)}
                              onRequestDelete={() => handleRequestDelete(session.id)}
                              onRequestMove={() => setMoveTargetId(session.id)}
                              onRename={handleAgentRename}
                              onTogglePin={handleTogglePinAgent}
                              onToggleManualWorking={handleToggleManualWorkingAgent}
                              onToggleArchive={handleToggleArchiveAgent}
                              onMouseEnter={() => setHoveredId(session.id)}
                              onMouseLeave={() => setHoveredId(null)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="px-2 py-3 text-[11px] text-foreground/30 text-center select-none">
                          暂无置顶会话
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 拖拽分割条：默认 1px 细线，hover 扩为 4px 热区 */}
              <div
                onMouseDown={handleAgentTopResizeStart}
                className="h-px bg-border/60 hover:h-1 hover:bg-foreground/[0.08] cursor-row-resize titlebar-no-drag flex-shrink-0 transition-[height,background-color] duration-75"
              />
            </>
          )}

          {/* 下区标题：最近会话 */}
          <div className="px-3 pt-2 pb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-foreground/40 select-none flex-shrink-0">
            <span>最近会话</span>
            <span className="rounded-full border border-border-subtle/45 bg-surface-card/50 px-2 py-0.5 text-[10px] text-text-tertiary">
              {mode === 'agent' ? activeAgentSessionCount : activeConversationCount}
            </span>
          </div>

          {/* 下区：历史会话列表 */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-none min-h-0">
            {agentSessionGroups.map((group) => (
              <div key={group.label} className="mb-1">
                <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-foreground/40 select-none">
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((session) => (
                    <AgentSessionItem
                      key={session.id}
                      session={session}
                      active={session.id === activeTabId}
                      hovered={session.id === hoveredId}
                      indicatorStatus={agentIndicatorMap.get(session.id) ?? 'idle'}
                      isInWorkingSection={workingSessionIds.has(session.id)}
                      showPinIcon={!!session.pinned}
                      onSelect={() => handleSelectAgentSession(session.id, session.title)}
                      onRequestDelete={() => handleRequestDelete(session.id)}
                      onRequestMove={() => setMoveTargetId(session.id)}
                      onRename={handleAgentRename}
                      onTogglePin={handleTogglePinAgent}
                      onToggleManualWorking={handleToggleManualWorkingAgent}
                      onToggleArchive={handleToggleArchiveAgent}
                      onMouseEnter={() => setHoveredId(session.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 归档视图标题栏 */}
          {viewMode === 'archived' && (
            <div className="px-6 pt-3 pb-1">
              <div className="text-[12px] font-medium text-foreground/40">
                已归档{mode === 'agent' ? '会话' : '对话'}
              </div>
            </div>
          )}

          {/* Chat 模式 / 归档视图：单列表布局 */}
          <div className="flex-1 overflow-y-auto px-3 pt-2 pb-3 scrollbar-none">
            {mode === 'chat' ? (
              /* Chat 模式：对话按日期分组 */
              conversationGroups.map((group) => (
                <div key={group.label} className="mb-1">
                  <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-foreground/40 select-none">
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        active={conv.id === activeTabId}
                        hovered={conv.id === hoveredId}
                        streaming={streamingIds.has(conv.id)}
                        showPinIcon={!!conv.pinned}
                        onSelect={() => handleSelectConversation(conv.id, conv.title)}
                        onRequestDelete={() => handleRequestDelete(conv.id)}
                        onRename={handleRename}
                        onTogglePin={handleTogglePin}
                        onToggleArchive={handleToggleArchive}
                        onMouseEnter={() => setHoveredId(conv.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              /* Agent 模式归档：Agent 会话按日期分组 */
              agentSessionGroups.map((group) => (
                <div key={group.label} className="mb-1">
                  <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-foreground/40 select-none">
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((session) => (
                      <AgentSessionItem
                        key={session.id}
                        session={session}
                        active={session.id === activeTabId}
                        hovered={session.id === hoveredId}
                        indicatorStatus={agentIndicatorMap.get(session.id) ?? 'idle'}
                        isInWorkingSection={workingSessionIds.has(session.id)}
                        showPinIcon={!!session.pinned}
                        onSelect={() => handleSelectAgentSession(session.id, session.title)}
                        onRequestDelete={() => handleRequestDelete(session.id)}
                        onRequestMove={() => setMoveTargetId(session.id)}
                        onRename={handleAgentRename}
                        onTogglePin={handleTogglePinAgent}
                        onToggleManualWorking={handleToggleManualWorkingAgent}
                        onToggleArchive={handleToggleArchiveAgent}
                        onMouseEnter={() => setHoveredId(session.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 底部：归档 / 能力 / 用户 dock */}
      <div className="px-3 pb-2">
        <div className="agent-bottom-dock agent-bottom-dock--neon rounded-panel border border-border-subtle/55 bg-background/28 p-2 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-status-running-fg">Dock Bay</div>
            </div>
            <div className="rounded-full border border-border-subtle/45 bg-surface-card/55 px-2 py-0.5 text-[10px] text-text-tertiary">
              {viewMode === 'archived' ? 'ARCHIVE' : 'LIVE'}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {viewMode === 'active' ? (
              <>
                {mode === 'chat' && archivedConversationCount > 0 && (
                  <button
                    onClick={() => setViewMode('archived')}
                    className="agent-dock-link agent-dock-link--archive w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-left transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span className="agent-dock-icon agent-dock-icon--small">
                      <Archive size={13} />
                    </span>
                    <span className="agent-dock-meta flex min-w-0 flex-1 items-center gap-2">
                      <span className="text-[12px] font-medium text-text-primary">已归档</span>
                      <span className="text-[10px] text-text-tertiary">历史对话</span>
                    </span>
                    <span className="agent-dock-count">{archivedConversationCount}</span>
                  </button>
                )}
                {mode === 'agent' && archivedAgentSessionCount > 0 && (
                  <button
                    onClick={() => setViewMode('archived')}
                    className="agent-dock-link agent-dock-link--archive w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-left transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span className="agent-dock-icon agent-dock-icon--small">
                      <Archive size={13} />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="text-[12px] font-medium text-text-primary">已归档</span>
                      <span className="text-[10px] text-text-tertiary">历史会话</span>
                    </span>
                    <span className="agent-dock-count">{archivedAgentSessionCount}</span>
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => setViewMode('active')}
                className="agent-dock-link agent-dock-link--archive w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-left transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="agent-dock-icon agent-dock-icon--small">
                  <ArrowLeft size={13} />
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="text-[12px] font-medium text-text-primary">返回活跃{mode === 'agent' ? '会话' : '对话'}</span>
                </span>
              </button>
            )}

            {mode === 'agent' && capabilities && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setSettingsTab('agent'); setSettingsOpen(true) }}
                    className="agent-dock-link agent-dock-link--capabilities w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-left transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    aria-label="配置 MCP 与 Skills"
                  >
                    <span className="agent-dock-icon agent-dock-icon--accent agent-dock-icon--small">
                      <Plug size={13} />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="text-[12px] font-medium text-text-primary">能力</span>
                      <span className="inline-flex min-w-0 items-center gap-1 truncate text-[10px] text-text-tertiary">
                        <span className="tabular-nums text-text-primary">{capabilities.mcpServers.filter((s) => s.enabled).length}</span>
                        <span>MCP</span>
                        <span className="text-foreground/20">·</span>
                        <span className="tabular-nums text-text-primary">{capabilities.skills.length}</span>
                        <span>Skills</span>
                      </span>
                    </span>
                    <span className="agent-dock-arrow agent-dock-arrow--small shrink-0">
                      <Zap size={12} />
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">点击配置 MCP 与 Skills</TooltipContent>
              </Tooltip>
            )}

            <button
              onClick={() => setSettingsOpen(true)}
              className="agent-user-dock-button w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control transition-colors titlebar-no-drag text-text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <UserAvatar avatar={userProfile.avatar} size={26} />
              <span className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate text-[12px] font-medium">{userProfile.userName}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[10px] text-text-tertiary">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-running-fg" />
                    设置
                  </span>
                  {(hasUpdate || hasEnvironmentIssues) && (
                    <>
                      <span className="text-foreground/20">·</span>
                      <span className="text-status-danger">Attention</span>
                    </>
                  )}
                </span>
              </span>
              <div className="relative flex-shrink-0 text-foreground/40">
                <Settings size={16} />
                {(hasUpdate || hasEnvironmentIssues) && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-status-danger" aria-hidden="true" />
                )}
                {(hasUpdate || hasEnvironmentIssues) && (
                  <span className="sr-only">有更新或环境问题需要处理</span>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {deleteDialog}
      {moveDialog}
      <SearchDialog />
    </div>
  )
}

// ===== 对话列表项 =====

interface ConversationItemProps {
  conversation: ConversationMeta
  active: boolean
  hovered: boolean
  streaming: boolean
  /** 是否在标题旁显示 Pin 图标 */
  showPinIcon: boolean
  onSelect: () => void
  onRequestDelete: () => void
  onRename: (id: string, newTitle: string) => Promise<void>
  onTogglePin: (id: string) => Promise<void>
  onToggleArchive: (id: string) => Promise<void>
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function ConversationItem({
  conversation,
  active,
  hovered,
  streaming,
  showPinIcon,
  onSelect,
  onRequestDelete,
  onRename,
  onTogglePin,
  onToggleArchive,
  onMouseEnter,
  onMouseLeave,
}: ConversationItemProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const justStartedEditing = React.useRef(false)

  /** 进入编辑模式 */
  const startEdit = (): void => {
    setEditTitle(conversation.title)
    setEditing(true)
    justStartedEditing.current = true
    // 延迟聚焦，等待 ContextMenu 完全关闭后再 focus
    setTimeout(() => {
      justStartedEditing.current = false
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 300)
  }

  /** 保存标题 */
  const saveTitle = async (): Promise<void> => {
    // ContextMenu 关闭导致的 blur，忽略
    if (justStartedEditing.current) return
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === conversation.title) {
      setEditing(false)
      return
    }
    await onRename(conversation.id, trimmed)
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

  const handleRowKeyDown = (event: React.KeyboardEvent): void => {
    if (editing) return
    if (event.currentTarget !== event.target) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }

  const isPinned = !!conversation.pinned
  const actionsVisible = hovered && !editing
  const rowStatusLabel = streaming ? '，正在生成回复' : ''

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`对话：${conversation.title}${rowStatusLabel}`}
      onClick={onSelect}
      onKeyDown={handleRowKeyDown}
      onDoubleClick={(e) => {
        e.stopPropagation()
        startEdit()
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'agent-session-row relative w-full min-h-12 flex items-center gap-2 px-3 py-2.5 rounded-control transition-[background-color,color,box-shadow,transform,border-color] duration-fast titlebar-no-drag text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        active
          ? 'session-item-selected agent-session-row--active shadow-card'
          : 'agent-session-row--idle'
      )}
    >
      {/* 流式状态左侧竖线条（与 Agent 保持一致） */}
      {streaming && (
        <span
          className="absolute left-1 top-1.5 bottom-1.5 w-[2px] rounded-full bg-status-success animate-pulse pointer-events-none"
          aria-hidden="true"
        />
      )}
      {streaming && <span className="sr-only">正在生成回复</span>}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveTitle}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-transparent text-[13px] leading-5 text-foreground border-b border-primary/50 outline-none px-0 py-0"
            maxLength={100}
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className={cn(
              'truncate text-[13px] leading-5 flex items-center gap-1.5',
              active ? 'text-foreground' : 'text-foreground/82'
            )}>
              {showPinIcon && (
                <Pin size={11} className="flex-shrink-0 text-primary/60" />
              )}
              <span className="truncate">{conversation.title}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] leading-4 text-text-tertiary">
              {streaming ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border/60 bg-status-success-bg/60 px-1.5 py-0.5 text-status-success-fg">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
                  流式生成
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-border-subtle/45 bg-surface-card/55 px-1.5 py-0.5">
                  已保存
                </span>
              )}
              {isPinned && (
                <span className="inline-flex items-center rounded-full border border-border-subtle/45 bg-surface-card/55 px-1.5 py-0.5">
                  置顶
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮组（hover 时可见） */}
      <div className={cn(
        'flex items-center gap-0.5 flex-shrink-0 transition-all duration-fast overflow-hidden',
        actionsVisible ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'
      )}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTogglePin(conversation.id)
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={isPinned ? `取消置顶对话：${conversation.title}` : `置顶对话：${conversation.title}`}
              tabIndex={actionsVisible ? 0 : -1}
            >
              {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{isPinned ? '取消置顶' : '置顶对话'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation()
                startEdit()
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={`重命名对话：${conversation.title}`}
              tabIndex={actionsVisible ? 0 : -1}
            >
              <Pencil size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">重命名</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleArchive(conversation.id)
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={conversation.archived ? `取消归档对话：${conversation.title}` : `归档对话：${conversation.title}`}
              tabIndex={actionsVisible ? 0 : -1}
            >
              {conversation.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{conversation.archived ? '取消归档' : '归档'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRequestDelete()
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-status-danger-bg hover:text-status-danger-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={`删除对话：${conversation.title}`}
              tabIndex={actionsVisible ? 0 : -1}
            >
              <Trash2 size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">删除对话</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

// ===== Agent 会话列表项 =====

/** 会话行左侧状态色块的颜色 — 与 SessionIndicatorStatus 呼应 */
type SessionLeftAccent = 'waiting' | 'running' | 'success' | 'danger'
const SESSION_LEFT_ACCENT_CLASS: Record<SessionLeftAccent, string> = {
  waiting: 'bg-status-waiting',
  running: 'bg-status-running',
  success: 'bg-status-success',
  danger: 'bg-status-danger',
}
const SESSION_LEFT_ACCENT_LABEL: Record<SessionLeftAccent, string> = {
  waiting: '等待处理',
  running: '运行中',
  success: '已完成',
  danger: '需要处理',
}

interface AgentSessionItemProps {
  session: AgentSessionMeta
  active: boolean
  hovered: boolean
  indicatorStatus: SessionIndicatorStatus
  showPinIcon?: boolean
  /** 是否在工作中分区（auto 或 manual） */
  isInWorkingSection?: boolean
  /** 行左侧状态色块；未传则不显示 */
  leftAccent?: SessionLeftAccent
  /** 工作区名称 Badge（跨工作区列表时显示） */
  workspaceName?: string
  onSelect: () => void
  onRequestDelete: () => void
  onRequestMove: () => void
  onRename: (id: string, newTitle: string) => Promise<void>
  onTogglePin: (id: string) => Promise<void>
  onToggleManualWorking: (id: string) => Promise<void>
  onToggleArchive: (id: string) => Promise<void>
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function AgentSessionItem({
  session,
  active,
  hovered,
  indicatorStatus,
  showPinIcon,
  isInWorkingSection,
  leftAccent,
  workspaceName,
  onSelect,
  onRequestDelete,
  onRequestMove,
  onRename,
  onTogglePin,
  onToggleManualWorking,
  onToggleArchive,
  onMouseEnter,
  onMouseLeave,
}: AgentSessionItemProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const justStartedEditing = React.useRef(false)

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

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
    } else if (e.key === 'Escape') {
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

  const actionsVisible = hovered && !editing
  const leftAccentLabel = leftAccent ? SESSION_LEFT_ACCENT_LABEL[leftAccent] : null
  const rowStatusLabel = leftAccentLabel ? `，${leftAccentLabel}` : ''

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Agent 会话：${session.title}${rowStatusLabel}`}
      onClick={onSelect}
      onKeyDown={handleRowKeyDown}
      onDoubleClick={(e) => {
        e.stopPropagation()
        startEdit()
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'agent-session-row relative w-full min-h-12 flex items-center gap-2 px-3 py-2.5 rounded-control transition-[background-color,color,box-shadow,transform,border-color] duration-fast titlebar-no-drag text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        active
          ? 'session-item-selected agent-session-row--active shadow-card'
          : 'agent-session-row--idle'
      )}
    >
      {leftAccent && (
        <span
          className={cn(
            'absolute left-1 top-1.5 bottom-1.5 w-[2px] rounded-full pointer-events-none',
            SESSION_LEFT_ACCENT_CLASS[leftAccent]
          )}
        />
      )}
      {leftAccentLabel && <span className="sr-only">{leftAccentLabel}</span>}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveTitle}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-transparent text-[13px] leading-5 text-foreground border-b border-primary/50 outline-none px-0 py-0"
            maxLength={100}
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className={cn(
              'truncate text-[13px] leading-5 flex items-center gap-1.5',
              active ? 'text-foreground' : 'text-foreground/82'
            )}>
              {showPinIcon && (
                <Pin size={11} className="flex-shrink-0 text-primary/60" />
              )}
              <span className="truncate">{session.title}</span>
              {workspaceName && (
                <span className="flex-shrink-0 max-w-[90px] truncate rounded-full border border-border-subtle/45 bg-surface-card/55 px-1.5 py-0 text-[10px] leading-4 text-text-tertiary">
                  {workspaceName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] leading-4 text-text-tertiary">
              <span className="inline-flex items-center rounded-full border border-border-subtle/45 bg-surface-card/55 px-1.5 py-0.5">
                {indicatorStatus === 'running'
                  ? '运行中'
                  : indicatorStatus === 'failed'
                    ? '异常'
                    : indicatorStatus === 'blocked'
                      ? '阻塞'
                      : indicatorStatus === 'completed'
                        ? '已完成'
                        : '待处理'}
              </span>
              {isInWorkingSection && (
                <span className="inline-flex items-center rounded-full border border-status-running-border/60 bg-status-running-bg/55 px-1.5 py-0.5 text-status-running-fg">
                  Working
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮组（hover 时可见） */}
      <div className={cn(
        'flex items-center gap-0.5 flex-shrink-0 transition-all duration-fast overflow-hidden',
        actionsVisible ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'
      )}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTogglePin(session.id)
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={session.pinned ? `取消置顶会话：${session.title}` : `置顶会话：${session.title}`}
              tabIndex={actionsVisible ? 0 : -1}
            >
              {session.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{session.pinned ? '取消置顶' : '置顶会话'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (indicatorStatus !== 'running') {
                  onToggleManualWorking(session.id)
                }
              }}
              disabled={indicatorStatus === 'running'}
              className={cn(
                'p-1 rounded-control transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                indicatorStatus === 'running'
                  ? 'text-primary/40 cursor-not-allowed'
                  : (isInWorkingSection || session.manualWorking)
                    ? 'text-primary hover:bg-surface-muted'
                    : 'text-text-tertiary hover:bg-surface-muted hover:text-text-primary'
              )}
              aria-label={
                indicatorStatus === 'running'
                  ? `运行中无法移出工作中：${session.title}`
                  : (isInWorkingSection || session.manualWorking)
                    ? `取消工作中：${session.title}`
                    : `标记为工作中：${session.title}`
              }
              tabIndex={actionsVisible ? 0 : -1}
            >
              <Hammer size={13} className={(isInWorkingSection || session.manualWorking) ? 'fill-current' : ''} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {indicatorStatus === 'running'
              ? '运行中无法移出'
              : (isInWorkingSection || session.manualWorking) ? '取消工作中' : '标记为工作中'}
          </TooltipContent>
        </Tooltip>
        {(indicatorStatus !== 'running' && indicatorStatus !== 'blocked' && indicatorStatus !== 'failed') && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRequestMove()
                }}
                className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label={`迁移会话到其他工作区：${session.title}`}
                tabIndex={actionsVisible ? 0 : -1}
              >
                <ArrowRightLeft size={13} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">迁移到其他工作区</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation()
                startEdit()
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={`重命名会话：${session.title}`}
              tabIndex={actionsVisible ? 0 : -1}
            >
              <Pencil size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">重命名</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleArchive(session.id)
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={session.archived ? `取消归档会话：${session.title}` : `归档会话：${session.title}`}
              tabIndex={actionsVisible ? 0 : -1}
            >
              {session.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{session.archived ? '取消归档' : '归档'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRequestDelete()
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-status-danger-bg hover:text-status-danger-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={`删除会话：${session.title}`}
              tabIndex={actionsVisible ? 0 : -1}
            >
              <Trash2 size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">删除会话</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

/**
 * FileBrowser — 通用文件浏览器面板
 *
 * 显示指定根路径下的文件树，支持：
 * - 文件夹懒加载展开（Chevron 旋转动画）
 * - 单击选中、Cmd/Ctrl+Click 多选
 * - 选中后显示三点菜单（打开 / 在文件夹中显示 / 重命名 / 移动 / 删除）
 * - 文件/文件夹删除（带确认对话框）
 * - 原位重命名（含同名检查）
 * - 自动刷新
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { toast } from 'sonner'
import {
  ChevronRight,
  Trash2,
  RefreshCw,
  ExternalLink,
  FolderSearch,
  MoreHorizontal,
  FolderInput,
  Pencil,
  MessageSquarePlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { workspaceFilesVersionAtom, fileBrowserAutoRevealAtom, recentlyModifiedPathsAtom, currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { getParentPath, getPathDisplay } from '@/components/ui6-view-model'
import type { FileEntry } from '@codeinsights/shared'
import { FileTypeIcon } from './FileTypeIcon'

/** 计算目标路径相对 rootPath 的祖先目录集合（不含 rootPath 自身、含目标的所有上级） */
function computeRevealAncestors(rootPath: string, targetPath: string): Set<string> {
  const ancestors = new Set<string>()
  if (!rootPath || !targetPath) return ancestors
  // 归一化：移除尾部分隔符
  const root = rootPath.replace(/[/\\]+$/, '')
  if (targetPath === root) return ancestors
  const sep = targetPath.includes('\\') ? '\\' : '/'
  if (!targetPath.startsWith(root + sep)) return ancestors
  // 取相对 root 的部分，逐级累加
  const relative = targetPath.slice(root.length + sep.length)
  const parts = relative.split(/[/\\]/).filter(Boolean)
  // 文件本身不算祖先，只到父目录
  let current = root
  for (let i = 0; i < parts.length - 1; i++) {
    current = current + sep + parts[i]
    ancestors.add(current)
  }
  return ancestors
}

/** 判断目标路径是否落在 rootPath 内 */
function isPathUnderRoot(rootPath: string, targetPath: string): boolean {
  if (!rootPath || !targetPath) return false
  const root = rootPath.replace(/[/\\]+$/, '')
  if (targetPath === root) return true
  return targetPath.startsWith(root + '/') || targetPath.startsWith(root + '\\')
}

interface FileBrowserProps {
  rootPath: string
  /** 隐藏内置顶部工具栏（面包屑 + 按钮），由外部自行渲染 */
  hideToolbar?: boolean
  /** 嵌入模式：不使用内部 ScrollArea 和 h-full，由外部容器控制布局和滚动 */
  embedded?: boolean
  /** 隐藏"目录为空"提示（当外部已有附加目录等内容时使用） */
  hideEmpty?: boolean
  /** 点击添加到聊天（非文件夹文件悬浮时显示按钮） */
  onAddToChat?: (entry: FileEntry) => void
}

export function FileBrowser({ rootPath, hideToolbar, embedded, hideEmpty, onAddToChat }: FileBrowserProps): React.ReactElement {
  const [entries, setEntries] = React.useState<FileEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const filesVersion = useAtomValue(workspaceFilesVersionAtom)

  // ===== Agent 写入文件时的自动定位 =====
  const autoReveal = useAtomValue(fileBrowserAutoRevealAtom)
  // 仅当目标路径落在本实例 rootPath 内才响应；以 ts 标识本次脉冲
  const revealForThisRoot = React.useMemo(() => {
    if (!autoReveal || !rootPath) return null
    if (!isPathUnderRoot(rootPath, autoReveal.path)) return null
    return autoReveal
  }, [autoReveal, rootPath])
  const revealAncestors = React.useMemo(
    () => revealForThisRoot ? computeRevealAncestors(rootPath, revealForThisRoot.path) : new Set<string>(),
    [revealForThisRoot, rootPath],
  )
  const revealTarget = revealForThisRoot?.path ?? null
  const revealTs = revealForThisRoot?.ts ?? 0

  // ===== 最近修改的文件路径（60s 内显示左侧竖条） =====
  const recentlyModifiedMap = useAtomValue(recentlyModifiedPathsAtom)
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const recentlyModifiedSet = React.useMemo<Set<string>>(() => {
    if (!currentSessionId) return new Set()
    const inner = recentlyModifiedMap.get(currentSessionId)
    if (!inner) return new Set()
    // 仅保留落在本实例 rootPath 下的路径
    const set = new Set<string>()
    for (const p of inner.keys()) {
      if (isPathUnderRoot(rootPath, p)) set.add(p)
    }
    return set
  }, [recentlyModifiedMap, currentSessionId, rootPath])

  // 选中状态
  const [selectedPaths, setSelectedPaths] = React.useState<Set<string>>(new Set())
  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = React.useState<FileEntry | null>(null)
  const [deleteCount, setDeleteCount] = React.useState(1)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  // 重命名状态
  const [renamingPath, setRenamingPath] = React.useState<string | null>(null)
  // 移动中状态
  const [moving, setMoving] = React.useState(false)

  const selectedCount = selectedPaths.size

  /** 加载根目录 */
  const loadRoot = React.useCallback(async () => {
    if (!rootPath) return
    setLoading(true)
    setError(null)
    try {
      const items = await window.electronAPI.listDirectory(rootPath)
      setEntries(items)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败'
      setError(msg)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [rootPath])

  React.useEffect(() => {
    loadRoot()
  }, [loadRoot, filesVersion])

  /** 选中项 */
  const handleSelect = React.useCallback((entry: FileEntry, event: Pick<React.MouseEvent | React.KeyboardEvent, 'metaKey' | 'ctrlKey'>) => {
    const isMulti = event.metaKey || event.ctrlKey
    if (isMulti) {
      setSelectedPaths((prev) => {
        const next = new Set(prev)
        if (next.has(entry.path)) {
          next.delete(entry.path)
        } else {
          next.add(entry.path)
        }
        return next
      })
    } else {
      setSelectedPaths(new Set([entry.path]))
    }
  }, [])

  /** 点击空白区域清空选中 */
  const handleBackgroundClick = React.useCallback((e: React.MouseEvent) => {
    // 只处理直接点击容器的情况
    if (e.target === e.currentTarget) {
      setSelectedPaths(new Set())
    }
  }, [])

  /** 在文件夹中显示 */
  const handleShowInFolder = React.useCallback((entry: FileEntry) => {
    window.electronAPI.showInFolder(entry.path).catch(console.error)
  }, [])

  /** 开始重命名 */
  const handleStartRename = React.useCallback((entry: FileEntry) => {
    setRenamingPath(entry.path)
  }, [])

  /** 取消重命名 */
  const handleCancelRename = React.useCallback(() => {
    setRenamingPath(null)
  }, [])

  /** 执行重命名 */
  const handleRename = React.useCallback(async (filePath: string, newName: string): Promise<string | null> => {
    // 同名检查
    const parentDir = getParentPath(filePath)
    try {
      const siblings = await window.electronAPI.listDirectory(parentDir)
      const conflict = siblings.some((s) => s.name === newName && s.path !== filePath)
      if (conflict) {
        return '同名文件已存在'
      }
    } catch {
      // 无法列出目录，跳过检查
    }

    try {
      await window.electronAPI.renameFile(filePath, newName)
      await loadRoot()
      setRenamingPath(null)
      setSelectedPaths(new Set())
      return null
    } catch (err) {
      return err instanceof Error ? err.message : '重命名失败'
    }
  }, [loadRoot])

  /** 触发删除（支持多选） */
  const handleRequestDelete = React.useCallback((entry: FileEntry) => {
    setDeleteError(null)
    setDeleteTarget(entry)
    setDeleteCount(selectedCount > 1 ? selectedCount : 1)
  }, [selectedCount])

  /** 执行删除 */
  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      if (selectedPaths.size > 1) {
        // 批量删除
        for (const path of selectedPaths) {
          await window.electronAPI.deleteFile(path)
        }
      } else {
        await window.electronAPI.deleteFile(deleteTarget.path)
      }
      setSelectedPaths(new Set())
      await loadRoot()
      setDeleteTarget(null)
    } catch (err) {
      console.error('[FileBrowser] 删除失败:', err)
      setDeleteError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, selectedPaths, loadRoot])

  /** 移动文件 */
  const handleMove = React.useCallback(async (entry: FileEntry) => {
    setMoving(true)
    try {
      const result = await window.electronAPI.openFolderDialog()
      if (!result) return

      if (selectedPaths.size > 1) {
        for (const path of selectedPaths) {
          await window.electronAPI.moveFile(path, result.path)
        }
      } else {
        await window.electronAPI.moveFile(entry.path, result.path)
      }
      setSelectedPaths(new Set())
      await loadRoot()
    } catch (err) {
      console.error('[FileBrowser] 移动失败:', err)
      toast.error(err instanceof Error ? err.message : '移动失败')
    } finally {
      setMoving(false)
    }
  }, [selectedPaths, loadRoot])

  // 显示根路径最后两段作为面包屑
  const breadcrumb = React.useMemo(() => {
    return getPathDisplay(rootPath, 2)
  }, [rootPath])

  const fileTree = (
    <div className="agent-file-tree py-1" onClick={handleBackgroundClick}>
      {error && (
        <div className="mx-2 rounded-card bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{error}</div>
      )}
      {!error && loading && (
        <div className="px-3 py-3 text-xs text-muted-foreground" role="status">正在加载文件...</div>
      )}
      {!error && entries.length === 0 && !loading && !hideEmpty && (
        <div className="agent-file-empty mx-2 rounded-card border border-dashed border-border-subtle px-3 py-5 text-center text-xs text-muted-foreground">
          此文件夹为空
        </div>
      )}
      {entries.length > 0 && (
        <div role="tree" aria-label="文件树">
          {entries.map((entry) => (
            <FileTreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              selectedPaths={selectedPaths}
              selectedCount={selectedCount}
              renamingPath={renamingPath}
              moving={moving}
              refreshVersion={filesVersion}
              revealAncestors={revealAncestors}
              revealTarget={revealTarget}
              revealTs={revealTs}
              recentlyModifiedSet={recentlyModifiedSet}
              onSelect={handleSelect}
              onShowInFolder={handleShowInFolder}
              onStartRename={handleStartRename}
              onCancelRename={handleCancelRename}
              onRename={handleRename}
              onDelete={handleRequestDelete}
              onMove={handleMove}
              onRefresh={loadRoot}
              onAddToChat={onAddToChat}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className={cn('flex flex-col', !embedded && 'h-full')}>
      {/* 顶部工具栏（可由外部接管） */}
      {!hideToolbar && (
        <div className="flex items-center gap-1 px-3 pr-10 h-[48px] border-b flex-shrink-0">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" title={rootPath}>
            {breadcrumb}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={() => window.electronAPI.openFile(rootPath).catch(console.error)}
            title="在 Finder 中打开"
            aria-label="在 Finder 中打开"
          >
            <ExternalLink className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={loadRoot}
            disabled={loading}
            aria-label="刷新文件树"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      )}

      {/* 文件树 */}
      {embedded ? fileTree : (
        <ScrollArea className="flex-1">
          {fileTree}
        </ScrollArea>
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) { setDeleteTarget(null); setDeleteError(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {deleteCount > 1 ? (
                <>确定要删除选中的 <strong>{deleteCount}</strong> 个项目吗？</>
              ) : (
                <>
                  确定要删除 <strong>{deleteTarget?.name}</strong> 吗？
                  {deleteTarget?.isDirectory && '（包含所有子文件）'}
                </>
              )}
              <span className="block">此操作不可撤销。请先确认完整路径：</span>
              <span className="block max-h-24 overflow-auto whitespace-pre-wrap rounded-control bg-surface-muted px-2 py-1.5 font-mono text-[11px] text-text-primary">
                {deleteCount > 1
                  ? Array.from(selectedPaths).map((path) => path).join('\n')
                  : deleteTarget?.path}
              </span>
            </AlertDialogDescription>
            {deleteError && (
              <div className="rounded-control bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
                {deleteError}
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===== FileTreeItem 子组件 =====

interface FileTreeItemProps {
  entry: FileEntry
  depth: number
  selectedPaths: Set<string>
  selectedCount: number
  renamingPath: string | null
  moving: boolean
  /** 文件版本号，变化时已展开的文件夹自动重新加载子项 */
  refreshVersion: number
  /** 自动定位：祖先目录路径集合（命中则自动展开） */
  revealAncestors: Set<string>
  /** 自动定位：目标文件路径（命中则滚动 + 高亮脉冲） */
  revealTarget: string | null
  /** 自动定位脉冲时间戳，变化时重新触发 */
  revealTs: number
  /** 最近修改的路径集合（命中则在行左侧显示竖条标记） */
  recentlyModifiedSet: Set<string>
  onSelect: (entry: FileEntry, event: Pick<React.MouseEvent | React.KeyboardEvent, 'metaKey' | 'ctrlKey'>) => void
  onShowInFolder: (entry: FileEntry) => void
  onStartRename: (entry: FileEntry) => void
  onCancelRename: () => void
  onRename: (filePath: string, newName: string) => Promise<string | null>
  onDelete: (entry: FileEntry) => void
  onMove: (entry: FileEntry) => void
  onRefresh: () => Promise<void>
  onAddToChat?: (entry: FileEntry) => void
}

function FileTreeItem({
  entry,
  depth,
  selectedPaths,
  selectedCount,
  renamingPath,
  moving,
  refreshVersion,
  revealAncestors,
  revealTarget,
  revealTs,
  recentlyModifiedSet,
  onSelect,
  onShowInFolder,
  onStartRename,
  onCancelRename,
  onRename,
  onDelete,
  onMove,
  onRefresh,
  onAddToChat,
}: FileTreeItemProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)
  const [children, setChildren] = React.useState<FileEntry[]>([])
  const [childrenLoaded, setChildrenLoaded] = React.useState(false)
  const [flash, setFlash] = React.useState(false)
  const rowRef = React.useRef<HTMLDivElement>(null)

  // 当 refreshVersion 变化时，已展开的文件夹自动重新加载子项
  React.useEffect(() => {
    if (expanded && childrenLoaded && entry.isDirectory) {
      window.electronAPI.listDirectory(entry.path)
        .then((items) => setChildren(items))
        .catch((err) => console.error('[FileTreeItem] 刷新子目录失败:', err))
    }
  }, [refreshVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Agent 自动定位：祖先目录自动展开 + 目标行滚动到中心 + 0.8s 高亮脉冲 =====
  React.useEffect(() => {
    if (revealTs === 0) return
    // 祖先目录：自动展开（必要时加载子项）
    if (entry.isDirectory && revealAncestors.has(entry.path) && !expanded) {
      let cancelled = false
      const run = async (): Promise<void> => {
        if (!childrenLoaded) {
          try {
            const items = await window.electronAPI.listDirectory(entry.path)
            if (!cancelled) {
              setChildren(items)
              setChildrenLoaded(true)
            }
          } catch (err) {
            console.error('[FileTreeItem] reveal 加载子目录失败:', err)
            return
          }
        }
        if (!cancelled) setExpanded(true)
      }
      run()
      return () => { cancelled = true }
    }
    // 目标行：滚动到可视区中心 + 高亮脉冲
    if (revealTarget && entry.path === revealTarget) {
      // 等下一帧渲染稳定后再 scroll
      requestAnimationFrame(() => {
        rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1200)
      return () => clearTimeout(t)
    }
  }, [revealTs]) // eslint-disable-line react-hooks/exhaustive-deps

  // 重命名编辑状态
  const [editName, setEditName] = React.useState('')
  const [renameError, setRenameError] = React.useState<string | null>(null)
  const renameInputRef = React.useRef<HTMLInputElement>(null)
  const justStartedEditing = React.useRef(false)

  const isSelected = selectedPaths.has(entry.path)
  const isRenaming = renamingPath === entry.path

  /** 展开/收起文件夹 */
  const toggleDir = async (): Promise<void> => {
    if (!entry.isDirectory) return

    if (!expanded && !childrenLoaded) {
      try {
        const items = await window.electronAPI.listDirectory(entry.path)
        setChildren(items)
        setChildrenLoaded(true)

        // 首次展开空目录时，延迟重试一次（应对 Agent 正在写入文件的时序问题）
        if (items.length === 0) {
          setTimeout(async () => {
            try {
              const retryItems = await window.electronAPI.listDirectory(entry.path)
              if (retryItems.length > 0) setChildren(retryItems)
            } catch { /* 静默忽略 */ }
          }, 800)
        }
      } catch (err) {
        console.error('[FileTreeItem] 加载子目录失败:', err)
      }
    }

    setExpanded(!expanded)
  }

  /** 点击行为：选中 + 文件夹展开/收起 */
  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onSelect(entry, e)
    if (entry.isDirectory && !e.metaKey && !e.ctrlKey) {
      toggleDir()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (isRenaming) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(entry, e)
      if (entry.isDirectory) void toggleDir()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const currentRow = rowRef.current
      if (!currentRow) return
      const tree = currentRow.closest('[role="tree"]')
      const items = Array.from(tree?.querySelectorAll<HTMLElement>('[role="treeitem"][tabindex="0"]') ?? [])
      const currentIndex = items.indexOf(currentRow)
      if (currentIndex === -1) return
      const offset = e.key === 'ArrowDown' ? 1 : -1
      const next = items[currentIndex + offset]
      next?.focus()
    } else if (e.key === 'ArrowRight' && entry.isDirectory && !expanded) {
      e.preventDefault()
      void toggleDir()
    } else if (e.key === 'ArrowLeft' && entry.isDirectory && expanded) {
      e.preventDefault()
      setExpanded(false)
    }
  }

  /** 双击预览文件 */
  const handleDoubleClick = (): void => {
    if (!entry.isDirectory) {
      window.electronAPI.previewFile(entry.path).catch(console.error)
    }
  }

  /** 删除后刷新子目录 */
  const handleRefreshAfterDelete = async (): Promise<void> => {
    if (childrenLoaded) {
      try {
        const items = await window.electronAPI.listDirectory(entry.path)
        setChildren(items)
      } catch {
        await onRefresh()
      }
    }
  }

  // 进入重命名编辑模式
  React.useEffect(() => {
    if (isRenaming) {
      setEditName(entry.name)
      setRenameError(null)
      justStartedEditing.current = true
      const timer = setTimeout(() => {
        justStartedEditing.current = false
        const input = renameInputRef.current
        if (input) {
          input.focus()
          // 只选中文件名部分，不包括后缀
          const lastDotIndex = entry.name.lastIndexOf('.')
          if (lastDotIndex > 0 && !entry.isDirectory) {
            input.setSelectionRange(0, lastDotIndex)
          } else {
            input.select()
          }
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isRenaming, entry.name, entry.isDirectory])

  /** 保存重命名 */
  const saveRename = async (): Promise<void> => {
    if (justStartedEditing.current) return

    const trimmed = editName.trim()
    if (!trimmed || trimmed === entry.name) {
      onCancelRename()
      return
    }
    const error = await onRename(entry.path, trimmed)
    if (error) {
      setRenameError(error)
    }
  }

  /** 重命名键盘事件 */
  const handleRenameKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void saveRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancelRename()
    }
  }

  /** 重命名失焦 */
  const handleBlur = (): void => {
    if (renameError) {
      return
    } else {
      void saveRename()
    }
  }

  const paddingLeft = 8 + depth * 16
  const showMenu = isSelected && selectedCount > 0 && !isRenaming
  const itemId = React.useId()

  return (
    <>
      <div
        ref={rowRef}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={entry.isDirectory ? expanded : undefined}
        aria-level={depth + 1}
        tabIndex={isRenaming ? -1 : 0}
        className={cn(
          'agent-file-row group relative mx-2 flex min-h-9 cursor-pointer items-center gap-1 rounded-lg py-1.5 pr-2 text-sm transition-[background-color,color,box-shadow,transform] duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          isSelected ? 'agent-file-row--selected text-foreground shadow-sm before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-primary' : 'agent-file-row--idle',
          flash && 'file-browser-row-flash',
        )}
        data-selected={isSelected ? 'true' : undefined}
        style={{ paddingLeft }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        title={entry.path}
      >
        {recentlyModifiedSet.has(entry.path) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                aria-label="最近被 Agent 修改"
              className="agent-file-modified-dot absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                style={{ left: paddingLeft - 6 }}
              />
            </TooltipTrigger>
            <TooltipContent side="right">最近被 Agent 修改</TooltipContent>
          </Tooltip>
        )}
        {/* 展开/收起图标 */}
        {entry.isDirectory ? (
          <ChevronRight
              className={cn(
                'size-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}

        {/* 文件/文件夹图标 */}
        <FileTypeIcon name={entry.name} isDirectory={entry.isDirectory} isOpen={expanded} />

        {/* 文件名 / 重命名输入框 */}
        {isRenaming ? (
          <div className="flex-1 min-w-0">
            <input
              ref={renameInputRef}
              id={itemId}
              value={editName}
              onChange={(e) => { setEditName(e.target.value); setRenameError(null) }}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleBlur}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full bg-transparent text-xs border-b py-0.5 outline-none focus-visible:ring-0',
                renameError ? 'border-destructive' : 'border-primary/50',
              )}
              aria-label={`重命名 ${entry.name}`}
              aria-invalid={renameError ? true : undefined}
              aria-describedby={renameError ? `${itemId}-error` : undefined}
              maxLength={255}
            />
            {renameError && (
              <div id={`${itemId}-error`} className="text-[10px] text-destructive mt-0.5">{renameError}</div>
            )}
          </div>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{entry.name}</span>
        )}

        {/* 右侧操作按钮占位（始终占位，避免行高跳动） */}
        <div
          className={cn(
            'flex-shrink-0',
            !(showMenu || (onAddToChat && !entry.isDirectory && !isRenaming)) && 'invisible',
          )}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 非文件夹：添加到聊天按钮（悬浮时显示） */}
          {onAddToChat && !entry.isDirectory && !isRenaming && !showMenu && (
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-control text-muted-foreground opacity-0 transition-opacity hover:bg-surface-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus group-hover:opacity-100 group-focus-within:opacity-100"
              title="添加到聊天"
              aria-label="添加到聊天"
              tabIndex={0}
              onClick={() => onAddToChat(entry)}
            >
              <MessageSquarePlus className="size-3.5" />
            </button>
          )}
          {/* 文件夹/选中状态：三点菜单 */}
          {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-control text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label={`${selectedCount > 1 ? `选中的 ${selectedCount} 个项目` : entry.name} 的更多操作`}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 z-[9999] min-w-0 p-0.5">
                {onAddToChat && !entry.isDirectory && selectedCount === 1 && (
                  <DropdownMenuItem
                    className="text-xs py-1 [&>svg]:size-3.5"
                    onSelect={() => onAddToChat(entry)}
                  >
                    <MessageSquarePlus />
                    添加到聊天
                  </DropdownMenuItem>
                )}
                {selectedCount === 1 && (
                  <DropdownMenuItem
                    className="text-xs py-1 [&>svg]:size-3.5"
                    onSelect={() => onShowInFolder(entry)}
                  >
                    <FolderSearch />
                    在文件夹中显示
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-xs py-1 [&>svg]:size-3.5"
                  disabled={moving}
                  onSelect={() => { void onMove(entry) }}
                >
                  <FolderInput />
                  {selectedCount > 1 ? `移动选中 (${selectedCount})` : '移动到...'}
                </DropdownMenuItem>
                {selectedCount === 1 && (
                  <DropdownMenuItem
                    className="text-xs py-1 [&>svg]:size-3.5"
                    onSelect={() => onStartRename(entry)}
                  >
                    <Pencil />
                    重命名
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="my-0.5" />
                <DropdownMenuItem
                  className="text-xs py-1 [&>svg]:size-3.5 text-destructive"
                  onSelect={() => onDelete(entry)}
                >
                  <Trash2 />
                  {selectedCount > 1 ? `删除选中 (${selectedCount})` : '删除'}
                </DropdownMenuItem>
              </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </div>

      {/* 子项 */}
      {expanded && childrenLoaded && (
        <div role="group">
          {children.length === 0 ? (
            <div
              role="treeitem"
              aria-level={depth + 2}
              className="py-1 text-[11px] text-muted-foreground/60"
              style={{ paddingLeft: paddingLeft + 24 }}
            >
              此文件夹为空
            </div>
          ) : children.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedPaths={selectedPaths}
              selectedCount={selectedCount}
              renamingPath={renamingPath}
              moving={moving}
              refreshVersion={refreshVersion}
              revealAncestors={revealAncestors}
              revealTarget={revealTarget}
              revealTs={revealTs}
              recentlyModifiedSet={recentlyModifiedSet}
              onSelect={onSelect}
              onShowInFolder={onShowInFolder}
              onStartRename={onStartRename}
              onCancelRename={onCancelRename}
              onRename={onRename}
              onDelete={onDelete}
              onMove={onMove}
              onRefresh={handleRefreshAfterDelete}
              onAddToChat={onAddToChat}
            />
          ))}
        </div>
      )}
    </>
  )
}

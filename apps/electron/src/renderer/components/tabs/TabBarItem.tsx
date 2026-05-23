/**
 * TabBarItem — 单个标签页 UI
 *
 * 显示：类型图标 + 标题 + 流式指示器 + 关闭按钮
 * 支持：点击聚焦、中键关闭、拖拽重排
 * hover 预览面板由父级 TabBar 统一管理状态
 */

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useAtomValue } from 'jotai'
import { MessageSquare, Bot, X, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TabType, TabMinimapItem } from '@/atoms/tab-atoms'
import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'
import { tabMinimapCacheAtom } from '@/atoms/tab-atoms'
import { TabPreviewPanel } from './TabPreviewPanel'
import { getTabStatusVisuals } from './tab-status-visuals'

export interface TabBarItemProps {
  id: string
  type: TabType
  title: string
  isActive: boolean
  isStreaming: SessionIndicatorStatus
  /** 是否显示 hover 预览面板（由父级管理） */
  isHovered: boolean
  /** 预览面板是否正在退出动画 */
  isLeaving: boolean
  onActivate: () => void
  onKeyDown: (event: React.KeyboardEvent) => void
  onClose: () => void
  onMiddleClick: () => void
  onDragStart: (e: React.PointerEvent) => void
  /** hover 进入 Tab */
  onHoverEnter: () => void
  /** hover 离开 Tab */
  onHoverLeave: () => void
  /** hover 进入面板（阻止关闭） */
  onPanelHoverEnter: () => void
  /** hover 离开面板 */
  onPanelHoverLeave: () => void
}

export function TabBarItem({
  id,
  type,
  title,
  isActive,
  isStreaming,
  isHovered,
  isLeaving,
  onActivate,
  onKeyDown,
  onClose,
  onMiddleClick,
  onDragStart,
  onHoverEnter,
  onHoverLeave,
  onPanelHoverEnter,
  onPanelHoverLeave,
}: TabBarItemProps): React.ReactElement {
  const tabRef = React.useRef<HTMLDivElement>(null)
  const [isNarrow, setIsNarrow] = React.useState(false)
  const minimapCache = useAtomValue(tabMinimapCacheAtom)

  React.useEffect(() => {
    const el = tabRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setIsNarrow(entry.contentRect.width < 72)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleMouseDown = (e: React.MouseEvent): void => {
    if (e.button === 1) {
      e.preventDefault()
      onMiddleClick()
    }
  }

  const handleCloseClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onClose()
  }

  const stopClosePointer = (event: React.PointerEvent | React.MouseEvent): void => {
    event.stopPropagation()
  }

  const Icon = type === 'chat' ? MessageSquare : type === 'pipeline' ? GitBranch : Bot
  const statusVisuals = getTabStatusVisuals(isStreaming, type)
  const previewItems = minimapCache.get(id) ?? []
  // 当前 active Tab 不显示预览面板
  const showPreview = isHovered && !isActive
  const tabLabel = `${type === 'pipeline' ? 'Pipeline' : type === 'agent' ? 'Agent' : 'Chat'} 标签：${title || '未命名标签'}${statusVisuals.label ? `，${statusVisuals.label}` : ''}`

  return (
    <div
      className="relative flex-1 min-w-[48px] max-w-[200px]"
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <div
        ref={tabRef}
        className={cn(
          'group relative flex items-center gap-1.5 h-[34px] w-full rounded-t-lg text-xs',
          'transition-[background-color,border-color,color,box-shadow] duration-fast select-none',
          'border-t border-l border-r border-transparent',
          isActive
            ? 'bg-surface-panel text-text-primary border-border-subtle/60 shadow-[0_-1px_0_hsl(var(--surface-panel))_inset]'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted/70',
        )}
        title={statusVisuals.tooltip ?? title}
        onMouseDown={handleMouseDown}
        onPointerDown={onDragStart}
      >
        <button
          id={`tab-trigger-${id}`}
          type="button"
          role="tab"
          aria-selected={isActive}
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-tl-lg px-3 pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-0"
          aria-label={tabLabel}
          tabIndex={isActive ? 0 : -1}
          onClick={onActivate}
          onKeyDown={onKeyDown}
        >
          {/* 类型图标 */}
          <Icon className={cn('shrink-0', isNarrow ? 'size-3.5' : 'size-3')} />

          {/* 标题（窄状态下隐藏，用 spacer 撑开让关闭按钮靠右） */}
          {isNarrow ? (
            <span className="flex-1" />
          ) : (
            <span className="flex-1 min-w-0 truncate text-left">{title}</span>
          )}
        </button>

        {/* 关闭按钮 */}
        <button
          type="button"
          aria-label={`关闭标签：${title || '未命名标签'}`}
          title={`关闭标签：${title || '未命名标签'}`}
          className={cn(
            'size-5 rounded-control flex items-center justify-center shrink-0',
            'opacity-0 group-hover:opacity-100 hover:bg-surface-muted hover:text-text-primary transition-[opacity,background-color,color] duration-fast',
            'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
            isActive && 'opacity-60',
          )}
          onMouseDown={stopClosePointer}
          onPointerDown={stopClosePointer}
          onClick={handleCloseClick}
        >
          <X className="size-2.5" />
        </button>

        {/* 底部状态横线条 */}
        {statusVisuals.lineClassName && (
          <span
            className={cn(
              'absolute left-2 right-2 bottom-0 h-[2px] rounded-full pointer-events-none',
              statusVisuals.lineClassName,
              statusVisuals.pulsing && 'animate-pulse',
            )}
            aria-hidden="true"
          />
        )}
      </div>

      {/* 悬浮预览面板（Portal 渲染到 body） */}
      {showPreview && (
        <TabPreviewDropdown
          buttonRef={tabRef}
          title={title}
          items={previewItems}
          isLeaving={isLeaving}
          onMouseEnter={onPanelHoverEnter}
          onMouseLeave={onPanelHoverLeave}
        />
      )}
    </div>
  )
}

/** 使用 Portal 渲染到 body，避免被容器 overflow 裁剪或被内容区遮盖 */
function TabPreviewDropdown({
  buttonRef,
  title,
  items,
  isLeaving,
  onMouseEnter,
  onMouseLeave,
}: {
  buttonRef: React.RefObject<HTMLDivElement | null>
  title: string
  items: TabMinimapItem[]
  isLeaving: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}): React.ReactElement | null {
  const panelWidth = 280
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)

  React.useLayoutEffect(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const top = rect.bottom
    let left = rect.left
    if (left + panelWidth > viewportWidth - 8) {
      left = viewportWidth - panelWidth - 8
    }
    if (left < 8) {
      left = 8
    }
    setPos({ top, left })
  }, [buttonRef])

  if (!pos) return null

  return createPortal(
    <div
      className="fixed z-[9999] pt-1"
      style={{ top: pos.top, left: pos.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <TabPreviewPanel title={title} items={items} isLeaving={isLeaving} />
    </div>,
    document.body
  )
}

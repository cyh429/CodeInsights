/**
 * AppShell - 应用主布局容器
 *
 * 布局结构：[LeftSidebar 可折叠] | [MainArea: TabBar + TabContent] | [RightSidePanel 可折叠]
 *
 * MainArea 支持多标签页，Settings 视图为独立覆盖。
 */

import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { LeftSidebar } from './LeftSidebar'
import { RightSidePanel } from './RightSidePanel'
import { MainArea } from '@/components/tabs/MainArea'
import { PipelineSidebar } from '@/components/pipeline'
import { AppShellProvider, type AppShellContextType } from '@/contexts/AppShellContext'
import { appModeAtom } from '@/atoms/app-mode'
import { currentAgentSessionIdAtom, currentSessionSidePanelOpenAtom } from '@/atoms/agent-atoms'
import { appShellLeftSidebarWidthAtom, appShellRightPanelWidthAtom } from '@/atoms/sidebar-atoms'

const LEFT_SIDEBAR_MIN_WIDTH = 260
const LEFT_SIDEBAR_MAX_WIDTH = 420
const RIGHT_PANEL_MIN_WIDTH = 280
const RIGHT_PANEL_MAX_WIDTH = 520
const MAIN_MIN_WIDTH = 560
const RESIZE_HANDLE_WIDTH = 10

type ResizeEdge = 'left' | 'right'

interface DragState {
  edge: ResizeEdge
}

function clampWidth(value: number, minWidth: number, maxWidth: number): number {
  return Math.min(Math.max(value, minWidth), maxWidth)
}

function getViewportLimitForLeft(containerWidth: number, rightPanelVisible: boolean, rightPanelWidth: number): number {
  const reservedRight = rightPanelVisible ? rightPanelWidth + RESIZE_HANDLE_WIDTH : 0
  return Math.max(LEFT_SIDEBAR_MIN_WIDTH, containerWidth - reservedRight - MAIN_MIN_WIDTH - RESIZE_HANDLE_WIDTH * 2)
}

function getViewportLimitForRight(containerWidth: number, leftWidth: number): number {
  return Math.max(RIGHT_PANEL_MIN_WIDTH, containerWidth - leftWidth - MAIN_MIN_WIDTH - RESIZE_HANDLE_WIDTH * 2)
}

function ResizeHandle({
  label,
  onDragStart,
  onReset,
  onKeyDown,
}: {
  label: string
  onDragStart: React.PointerEventHandler<HTMLButtonElement>
  onReset: React.MouseEventHandler<HTMLButtonElement>
  onKeyDown: React.KeyboardEventHandler<HTMLButtonElement>
}): React.ReactElement {
  return (
    <button
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      className="group relative z-[61] h-full w-[10px] shrink-0 cursor-col-resize items-stretch justify-center bg-transparent px-0 outline-none titlebar-no-drag"
      onPointerDown={onDragStart}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/0 transition-colors group-hover:bg-status-running-border/70 group-focus-visible:bg-status-running-border/70" aria-hidden="true" />
      <span className="absolute inset-y-2 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-foreground/0 transition-colors group-hover:bg-foreground/18 group-focus-visible:bg-foreground/18" aria-hidden="true" />
    </button>
  )
}

export interface AppShellProps {
  /** Context 值，用于传递给子组件 */
  contextValue: AppShellContextType
}

export function AppShell({ contextValue }: AppShellProps): React.ReactElement {
  const appMode = useAtomValue(appModeAtom)
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const isPanelOpen = useAtomValue(currentSessionSidePanelOpenAtom)
  const [leftSidebarWidth, setLeftSidebarWidth] = useAtom(appShellLeftSidebarWidthAtom)
  const [rightPanelWidth, setRightPanelWidth] = useAtom(appShellRightPanelWidthAtom)
  const showRightPanel = appMode === 'agent' && !!currentSessionId
  const shellRef = React.useRef<HTMLDivElement>(null)
  const dragStateRef = React.useRef<DragState | null>(null)
  const frameRef = React.useRef<number | null>(null)
  const leftSidebarWidthRef = React.useRef(leftSidebarWidth)
  const rightPanelWidthRef = React.useRef(rightPanelWidth)

  React.useEffect(() => {
    leftSidebarWidthRef.current = leftSidebarWidth
  }, [leftSidebarWidth])

  React.useEffect(() => {
    rightPanelWidthRef.current = rightPanelWidth
  }, [rightPanelWidth])

  const stopDragging = React.useCallback(() => {
    dragStateRef.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const updateLeftWidth = React.useCallback((clientX: number) => {
    const shellElement = shellRef.current
    if (!shellElement) return
    const rect = shellElement.getBoundingClientRect()
    const availableWidth = rect.width
    const nextWidth = clientX - rect.left - 8
    const maxWidth = getViewportLimitForLeft(availableWidth, showRightPanel && isPanelOpen, rightPanelWidthRef.current)
    setLeftSidebarWidth(clampWidth(nextWidth, LEFT_SIDEBAR_MIN_WIDTH, Math.min(LEFT_SIDEBAR_MAX_WIDTH, maxWidth)))
  }, [isPanelOpen, setLeftSidebarWidth, showRightPanel])

  const updateRightWidth = React.useCallback((clientX: number) => {
    const shellElement = shellRef.current
    if (!shellElement) return
    const rect = shellElement.getBoundingClientRect()
    const availableWidth = rect.width
    const nextWidth = rect.right - clientX - 8
    const maxWidth = getViewportLimitForRight(availableWidth, leftSidebarWidthRef.current)
    setRightPanelWidth(clampWidth(nextWidth, RIGHT_PANEL_MIN_WIDTH, Math.min(RIGHT_PANEL_MAX_WIDTH, maxWidth)))
  }, [setRightPanelWidth])

  const beginResize = React.useCallback((edge: ResizeEdge, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragStateRef.current = {
      edge,
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMove = (moveEvent: PointerEvent): void => {
      const state = dragStateRef.current
      if (!state) return
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
      frameRef.current = window.requestAnimationFrame(() => {
        if (state.edge === 'left') {
          updateLeftWidth(moveEvent.clientX)
        } else {
          updateRightWidth(moveEvent.clientX)
        }
      })
    }

    const handleUp = (): void => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      stopDragging()
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }, [stopDragging, updateLeftWidth, updateRightWidth])

  const resetWidth = React.useCallback((edge: ResizeEdge) => {
    if (edge === 'left') {
      setLeftSidebarWidth(280)
    } else {
      setRightPanelWidth(320)
    }
  }, [setLeftSidebarWidth, setRightPanelWidth])

  const handleKeyResize = React.useCallback((edge: ResizeEdge, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 32 : 16
    if (event.key === 'Home') {
      event.preventDefault()
      resetWidth(edge)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      resetWidth(edge)
      return
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    if (edge === 'left') {
      const delta = event.key === 'ArrowLeft' ? -step : step
      setLeftSidebarWidth((current) => clampWidth(current + delta, LEFT_SIDEBAR_MIN_WIDTH, LEFT_SIDEBAR_MAX_WIDTH))
    } else {
      const delta = event.key === 'ArrowLeft' ? step : -step
      setRightPanelWidth((current) => clampWidth(current + delta, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH))
    }
  }, [resetWidth, setLeftSidebarWidth, setRightPanelWidth])

  return (
    <AppShellProvider value={contextValue}>
      {/* 可拖动标题栏区域，用于窗口拖动 */}
      <div className="titlebar-drag-region fixed top-0 left-0 right-0 h-[50px] z-50" />

      <div
        ref={shellRef}
        data-app-mode={appMode}
        className={`shell-bg app-workbench h-screen w-screen flex overflow-hidden bg-surface-app ${appMode === 'agent' ? 'agent-shell-bg agent-shell-stage' : ''}`}
      >
        {/* 左侧边栏：可折叠，带圆角和内边距 */}
        <div className="p-2 pr-0 relative z-[60] shrink-0">
          {appMode === 'pipeline' ? <PipelineSidebar width={leftSidebarWidth} /> : <LeftSidebar width={leftSidebarWidth} />}
        </div>

        <ResizeHandle
          label="调整左侧导航栏宽度"
          onDragStart={(event) => beginResize('left', event)}
          onReset={() => resetWidth('left')}
          onKeyDown={(event) => handleKeyResize('left', event)}
        />

        {/* 中间容器：relative z-[60] 使其在 z-50 拖动区域之上 */}
        <div className="app-workbench-main flex-1 min-w-0 p-2 relative z-[60]">
          {/* 主内容区域（TabBar + TabContent） */}
          <MainArea />
        </div>

        {/* 右侧边栏：Agent 文件面板，带圆角和内边距 */}
        {showRightPanel && isPanelOpen && (
          <>
            <ResizeHandle
              label="调整右侧文件面板宽度"
              onDragStart={(event) => beginResize('right', event)}
              onReset={() => resetWidth('right')}
              onKeyDown={(event) => handleKeyResize('right', event)}
            />
            <div
              className="relative z-[60] shrink-0 p-2 pl-0 transition-[padding,width] duration-normal ease-out"
              style={{ width: rightPanelWidth + RESIZE_HANDLE_WIDTH }}
            >
              <RightSidePanel width={rightPanelWidth} />
            </div>
          </>
        )}
      </div>
    </AppShellProvider>
  )
}

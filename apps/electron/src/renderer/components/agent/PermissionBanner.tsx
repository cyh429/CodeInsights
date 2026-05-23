/**
 * PermissionBanner — Agent 权限请求横幅
 *
 * 内联在 Agent 对话流底部，当有待处理的权限请求时显示。
 * 显示工具名、命令内容、危险等级，提供允许/拒绝/总是允许操作。
 * 支持队列模式：多个并发请求按 FIFO 逐个展示。
 *
 * 设计参考 Craft Agents OSS 的内联权限 UI。
 */

import * as React from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { Shield, ShieldAlert, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { allPendingPermissionRequestsAtom, agentStreamingStatesAtom, finalizeStreamingActivities } from '@/atoms/agent-atoms'
import { cn } from '@/lib/utils'
import { getBannerToneForPermission } from './agent-ui-model'
import type { DangerLevel } from '@codeinsights/shared'

/** 危险等级对应的图标颜色 */
const DANGER_ICON_STYLES: Record<DangerLevel, string> = {
  safe: 'text-green-500',
  normal: 'text-primary',
  dangerous: 'text-amber-500',
}

/** 解析工具显示名称（MCP 工具显示 server / tool） */
function formatToolName(toolName: string): string {
  const parts = toolName.split('__')
  if (parts[0] === 'mcp' && parts.length >= 3) {
    return `${parts[1]} / ${parts.slice(2).join('__')}`
  }
  return toolName
}

/** PermissionBanner 属性接口 */
interface PermissionBannerProps {
  sessionId: string
  active?: boolean
}

export function PermissionBanner({ sessionId, active = true }: PermissionBannerProps): React.ReactElement | null {
  const [allRequests, setAllRequests] = useAtom(allPendingPermissionRequestsAtom)
  const setStreamingStates = useSetAtom(agentStreamingStatesAtom)
  const requests = allRequests.get(sessionId) ?? []
  const [responding, setResponding] = React.useState(false)
  const respondRef = React.useRef<(behavior: 'allow' | 'deny', alwaysAllow?: boolean) => void>()

  const request = requests[0] ?? null

  // Enter 键快捷允许
  React.useEffect(() => {
    if (!request || !active) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) return
      if (e.key === 'Enter') {
        e.preventDefault()
        respondRef.current?.('allow')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [request?.requestId, active])

  /** 关闭权限请求 & 终止 Agent */
  const handleDismiss = (): void => {
    setStreamingStates((prev) => {
      const current = prev.get(sessionId)
      if (!current || !current.running) return prev
      const map = new Map(prev)
      map.set(sessionId, {
        ...current,
        running: false,
        ...finalizeStreamingActivities(current.toolActivities, current.teammates),
      })
      return map
    })
    setAllRequests((prev) => {
      const map = new Map(prev)
      map.delete(sessionId)
      return map
    })
    window.electronAPI.stopAgent(sessionId).catch(console.error)
  }

  if (!request) return null

  const iconColor = DANGER_ICON_STYLES[request.dangerLevel]
  const isDangerous = request.dangerLevel === 'dangerous'
  const IconComponent = isDangerous ? ShieldAlert : Shield
  const tone = getBannerToneForPermission(request.dangerLevel)

  /** 响应权限请求 */
  const respond = async (behavior: 'allow' | 'deny', alwaysAllow = false): Promise<void> => {
    if (responding) return
    setResponding(true)

    try {
      await window.electronAPI.respondPermission({
        requestId: request.requestId,
        behavior,
        alwaysAllow,
      })
      // 移除已响应的请求（FIFO 出队）
      setAllRequests((prev) => {
        const map = new Map(prev)
        const current = map.get(sessionId) ?? []
        const newValue = current.filter((r) => r.requestId !== request.requestId)
        if (newValue.length === 0) map.delete(sessionId)
        else map.set(sessionId, newValue)
        return map
      })
    } catch (error) {
      console.error('[PermissionBanner] 响应失败:', error)
    } finally {
      setResponding(false)
    }
  }

  respondRef.current = respond

  return (
    <div
      className={cn(
        'agent-tool-rail mb-2 overflow-hidden rounded-card border shadow-card animate-in slide-in-from-top-1 duration-200',
        tone === 'danger'
          ? 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
          : 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg',
      )}
      role="status"
      aria-live="polite"
    >
      {/* 头部 */}
      <div className="flex items-start justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <IconComponent className={`size-4 ${iconColor}`} />
          <span className="truncate text-sm font-medium">
            {isDangerous ? '危险操作需要确认' : '需要允许工具操作'}
          </span>
          {requests.length > 1 && (
            <span className="shrink-0 text-xs text-current/60">
              (+{requests.length - 1})
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="min-w-0 truncate rounded-full border border-current/10 bg-background/35 px-2 py-0.5 font-mono text-xs text-current/70 backdrop-blur-sm"
            title={request.sdkDisplayName ?? formatToolName(request.toolName)}
          >
            {request.sdkDisplayName ?? formatToolName(request.toolName)}
          </span>
          <button
            type="button"
            className="size-6 flex shrink-0 items-center justify-center rounded-control text-current/50 transition-colors hover:bg-background/45 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={handleDismiss}
            title="关闭并终止 Agent"
            aria-label="关闭权限请求并终止 Agent"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 命令/操作内容 */}
      <div className="px-3 pb-2 space-y-1.5">
        {/* SDK 可读标题（优先展示，描述操作意图） */}
        {request.sdkTitle && (
          <p className="text-xs text-current">{request.sdkTitle}</p>
        )}
        {/* SDK 详细描述（与标题不同时才展示） */}
        {request.sdkDescription && request.sdkDescription !== request.sdkTitle && (
          <p className="text-xs text-current/70">{request.sdkDescription}</p>
        )}
        {/* Bash 命令：始终展示代码块 */}
        {request.command ? (
          <pre className="text-xs font-mono bg-background/60 rounded-control px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto">
            {request.command}
          </pre>
        ) : !request.sdkTitle && Object.keys(request.toolInput).length > 0 ? (
          <pre className="text-xs font-mono bg-background/60 rounded-control px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto">
            {JSON.stringify(request.toolInput, null, 2)}
          </pre>
        ) : !request.sdkTitle ? (
          <p className="text-xs text-current/70">
            {request.description}
          </p>
        ) : null}
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 px-3 pb-2.5">
        <span className="mr-auto text-[10px] text-current/50">
          Enter 允许
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => respond('deny')}
          disabled={responding}
          className="h-7 px-3 text-xs text-muted-foreground hover:text-destructive"
        >
          <X className="size-3 mr-1" />
          拒绝
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => respond('allow', true)}
          disabled={responding}
          className="h-7 px-3 text-xs"
        >
          本次会话总是允许
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={() => respond('allow')}
          disabled={responding}
          className="h-7 px-3 text-xs"
        >
          <Check className="size-3 mr-1" />
          允许
        </Button>
      </div>
    </div>
  )
}

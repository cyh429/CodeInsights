import * as React from 'react'
import { useSetAtom } from 'jotai'
import { scanSessionsAtom, currentScanSessionIdAtom, selectedFindingIdAtom } from '@/atoms/scan-atoms'
import { appModeAtom } from '@/atoms/app-mode'
import type { ScanSessionMeta } from '@codeinsights/shared'
import { cn } from '@/lib/utils'
import { ShieldAlert, RefreshCw, Plus, Trash2, Download, MoreHorizontal } from 'lucide-react'

export interface ScanHeaderProps {
  session: ScanSessionMeta
  findingsCount: number
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-status-idle/80',
  running: 'bg-status-running animate-pulse',
  completed: 'bg-status-success',
  failed: 'bg-status-error',
  cancelled: 'bg-status-info',
}

const STATUS_LABELS: Record<string, string> = {
  idle: '空闲',
  running: '扫描中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

export function ScanHeader({ session, findingsCount }: ScanHeaderProps): React.ReactElement {
  const setSelectedFindingId = useSetAtom(selectedFindingIdAtom)
  const setSessions = useSetAtom(scanSessionsAtom)
  const setCurrentSessionId = useSetAtom(currentScanSessionIdAtom)
  const setAppMode = useSetAtom(appModeAtom)

  const handleExport = React.useCallback(() => {
    window.electronAPI.exportScanResults(session.id)
  }, [session.id])

  const handleDelete = React.useCallback(() => {
    if (confirm('确定要删除此扫描会话吗？')) {
      window.electronAPI.deleteScanSession(session.id)
        .then(() => {
          // 更新 atoms，移除已删除的会话
          setSessions((prev) => prev.filter((s) => s.id !== session.id))
          setSelectedFindingId(null)
          setCurrentSessionId(null)
          // 如果没有其他扫描会话了，切换到其他模式
          setAppMode('pipeline')
        })
        .catch((err) => {
          console.error('删除扫描会话失败:', err)
        })
    }
  }, [session.id, setSessions, setSelectedFindingId, setCurrentSessionId, setAppMode])

  return (
    <div className="border-b border-border-subtle/60 bg-surface-card/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 图标 */}
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-status-warning/20 via-status-warning/10 to-transparent">
            <ShieldAlert size={18} className="text-status-warning" />
          </div>

          {/* 标题和信息 */}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-medium text-text-primary">{session.title}</h1>
              <span
                className={cn(
                  'h-1.5 w-1.5 flex-shrink-0 rounded-full',
                  STATUS_COLORS[session.status] ?? STATUS_COLORS.idle,
                )}
                title={STATUS_LABELS[session.status] ?? session.status}
              />
            </div>
            {session.description && (
              <p className="mt-0.5 text-xs text-text-tertiary">{session.description}</p>
            )}
            <div className="mt-1 flex items-center gap-2 text-[11px] text-text-tertiary">
              <span>{session.target}</span>
              <span>·</span>
              <span>{findingsCount} 个发现项</span>
              {session.criticalCount != null && session.criticalCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-status-critical">严重 {session.criticalCount}</span>
                </>
              )}
              {session.highCount != null && session.highCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-status-error">高危 {session.highCount}</span>
                </>
              )}
              {session.mediumCount != null && session.mediumCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-status-warning">中危 {session.mediumCount}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {}}
            className="flex h-7.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            title="重新扫描"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">重新扫描</span>
          </button>
          <button
            onClick={() => {}}
            className="flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            title="添加发现项"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">添加</span>
          </button>
          <button
            onClick={handleExport}
            className="flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            title="导出结果"
          >
            <Download size={14} />
            <span className="hidden sm:inline">导出</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-status-error/10 hover:text-status-error"
            title="删除扫描"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => {}}
            className="flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            title="更多操作"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

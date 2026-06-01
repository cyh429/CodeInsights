import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  scanFilterStateAtom,
  scanSortStateAtom,
  selectedFindingIdAtom,
  type ScanFilterState,
  type ScanSortState,
} from '@/atoms/scan-atoms'
import type { ScanFinding } from '@codeinsights/shared'
import { cn } from '@/lib/utils'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'

export interface ScanFindingListProps {
  findings: ScanFinding[]
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-status-critical/15 text-status-critical border-status-critical/30',
  high: 'bg-status-error/15 text-status-error border-status-error/30',
  medium: 'bg-status-warning/15 text-status-warning border-status-warning/30',
  low: 'bg-status-success/15 text-status-success border-status-success/30',
  info: 'bg-status-info/15 text-status-info border-status-info/30',
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
  info: '信息',
}

const STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  triaged: '已分诊',
  confirmed: '已确认',
  fixed: '已修复',
  false_positive: '误报',
  suppressed: '已忽略',
}

export function ScanFindingList({ findings }: ScanFindingListProps): React.ReactElement {
  const [selectedId, setSelectedId] = useAtom(selectedFindingIdAtom)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [showFilters, setShowFilters] = React.useState(false)
  const setFilterState = useSetAtom(scanFilterStateAtom)
  const setSortState = useSetAtom(scanSortStateAtom)
  const filterState = useAtomValue(scanFilterStateAtom)
  const sortState = useAtomValue(scanSortStateAtom)

  const handleSelectFinding = React.useCallback((finding: ScanFinding) => {
    setSelectedId(finding.id)
  }, [setSelectedId])

  const handleSeverityFilterChange = React.useCallback((severity: string, checked: boolean) => {
    setFilterState((prev) => {
      const currentSeverities = prev.severity ?? []
      const nextSeverities = checked
        ? [...currentSeverities, severity]
        : currentSeverities.filter((s) => s !== severity)
      return {
        ...prev,
        severity: nextSeverities.length > 0 ? nextSeverities : undefined,
      }
    })
  }, [setFilterState])

  const handleStatusFilterChange = React.useCallback((status: string, checked: boolean) => {
    setFilterState((prev) => {
      const currentStatuses = prev.status ?? []
      const nextStatuses = checked
        ? [...currentStatuses, status]
        : currentStatuses.filter((s) => s !== status)
      return {
        ...prev,
        status: nextStatuses.length > 0 ? nextStatuses : undefined,
      }
    })
  }, [setFilterState])

  const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setFilterState((prev) => ({
      ...prev,
      searchQuery: value || undefined,
    }))
  }, [setFilterState])

  const toggleSort = React.useCallback((field: 'severity' | 'status' | 'filePath') => {
    setSortState((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }))
  }, [setSortState])

  const uniqueSeverities = React.useMemo(() =>
    [...new Set(findings.map((f) => f.severity))].sort(),
    [findings],
  )

  const uniqueStatuses = React.useMemo(() =>
    [...new Set(findings.map((f) => f.status))].sort(),
    [findings],
  )

  return (
    <div className="flex h-full flex-col">
      {/* 搜索和筛选区 */}
      <div className="border-b border-border-subtle/60 bg-surface-card/50 p-3">
        <div className="mb-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="搜索漏洞..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full rounded-lg border border-border-subtle/60 bg-surface-app/80 px-2.5 pl-8 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-focus/50 focus:outline-none focus:ring-1 focus:ring-focus/30"
            />
          </div>
        </div>

        {/* 筛选切换按钮 */}
        <button
          onClick={() => setShowFilters((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-text-secondary hover:bg-surface-hover transition-colors"
        >
          <span>筛选与排序</span>
          {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showFilters && (
          <div className="mt-2 space-y-3 border-t border-border-subtle/40 pt-2">
            {/* 严重程度筛选 */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium text-text-secondary">严重程度</div>
              <div className="flex flex-wrap gap-1.5">
                {uniqueSeverities.map((severity) => (
                  <label
                    key={severity}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] hover:bg-surface-hover"
                  >
                    <input
                      type="checkbox"
                      checked={filterState.severity?.includes(severity) ?? false}
                      onChange={(e) => handleSeverityFilterChange(severity, e.target.checked)}
                      className="rounded border-border-subtle text-focus focus:ring-focus/30"
                    />
                    <span>{SEVERITY_LABELS[severity] ?? severity}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 状态筛选 */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium text-text-secondary">状态</div>
              <div className="flex flex-wrap gap-1.5">
                {uniqueStatuses.map((status) => (
                  <label
                    key={status}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] hover:bg-surface-hover"
                  >
                    <input
                      type="checkbox"
                      checked={filterState.status?.includes(status) ?? false}
                      onChange={(e) => handleStatusFilterChange(status, e.target.checked)}
                      className="rounded border-border-subtle text-focus focus:ring-focus/30"
                    />
                    <span>{STATUS_LABELS[status] ?? status}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 排序 */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium text-text-secondary">排序</div>
              <div className="flex gap-2">
                {(['severity', 'status', 'filePath'] as const).map((field) => (
                  <button
                    key={field}
                    onClick={() => toggleSort(field)}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors',
                      sortState.field === field
                        ? 'bg-focus/10 text-focus'
                        : 'bg-surface-app/50 text-text-secondary hover:bg-surface-hover',
                    )}
                  >
                    <span>
                      {field === 'severity' ? '严重度' : field === 'status' ? '状态' : '文件'}
                    </span>
                    {sortState.field === field && (
                      sortState.direction === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 发现项列表 */}
      <div className="flex-1 overflow-y-auto">
        {findings.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <div className="text-center text-xs text-text-tertiary">
              暂无发现项
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle/40">
            {findings.map((finding) => (
              <button
                key={finding.id}
                onClick={() => handleSelectFinding(finding)}
                className={cn(
                  'w-full px-3 py-2.5 text-left transition-colors hover:bg-surface-hover',
                  selectedId === finding.id && 'bg-surface-selected',
                )}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                      SEVERITY_COLORS[finding.severity] ?? SEVERITY_COLORS.info,
                    )}
                  >
                    {SEVERITY_LABELS[finding.severity] ?? finding.severity}
                  </span>
                  <span className="text-[10px] text-text-tertiary">
                    {STATUS_LABELS[finding.status] ?? finding.status}
                  </span>
                </div>
                <div className="mb-1 line-clamp-1 text-xs font-medium text-text-primary">
                  {finding.title}
                </div>
                <div className="line-clamp-2 text-[11px] text-text-secondary">
                  {finding.description}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-text-tertiary">
                  <span className="truncate">{finding.location.filePath}</span>
                  <span>·</span>
                  <span>第 {finding.location.line} 行</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

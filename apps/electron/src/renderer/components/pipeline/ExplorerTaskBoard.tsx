import * as React from 'react'
import type { PipelineExplorerReportRef } from '@codeinsights/shared'

export interface ExplorerTaskItemViewModel {
  reportId: string
  title: string
  summary?: string
  relativePath: string
  revisionLabel: string
  checksumLabel: string
  selected: boolean
}

export interface ExplorerTaskBoardViewModel {
  empty: boolean
  confirmDisabled: boolean
  confirmLabel: string
  selectedReportId: string | null
  items: ExplorerTaskItemViewModel[]
}

function checksumLabel(checksum?: string): string {
  return checksum ? `sha256:${checksum.slice(0, 8)}` : 'checksum 缺失'
}

export function resolveExplorerTaskSelection(
  reports: PipelineExplorerReportRef[],
  selectedReportId: string | null | undefined,
): PipelineExplorerReportRef | null {
  if (!selectedReportId) return null
  return reports.find((report) => report.reportId === selectedReportId) ?? null
}

export function buildExplorerTaskBoardViewModel({
  reports,
  selectedReportId,
  submitting,
}: {
  reports: PipelineExplorerReportRef[]
  selectedReportId?: string | null
  submitting: boolean
}): ExplorerTaskBoardViewModel {
  const selected = resolveExplorerTaskSelection(reports, selectedReportId)

  return {
    empty: reports.length === 0,
    confirmDisabled: submitting || !selected,
    confirmLabel: submitting ? '正在进入规划' : '选择此任务并进入规划',
    selectedReportId: selected?.reportId ?? null,
    items: reports.map((report) => ({
      reportId: report.reportId,
      title: report.title,
      summary: report.summary,
      relativePath: report.relativePath,
      revisionLabel: `第 ${report.revision ?? 1} 版`,
      checksumLabel: checksumLabel(report.checksum),
      selected: report.reportId === selectedReportId,
    })),
  }
}

export function ExplorerTaskBoard({
  reports,
  initialSelectedReportId,
  onSelectTask,
  onRerun,
}: {
  reports: PipelineExplorerReportRef[]
  initialSelectedReportId?: string | null
  onSelectTask: (reportId: string) => Promise<void>
  onRerun?: () => Promise<void>
}): React.ReactElement {
  const [selectedReportId, setSelectedReportId] = React.useState<string | null>(
    initialSelectedReportId ?? null,
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const viewModel = buildExplorerTaskBoardViewModel({
    reports,
    selectedReportId,
    submitting,
  })

  React.useEffect(() => {
    setSelectedReportId(initialSelectedReportId ?? null)
  }, [initialSelectedReportId])

  const handleSubmit = async (): Promise<void> => {
    if (viewModel.confirmDisabled || !viewModel.selectedReportId) return
    setSubmitting(true)
    setError(null)
    try {
      await onSelectTask(viewModel.selectedReportId)
    } catch (submitError) {
      console.error('[ExplorerTaskBoard] 选择任务失败:', submitError)
      setError(submitError instanceof Error ? submitError.message : '选择任务失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-panel border border-status-waiting-border bg-status-waiting-bg px-4 py-4 text-text-primary shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.16em] text-status-waiting-fg">任务选择</div>
          <h2 className="mt-1 text-base font-semibold text-text-primary">选择 Explorer 报告</h2>
        </div>
        <div className="rounded-full border border-status-waiting-border bg-background/80 px-3 py-1 text-xs font-semibold text-status-waiting-fg">
          {reports.length} 份报告
        </div>
      </div>

      {viewModel.empty ? (
        <div className="mt-4 rounded-card bg-background/75 px-3 py-3 text-sm text-text-secondary">
          Explorer 尚未生成可选择的报告。
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {viewModel.items.map((item) => (
            <button
              key={item.reportId}
              type="button"
              onClick={() => {
                setSelectedReportId(item.reportId)
                setError(null)
              }}
              className={[
                'w-full rounded-card px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                item.selected
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-background/75 text-text-primary hover:bg-background',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{item.title}</div>
                  {item.summary ? (
                    <div className={[
                      'mt-1 line-clamp-2 text-xs leading-5',
                      item.selected ? 'text-primary-foreground/80' : 'text-text-secondary',
                    ].join(' ')}
                    >
                      {item.summary}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1 text-[11px]">
                  <span>{item.revisionLabel}</span>
                  <span>{item.checksumLabel}</span>
                </div>
              </div>
              <div className={[
                'mt-2 truncate font-mono text-[11px]',
                item.selected ? 'text-primary-foreground/70' : 'text-text-tertiary',
              ].join(' ')}
              >
                {item.relativePath}
              </div>
            </button>
          ))}
        </div>
      )}

      {error ? (
        <div className="mt-3 rounded-card border border-status-danger-border bg-status-danger-bg px-3 py-2 text-xs text-status-danger-fg">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={viewModel.confirmDisabled}
          onClick={() => void handleSubmit()}
          className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {viewModel.confirmLabel}
        </button>
        {onRerun ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onRerun()}
            className="rounded-control border border-border-subtle bg-background px-4 py-2 text-sm font-medium text-text-primary shadow-sm transition-colors hover:bg-surface-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            重跑探索
          </button>
        ) : null}
      </div>
    </section>
  )
}

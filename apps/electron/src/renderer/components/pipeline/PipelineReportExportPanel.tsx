import * as React from 'react'
import { Clipboard, Download, FileText, RefreshCw } from 'lucide-react'
import type { PipelineReportExport } from '@codeinsights/shared'

type ReportActionStatus = 'idle' | 'copied' | 'saved' | 'failed'

export interface PipelineReportExportPanelViewModel {
  title: string
  statusLabel: string
  generateLabel: string
  copyLabel: string
  saveLabel: string
  fileName: string
  preview: string
  generateDisabled: boolean
  copyDisabled: boolean
  saveDisabled: boolean
  error?: string
}

export function buildPipelineReportExportPanelViewModel({
  report,
  loading,
  error,
  copyStatus,
  saveStatus,
}: {
  report: PipelineReportExport | null
  loading: boolean
  error: string | null
  copyStatus: ReportActionStatus
  saveStatus: ReportActionStatus
}): PipelineReportExportPanelViewModel {
  const hasReport = Boolean(report)
  const preview = report?.markdown
    .split(/\r?\n/)
    .slice(0, 18)
    .join('\n')
    ?? '点击生成报告后，会在这里预览 Markdown 内容。'

  return {
    title: '贡献报告',
    statusLabel: loading ? '生成中' : error ? '生成失败' : hasReport ? '已生成' : '尚未生成',
    generateLabel: loading ? '生成中' : hasReport ? '重新生成' : '生成报告',
    copyLabel: copyStatus === 'copied' ? '已复制' : copyStatus === 'failed' ? '复制失败' : '复制 Markdown',
    saveLabel: saveStatus === 'saved' ? '已保存' : saveStatus === 'failed' ? '保存失败' : '保存 .md',
    fileName: report?.fileName ?? 'pipeline-report.md',
    preview,
    generateDisabled: loading,
    copyDisabled: loading || !hasReport,
    saveDisabled: loading || !hasReport,
    error: error ?? undefined,
  }
}

function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    const success = document.execCommand('copy')
    if (!success) {
      throw new Error('复制命令未成功执行')
    }
    return Promise.resolve()
  } finally {
    document.body.removeChild(textarea)
  }
}

function saveMarkdownFile(report: PipelineReportExport): void {
  const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = report.fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function PipelineReportExportPanel({
  sessionId,
}: {
  sessionId: string
}): React.ReactElement {
  const [report, setReport] = React.useState<PipelineReportExport | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [copyStatus, setCopyStatus] = React.useState<ReportActionStatus>('idle')
  const [saveStatus, setSaveStatus] = React.useState<ReportActionStatus>('idle')

  React.useEffect(() => {
    setReport(null)
    setError(null)
    setCopyStatus('idle')
    setSaveStatus('idle')
  }, [sessionId])

  const viewModel = buildPipelineReportExportPanelViewModel({
    report,
    loading,
    error,
    copyStatus,
    saveStatus,
  })

  const resetActionStatus = React.useCallback((setter: React.Dispatch<React.SetStateAction<ReportActionStatus>>): void => {
    window.setTimeout(() => setter('idle'), 1800)
  }, [])

  const generateReport = React.useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    setCopyStatus('idle')
    setSaveStatus('idle')
    try {
      const nextReport = await window.electronAPI.exportPipelineReport({ sessionId })
      setReport(nextReport)
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : '导出 Pipeline 贡献报告失败')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  const copyReport = React.useCallback(async (): Promise<void> => {
    if (!report) return
    try {
      await copyTextToClipboard(report.markdown)
      setCopyStatus('copied')
      resetActionStatus(setCopyStatus)
    } catch (copyError) {
      console.error('[PipelineReportExport] 复制报告失败:', copyError)
      setCopyStatus('failed')
      resetActionStatus(setCopyStatus)
    }
  }, [report, resetActionStatus])

  const saveReport = React.useCallback((): void => {
    if (!report) return
    try {
      saveMarkdownFile(report)
      setSaveStatus('saved')
      resetActionStatus(setSaveStatus)
    } catch (saveError) {
      console.error('[PipelineReportExport] 保存报告失败:', saveError)
      setSaveStatus('failed')
      resetActionStatus(setSaveStatus)
    }
  }, [report, resetActionStatus])

  return (
    <section className="rounded-panel bg-background/95 px-4 py-4 text-text-primary shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-text-tertiary">报告导出</div>
          <h2 className="mt-1 text-base font-semibold text-text-primary">{viewModel.title}</h2>
          <div className="mt-1 text-xs text-text-secondary">{viewModel.fileName}</div>
        </div>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-text-secondary">
          {viewModel.statusLabel}
        </span>
      </div>

      {viewModel.error ? (
        <div className="mt-3 rounded-card border border-status-danger-border bg-status-danger-bg px-3 py-2 text-xs text-status-danger-fg">
          {viewModel.error}
        </div>
      ) : null}

      <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-card bg-surface-muted px-3 py-3 text-xs leading-5 text-text-secondary">
        {viewModel.preview}
      </pre>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={viewModel.generateDisabled}
          onClick={() => void generateReport()}
          className="inline-flex items-center gap-2 rounded-control bg-background px-3 py-2 text-xs font-medium text-text-primary shadow-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {loading ? <RefreshCw className="animate-spin" size={14} aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
          {viewModel.generateLabel}
        </button>
        <button
          type="button"
          disabled={viewModel.copyDisabled}
          onClick={() => void copyReport()}
          className="inline-flex items-center gap-2 rounded-control bg-background px-3 py-2 text-xs font-medium text-text-primary shadow-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Clipboard size={14} aria-hidden="true" />
          {viewModel.copyLabel}
        </button>
        <button
          type="button"
          disabled={viewModel.saveDisabled}
          onClick={saveReport}
          className="inline-flex items-center gap-2 rounded-control bg-background px-3 py-2 text-xs font-medium text-text-primary shadow-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Download size={14} aria-hidden="true" />
          {viewModel.saveLabel}
        </button>
      </div>
    </section>
  )
}

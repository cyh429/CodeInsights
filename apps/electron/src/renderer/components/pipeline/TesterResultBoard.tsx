import * as React from 'react'
import { FolderOpen } from 'lucide-react'
import type {
  PipelineGateKind,
  PipelinePatchWorkDocumentRef,
  PipelineTesterStageOutput,
  PipelineTestEvidence,
} from '@codeinsights/shared'

export interface TesterPatchWorkDocumentViewModel {
  displayName: string
  relativePath: string
  checksumLabel: string
  revisionLabel: string
  loading: boolean
  language: 'markdown' | 'diff' | 'json' | 'text'
  content?: string
  error?: string
}

export interface TesterEvidenceViewModel {
  command: string
  statusLabel: string
  summary: string
  durationLabel?: string
}

export interface TesterResultBoardViewModel {
  title: string
  subtitle: string
  statusLabel: string
  statusTone: 'success' | 'failed' | 'warning' | 'neutral'
  summary: string
  passed: boolean | null
  approveDisabled: boolean
  approveLabel: string
  rejectLabel: string
  rerunLabel: string
  feedbackPlaceholder: string
  feedbackError: string
  warning?: string
  patchSetSummary: string
  commands: string[]
  results: string[]
  blockers: string[]
  evidenceItems: TesterEvidenceViewModel[]
  documents: TesterPatchWorkDocumentViewModel[]
}

function checksumLabel(checksum?: string): string {
  return checksum ? `sha256:${checksum.slice(0, 8)}` : 'checksum 缺失'
}

function dedupeDocuments(documents: PipelinePatchWorkDocumentRef[]): PipelinePatchWorkDocumentRef[] {
  return documents.filter((document, index, items) =>
    items.findIndex((item) => item.relativePath === document.relativePath) === index)
}

export function collectTesterPatchWorkRefs(
  output: PipelineTesterStageOutput | null | undefined,
): PipelinePatchWorkDocumentRef[] {
  if (!output) return []
  return dedupeDocuments([
    output.testResultRef,
    output.patchSet?.patchRef,
    output.patchSet?.changedFilesRef,
    output.patchSet?.diffSummaryRef,
    output.patchSet?.testEvidenceRef,
  ].filter((ref): ref is PipelinePatchWorkDocumentRef => Boolean(ref)))
}

function languageForPath(relativePath: string): TesterPatchWorkDocumentViewModel['language'] {
  if (relativePath.endsWith('.patch')) return 'diff'
  if (relativePath.endsWith('.json')) return 'json'
  if (relativePath.endsWith('.md')) return 'markdown'
  return 'text'
}

function formatDuration(durationMs?: number): string | undefined {
  if (durationMs == null) return undefined
  if (durationMs < 1000) return `${durationMs}ms`
  return `${(durationMs / 1000).toFixed(1)}s`
}

function statusLabel(status: PipelineTestEvidence['status']): string {
  if (status === 'passed') return '通过'
  if (status === 'failed') return '失败'
  return '跳过'
}

function resolveStatus(output: PipelineTesterStageOutput | null | undefined, gateKind?: PipelineGateKind): {
  label: string
  tone: TesterResultBoardViewModel['statusTone']
  passed: boolean | null
} {
  if (!output) return { label: '等待测试结果', tone: 'neutral', passed: null }
  if (gateKind === 'test_blocked' || output.blockers.length > 0) {
    return { label: '测试阻塞', tone: 'warning', passed: false }
  }
  if (output.passed === false) return { label: '测试未通过', tone: 'failed', passed: false }
  if (output.passed === true) return { label: '测试通过', tone: 'success', passed: true }
  return { label: '等待测试结论', tone: 'neutral', passed: null }
}

function sumPatchSetStats(output: PipelineTesterStageOutput | null | undefined): {
  files: number
  additions: number
  deletions: number
} {
  const patchSet = output?.patchSet
  if (!patchSet) return { files: 0, additions: 0, deletions: 0 }
  return {
    files: patchSet.files.length,
    additions: patchSet.additions ?? patchSet.files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
    deletions: patchSet.deletions ?? patchSet.files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
  }
}

export function buildTesterResultBoardViewModel({
  output,
  contents,
  loadingPaths,
  readErrors,
  gateKind,
  submitting,
}: {
  output: PipelineTesterStageOutput | null | undefined
  contents: Map<string, string>
  loadingPaths: Set<string>
  readErrors: Map<string, string>
  gateKind?: PipelineGateKind
  submitting: boolean
}): TesterResultBoardViewModel {
  const documents = collectTesterPatchWorkRefs(output)
  const missingChecksum = documents.some((document) => !document.checksum)
  const hasLoading = documents.some((document) => loadingPaths.has(document.relativePath))
  const hasReadErrors = documents.some((document) => readErrors.has(document.relativePath))
  const evidence = output?.patchSet?.testEvidence ?? output?.testEvidence ?? []
  const hasNonPassingEvidence = evidence.some((item) => item.status !== 'passed')
  const missingContent = documents.some((document) => {
    const content = contents.get(document.relativePath)
    return !loadingPaths.has(document.relativePath)
      && !readErrors.has(document.relativePath)
      && (!content || !content.trim())
  })
  const patchSetUnsafe = output?.patchSet ? !output.patchSet.excludesPatchWork : true
  const status = resolveStatus(output, gateKind)
  const stats = sumPatchSetStats(output)
  const isRiskAcceptanceGate = gateKind === 'test_blocked'
  const riskOnlyWarning = hasNonPassingEvidence && isRiskAcceptanceGate
  const warning = (() => {
    if (!output) return 'Tester 尚未生成结构化测试结果。'
    if (hasNonPassingEvidence && !isRiskAcceptanceGate) return '存在失败或跳过的测试证据，不能继续。'
    if (missingChecksum) return '存在缺少 checksum 的 Tester 产物，不能继续。'
    if (hasLoading) return '仍在读取 Tester 产物，加载完成后才能继续。'
    if (hasReadErrors) return '存在读取失败的 Tester 产物，请刷新后重试。'
    if (patchSetUnsafe) return 'patch-set 未确认排除 patch-work/**，不能进入提交草稿。'
    if (missingContent) return '存在缺少正文的 Tester 产物，请刷新后重试。'
    if (riskOnlyWarning) return '存在失败或跳过的测试证据，继续将记录为人工风险接受。'
    return undefined
  })()
  const approveDisabled = submitting || Boolean(warning && !riskOnlyWarning)

  return {
    title: '审核 Tester 测试结果',
    subtitle: gateKind === 'test_blocked' ? '测试阻塞' : '测试报告',
    statusLabel: status.label,
    statusTone: status.tone,
    summary: output?.summary ?? '等待 Tester 输出测试报告和 patch-set。',
    passed: status.passed,
    approveDisabled,
    approveLabel: submitting
      ? '正在进入提交草稿'
      : gateKind === 'test_blocked'
        ? '接受风险并生成提交草稿'
        : '接受测试结果并生成提交草稿',
    rejectLabel: '要求修订',
    rerunLabel: '重跑测试',
    feedbackPlaceholder: '指出 result.md、测试命令或 patch-set 需要 tester / developer 修订的地方',
    feedbackError: '请填写需要修订的具体反馈。',
    warning,
    patchSetSummary: `${stats.files} 个文件，+${stats.additions} / -${stats.deletions}`,
    commands: output?.commands ?? [],
    results: output?.results ?? [],
    blockers: output?.blockers ?? [],
    evidenceItems: evidence.map((item) => ({
      command: item.command,
      statusLabel: statusLabel(item.status),
      summary: item.summary,
      durationLabel: formatDuration(item.durationMs),
    })),
    documents: documents.map((document) => ({
      displayName: document.displayName,
      relativePath: document.relativePath,
      checksumLabel: checksumLabel(document.checksum),
      revisionLabel: `第 ${document.revision ?? 1} 版`,
      loading: loadingPaths.has(document.relativePath),
      language: languageForPath(document.relativePath),
      content: contents.get(document.relativePath),
      error: readErrors.get(document.relativePath),
    })),
  }
}

function toneClass(tone: TesterResultBoardViewModel['statusTone']): string {
  if (tone === 'success') return 'border-status-success-border bg-status-success-bg text-status-success-fg'
  if (tone === 'failed') return 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
  if (tone === 'warning') return 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg'
  return 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg'
}

export function TesterResultBoard({
  output,
  contents,
  loadingPaths,
  readErrors,
  gateKind,
  onApprove,
  onReject,
  onRerun,
  onOpenPatchWorkDir,
}: {
  output: PipelineTesterStageOutput | null | undefined
  contents: Map<string, string>
  loadingPaths: Set<string>
  readErrors: Map<string, string>
  gateKind?: PipelineGateKind
  onApprove: () => Promise<void>
  onReject: (feedback: string) => Promise<void>
  onRerun: () => Promise<void>
  onOpenPatchWorkDir: () => Promise<void>
}): React.ReactElement {
  const [feedback, setFeedback] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [openPatchWorkError, setOpenPatchWorkError] = React.useState<string | null>(null)
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null)
  const viewModel = buildTesterResultBoardViewModel({
    output,
    contents,
    loadingPaths,
    readErrors,
    gateKind,
    submitting,
  })

  const runAction = async (action: () => Promise<void>): Promise<void> => {
    setSubmitting(true)
    setError(null)
    try {
      await action()
    } catch (submitError) {
      console.error('[TesterResultBoard] 测试结果审核失败:', submitError)
      setError(submitError instanceof Error ? submitError.message : '提交审核失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenPatchWorkDir = async (): Promise<void> => {
    setOpenPatchWorkError(null)
    try {
      await onOpenPatchWorkDir()
    } catch (openError) {
      console.error('[TesterResultBoard] 打开 patch-work 目录失败:', openError)
      setOpenPatchWorkError(openError instanceof Error ? openError.message : '打开 patch-work 目录失败，请稍后重试。')
    }
  }

  const handleReject = async (): Promise<void> => {
    const trimmed = feedback.trim()
    if (!trimmed) {
      setFeedbackError(viewModel.feedbackError)
      return
    }
    setFeedbackError(null)
    await runAction(() => onReject(trimmed))
  }

  return (
    <section className="rounded-panel border border-status-success-border bg-status-success-bg px-4 py-4 text-text-primary shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.16em] text-status-success-fg">{viewModel.subtitle}</div>
          <h2 className="mt-1 text-base font-semibold text-text-primary">{viewModel.title}</h2>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass(viewModel.statusTone)}`}>
          {viewModel.statusLabel}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-text-primary">{viewModel.summary}</p>
      <div className="mt-3 rounded-card bg-background/80 px-3 py-2 text-xs text-text-secondary">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>Patch-set：{viewModel.patchSetSummary}</span>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleOpenPatchWorkDir()}
            className="inline-flex items-center justify-center gap-2 rounded-control bg-background px-3 py-1.5 text-xs font-medium text-text-primary shadow-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <FolderOpen size={14} aria-hidden="true" />
            打开 patch-work
          </button>
        </div>
      </div>
      {openPatchWorkError ? <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">{openPatchWorkError}</div> : null}

      {viewModel.warning ? (
        <div className="mt-3 rounded-card border border-status-waiting-border bg-status-waiting-bg px-3 py-2 text-xs text-status-waiting-fg">
          {viewModel.warning}
        </div>
      ) : null}

      {viewModel.blockers.length > 0 ? (
        <div className="mt-3 rounded-card bg-background/80 px-3 py-2 text-xs text-text-primary">
          <div className="font-medium">阻塞项</div>
          <ul className="mt-2 space-y-1">
            {viewModel.blockers.map((blocker) => (
              <li key={blocker}>- {blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {viewModel.evidenceItems.length > 0 ? (
        <div className="mt-3 rounded-lg bg-background/80 px-3 py-2 text-xs">
          <div className="font-medium">测试证据</div>
          <ul className="mt-2 space-y-1">
            {viewModel.evidenceItems.map((item) => (
              <li key={`${item.command}-${item.statusLabel}`}>
                <span className="font-medium">{item.statusLabel}</span>
                {' '}
                <code>{item.command}</code>
                {' '}
                {item.summary}
                {item.durationLabel ? ` (${item.durationLabel})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {viewModel.documents.map((document) => (
          <article key={document.relativePath} className="rounded-card bg-background px-3 py-3 text-text-primary shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{document.displayName}</div>
                <div className="mt-1 truncate font-mono text-[11px] text-text-tertiary">
                  {document.relativePath}
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1 text-[11px] text-text-tertiary">
                <span>{document.revisionLabel}</span>
                <span>{document.checksumLabel}</span>
              </div>
            </div>
            <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-card bg-surface-muted/70 px-3 py-3 text-xs leading-5 text-text-primary">
              {document.loading
                ? '正在读取 Tester 产物...'
                : document.error
                  ? `读取失败：${document.error}`
                  : document.content}
            </pre>
          </article>
        ))}
      </div>

      <label className="mt-4 block text-xs font-medium text-emerald-700 dark:text-emerald-200" htmlFor="pipeline-tester-feedback">
        修订反馈
      </label>
      <textarea
        id="pipeline-tester-feedback"
        value={feedback}
        onChange={(event) => {
          setFeedback(event.target.value)
          setFeedbackError(null)
        }}
        placeholder={viewModel.feedbackPlaceholder}
        rows={3}
        className="mt-2 w-full resize-none rounded-card border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary shadow-sm outline-none transition focus:ring-2 focus:ring-focus"
      />
      {feedbackError ? <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">{feedbackError}</div> : null}
      {error ? <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</div> : null}

      <div className="mt-3 grid grid-cols-1 gap-2">
        <button
          type="button"
          disabled={viewModel.approveDisabled}
          onClick={() => runAction(onApprove)}
          className="rounded-control bg-status-success px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-status-success/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {viewModel.approveLabel}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={handleReject}
          className="rounded-control bg-background px-3 py-2 text-sm font-medium text-text-primary shadow-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {viewModel.rejectLabel}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => runAction(onRerun)}
          className="rounded-control bg-background px-3 py-2 text-sm font-medium text-text-secondary shadow-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {viewModel.rerunLabel}
        </button>
      </div>
    </section>
  )
}

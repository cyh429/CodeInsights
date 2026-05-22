import * as React from 'react'
import type {
  PipelineDeveloperStageOutput,
  PipelinePatchWorkDocumentRef,
  PipelinePlannerStageOutput,
} from '@codeinsights/shared'

export interface ReviewDocumentItemViewModel {
  displayName: string
  relativePath: string
  checksumLabel: string
  revisionLabel: string
  loading: boolean
  content?: string
  error?: string
}

export interface ReviewDocumentBoardViewModel {
  empty: boolean
  approveDisabled: boolean
  approveLabel: string
  title: string
  subtitle: string
  countLabel: string
  feedbackPlaceholder: string
  rejectFeedbackError: string
  rejectLabel: string
  rerunLabel: string
  warning?: string
  documents: ReviewDocumentItemViewModel[]
}

type ReviewDocumentStage = 'planner' | 'developer'

function checksumLabel(checksum?: string): string {
  return checksum ? `sha256:${checksum.slice(0, 8)}` : 'checksum 缺失'
}

export function collectPlannerDocumentRefs(
  output: PipelinePlannerStageOutput | null | undefined,
): PipelinePatchWorkDocumentRef[] {
  if (!output) return []
  if (output.documentRefs?.length) return output.documentRefs

  return [output.planRef, output.testPlanRef]
    .filter((ref): ref is PipelinePatchWorkDocumentRef => Boolean(ref))
}

export function collectDeveloperDocumentRefs(
  output: PipelineDeveloperStageOutput | null | undefined,
): PipelinePatchWorkDocumentRef[] {
  if (!output) return []
  return [output.devDocRef, output.devDoc]
    .filter((ref): ref is PipelinePatchWorkDocumentRef => Boolean(ref))
    .filter((ref, index, refs) => refs.findIndex((item) => item.relativePath === ref.relativePath) === index)
}

function textForStage(stage: ReviewDocumentStage) {
  if (stage === 'developer') {
    return {
      title: '审核 Developer 开发文档',
      subtitle: '文档审核',
      approveLabel: '接受开发文档并开始审查',
      submittingApproveLabel: '正在进入审查',
      warningSubject: 'Developer 文档',
      feedbackPlaceholder: '指出 dev.md 或代码实现需要 developer 修订的地方',
      rejectFeedbackError: '请填写需要 developer 修订的具体反馈。',
      rejectLabel: '要求修订',
      rerunLabel: '重跑开发',
    }
  }

  return {
    title: '审核 Planner 方案',
    subtitle: '文档审核',
    approveLabel: '接受方案并开始开发',
    submittingApproveLabel: '正在进入开发',
    warningSubject: 'Planner 文档',
    feedbackPlaceholder: '指出 plan.md 或 test-plan.md 需要 planner 修订的地方',
    rejectFeedbackError: '请填写需要 planner 修订的具体反馈。',
    rejectLabel: '要求修订',
    rerunLabel: '重跑计划',
  }
}

export function buildReviewDocumentBoardViewModel({
  stage = 'planner',
  documents,
  contents,
  loadingPaths,
  readErrors,
  submitting,
}: {
  stage?: ReviewDocumentStage
  documents: PipelinePatchWorkDocumentRef[]
  contents: Map<string, string>
  loadingPaths: Set<string>
  readErrors: Map<string, string>
  submitting: boolean
}): ReviewDocumentBoardViewModel {
  const missingChecksum = documents.some((document) => !document.checksum)
  const hasLoading = documents.some((document) => loadingPaths.has(document.relativePath))
  const hasReadErrors = documents.some((document) => readErrors.has(document.relativePath))
  const missingContent = documents.some((document) => {
    const content = contents.get(document.relativePath)
    return !loadingPaths.has(document.relativePath)
      && !readErrors.has(document.relativePath)
      && (!content || !content.trim())
  })
  const empty = documents.length === 0
  const text = textForStage(stage)
  const warning = (() => {
    if (missingChecksum) return '存在缺少 checksum 的文档，不能继续审核。'
    if (hasLoading) return `仍在读取 ${text.warningSubject}，加载完成后才能继续审核。`
    if (hasReadErrors) return `存在读取失败的 ${text.warningSubject}，请刷新后重试。`
    if (missingContent) return `存在缺少正文的 ${text.warningSubject}，请刷新后重试。`
    return undefined
  })()

  return {
    empty,
    approveDisabled: submitting || empty || missingChecksum || hasLoading || hasReadErrors || missingContent,
    approveLabel: submitting ? text.submittingApproveLabel : text.approveLabel,
    title: text.title,
    subtitle: text.subtitle,
    countLabel: `${documents.length} 份文档`,
    feedbackPlaceholder: text.feedbackPlaceholder,
    rejectFeedbackError: text.rejectFeedbackError,
    rejectLabel: text.rejectLabel,
    rerunLabel: text.rerunLabel,
    warning,
    documents: documents.map((document) => ({
      displayName: document.displayName,
      relativePath: document.relativePath,
      checksumLabel: checksumLabel(document.checksum),
      revisionLabel: `第 ${document.revision ?? 1} 版`,
      loading: loadingPaths.has(document.relativePath),
      content: contents.get(document.relativePath),
      error: readErrors.get(document.relativePath),
    })),
  }
}

export function ReviewDocumentBoard({
  stage = 'planner',
  documents,
  contents,
  loadingPaths,
  readErrors,
  onApprove,
  onReject,
  onRerun,
}: {
  stage?: ReviewDocumentStage
  documents: PipelinePatchWorkDocumentRef[]
  contents: Map<string, string>
  loadingPaths: Set<string>
  readErrors: Map<string, string>
  onApprove: () => Promise<void>
  onReject: (feedback: string) => Promise<void>
  onRerun: () => Promise<void>
}): React.ReactElement {
  const [feedback, setFeedback] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null)
  const viewModel = buildReviewDocumentBoardViewModel({
    stage,
    documents,
    contents,
    loadingPaths,
    readErrors,
    submitting,
  })

  const runAction = async (action: () => Promise<void>): Promise<void> => {
    setSubmitting(true)
    setError(null)
    try {
      await action()
    } catch (submitError) {
      console.error('[ReviewDocumentBoard] 文档审核失败:', submitError)
      setError(submitError instanceof Error ? submitError.message : '提交审核失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async (): Promise<void> => {
    const trimmed = feedback.trim()
    if (!trimmed) {
      setFeedbackError(viewModel.rejectFeedbackError)
      return
    }
    setFeedbackError(null)
    await runAction(() => onReject(trimmed))
  }

  return (
    <section className="rounded-panel border border-status-running-border bg-status-running-bg px-4 py-4 text-text-primary shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.16em] text-status-running-fg">{viewModel.subtitle}</div>
          <h2 className="mt-1 text-base font-semibold text-text-primary">{viewModel.title}</h2>
        </div>
        <div className="rounded-full border border-status-running-border bg-background/80 px-3 py-1 text-xs font-semibold text-status-running-fg">
          {viewModel.countLabel}
        </div>
      </div>

      {viewModel.warning ? (
        <div className="mt-3 rounded-card border border-status-waiting-border bg-status-waiting-bg px-3 py-2 text-xs text-status-waiting-fg">
          {viewModel.warning}
        </div>
      ) : null}

      {viewModel.empty ? (
        <div className="mt-4 rounded-card bg-background/80 px-3 py-3 text-sm text-text-secondary">
          Planner 尚未生成可审核文档。
        </div>
      ) : (
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
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-card bg-surface-muted/70 px-3 py-3 text-xs leading-5 text-text-primary">
                {document.loading
                  ? '正在读取文档...'
                  : document.error
                    ? `读取失败：${document.error}`
                    : document.content ?? '文档内容暂不可用。'}
              </pre>
            </article>
          ))}
        </div>
      )}

      <label className="mt-4 block text-xs font-semibold text-status-running-fg" htmlFor="pipeline-document-review-feedback">
        修订反馈
      </label>
      <textarea
        id="pipeline-document-review-feedback"
        value={feedback}
        onChange={(event) => {
          setFeedback(event.target.value)
          if (feedbackError) setFeedbackError(null)
          if (error) setError(null)
        }}
        placeholder={viewModel.feedbackPlaceholder}
        className="mt-2 min-h-24 w-full rounded-card border border-status-running-border bg-background px-3 py-3 text-sm text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-focus"
      />
      {feedbackError ? (
        <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">{feedbackError}</div>
      ) : null}
      {error ? (
        <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={viewModel.approveDisabled}
          onClick={() => void runAction(onApprove)}
          className="rounded-control bg-status-success px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-status-success/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {viewModel.approveLabel}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleReject()}
          className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {viewModel.rejectLabel}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void runAction(onRerun)}
          className="rounded-control border border-border-subtle bg-background px-4 py-2 text-sm font-medium text-text-primary shadow-sm transition-colors hover:bg-surface-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {viewModel.rerunLabel}
        </button>
      </div>
    </section>
  )
}

import * as React from 'react'
import type {
  PipelinePatchWorkDocumentRef,
  PipelineReviewIssue,
  PipelineReviewIssueSeverity,
  PipelineReviewerStageOutput,
} from '@codeinsights/shared'

interface ReviewerIssueItemViewModel extends PipelineReviewIssue {
  severityLabel: string
  categoryLabel: string
  statusLabel: string
}

interface ReviewerIssueGroupViewModel {
  severity: PipelineReviewIssueSeverity
  severityLabel: string
  issues: ReviewerIssueItemViewModel[]
}

interface ReviewerIssueDocumentViewModel {
  displayName: string
  relativePath: string
  checksumLabel: string
  revisionLabel: string
}

export interface ReviewerIssueBoardViewModel {
  approved: boolean
  summary: string
  iterationLabel: string
  openIssueCount: number
  groups: ReviewerIssueGroupViewModel[]
  reviewDocument?: ReviewerIssueDocumentViewModel
  reviewContent?: string
}

const SEVERITY_ORDER: PipelineReviewIssueSeverity[] = ['blocker', 'major', 'minor', 'nit']

const SEVERITY_LABELS: Record<PipelineReviewIssueSeverity, string> = {
  blocker: '阻塞',
  major: '主要',
  minor: '次要',
  nit: '细节',
}

const CATEGORY_LABELS: Record<PipelineReviewIssue['category'], string> = {
  correctness: '正确性',
  regression: '回归',
  test_gap: '测试缺口',
  maintainability: '可维护性',
  security: '安全',
  style: '风格',
}

const STATUS_LABELS: Record<PipelineReviewIssue['status'], string> = {
  open: '待修复',
  fixed: '已修复',
  accepted_risk: '接受风险',
}

function checksumLabel(checksum?: string): string {
  return checksum ? `sha256:${checksum.slice(0, 8)}` : 'checksum 缺失'
}

function documentViewModel(document: PipelinePatchWorkDocumentRef | undefined): ReviewerIssueDocumentViewModel | undefined {
  if (!document) return undefined
  return {
    displayName: document.displayName,
    relativePath: document.relativePath,
    checksumLabel: checksumLabel(document.checksum),
    revisionLabel: `第 ${document.revision ?? 1} 版`,
  }
}

function fallbackIssues(issues: string[]): PipelineReviewIssue[] {
  return issues.map((issue, index) => ({
    id: `CI-REV-${String(index + 1).padStart(3, '0')}`,
    severity: 'major',
    category: 'correctness',
    title: issue,
    detail: issue,
    status: 'open',
  }))
}

function toIssueItem(issue: PipelineReviewIssue): ReviewerIssueItemViewModel {
  return {
    ...issue,
    severityLabel: SEVERITY_LABELS[issue.severity],
    categoryLabel: CATEGORY_LABELS[issue.category],
    statusLabel: STATUS_LABELS[issue.status],
  }
}

export function buildReviewerIssueBoardViewModel(
  output: PipelineReviewerStageOutput | null | undefined,
  options: {
    iteration: number
    maxIterations: number
    reviewContent?: string
  },
): ReviewerIssueBoardViewModel {
  const sourceIssues = output?.structuredIssues?.length
    ? output.structuredIssues
    : fallbackIssues(output?.issues ?? [])
  const items = sourceIssues.map(toIssueItem)
  const groups = SEVERITY_ORDER
    .map((severity) => ({
      severity,
      severityLabel: SEVERITY_LABELS[severity],
      issues: items.filter((issue) => issue.severity === severity),
    }))
    .filter((group) => group.issues.length > 0)

  return {
    approved: output?.approved ?? false,
    summary: output?.summary ?? 'Reviewer 尚未输出审查结果。',
    iterationLabel: `第 ${options.iteration} / ${options.maxIterations} 轮审查`,
    openIssueCount: items.filter((issue) => issue.status === 'open').length,
    groups,
    reviewDocument: documentViewModel(output?.reviewDocRef ?? output?.reviewDoc),
    reviewContent: options.reviewContent,
  }
}

export function ReviewerIssueBoard({
  output,
  iteration,
  maxIterations,
  reviewContent,
}: {
  output: PipelineReviewerStageOutput | null | undefined
  iteration: number
  maxIterations: number
  reviewContent?: string
}): React.ReactElement {
  const viewModel = buildReviewerIssueBoardViewModel(output, {
    iteration,
    maxIterations,
    reviewContent,
  })

  return (
    <section className="rounded-panel border border-status-danger-border bg-status-danger-bg px-4 py-4 text-text-primary shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.16em] text-status-danger-fg">Reviewer 结果</div>
          <h2 className="mt-1 text-base font-semibold text-text-primary">
            {viewModel.approved ? '审查通过' : '审查未通过'}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{viewModel.summary}</p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs text-status-danger-fg">
          <span className="rounded-full border border-status-danger-border bg-background/80 px-3 py-1 font-semibold">{viewModel.iterationLabel}</span>
          <span>{viewModel.openIssueCount} 个待修复</span>
        </div>
      </div>

      {viewModel.reviewDocument ? (
        <div className="mt-3 rounded-card bg-background px-3 py-2 text-xs text-text-primary shadow-sm">
          <div className="font-medium">{viewModel.reviewDocument.displayName}</div>
          <div className="mt-1 font-mono text-[11px] text-text-tertiary">
            {viewModel.reviewDocument.relativePath} · {viewModel.reviewDocument.revisionLabel} · {viewModel.reviewDocument.checksumLabel}
          </div>
        </div>
      ) : null}

      {viewModel.groups.length > 0 ? (
        <div className="mt-4 space-y-3">
          {viewModel.groups.map((group) => (
            <div key={group.severity} className="rounded-card bg-background px-3 py-3 shadow-sm">
              <div className="text-xs font-semibold text-text-secondary">{group.severityLabel}</div>
              <div className="mt-2 space-y-2">
                {group.issues.map((issue) => (
                  <article key={issue.id} className="rounded-card bg-surface-muted/60 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{issue.title}</div>
                        <div className="mt-1 text-xs text-text-tertiary">
                          {issue.id} · {issue.categoryLabel} · {issue.statusLabel}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-text-primary">{issue.detail}</p>
                    {issue.file ? (
                      <div className="mt-2 font-mono text-[11px] text-text-tertiary">
                        {issue.file}{issue.line ? `:${issue.line}` : ''}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-card bg-background/80 px-3 py-3 text-sm text-text-secondary">
          当前没有结构化 reviewer issue。
        </div>
      )}

      {viewModel.reviewContent ? (
        <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-card bg-background px-3 py-3 text-xs leading-5 text-text-primary shadow-sm">
          {viewModel.reviewContent}
        </pre>
      ) : null}
    </section>
  )
}

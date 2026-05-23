import * as React from 'react'
import type {
  PipelineCommitterStageOutput,
  PipelinePatchWorkDocumentRef,
  PipelineTestEvidence,
  PipelineTesterStageOutput,
} from '@codeinsights/shared'

interface CommitterDocumentViewModel {
  displayName: string
  relativePath: string
  checksumLabel: string
  revisionLabel: string
  loading: boolean
  content?: string
  error?: string
}

interface CommitterEvidenceViewModel {
  command: string
  statusLabel: string
  summary: string
}

export interface CommitterPanelViewModel {
  title: string
  subtitle: string
  statusLabel: string
  statusTone: 'success' | 'warning' | 'neutral'
  summary: string
  commitMessage: string
  prTitle: string
  approveDisabled: boolean
  approveLabel: string
  rejectLabel: string
  rerunLabel: string
  feedbackPlaceholder: string
  feedbackError: string
  warning?: string
  blockers: string[]
  risks: string[]
  patchSetSummary: string
  branchSummary: string
  commitCandidateItems: string[]
  excludedItems: string[]
  localCommitLabel: string
  localCommitDisabled: boolean
  localCommitResult?: string
  remoteConfirmLabel: string
  remoteSubmitLabel: string
  remoteSubmitDisabled: boolean
  remoteSubmitWarning?: string
  remoteSubmitResult?: string
  remoteTargetSummary: string
  evidenceItems: CommitterEvidenceViewModel[]
  documents: CommitterDocumentViewModel[]
}

function checksumLabel(checksum?: string): string {
  return checksum ? `sha256:${checksum.slice(0, 8)}` : 'checksum 缺失'
}

function dedupeDocuments(documents: PipelinePatchWorkDocumentRef[]): PipelinePatchWorkDocumentRef[] {
  return documents.filter((document, index, items) =>
    items.findIndex((item) => item.relativePath === document.relativePath) === index)
}

export function collectCommitterPatchWorkRefs(
  output: PipelineCommitterStageOutput | null | undefined,
): PipelinePatchWorkDocumentRef[] {
  if (!output) return []
  return dedupeDocuments([
    output.commitDocRef,
    output.prDocRef,
    output.commitRef,
    output.prRef,
  ].filter((ref): ref is PipelinePatchWorkDocumentRef => Boolean(ref)))
}

function statusLabel(status: PipelineTestEvidence['status']): string {
  if (status === 'passed') return '通过'
  if (status === 'failed') return '失败'
  return '跳过'
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

export function buildCommitterPanelViewModel({
  output,
  testerOutput,
  contents,
  loadingPaths,
  readErrors,
  submitting,
  remoteConfirmed,
}: {
  output: PipelineCommitterStageOutput | null | undefined
  testerOutput: PipelineTesterStageOutput | null | undefined
  contents: Map<string, string>
  loadingPaths: Set<string>
  readErrors: Map<string, string>
  submitting: boolean
  remoteConfirmed?: boolean
}): CommitterPanelViewModel {
  const documents = collectCommitterPatchWorkRefs(output)
  const blockers = output?.blockers ?? []
  const missingRequiredDocuments = Boolean(output)
    && ((!output?.commitDocRef && !output?.commitRef) || (!output?.prDocRef && !output?.prRef))
  const remoteCreated = output?.submissionStatus === 'remote_pr_created' || output?.remoteSubmission?.status === 'created'
  const remoteFailed = output?.submissionStatus === 'remote_pr_failed' || output?.remoteSubmission?.status === 'failed'
  const hasForbiddenRemoteAttempt = Boolean(output?.remoteSubmission?.attempted) && !remoteCreated && !remoteFailed
  const missingChecksum = documents.some((document) => !document.checksum)
  const hasLoading = documents.some((document) => loadingPaths.has(document.relativePath))
  const hasReadErrors = documents.some((document) => readErrors.has(document.relativePath))
  const missingContent = documents.some((document) => {
    const content = contents.get(document.relativePath)
    return !loadingPaths.has(document.relativePath)
      && !readErrors.has(document.relativePath)
      && (!content || !content.trim())
  })
  const localCommitCreated = output?.submissionStatus === 'local_commit_created' || output?.localCommit?.status === 'created'
  const statusTone: CommitterPanelViewModel['statusTone'] = blockers.length > 0
    ? 'warning'
    : output?.submissionStatus === 'draft_only' || localCommitCreated || remoteCreated
      ? 'success'
      : 'neutral'
  const hasDocumentBlockingIssue = missingRequiredDocuments
    || missingChecksum
    || hasLoading
    || hasReadErrors
    || missingContent
  const warning = (() => {
    if (!output) return 'Committer 尚未生成提交材料。'
    if (blockers.length > 0) return '存在提交材料 blocker，需要修订后才能完成。'
    if (
      output.submissionStatus !== 'draft_only'
      && output.submissionStatus !== 'local_commit_created'
      && output.submissionStatus !== 'remote_pr_created'
      && output.submissionStatus !== 'remote_pr_failed'
    ) {
      return '当前提交状态不允许直接完成；远端写必须使用独立高风险确认。'
    }
    if (hasForbiddenRemoteAttempt) return '提交材料包含未受控远端提交尝试记录，禁止继续。'
    if (missingRequiredDocuments) return '缺少 commit.md 或 pr.md 提交材料，不能继续。'
    if (missingChecksum) return '存在缺少 checksum 的提交材料，不能继续。'
    if (hasLoading) return '仍在读取提交材料，加载完成后才能继续。'
    if (hasReadErrors) return '存在读取失败的提交材料，请刷新后重试。'
    if (missingContent) return '存在缺少正文的提交材料，请刷新后重试。'
    return undefined
  })()
  const stats = sumPatchSetStats(testerOutput)
  const evidence = testerOutput?.patchSet?.testEvidence ?? testerOutput?.testEvidence ?? []
  const commitCandidateFiles = output?.localCommit?.files?.length
    ? output.localCommit.files
    : testerOutput?.patchSet?.files ?? []
  const excludedItems = output?.localCommit?.excludedFiles?.length
    ? output.localCommit.excludedFiles
    : ['patch-work/**']
  const baseBranch = output?.localCommit?.baseBranch ?? testerOutput?.patchSet?.baseBranch
  const workingBranch = output?.localCommit?.workingBranch ?? testerOutput?.patchSet?.workingBranch
  const branchSummary = baseBranch && workingBranch
    ? `${baseBranch} -> ${workingBranch}`
    : workingBranch ?? '工作分支未知'
  const localCommitResult = output?.localCommit?.status === 'created' && output.localCommit.commitHash
    ? `已创建 ${output.localCommit.commitHash}`
    : output?.localCommit?.status === 'failed'
      ? `提交失败：${output.localCommit.error ?? '未知错误'}`
      : undefined
  const remoteSubmission = output?.remoteSubmission
  const remoteCommitHash = remoteSubmission?.commitHash ?? output?.localCommit?.commitHash
  const remoteHeadBranch = remoteSubmission?.headBranch ?? output?.localCommit?.workingBranch
  const remoteTargetSummary = remoteCommitHash
    ? `${remoteSubmission?.remoteName ?? 'origin'} ${remoteHeadBranch ?? branchSummary} (${remoteCommitHash})`
    : '需要先创建本地 commit'
  const remoteSubmitResult = remoteSubmission?.status === 'created'
    ? `已创建 ${remoteSubmission.prUrl ?? '远端 PR'}`
    : remoteSubmission?.status === 'pushed'
      ? `已推送远端分支，PR 创建失败：${remoteSubmission.error ?? '可重试创建 PR'}`
    : remoteSubmission?.status === 'failed'
      ? `远端提交失败：${remoteSubmission.error ?? '未知错误'}`
      : undefined
  const remoteSubmitWarning = !localCommitCreated
    ? '需要先创建本地 commit，远端写不会直接基于草稿执行。'
    : !remoteConfirmed
      ? '需要单独二次确认后才会执行 push / PR。'
      : undefined
  const remoteSubmitDisabled = submitting
    || hasDocumentBlockingIssue
    || blockers.length > 0
    || !localCommitCreated
    || remoteCreated
    || remoteConfirmed !== true

  return {
    title: '审核提交材料',
    subtitle: '提交草稿',
    statusLabel: blockers.length > 0
      ? '提交材料阻塞'
      : remoteCreated
        ? '远端 PR 已创建'
        : remoteFailed
          ? '远端提交失败'
          : localCommitCreated
            ? '本地 commit 已创建'
            : output?.submissionStatus === 'draft_only'
              ? '草稿待确认'
              : output
                ? '非草稿状态已阻止'
                : '等待提交草稿',
    statusTone,
    summary: output?.summary ?? '等待 Committer 输出 commit.md 和 pr.md。',
    commitMessage: output?.commitMessage ?? '',
    prTitle: output?.prTitle ?? '',
    approveDisabled: submitting || Boolean(warning) || localCommitCreated || remoteCreated,
    approveLabel: submitting ? '正在保存提交材料' : '仅保存提交材料并完成',
    rejectLabel: '要求修订',
    rerunLabel: '重跑提交草稿',
    feedbackPlaceholder: '指出 commit.md、pr.md 或风险说明需要修订的地方',
    feedbackError: '请填写需要修订的具体反馈。',
    warning,
    blockers,
    risks: output?.risks ?? [],
    patchSetSummary: `${stats.files} 个文件，+${stats.additions} / -${stats.deletions}`,
    branchSummary,
    commitCandidateItems: commitCandidateFiles.map((file) => file.path),
    excludedItems,
    localCommitLabel: localCommitCreated
      ? '本地 commit 已创建'
      : submitting
        ? '正在创建本地 commit'
        : '创建本地 commit',
    localCommitDisabled: submitting || Boolean(warning) || localCommitCreated || remoteCreated,
    localCommitResult,
    remoteConfirmLabel: '我确认将本地 commit 推送到远端并创建 Draft PR',
    remoteSubmitLabel: remoteCreated
      ? '远端 PR 已创建'
      : submitting
        ? '正在执行远端提交'
        : '推送并创建 Draft PR',
    remoteSubmitDisabled,
    remoteSubmitWarning,
    remoteSubmitResult,
    remoteTargetSummary,
    evidenceItems: evidence.map((item) => ({
      command: item.command,
      statusLabel: statusLabel(item.status),
      summary: item.summary,
    })),
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

function toneClass(tone: CommitterPanelViewModel['statusTone']): string {
  if (tone === 'success') return 'border-status-success-border bg-status-success-bg text-status-success-fg'
  if (tone === 'warning') return 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg'
  return 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg'
}

export function CommitterPanel({
  output,
  testerOutput,
  contents,
  loadingPaths,
  readErrors,
  onApprove,
  onLocalCommit,
  onRemoteSubmit,
  onReject,
  onRerun,
}: {
  output: PipelineCommitterStageOutput | null | undefined
  testerOutput: PipelineTesterStageOutput | null | undefined
  contents: Map<string, string>
  loadingPaths: Set<string>
  readErrors: Map<string, string>
  onApprove: () => Promise<void>
  onLocalCommit: () => Promise<void>
  onRemoteSubmit: () => Promise<void>
  onReject: (feedback: string) => Promise<void>
  onRerun: () => Promise<void>
}): React.ReactElement {
  const [feedback, setFeedback] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [remoteConfirmed, setRemoteConfirmed] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null)
  const viewModel = buildCommitterPanelViewModel({
    output,
    testerOutput,
    contents,
    loadingPaths,
    readErrors,
    submitting,
    remoteConfirmed,
  })

  const runAction = async (action: () => Promise<void>): Promise<void> => {
    setSubmitting(true)
    setError(null)
    try {
      await action()
    } catch (submitError) {
      console.error('[CommitterPanel] 提交材料审核失败:', submitError)
      setError(submitError instanceof Error ? submitError.message : '提交审核失败，请稍后重试。')
    } finally {
      setSubmitting(false)
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
    <section className="rounded-panel border border-status-running-border bg-status-running-bg px-4 py-4 text-text-primary shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.16em] text-status-running-fg">{viewModel.subtitle}</div>
          <h2 className="mt-1 text-base font-semibold text-text-primary">{viewModel.title}</h2>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass(viewModel.statusTone)}`}>
          {viewModel.statusLabel}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-text-primary">{viewModel.summary}</p>
      <div className="mt-3 space-y-2 rounded-card bg-background/80 px-3 py-2 text-xs text-text-secondary">
        <div>Commit：{viewModel.commitMessage || '待生成'}</div>
        <div>PR：{viewModel.prTitle || '待生成'}</div>
        <div>分支：{viewModel.branchSummary}</div>
        <div>Patch-set：{viewModel.patchSetSummary}</div>
        {viewModel.localCommitResult ? <div>本地提交：{viewModel.localCommitResult}</div> : null}
        <div>远端目标：{viewModel.remoteTargetSummary}</div>
        {viewModel.remoteSubmitResult ? <div>远端提交：{viewModel.remoteSubmitResult}</div> : null}
      </div>

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

      {viewModel.risks.length > 0 ? (
        <div className="mt-3 rounded-card bg-background/80 px-3 py-2 text-xs text-text-primary">
          <div className="font-medium">风险提示</div>
          <ul className="mt-2 space-y-1">
            {viewModel.risks.map((risk) => (
              <li key={risk}>- {risk}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {viewModel.evidenceItems.length > 0 ? (
        <div className="mt-3 rounded-card bg-background/80 px-3 py-2 text-xs text-text-primary">
          <div className="font-medium">测试证据</div>
          <ul className="mt-2 space-y-1">
            {viewModel.evidenceItems.map((item) => (
              <li key={`${item.command}-${item.statusLabel}`}>
                <span className="font-medium">{item.statusLabel}</span>
                {' '}
                <code>{item.command}</code>
                {' '}
                {item.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 rounded-card bg-background/80 px-3 py-2 text-xs text-text-primary">
        <div>
          <div className="font-medium">本地 commit 候选文件</div>
          <ul className="mt-2 space-y-1 text-text-secondary">
            {viewModel.commitCandidateItems.length > 0
              ? viewModel.commitCandidateItems.map((item) => <li key={item}>- {item}</li>)
              : <li>- 无候选文件</li>}
          </ul>
        </div>
        <div>
          <div className="font-medium">默认排除</div>
          <ul className="mt-2 space-y-1 text-text-secondary">
            {viewModel.excludedItems.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      </div>

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
                ? '正在读取提交材料...'
                : document.error
                  ? `读取失败：${document.error}`
                  : document.content}
            </pre>
          </article>
        ))}
      </div>

      <label className="mt-4 block text-xs font-semibold text-status-running-fg" htmlFor="pipeline-committer-feedback">
        修订反馈
      </label>
      <textarea
        id="pipeline-committer-feedback"
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
          className="rounded-control bg-status-running px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-status-running/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {viewModel.approveLabel}
        </button>
        <button
          type="button"
          disabled={viewModel.localCommitDisabled}
          onClick={() => runAction(onLocalCommit)}
          className="rounded-control bg-status-success px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-status-success/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {viewModel.localCommitLabel}
        </button>
        <label className="flex items-start gap-2 rounded-card bg-background px-3 py-2 text-xs text-text-secondary shadow-sm">
          <input
            type="checkbox"
            checked={remoteConfirmed}
            onChange={(event) => setRemoteConfirmed(event.target.checked)}
            className="mt-0.5"
          />
          <span>{viewModel.remoteConfirmLabel}</span>
        </label>
        {viewModel.remoteSubmitWarning ? (
          <div className="rounded-card border border-status-waiting-border bg-status-waiting-bg px-3 py-2 text-xs text-status-waiting-fg">
            {viewModel.remoteSubmitWarning}
          </div>
        ) : null}
        <button
          type="button"
          disabled={viewModel.remoteSubmitDisabled}
          onClick={() => runAction(onRemoteSubmit)}
          className="rounded-control bg-status-danger px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-status-danger/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {viewModel.remoteSubmitLabel}
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

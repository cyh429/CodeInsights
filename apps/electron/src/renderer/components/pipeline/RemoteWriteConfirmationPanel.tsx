import * as React from 'react'
import type {
  PipelineCommitterStageOutput,
  PipelineSubmissionPlan,
} from '@codeinsights/shared'

export interface RemoteWriteConfirmationViewModel {
  title: string
  subtitle: string
  operationId: string
  remoteSummary: string
  commitHash: string
  prTitle: string
  prBody: string
  confirmLabel: string
  confirmDisabled: boolean
  warningItems: string[]
  blockerItems: string[]
  recoveryMessage?: string
}

export function buildRemoteWriteConfirmationViewModel({
  output,
  submissionPlan,
  operationId,
  confirmed,
  submitting,
}: {
  output: PipelineCommitterStageOutput | null | undefined
  submissionPlan?: PipelineSubmissionPlan | null
  operationId: string
  confirmed: boolean
  submitting: boolean
}): RemoteWriteConfirmationViewModel {
  const localCommit = submissionPlan?.localCommit ?? output?.localCommit
  const remoteSubmission = submissionPlan?.remoteSubmission ?? output?.remoteSubmission
  const remoteName = submissionPlan?.remoteName ?? remoteSubmission?.remoteName ?? 'origin'
  const baseBranch = submissionPlan?.baseBranch ?? remoteSubmission?.baseBranch ?? localCommit?.baseBranch ?? 'main'
  const headBranch = submissionPlan?.headBranch
    ?? remoteSubmission?.headBranch
    ?? localCommit?.workingBranch
    ?? '工作分支未知'
  const commitHash = remoteSubmission?.commitHash ?? localCommit?.commitHash ?? ''
  const prTitle = submissionPlan?.prTitle ?? remoteSubmission?.prTitle ?? output?.prTitle ?? ''
  const prBody = submissionPlan?.prBody ?? remoteSubmission?.prBody ?? output?.prBody ?? ''
  const blockerItems = [
    ...(submissionPlan?.blockers ?? []),
    ...(!commitHash ? ['缺少本地 commit hash'] : []),
    ...(output?.blockers ?? []),
  ]
  const retryPrOnly = remoteSubmission?.status === 'pushed'
  const warningItems = [
    ...new Set([
      '确认后会执行 git push，并创建 GitHub Draft PR。',
      'patch-work/** 必须保持在提交和推送范围之外。',
      ...(retryPrOnly ? ['远端分支已推送，本次只重试创建 Draft PR。'] : []),
      ...(submissionPlan?.warnings ?? []),
      ...(output?.risks ?? []),
    ]),
  ]
  const recoveryMessage = remoteSubmission?.existingPr && remoteSubmission.prUrl
    ? `已存在同一 head/base 的 PR，未执行远端推送：${remoteSubmission.prUrl}`
    : retryPrOnly
    ? `已推送远端分支，PR 创建失败：${remoteSubmission?.error ?? '可重试创建 PR'}`
    : remoteSubmission?.status === 'failed'
      ? `远端提交失败：${remoteSubmission.error ?? '未知错误'}`
      : undefined

  return {
    title: '确认远端写',
    subtitle: '高风险操作',
    operationId,
    remoteSummary: `${remoteName} ${baseBranch} -> ${headBranch}`,
    commitHash,
    prTitle,
    prBody,
    confirmLabel: retryPrOnly
      ? '重试创建 Draft PR'
      : submitting
        ? '正在执行远端写'
        : '确认推送并创建 Draft PR',
    confirmDisabled: submitting || !confirmed || blockerItems.length > 0,
    warningItems,
    blockerItems,
    recoveryMessage,
  }
}

export function RemoteWriteConfirmationPanel({
  output,
  submissionPlan,
  operationId,
  onConfirm,
  onCancel,
}: {
  output: PipelineCommitterStageOutput | null | undefined
  submissionPlan?: PipelineSubmissionPlan | null
  operationId: string
  onConfirm: () => Promise<void>
  onCancel: (feedback: string) => Promise<void>
}): React.ReactElement {
  const [confirmed, setConfirmed] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const viewModel = buildRemoteWriteConfirmationViewModel({
    output,
    submissionPlan,
    operationId,
    confirmed,
    submitting,
  })

  const runAction = async (action: () => Promise<void>): Promise<void> => {
    setSubmitting(true)
    setError(null)
    try {
      await action()
    } catch (submitError) {
      console.error('[RemoteWriteConfirmationPanel] 远端写确认失败:', submitError)
      setError(submitError instanceof Error ? submitError.message : '远端写确认失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-panel border border-status-danger/40 bg-status-danger/10 px-4 py-4 text-text-primary shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.16em] text-status-danger">{viewModel.subtitle}</div>
          <h2 className="mt-1 text-base font-semibold text-text-primary">{viewModel.title}</h2>
        </div>
        <span className="rounded-full border border-status-danger/40 bg-background px-3 py-1 text-xs font-semibold text-status-danger">
          需要二次确认
        </span>
      </div>

      <div className="mt-3 space-y-2 rounded-card bg-background/85 px-3 py-2 text-xs text-text-secondary">
        <div>Operation：{viewModel.operationId}</div>
        <div>Remote：{viewModel.remoteSummary}</div>
        <div>Commit：{viewModel.commitHash || '缺少 commit hash'}</div>
        <div>PR：{viewModel.prTitle || '缺少 PR title'}</div>
      </div>

      {viewModel.recoveryMessage ? (
        <div className="mt-3 rounded-card border border-status-waiting-border bg-status-waiting-bg px-3 py-2 text-xs text-status-waiting-fg">
          {viewModel.recoveryMessage}
        </div>
      ) : null}

      {viewModel.blockerItems.length > 0 ? (
        <div className="mt-3 rounded-card border border-status-waiting-border bg-status-waiting-bg px-3 py-2 text-xs text-status-waiting-fg">
          <div className="font-medium">阻塞项</div>
          <ul className="mt-2 space-y-1">
            {viewModel.blockerItems.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 rounded-card bg-background/85 px-3 py-2 text-xs text-text-primary">
        <div className="font-medium">确认前检查</div>
        <ul className="mt-2 space-y-1 text-text-secondary">
          {viewModel.warningItems.map((item) => <li key={item}>- {item}</li>)}
        </ul>
      </div>

      <label className="mt-3 flex items-start gap-2 rounded-card bg-background/85 px-3 py-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5"
        />
        <span>我确认本次远端写风险，并允许执行 push / Draft PR 操作。</span>
      </label>

      {error ? <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</div> : null}

      <div className="mt-3 grid grid-cols-1 gap-2">
        <button
          type="button"
          disabled={viewModel.confirmDisabled}
          onClick={() => runAction(onConfirm)}
          className="rounded-control bg-status-danger px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-status-danger/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {viewModel.confirmLabel}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => runAction(() => onCancel('取消远端写，返回提交材料审核'))}
          className="rounded-control bg-background px-3 py-2 text-sm font-medium text-text-primary shadow-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          取消远端写
        </button>
      </div>
    </section>
  )
}

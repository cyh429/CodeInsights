import * as React from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'
import type {
  ContributionMode,
  ContributionTaskStatus,
  ContributionTaskSummary,
  ContributionTaskSummaryEvent,
  PipelineLocalCommitSummary,
  PipelineRemoteSubmissionSummary,
} from '@codeinsights/shared'

interface ContributionTaskDashboardViewModelInput {
  summary: ContributionTaskSummary | null
  loading: boolean
  error: string | null
}

interface ContributionTaskDashboardEventViewModel {
  id: string
  title: string
  detail?: string
}

export interface ContributionTaskDashboardViewModel {
  statusLabel: string
  taskTitle: string
  repositoryRoot: string
  branchSummary: string
  modeLabel: string
  patchWorkSummary: string
  localCommitSummary: string
  remoteSubmissionSummary: string
  allowRemoteWritesLabel: string
  recentEvents: ContributionTaskDashboardEventViewModel[]
  error?: string
}

function statusLabel(status?: ContributionTaskStatus): string {
  switch (status) {
    case 'created':
      return '任务已创建'
    case 'exploring':
      return '探索中'
    case 'task_selected':
      return '任务已选择'
    case 'planning':
    case 'plan_review':
      return '方案审核'
    case 'developing':
    case 'dev_review':
      return '开发审核'
    case 'reviewing':
      return '代码审查'
    case 'testing':
      return '测试中'
    case 'committing':
      return '提交材料'
    case 'completed':
      return '已完成'
    case 'failed':
      return '已失败'
    default:
      return '等待贡献任务'
  }
}

function modeLabel(mode?: ContributionMode): string {
  if (mode === 'local_commit') return '本地 commit'
  if (mode === 'remote_pr') return 'Draft PR'
  return '本地 patch'
}

function branchSummary(summary: ContributionTaskSummary | null): string {
  const base = summary?.repository?.baseBranch
  const working = summary?.repository?.workingBranch
  if (base && working) return `${base} -> ${working}`
  return working ?? base ?? '分支未知'
}

function patchWorkSummary(summary: ContributionTaskSummary | null): string {
  const patchWork = summary?.patchWork
  if (!patchWork) return '尚未初始化'
  if (!patchWork.manifestFound) return patchWork.error ? `读取失败：${patchWork.error}` : '尚未初始化'
  return `${patchWork.fileCount} 个文件，${patchWork.acceptedFileCount} 个已接受`
}

function localCommitSummary(localCommit?: PipelineLocalCommitSummary): string {
  if (!localCommit || localCommit.status === 'not_requested') return '尚未创建'
  if (localCommit.status === 'created') return `已创建 ${localCommit.commitHash ?? 'commit'}`
  return `创建失败：${localCommit.error ?? '未知错误'}`
}

function remoteSubmissionSummary(remoteSubmission?: PipelineRemoteSubmissionSummary): string {
  if (!remoteSubmission || remoteSubmission.status === 'not_requested') return '尚未提交远端'
  if (remoteSubmission.status === 'created') return `Draft PR 已创建：${remoteSubmission.prUrl ?? 'URL 未返回'}`
  if (remoteSubmission.status === 'pushed') {
    return `远端分支已推送，PR 创建失败：${remoteSubmission.error ?? '可重试创建 PR'}`
  }
  return `远端提交失败：${remoteSubmission.error ?? '未知错误'}`
}

function eventViewModel(event: ContributionTaskSummaryEvent): ContributionTaskDashboardEventViewModel {
  return {
    id: event.id,
    title: event.title,
    detail: event.detail,
  }
}

export function buildContributionTaskDashboardViewModel({
  summary,
  loading,
  error,
}: ContributionTaskDashboardViewModelInput): ContributionTaskDashboardViewModel {
  if (loading) {
    return {
      statusLabel: '读取中',
      taskTitle: '正在读取贡献任务状态',
      repositoryRoot: summary?.repository?.root ?? '尚未绑定仓库',
      branchSummary: branchSummary(summary),
      modeLabel: modeLabel(summary?.mode),
      patchWorkSummary: patchWorkSummary(summary),
      localCommitSummary: localCommitSummary(summary?.localCommit),
      remoteSubmissionSummary: remoteSubmissionSummary(summary?.remoteSubmission),
      allowRemoteWritesLabel: summary?.allowRemoteWrites ? '已授权远端写' : '未授权远端写',
      recentEvents: summary?.recentEvents.map(eventViewModel) ?? [],
    }
  }

  if (error) {
    return {
      statusLabel: '读取失败',
      taskTitle: '贡献任务状态暂不可用',
      repositoryRoot: '尚未绑定仓库',
      branchSummary: '分支未知',
      modeLabel: '本地 patch',
      patchWorkSummary: '尚未初始化',
      localCommitSummary: '尚未创建',
      remoteSubmissionSummary: '尚未提交远端',
      allowRemoteWritesLabel: '未授权远端写',
      recentEvents: [],
      error,
    }
  }

  if (!summary?.task) {
    return {
      statusLabel: '等待贡献任务',
      taskTitle: '尚未创建 ContributionTask',
      repositoryRoot: '尚未绑定仓库',
      branchSummary: '分支未知',
      modeLabel: '本地 patch',
      patchWorkSummary: '尚未初始化',
      localCommitSummary: '尚未创建',
      remoteSubmissionSummary: '尚未提交远端',
      allowRemoteWritesLabel: '未授权远端写',
      recentEvents: [],
      error: summary?.error,
    }
  }

  return {
    statusLabel: statusLabel(summary.task.status),
    taskTitle: summary.task.selectedTaskTitle ?? summary.task.selectedReportId ?? '贡献任务已创建',
    repositoryRoot: summary.repository?.root ?? summary.task.repositoryRoot,
    branchSummary: branchSummary(summary),
    modeLabel: modeLabel(summary.mode),
    patchWorkSummary: patchWorkSummary(summary),
    localCommitSummary: localCommitSummary(summary.localCommit),
    remoteSubmissionSummary: remoteSubmissionSummary(summary.remoteSubmission),
    allowRemoteWritesLabel: summary.allowRemoteWrites ? '已授权远端写' : '未授权远端写',
    recentEvents: summary.recentEvents.map(eventViewModel),
    error: summary.error,
  }
}

export function ContributionTaskDashboard({
  summary,
  loading,
  error,
  onRefresh,
  onOpenPatchWorkDir,
}: {
  summary: ContributionTaskSummary | null
  loading: boolean
  error: string | null
  onRefresh: () => Promise<void>
  onOpenPatchWorkDir: () => Promise<void>
}): React.ReactElement {
  const [refreshing, setRefreshing] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const viewModel = buildContributionTaskDashboardViewModel({ summary, loading: loading || refreshing, error })

  const runAction = async (action: () => Promise<void>): Promise<void> => {
    setActionError(null)
    try {
      await action()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '操作失败，请稍后重试。')
    }
  }

  const refresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await runAction(onRefresh)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className="rounded-panel bg-background/95 px-4 py-4 text-text-primary shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-text-tertiary">Contribution Task</div>
          <h2 className="mt-1 text-base font-semibold text-text-primary">{viewModel.taskTitle}</h2>
        </div>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-text-secondary">
          {viewModel.statusLabel}
        </span>
      </div>

      <div className="mt-3 grid gap-3 text-xs text-text-secondary md:grid-cols-2 xl:grid-cols-4">
        <div>
          <div className="font-semibold text-text-primary">仓库</div>
          <div className="mt-1 break-all">{viewModel.repositoryRoot}</div>
        </div>
        <div>
          <div className="font-semibold text-text-primary">分支</div>
          <div className="mt-1">{viewModel.branchSummary}</div>
        </div>
        <div>
          <div className="font-semibold text-text-primary">模式</div>
          <div className="mt-1">{viewModel.modeLabel} · {viewModel.allowRemoteWritesLabel}</div>
        </div>
        <div>
          <div className="font-semibold text-text-primary">patch-work</div>
          <div className="mt-1">{viewModel.patchWorkSummary}</div>
        </div>
        <div>
          <div className="font-semibold text-text-primary">本地 commit</div>
          <div className="mt-1">{viewModel.localCommitSummary}</div>
        </div>
        <div>
          <div className="font-semibold text-text-primary">Draft PR</div>
          <div className="mt-1">{viewModel.remoteSubmissionSummary}</div>
        </div>
      </div>

      {viewModel.recentEvents.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-secondary">
          {viewModel.recentEvents.map((event) => (
            <span key={event.id} className="rounded-full bg-surface-muted px-2.5 py-1">
              {event.title}{event.detail ? `：${event.detail}` : ''}
            </span>
          ))}
        </div>
      ) : null}

      {viewModel.error || actionError ? (
        <div className="mt-3 rounded-card border border-status-waiting-border bg-status-waiting-bg px-3 py-2 text-xs text-status-waiting-fg">
          {actionError ?? viewModel.error}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-control bg-background px-3 py-2 text-xs font-medium text-text-primary shadow-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <RefreshCw size={14} aria-hidden="true" />
          刷新状态
        </button>
        <button
          type="button"
          disabled={refreshing || !summary?.task}
          onClick={() => void runAction(onOpenPatchWorkDir)}
          className="inline-flex items-center gap-2 rounded-control bg-background px-3 py-2 text-xs font-medium text-text-primary shadow-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <FolderOpen size={14} aria-hidden="true" />
          打开 patch-work
        </button>
      </div>
    </section>
  )
}

import type {
  ContributionTask,
  ContributionMode,
  ContributionTaskEvent,
  ContributionTaskSummary,
  ContributionTaskSummaryEvent,
  PipelineChangedFileType,
  PipelineCommitterStageOutput,
  PipelineLocalCommitSummary,
  PipelinePatchSetFile,
  PipelineRemoteSubmissionSummary,
  PipelineStageOutputMap,
  PipelineSubmissionPlan,
} from '@codeinsights/shared'
import { replayPipelineRecords } from '@codeinsights/shared'
import {
  getContributionTaskByPipelineSessionId,
  getContributionTaskEvents,
} from './contribution-task-service'
import {
  getPipelineRecords,
  getPipelineSessionMeta,
} from './pipeline-session-manager'
import { readPatchWorkManifest } from './pipeline-patch-work-service'
import { resolvePatchWorkDir } from './pipeline-patch-work-service'
import {
  redactPreflightDiagnosticText,
  redactPreflightRemoteUrl,
} from './pipeline-preflight-service'
import {
  redactSecretText,
  validateCommitPreconditions,
} from './pipeline-git-submission-service'

interface SessionReadModelInput {
  sessionId: string
}

const DEFAULT_EXCLUDED_FILES = ['patch-work/**']

function redactReadModelText(value: string): string {
  return redactPreflightDiagnosticText(redactSecretText(value))
}

function redactReadModelUrl(value: string): string {
  return redactPreflightRemoteUrl(redactSecretText(value))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireSessionId(sessionId: string): string {
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('Pipeline read model 参数无效: sessionId')
  }
  return sessionId.trim()
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
}

function uniqueStrings(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index)
}

function normalizeChangedFileType(value: unknown): PipelineChangedFileType {
  return value === 'added' || value === 'deleted' || value === 'renamed' || value === 'modified'
    ? value
    : 'modified'
}

function toPatchSetFile(value: unknown): PipelinePatchSetFile | undefined {
  if (!isObject(value) || typeof value.path !== 'string' || !value.path.trim()) {
    return undefined
  }

  return {
    path: value.path.trim(),
    changeType: normalizeChangedFileType(value.changeType),
    summary: typeof value.summary === 'string' ? value.summary : value.path.trim(),
    additions: typeof value.additions === 'number' ? value.additions : undefined,
    deletions: typeof value.deletions === 'number' ? value.deletions : undefined,
  }
}

function toLocalCommitSummary(value: unknown): PipelineLocalCommitSummary | undefined {
  if (!isObject(value)) return undefined
  const status = value.status === 'created' || value.status === 'failed' || value.status === 'not_requested'
    ? value.status
    : undefined
  if (!status) return undefined

  return {
    attempted: value.attempted === true,
    operationId: typeof value.operationId === 'string' ? value.operationId : undefined,
    commitHash: typeof value.commitHash === 'string' ? value.commitHash : undefined,
    commitMessage: typeof value.commitMessage === 'string' ? redactReadModelText(value.commitMessage) : undefined,
    status,
    error: typeof value.error === 'string' ? redactReadModelText(value.error) : undefined,
    files: Array.isArray(value.files)
      ? value.files.map(toPatchSetFile).filter((file): file is PipelinePatchSetFile => Boolean(file))
      : undefined,
    excludedFiles: asStringArray(value.excludedFiles),
    baseBranch: typeof value.baseBranch === 'string' ? value.baseBranch : undefined,
    workingBranch: typeof value.workingBranch === 'string' ? value.workingBranch : undefined,
    headCommit: typeof value.headCommit === 'string' ? value.headCommit : undefined,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : undefined,
  }
}

function toRemoteSubmissionSummary(value: unknown): PipelineRemoteSubmissionSummary | undefined {
  if (!isObject(value)) return undefined
  const status = value.status === 'created'
    || value.status === 'failed'
    || value.status === 'pushed'
    || value.status === 'not_requested'
    ? value.status
    : undefined
  if (!status) return undefined

  return {
    attempted: value.attempted === true,
    operationId: typeof value.operationId === 'string' ? value.operationId : undefined,
    commitHash: typeof value.commitHash === 'string' ? value.commitHash : undefined,
    status,
    type: value.type === 'push' || value.type === 'pull_request' ? value.type : undefined,
    provider: value.provider === 'gh_cli' || value.provider === 'github_api' ? value.provider : undefined,
    remoteName: typeof value.remoteName === 'string' ? value.remoteName : undefined,
    sanitizedRemoteUrl: typeof value.sanitizedRemoteUrl === 'string'
      ? redactReadModelUrl(value.sanitizedRemoteUrl)
      : undefined,
    githubRepo: typeof value.githubRepo === 'string' ? value.githubRepo : undefined,
    baseBranch: typeof value.baseBranch === 'string' ? value.baseBranch : undefined,
    headBranch: typeof value.headBranch === 'string' ? value.headBranch : undefined,
    pushedRef: typeof value.pushedRef === 'string' ? value.pushedRef : undefined,
    prTitle: typeof value.prTitle === 'string' ? redactReadModelText(value.prTitle) : undefined,
    prBody: typeof value.prBody === 'string' ? redactReadModelText(value.prBody) : undefined,
    prUrl: typeof value.prUrl === 'string' ? redactReadModelUrl(value.prUrl) : undefined,
    prNumber: typeof value.prNumber === 'number' ? value.prNumber : undefined,
    existingPr: value.existingPr === true ? true : undefined,
    draft: typeof value.draft === 'boolean' ? value.draft : undefined,
    error: typeof value.error === 'string' ? redactReadModelText(value.error) : undefined,
    pushedAt: typeof value.pushedAt === 'number' ? value.pushedAt : undefined,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : undefined,
  }
}

function localCommitFromEvent(event: ContributionTaskEvent): PipelineLocalCommitSummary | undefined {
  if (event.type !== 'local_commit_created' && event.type !== 'local_commit_failed') return undefined
  return toLocalCommitSummary(event.payload?.localCommit)
}

function remoteSubmissionFromEvent(event: ContributionTaskEvent): PipelineRemoteSubmissionSummary | undefined {
  if (event.type !== 'remote_submission_created' && event.type !== 'remote_submission_failed') return undefined
  return toRemoteSubmissionSummary(event.payload?.remoteSubmission)
}

function latestLocalCommit(events: ContributionTaskEvent[]): PipelineLocalCommitSummary | undefined {
  for (const event of events.slice().reverse()) {
    const summary = localCommitFromEvent(event)
    if (summary) return summary
  }
  return undefined
}

function latestRemoteSubmission(events: ContributionTaskEvent[]): PipelineRemoteSubmissionSummary | undefined {
  for (const event of events.slice().reverse()) {
    const summary = remoteSubmissionFromEvent(event)
    if (summary) return summary
  }
  return undefined
}

function isMeaningfulLocalCommit(value: PipelineLocalCommitSummary | undefined): boolean {
  return Boolean(value && (value.status !== 'not_requested' || value.attempted || value.commitHash))
}

function isMeaningfulRemoteSubmission(value: PipelineRemoteSubmissionSummary | undefined): boolean {
  return Boolean(value && (value.status !== 'not_requested' || value.attempted || value.prUrl))
}

function eventTitle(event: ContributionTaskEvent): string {
  switch (event.type) {
    case 'task_created':
      return '贡献任务已创建'
    case 'task_updated':
      return '任务状态已更新'
    case 'preflight_completed':
      return '启动检查完成'
    case 'patch_work_updated':
      return 'patch-work 已更新'
    case 'document_revision_created':
      return '文档 revision 已生成'
    case 'local_commit_created':
      return '本地 commit 已创建'
    case 'local_commit_failed':
      return '本地 commit 失败'
    case 'remote_write_confirmed':
      return '远端写已确认'
    case 'remote_submission_created':
      return '远端 PR 已创建'
    case 'remote_submission_failed':
      return '远端提交失败'
    case 'task_failed':
      return '贡献任务失败'
    default:
      return '贡献任务事件'
  }
}

function eventDetail(event: ContributionTaskEvent): string | undefined {
  const payload = event.payload
  if (!isObject(payload)) return undefined
  const localCommit = toLocalCommitSummary(payload.localCommit)
  if (localCommit?.commitHash) return localCommit.commitHash
  const remoteSubmission = toRemoteSubmissionSummary(payload.remoteSubmission)
  if (remoteSubmission?.prUrl) return remoteSubmission.prUrl
  if (remoteSubmission?.error) return remoteSubmission.error
  if (typeof payload.error === 'string') return redactReadModelText(payload.error)
  if (typeof payload.relativePath === 'string') return payload.relativePath
  if (typeof payload.status === 'string') return payload.status
  return undefined
}

function toSummaryEvent(event: ContributionTaskEvent): ContributionTaskSummaryEvent {
  return {
    id: event.id,
    type: event.type,
    title: eventTitle(event),
    detail: eventDetail(event),
    createdAt: event.createdAt,
  }
}

function readStageOutputs(sessionId: string): PipelineStageOutputMap {
  const meta = getPipelineSessionMeta(sessionId)
  if (!meta) return {}
  return replayPipelineRecords(sessionId, getPipelineRecords(sessionId), {
    version: meta.version,
    now: meta.updatedAt,
  }).stageOutputs ?? {}
}

function getCommitterOutput(sessionId: string): PipelineCommitterStageOutput | undefined {
  const output = readStageOutputs(sessionId).committer
  return output?.node === 'committer' ? output : undefined
}

function ensurePatchWorkExcluded(files: string[]): string[] {
  return uniqueStrings([
    ...files,
    ...DEFAULT_EXCLUDED_FILES,
  ])
}

function sanitizeContributionTask(task: ContributionTask): ContributionTask {
  return {
    ...task,
    repositoryUrl: task.repositoryUrl ? redactReadModelUrl(task.repositoryUrl) : undefined,
    issueUrl: task.issueUrl ? redactReadModelUrl(task.issueUrl) : undefined,
    selectedTaskTitle: task.selectedTaskTitle ? redactReadModelText(task.selectedTaskTitle) : undefined,
  }
}

export function getContributionTaskSummary(input: SessionReadModelInput): ContributionTaskSummary {
  const sessionId = requireSessionId(input.sessionId)
  const task = getContributionTaskByPipelineSessionId(sessionId)
  if (!task) {
    return {
      sessionId,
      task: null,
      recentEvents: [],
      updatedAt: Date.now(),
      error: `未找到贡献任务: ${sessionId}`,
    }
  }

  const events = getContributionTaskEvents(task.id)
  const committerOutput = getCommitterOutput(sessionId)
  const committerLocalCommit = toLocalCommitSummary(committerOutput?.localCommit)
  const committerRemoteSubmission = toRemoteSubmissionSummary(committerOutput?.remoteSubmission)
  const localCommit = isMeaningfulLocalCommit(committerLocalCommit)
    ? committerLocalCommit
    : latestLocalCommit(events) ?? committerLocalCommit
  const remoteSubmission = isMeaningfulRemoteSubmission(committerRemoteSubmission)
    ? committerRemoteSubmission
    : latestRemoteSubmission(events) ?? committerRemoteSubmission
  const patchWork = (() => {
    try {
      const patchWorkDir = resolvePatchWorkDir(task.repositoryRoot, { create: false })
      const manifest = readPatchWorkManifest(task.repositoryRoot)
      return {
        dir: patchWorkDir,
        manifestFound: true,
        fileCount: manifest.files.length,
        acceptedFileCount: manifest.files.filter((file) => file.acceptedRevision !== undefined).length,
        updatedAt: manifest.updatedAt,
      }
    } catch (error) {
      return {
        dir: task.patchWorkDir,
        manifestFound: false,
        fileCount: 0,
        acceptedFileCount: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })()

  return {
    sessionId,
    task: sanitizeContributionTask(task),
    repository: {
      root: task.repositoryRoot,
      url: task.repositoryUrl ? redactReadModelUrl(task.repositoryUrl) : undefined,
      issueUrl: task.issueUrl ? redactReadModelUrl(task.issueUrl) : undefined,
      baseBranch: task.baseBranch,
      workingBranch: task.workingBranch,
      baseCommit: task.baseCommit,
    },
    mode: task.contributionMode,
    allowRemoteWrites: task.allowRemoteWrites,
    patchWork,
    localCommit,
    remoteSubmission,
    recentEvents: events
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6)
      .map(toSummaryEvent),
    updatedAt: Math.max(task.updatedAt, patchWork.updatedAt ?? task.updatedAt),
  }
}

export function getPipelineSubmissionPlan(input: SessionReadModelInput): PipelineSubmissionPlan {
  const sessionId = requireSessionId(input.sessionId)
  const task = getContributionTaskByPipelineSessionId(sessionId)
  if (!task) {
    return {
      sessionId,
      mode: 'local_patch',
      commitMessage: '',
      prTitle: '',
      prBody: '',
      candidateFiles: [],
      excludedFiles: DEFAULT_EXCLUDED_FILES,
      blockers: [`未找到贡献任务: ${sessionId}`],
      warnings: [],
      updatedAt: Date.now(),
    }
  }

  const events = getContributionTaskEvents(task.id)
  const stageOutputs = readStageOutputs(sessionId)
  const committerOutput = stageOutputs.committer?.node === 'committer'
    ? stageOutputs.committer
    : undefined
  const testerOutput = stageOutputs.tester?.node === 'tester'
    ? stageOutputs.tester
    : undefined
  const committerLocalCommit = toLocalCommitSummary(committerOutput?.localCommit)
  const committerRemoteSubmission = toRemoteSubmissionSummary(committerOutput?.remoteSubmission)
  const localCommit = isMeaningfulLocalCommit(committerLocalCommit)
    ? committerLocalCommit
    : latestLocalCommit(events) ?? committerLocalCommit
  const remoteSubmission = isMeaningfulRemoteSubmission(committerRemoteSubmission)
    ? committerRemoteSubmission
    : latestRemoteSubmission(events) ?? committerRemoteSubmission
  const blockers = [...(committerOutput?.blockers ?? [])]
  const warnings = [...(committerOutput?.risks ?? [])]

  let candidateFiles = localCommit?.files?.map((file) => file.path)
    ?? testerOutput?.patchSet?.files.map((file) => file.path)
    ?? []
  let excludedFiles = localCommit?.excludedFiles ?? []
  let workingBranch = localCommit?.workingBranch
    ?? remoteSubmission?.headBranch
    ?? testerOutput?.patchSet?.workingBranch
    ?? task.workingBranch
  let baseBranch = localCommit?.baseBranch
    ?? remoteSubmission?.baseBranch
    ?? testerOutput?.patchSet?.baseBranch
    ?? task.baseBranch

  if (!committerOutput) {
    blockers.push('Committer 尚未生成提交材料')
  } else if (localCommit?.status !== 'created') {
    try {
      const commitPlan = validateCommitPreconditions({
        repositoryRoot: task.repositoryRoot,
        commitMessage: committerOutput.commitMessage,
        operationId: `${sessionId}:submission-plan:local_commit`,
      })
      candidateFiles = commitPlan.changedFiles.map((file) => file.path)
      excludedFiles = commitPlan.excludedFiles
      workingBranch = commitPlan.workingBranch ?? workingBranch
      baseBranch = commitPlan.baseBranch ?? baseBranch
      if (!commitPlan.canCommit) {
        blockers.push(...commitPlan.blockers)
      }
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (remoteSubmission?.status === 'pushed') {
    warnings.push('远端分支已推送但 PR 创建失败，可在确认后重试创建 PR。')
  }

  const mode: ContributionMode = remoteSubmission?.status === 'created'
    ? 'remote_pr'
    : localCommit?.status === 'created'
      ? 'local_commit'
      : task.contributionMode

  return {
    sessionId,
    mode,
    commitMessage: redactReadModelText(committerOutput?.commitMessage ?? localCommit?.commitMessage ?? ''),
    prTitle: redactReadModelText(committerOutput?.prTitle ?? remoteSubmission?.prTitle ?? ''),
    prBody: redactReadModelText(committerOutput?.prBody ?? remoteSubmission?.prBody ?? ''),
    baseBranch,
    headBranch: remoteSubmission?.headBranch ?? workingBranch,
    remoteName: remoteSubmission?.remoteName ?? 'origin',
    sanitizedRemoteUrl: remoteSubmission?.sanitizedRemoteUrl,
    candidateFiles: uniqueStrings(candidateFiles),
    excludedFiles: ensurePatchWorkExcluded(excludedFiles),
    blockers: uniqueStrings(blockers.map(redactReadModelText)),
    warnings: uniqueStrings(warnings.map(redactReadModelText)),
    localCommit,
    remoteSubmission,
    updatedAt: Date.now(),
  }
}

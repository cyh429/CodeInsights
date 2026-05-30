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
  PipelineRecord,
  PipelineRemoteSubmissionSummary,
  PipelineReportExport,
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
const REPORT_STAGE_LABELS: Record<keyof PipelineStageOutputMap, string> = {
  explorer: 'Explorer',
  planner: 'Planner',
  developer: 'Developer',
  reviewer: 'Reviewer',
  tester: 'Tester',
  committer: 'Committer',
}

function redactReadModelText(value: string): string {
  return redactPreflightDiagnosticText(redactSecretText(value))
    .replace(/\bAuthorization\s*[:=]\s*[A-Za-z][A-Za-z0-9_-]*\s+\S+/gi, 'Authorization: [REDACTED]')
    .replace(/\bBearer\s+[^\s"'`<>]+/gi, '[REDACTED]')
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

function formatReportTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

function sanitizeReportFileName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return normalized || 'pipeline-report'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function closeReportHtmlLists(lines: string[], listDepth: number): number {
  while (listDepth > 0) {
    lines.push('</ul>')
    listDepth -= 1
  }
  return listDepth
}

function markdownLineToHtmlContent(value: string): string {
  return escapeHtml(value)
    .replace(/\bon[a-z]+\s*=/gi, (match) => match.replace('=', '&#61;'))
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

function buildPipelineReportHtml(input: {
  title: string
  markdown: string
  generatedAt: number
}): string {
  const body: string[] = []
  let listDepth = 0

  for (const rawLine of input.markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (!line.trim()) {
      listDepth = closeReportHtmlLists(body, listDepth)
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      listDepth = closeReportHtmlLists(body, listDepth)
      const level = heading[1]!.length
      body.push(`<h${level}>${markdownLineToHtmlContent(heading[2]!)}</h${level}>`)
      continue
    }

    const bullet = /^(\s*)-\s+(.+)$/.exec(line)
    if (bullet) {
      const indent = Math.min(3, Math.floor(bullet[1]!.length / 2))
      while (listDepth < 1) {
        body.push('<ul>')
        listDepth += 1
      }
      body.push(`<li class="indent-${indent}">${markdownLineToHtmlContent(bullet[2]!)}</li>`)
      continue
    }

    listDepth = closeReportHtmlLists(body, listDepth)
    body.push(`<p>${markdownLineToHtmlContent(line)}</p>`)
  }

  closeReportHtmlLists(body, listDepth)

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(input.title)}</title>`,
    '<style>',
    ':root{color-scheme:light;--bg:#f7f8fb;--surface:#ffffff;--text:#18202f;--muted:#5d687a;--line:#d8dee9;--accent:#2563eb;}',
    '*{box-sizing:border-box;}',
    'body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65;}',
    'main{width:min(920px,calc(100% - 48px));margin:40px auto;padding:40px;background:var(--surface);box-shadow:0 18px 48px rgba(15,23,42,.10);}',
    'h1{margin:0 0 24px;font-size:30px;line-height:1.2;}',
    'h2{margin:32px 0 12px;padding-top:18px;border-top:1px solid var(--line);font-size:20px;}',
    'h3{margin:22px 0 8px;font-size:16px;}',
    'p{margin:8px 0;color:var(--muted);}',
    'ul{margin:8px 0 8px 20px;padding:0;}',
    'li{margin:4px 0;}',
    '.indent-1{margin-left:18px;}',
    '.indent-2,.indent-3{margin-left:36px;}',
    'code{padding:2px 5px;border-radius:5px;background:#eef2ff;color:#1d4ed8;font-family:"SFMono-Regular",Consolas,monospace;font-size:.92em;}',
    '.meta{margin-bottom:24px;color:var(--muted);font-size:13px;}',
    '@media print{body{background:#fff;}main{width:auto;margin:0;padding:24px;box-shadow:none;}h2{break-after:avoid;}li,p{break-inside:avoid;}}',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    `<div class="meta">生成时间：${escapeHtml(formatReportTime(input.generatedAt))}</div>`,
    ...body,
    '</main>',
    '</body>',
    '</html>',
  ].join('\n')
}

function modeLabel(mode?: ContributionMode): string {
  if (mode === 'remote_pr') return 'Draft PR'
  if (mode === 'local_commit') return '本地 commit'
  return '本地 patch'
}

function taskStatusLabel(task: ContributionTask | null | undefined): string {
  if (!task) return '未找到贡献任务'
  return task.status
}

function findLatestUserInput(records: PipelineRecord[]): string | undefined {
  return records
    .slice()
    .reverse()
    .find((record): record is Extract<PipelineRecord, { type: 'user_input' }> => record.type === 'user_input')
    ?.content
}

function appendSection(lines: string[], title: string): void {
  lines.push('', `## ${title}`, '')
}

function appendBullet(lines: string[], label: string, value: string | undefined): void {
  if (!value || !value.trim()) return
  lines.push(`- ${label}：${redactReadModelText(value)}`)
}

function appendOptionalList(lines: string[], title: string, values: string[]): void {
  const normalized = uniqueStrings(values.map(redactReadModelText))
  if (normalized.length === 0) {
    lines.push(`- ${title}：暂无`)
    return
  }
  lines.push(`- ${title}：`)
  for (const value of normalized) {
    lines.push(`  - ${value}`)
  }
}

function localCommitReportLine(localCommit: PipelineLocalCommitSummary | undefined): string {
  if (!localCommit || localCommit.status === 'not_requested') {
    return '未创建'
  }
  if (localCommit.status === 'created') {
    return `已创建 ${redactReadModelText(localCommit.commitHash ?? 'commit')}（operation: ${redactReadModelText(localCommit.operationId ?? 'unknown')}）`
  }
  return `创建失败：${redactReadModelText(localCommit.error ?? '未知错误')}`
}

function remoteSubmissionReportLine(remoteSubmission: PipelineRemoteSubmissionSummary | undefined): string {
  if (!remoteSubmission || remoteSubmission.status === 'not_requested') {
    return '未提交远端'
  }
  const operation = remoteSubmission.operationId ? `（operation: ${redactReadModelText(remoteSubmission.operationId)}）` : ''
  if (remoteSubmission.status === 'created') {
    return `Draft PR 已创建：${redactReadModelUrl(remoteSubmission.prUrl ?? 'URL 未返回')}${operation}`
  }
  if (remoteSubmission.status === 'pushed') {
    return `远端分支已推送，PR 创建失败：${redactReadModelText(remoteSubmission.error ?? '可重试创建 PR')}${operation}`
  }
  return `远端提交失败：${redactReadModelText(remoteSubmission.error ?? '未知错误')}${operation}`
}

function appendStageSummaries(lines: string[], stageOutputs: PipelineStageOutputMap): void {
  const entries = Object.entries(REPORT_STAGE_LABELS) as Array<[keyof PipelineStageOutputMap, string]>
  for (const [node, label] of entries) {
    const output = stageOutputs[node]
    if (!output) continue
    lines.push(`### ${label}`)
    lines.push('')
    appendBullet(lines, '摘要', output.summary)
    if (node === 'tester' && output.node === 'tester') {
      appendOptionalList(lines, '测试命令', output.commands ?? [])
      appendOptionalList(lines, '测试结果', output.results ?? [])
      if (output.patchSet?.testEvidence?.length) {
        lines.push('- 测试证据：')
        for (const evidence of output.patchSet.testEvidence) {
          lines.push(`  - ${redactReadModelText(evidence.command)}：${evidence.status}，${redactReadModelText(evidence.summary)}`)
        }
      }
    }
    if (node === 'committer' && output.node === 'committer') {
      appendBullet(lines, '提交状态', output.submissionStatus)
      if (output.submissionStatus === 'draft_only') {
        lines.push('- draft-only：仅保存提交材料，不会创建本地 commit 或真实 PR。')
      }
    }
    lines.push('')
  }
}

function appendPatchWorkSummary(lines: string[], task: ContributionTask | null): void {
  if (!task) {
    lines.push('- patch-work：未找到贡献任务，无法读取。')
    return
  }

  try {
    const manifest = readPatchWorkManifest(task.repositoryRoot, { create: false })
    appendBullet(lines, '目录', manifest.patchWorkDir)
    if (manifest.files.length === 0) {
      lines.push('- 文件：暂无')
      return
    }
    lines.push('- 文件：')
    for (const file of manifest.files) {
      const accepted = file.acceptedRevision ? `，accepted r${file.acceptedRevision}` : ''
      lines.push(`  - ${redactReadModelText(file.relativePath)}（r${file.revision}${accepted}）`)
    }
  } catch (error) {
    lines.push(`- patch-work：读取失败，${redactReadModelText(error instanceof Error ? error.message : String(error))}`)
  }
}

function payloadString(payload: Record<string, unknown>, key: string, url = false): string | undefined {
  const value = payload[key]
  if (typeof value !== 'string' || !value.trim()) return undefined
  return url ? redactReadModelUrl(value) : redactReadModelText(value)
}

function remoteSubmissionPayload(payload: Record<string, unknown>): PipelineRemoteSubmissionSummary | undefined {
  return toRemoteSubmissionSummary(payload.remoteSubmission)
}

function appendAuditDetail(details: string[], value: string | undefined, url = false): void {
  if (!value || !value.trim()) return
  details.push(url ? redactReadModelUrl(value) : redactReadModelText(value))
}

function appendAuditEvents(lines: string[], events: ContributionTaskEvent[], records: PipelineRecord[]): void {
  const gateDecisions = records.filter((record): record is Extract<PipelineRecord, { type: 'gate_decision' }> =>
    record.type === 'gate_decision',
  )
  const errorRecords = records.filter((record): record is Extract<PipelineRecord, { type: 'error' }> =>
    record.type === 'error',
  )

  if (events.length === 0 && gateDecisions.length === 0 && errorRecords.length === 0) {
    lines.push('暂无人工审核、风险接受或错误记录。')
    return
  }

  for (const event of events.slice().sort((a, b) => a.createdAt - b.createdAt)) {
    const payload = isObject(event.payload) ? event.payload : {}
    const details = [
      payloadString(payload, 'operationId'),
      payloadString(payload, 'remoteName'),
      payloadString(payload, 'commitHash'),
    ].filter((item): item is string => Boolean(item))
    const baseBranch = payloadString(payload, 'baseBranch')
    const headBranch = payloadString(payload, 'headBranch')
    if (baseBranch || headBranch) {
      details.push(`${baseBranch ?? '?'} -> ${headBranch ?? '?'}`)
    }
    const remoteSubmission = remoteSubmissionPayload(payload)
    appendAuditDetail(details, remoteSubmission?.operationId)
    appendAuditDetail(details, remoteSubmission?.remoteName)
    if (remoteSubmission?.baseBranch || remoteSubmission?.headBranch) {
      const remoteBase = remoteSubmission.baseBranch ? redactReadModelText(remoteSubmission.baseBranch) : '?'
      const remoteHead = remoteSubmission.headBranch ? redactReadModelText(remoteSubmission.headBranch) : '?'
      details.push(`${remoteBase} -> ${remoteHead}`)
    }
    appendAuditDetail(details, remoteSubmission?.prUrl, true)

    const suffix = details.length ? `：${uniqueStrings(details).join('，')}` : ''
    lines.push(`- ${formatReportTime(event.createdAt)} ${eventTitle(event)}${suffix}`)
  }

  for (const decision of gateDecisions) {
    const mode = decision.submissionMode ? `，模式 ${decision.submissionMode}` : ''
    const feedback = decision.feedback ? `，反馈 ${redactReadModelText(decision.feedback)}` : ''
    lines.push(`- ${formatReportTime(decision.createdAt)} gate ${decision.kind ?? decision.node}：${decision.action}${mode}${feedback}`)
  }

  for (const record of errorRecords) {
    lines.push(`- ${formatReportTime(record.createdAt)} 错误：${redactReadModelText(record.error)}`)
  }
}

function buildPipelineReportMarkdown(input: {
  sessionId: string
  sessionTitle?: string
  generatedAt: number
  summary: ContributionTaskSummary
  plan: PipelineSubmissionPlan
  records: PipelineRecord[]
  events: ContributionTaskEvent[]
  stageOutputs: PipelineStageOutputMap
}): string {
  const task = input.summary.task
  const latestUserInput = findLatestUserInput(input.records)
  const lines: string[] = [
    '# Pipeline 贡献报告',
    '',
    `生成时间：${formatReportTime(input.generatedAt)}`,
    `会话：${redactReadModelText(input.sessionTitle ?? input.sessionId)}`,
  ]

  appendSection(lines, '任务')
  appendBullet(lines, '任务', task?.selectedTaskTitle ?? task?.selectedReportId ?? latestUserInput ?? input.summary.error)
  appendBullet(lines, '状态', taskStatusLabel(task))
  appendBullet(lines, '贡献模式', `${modeLabel(input.summary.mode ?? input.plan.mode)}（${input.summary.mode ?? input.plan.mode}）`)
  appendBullet(lines, '远端写授权', input.summary.allowRemoteWrites ? '已授权' : '未授权')

  appendSection(lines, '仓库与分支')
  appendBullet(lines, '仓库', input.summary.repository?.root)
  appendBullet(lines, '远端', input.summary.repository?.url ? redactReadModelUrl(input.summary.repository.url) : undefined)
  appendBullet(lines, 'Issue', input.summary.repository?.issueUrl ? redactReadModelUrl(input.summary.repository.issueUrl) : undefined)
  appendBullet(lines, '分支', `${input.plan.baseBranch ?? input.summary.repository?.baseBranch ?? '?'} -> ${input.plan.headBranch ?? input.summary.repository?.workingBranch ?? '?'}`)
  appendBullet(lines, 'base commit', input.summary.repository?.baseCommit)

  appendSection(lines, '阶段摘要')
  appendStageSummaries(lines, input.stageOutputs)
  if (Object.keys(input.stageOutputs).length === 0) {
    lines.push('暂无阶段结构化摘要。')
  }

  appendSection(lines, 'Patch-set')
  if (input.plan.candidateFiles.length === 0) {
    lines.push('- 候选文件：暂无提交候选文件')
  } else {
    appendOptionalList(lines, '候选文件', input.plan.candidateFiles)
  }
  appendOptionalList(lines, '排除文件', input.plan.excludedFiles)
  if (input.plan.blockers.length) appendOptionalList(lines, '阻塞项', input.plan.blockers)
  if (input.plan.warnings.length) appendOptionalList(lines, '风险提示', input.plan.warnings)

  appendSection(lines, '提交 / PR')
  appendBullet(lines, '本地 commit', localCommitReportLine(input.plan.localCommit ?? input.summary.localCommit))
  appendBullet(lines, '远端提交', remoteSubmissionReportLine(input.plan.remoteSubmission ?? input.summary.remoteSubmission))
  appendBullet(lines, 'Commit message', input.plan.commitMessage)
  appendBullet(lines, 'PR title', input.plan.prTitle)
  if ((input.stageOutputs.committer?.node === 'committer' && input.stageOutputs.committer.submissionStatus === 'draft_only')
    || input.plan.mode === 'local_patch') {
    lines.push('- draft-only：仅保存提交材料，不会创建本地 commit 或真实 PR。')
  }

  appendSection(lines, 'patch-work')
  appendPatchWorkSummary(lines, task)

  appendSection(lines, '人工审核与审计')
  appendAuditEvents(lines, input.events, input.records)

  appendSection(lines, '原始事件索引')
  lines.push(`- Pipeline records：${input.records.length}`)
  lines.push(`- ContributionTask events：${input.events.length}`)

  return lines.join('\n').trimEnd() + '\n'
}

function buildPipelineReportSubmissionPlan(input: {
  sessionId: string
  summary: ContributionTaskSummary
  events: ContributionTaskEvent[]
  stageOutputs: PipelineStageOutputMap
  generatedAt: number
}): PipelineSubmissionPlan {
  const task = input.summary.task
  if (!task) {
    return {
      sessionId: input.sessionId,
      mode: 'local_patch',
      commitMessage: '',
      prTitle: '',
      prBody: '',
      candidateFiles: [],
      excludedFiles: DEFAULT_EXCLUDED_FILES,
      blockers: [`未找到贡献任务: ${input.sessionId}`],
      warnings: [],
      updatedAt: input.generatedAt,
    }
  }

  const committerOutput = input.stageOutputs.committer?.node === 'committer'
    ? input.stageOutputs.committer
    : undefined
  const testerOutput = input.stageOutputs.tester?.node === 'tester'
    ? input.stageOutputs.tester
    : undefined
  const committerLocalCommit = toLocalCommitSummary(committerOutput?.localCommit)
  const committerRemoteSubmission = toRemoteSubmissionSummary(committerOutput?.remoteSubmission)
  const localCommit = isMeaningfulLocalCommit(committerLocalCommit)
    ? committerLocalCommit
    : latestLocalCommit(input.events) ?? committerLocalCommit
  const remoteSubmission = isMeaningfulRemoteSubmission(committerRemoteSubmission)
    ? committerRemoteSubmission
    : latestRemoteSubmission(input.events) ?? committerRemoteSubmission
  const candidateFiles = localCommit?.files?.map((file) => file.path)
    ?? testerOutput?.patchSet?.files.map((file) => file.path)
    ?? testerOutput?.changedFiles
    ?? []
  const excludedFiles = localCommit?.excludedFiles
    ?? (testerOutput?.patchSet?.excludesPatchWork ? DEFAULT_EXCLUDED_FILES : [])
  const blockers = [...(committerOutput?.blockers ?? [])]
  const warnings = [...(committerOutput?.risks ?? [])]

  if (!committerOutput) {
    blockers.push('Committer 尚未生成提交材料')
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
    sessionId: input.sessionId,
    mode,
    commitMessage: redactReadModelText(committerOutput?.commitMessage ?? localCommit?.commitMessage ?? ''),
    prTitle: redactReadModelText(committerOutput?.prTitle ?? remoteSubmission?.prTitle ?? ''),
    prBody: redactReadModelText(committerOutput?.prBody ?? remoteSubmission?.prBody ?? ''),
    baseBranch: localCommit?.baseBranch ?? remoteSubmission?.baseBranch ?? testerOutput?.patchSet?.baseBranch ?? task.baseBranch,
    headBranch: remoteSubmission?.headBranch ?? localCommit?.workingBranch ?? testerOutput?.patchSet?.workingBranch ?? task.workingBranch,
    remoteName: remoteSubmission?.remoteName ?? 'origin',
    sanitizedRemoteUrl: remoteSubmission?.sanitizedRemoteUrl,
    candidateFiles: uniqueStrings(candidateFiles),
    excludedFiles: ensurePatchWorkExcluded(excludedFiles),
    blockers: uniqueStrings(blockers.map(redactReadModelText)),
    warnings: uniqueStrings(warnings.map(redactReadModelText)),
    localCommit,
    remoteSubmission,
    updatedAt: input.generatedAt,
  }
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
      const manifest = readPatchWorkManifest(task.repositoryRoot, { create: false })
      return {
        dir: manifest.patchWorkDir,
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

export function exportPipelineReport(input: SessionReadModelInput): PipelineReportExport {
  const sessionId = requireSessionId(input.sessionId)
  const generatedAt = Date.now()
  const meta = getPipelineSessionMeta(sessionId)
  const summary = getContributionTaskSummary({ sessionId })
  const records = getPipelineRecords(sessionId)
  const events = summary.task ? getContributionTaskEvents(summary.task.id) : []
  const stageOutputs = meta
    ? replayPipelineRecords(sessionId, records, {
        version: meta.version,
        now: meta.updatedAt,
      }).stageOutputs ?? {}
    : {}
  const plan = buildPipelineReportSubmissionPlan({
    sessionId,
    summary,
    events,
    stageOutputs,
    generatedAt,
  })
  const safeSessionTitle = meta?.title ? redactReadModelText(meta.title) : undefined
  const title = safeSessionTitle ? `${safeSessionTitle} - Pipeline 贡献报告` : 'Pipeline 贡献报告'
  const markdown = buildPipelineReportMarkdown({
    sessionId,
    sessionTitle: meta?.title,
    generatedAt,
    summary,
    plan,
    records,
    events,
    stageOutputs,
  })
  const baseFileName = `${sanitizeReportFileName(safeSessionTitle ?? sessionId)}-${sessionId.slice(0, 8)}-pipeline-report`

  return {
    sessionId,
    title,
    markdown,
    html: buildPipelineReportHtml({ title, markdown, generatedAt }),
    fileName: `${baseFileName}.md`,
    htmlFileName: `${baseFileName}.html`,
    pdfFileName: `${baseFileName}.pdf`,
    generatedAt,
  }
}

import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type {
  PipelinePatchSetFile,
  PipelineRemoteSubmissionSummary,
  PipelineTestEvidence,
} from '@codeinsights/shared'

export interface BuildPipelinePatchSetDraftInput {
  repositoryRoot: string
  testEvidence: PipelineTestEvidence[]
}

export interface PipelinePatchSetDraft {
  patch: string
  changedFiles: PipelinePatchSetFile[]
  diffSummaryMarkdown: string
  testEvidence: PipelineTestEvidence[]
  additions: number
  deletions: number
  excludesPatchWork: boolean
  baseBranch?: string
  workingBranch?: string
  headCommit?: string
}

export interface PipelineSubmissionDraftContext {
  changedFiles: PipelinePatchSetFile[]
  statusPorcelain: string
  diffSummaryMarkdown: string
  additions: number
  deletions: number
  excludesPatchWork: boolean
  contributingGuidelines?: string
  contributingGuidelinesPath?: string
  workingBranch?: string
  headCommit?: string
}

export interface ValidateCommitPreconditionsInput {
  repositoryRoot: string
  commitMessage: string
  operationId: string
}

export interface PipelineLocalCommitPlan {
  operationId: string
  commitMessage: string
  canCommit: boolean
  blockers: string[]
  changedFiles: PipelinePatchSetFile[]
  excludedFiles: string[]
  baseBranch?: string
  workingBranch?: string
  headCommit?: string
}

export interface CreateLocalPipelineCommitInput extends ValidateCommitPreconditionsInput {
  confirmed: boolean
}

export interface PipelineLocalCommitResult {
  operationId: string
  commitMessage: string
  status: 'created'
  commitHash: string
  files: PipelinePatchSetFile[]
  excludedFiles: string[]
  baseBranch?: string
  workingBranch?: string
  headCommit?: string
  createdAt: number
}

export interface PipelineRemoteCommandOptions {
  cwd: string
}

export type PipelineRemoteCommandRunner = (
  command: string,
  args: string[],
  options: PipelineRemoteCommandOptions,
) => string

export interface ValidateRemoteSubmissionPreconditionsInput {
  repositoryRoot: string
  operationId: string
  commitHash: string
  prTitle: string
  prBody: string
  allowRemoteWrites: boolean
  remoteName?: string
  headBranch?: string
  baseBranch?: string
  draft?: boolean
  commandRunner?: PipelineRemoteCommandRunner
  skipPush?: boolean
}

export interface PipelineRemoteSubmissionPlan {
  operationId: string
  commitHash: string
  canSubmit: boolean
  blockers: string[]
  remoteName: string
  sanitizedRemoteUrl?: string
  githubRepo?: string
  baseBranch: string
  headBranch: string
  prTitle: string
  prBody: string
  draft: boolean
  pushedRef?: string
}

export interface CreateRemotePipelineSubmissionInput extends ValidateRemoteSubmissionPreconditionsInput {
  confirmed: boolean
}

interface GitStatusEntry {
  path: string
  changeType: PipelinePatchSetFile['changeType']
}

interface GitNumstatEntry {
  path: string
  additions: number
  deletions: number
}

export class PipelineRemoteSubmissionError extends Error {
  remoteSubmission?: PipelineRemoteSubmissionSummary

  constructor(message: string, remoteSubmission?: PipelineRemoteSubmissionSummary) {
    super(redactSecretText(message))
    this.name = 'PipelineRemoteSubmissionError'
    this.remoteSubmission = remoteSubmission
      ? {
        ...remoteSubmission,
        error: remoteSubmission.error ? redactSecretText(remoteSubmission.error) : undefined,
      }
      : undefined
  }
}

function runGit(
  repositoryRoot: string,
  args: string[],
  options: { allowDiffExit?: boolean } = {},
): string {
  try {
    return execFileSync('git', ['-C', repositoryRoot, ...args], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    if (
      options.allowDiffExit
      && typeof error === 'object'
      && error !== null
      && 'status' in error
      && (error as { status?: number }).status === 1
      && 'stdout' in error
      && typeof (error as { stdout?: unknown }).stdout === 'string'
    ) {
      return (error as { stdout: string }).stdout
    }
    throw error
  }
}

function runRemoteCommand(
  repositoryRoot: string,
  command: string,
  args: string[],
  runner?: PipelineRemoteCommandRunner,
): string {
  try {
    if (runner) {
      return runner(command, args, { cwd: repositoryRoot })
    }

    return execFileSync(command, args, {
      cwd: repositoryRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: command === 'git' && args[0] === 'push' ? 120_000 : 30_000,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GH_PROMPT_DISABLED: '1',
      },
    })
  } catch (error) {
    throw new Error(redactSecretText(formatCommandError(error)))
  }
}

export function sanitizeRemoteUrl(remoteUrl: string): string {
  const trimmed = remoteUrl.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    url.username = ''
    url.password = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return trimmed.replace(/\/\/[^/@]+@/, '//')
  }
}

export function redactSecretText(value: string): string {
  return value
    .replace(/(https?:\/\/)(?:[^/\s:@]+(?::[^/\s@]*)?@)([^\s]+)/gi, (_match, protocol: string, rest: string) =>
      `${protocol}${rest}`)
    .replace(/\bAuthorization:\s*Bearer\s+[^\s]+/gi, 'Authorization: Bearer [REDACTED]')
    .replace(/\bBearer\s+(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)/gi, 'Bearer [REDACTED]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{10,}\b/g, '[REDACTED]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]{10,}\b/g, '[REDACTED]')
    .replace(/\b(GH_TOKEN|GITHUB_TOKEN)(\s*[=:]\s*)[^\s]+/gi, '$1$2[REDACTED]')
}

function formatCommandError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return String(error)
  }

  const parts: string[] = []
  if (error instanceof Error) {
    parts.push(error.message)
  }
  if ('stderr' in error && typeof (error as { stderr?: unknown }).stderr === 'string') {
    parts.push((error as { stderr: string }).stderr)
  }
  if ('stdout' in error && typeof (error as { stdout?: unknown }).stdout === 'string') {
    parts.push((error as { stdout: string }).stdout)
  }

  return parts.filter(Boolean).join('\n') || String(error)
}

function ensureGitRepository(repositoryRoot: string): string {
  const root = resolve(repositoryRoot)
  if (!existsSync(root)) {
    throw new Error(`仓库目录不存在: ${repositoryRoot}`)
  }

  try {
    const topLevel = runGit(root, ['rev-parse', '--show-toplevel']).trim()
    if (realpathSync(resolve(topLevel)) !== realpathSync(root)) {
      throw new Error(`不是 Git 仓库根目录: ${repositoryRoot}`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('不是 Git 仓库根目录')) {
      throw error
    }
    throw new Error(`不是 Git 仓库: ${repositoryRoot}`)
  }

  return root
}

function isInsideOrEqual(root: string, target: string): boolean {
  const relativeTarget = relative(root, target)
  return (
    relativeTarget === ''
    || (
      relativeTarget !== '..'
      && !relativeTarget.startsWith(`..${sep}`)
      && !isAbsolute(relativeTarget)
    )
  )
}

function normalizeGitPath(repositoryRoot: string, gitPath: string): string {
  const normalized = gitPath.trim().replace(/\\/g, '/')
  if (!normalized || normalized.startsWith('../') || normalized === '..' || normalized.startsWith('/')) {
    throw new Error(`Git 路径越界: ${gitPath}`)
  }

  const absolutePath = resolve(repositoryRoot, normalized)
  if (!isInsideOrEqual(repositoryRoot, absolutePath)) {
    throw new Error(`Git 路径越界: ${gitPath}`)
  }

  return normalized
}

function toLiteralPathspec(path: string): string {
  return `:(literal)${path}`
}

function parseChangeType(status: string): PipelinePatchSetFile['changeType'] {
  if (status.includes('D')) return 'deleted'
  if (status.includes('R')) return 'renamed'
  if (status.includes('A') || status === '??') return 'added'
  return 'modified'
}

function parseStatusLine(repositoryRoot: string, line: string): GitStatusEntry | null {
  if (!line.trim()) return null
  const status = line.slice(0, 2)
  const rawPath = line.slice(3)
  const path = status.includes('R') && rawPath.includes(' -> ')
    ? rawPath.split(' -> ').at(-1) ?? rawPath
    : rawPath
  return {
    path: normalizeGitPath(repositoryRoot, path),
    changeType: parseChangeType(status),
  }
}

function parseStatusEntries(repositoryRoot: string): GitStatusEntry[] {
  const output = runGit(repositoryRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    '.',
    ':(exclude)patch-work',
    ':(exclude)patch-work/**',
  ])
  const entries: GitStatusEntry[] = []

  for (const line of output.split('\n')) {
    const entry = parseStatusLine(repositoryRoot, line)
    if (!entry) continue
    const normalized = entry.path
    if (normalized === 'patch-work' || normalized.startsWith('patch-work/')) continue
    entries.push({
      path: normalized,
      changeType: entry.changeType,
    })
  }

  return entries
}

function parseAllStatusEntries(repositoryRoot: string): GitStatusEntry[] {
  const output = runGit(repositoryRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ])
  return output
    .split('\n')
    .map((line) => parseStatusLine(repositoryRoot, line))
    .filter((entry): entry is GitStatusEntry => Boolean(entry))
}

function parseNumstat(repositoryRoot: string): Map<string, GitNumstatEntry> {
  const output = runGit(repositoryRoot, [
    'diff',
    'HEAD',
    '--numstat',
    '--',
    '.',
    ':(exclude)patch-work',
    ':(exclude)patch-work/**',
  ])
  const result = new Map<string, GitNumstatEntry>()

  for (const line of output.split('\n')) {
    if (!line.trim()) continue
    const [additionsRaw, deletionsRaw, ...pathParts] = line.split('\t')
    const path = normalizeGitPath(repositoryRoot, pathParts.join('\t'))
    result.set(path, {
      path,
      additions: additionsRaw === '-' ? 0 : Number(additionsRaw) || 0,
      deletions: deletionsRaw === '-' ? 0 : Number(deletionsRaw) || 0,
    })
  }

  return result
}

function countFileLines(repositoryRoot: string, path: string): number {
  const content = readFileSync(resolve(repositoryRoot, path), 'utf-8')
  if (!content) return 0
  return content.endsWith('\n')
    ? content.split('\n').length - 1
    : content.split('\n').length
}

function buildUntrackedPatch(repositoryRoot: string, path: string): string {
  return runGit(repositoryRoot, ['diff', '--no-index', '--', '/dev/null', path], {
    allowDiffExit: true,
  })
}

function buildTrackedPatch(repositoryRoot: string): string {
  return runGit(repositoryRoot, [
    'diff',
    'HEAD',
    '--',
    '.',
    ':(exclude)patch-work',
    ':(exclude)patch-work/**',
  ], { allowDiffExit: true })
}

function buildChangedFiles(repositoryRoot: string): PipelinePatchSetFile[] {
  const statusEntries = parseStatusEntries(repositoryRoot)
  const numstatByPath = parseNumstat(repositoryRoot)

  return statusEntries
    .filter((entry, index, entries) =>
      entries.findIndex((item) => item.path === entry.path) === index)
    .map((entry) => {
      const numstat = numstatByPath.get(entry.path)
      const additions = numstat?.additions
        ?? (entry.changeType === 'added' ? countFileLines(repositoryRoot, entry.path) : 0)
      const deletions = numstat?.deletions ?? 0
      return {
        path: entry.path,
        changeType: entry.changeType,
        additions,
        deletions,
        summary: `${entry.changeType}: ${entry.path}`,
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

function buildPatch(repositoryRoot: string, changedFiles: PipelinePatchSetFile[]): string {
  const trackedPatch = buildTrackedPatch(repositoryRoot).trimEnd()
  const untrackedPatches = changedFiles
    .filter((file) => file.changeType === 'added')
    .filter((file) => !trackedPatch.includes(`diff --git a/${file.path} b/${file.path}`))
    .map((file) => buildUntrackedPatch(repositoryRoot, file.path).trimEnd())
    .filter(Boolean)

  return [trackedPatch, ...untrackedPatches]
    .filter(Boolean)
    .join('\n\n')
}

function patchHasPatchWorkFileHeader(patch: string): boolean {
  return patch.split('\n').some((line) =>
    line.startsWith('diff --git a/patch-work ')
    || line.startsWith('diff --git a/patch-work/')
    || line.includes(' b/patch-work/')
    || line.endsWith(' b/patch-work'))
}

function resolveBranchName(repositoryRoot: string): string | undefined {
  const branch = runGit(repositoryRoot, ['branch', '--show-current']).trim()
  return branch || undefined
}

function readStatusPorcelain(repositoryRoot: string): string {
  return runGit(repositoryRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    '.',
    ':(exclude)patch-work',
    ':(exclude)patch-work/**',
  ]).trimEnd()
}

function readExcludedPatchWorkFiles(repositoryRoot: string): string[] {
  return parseAllStatusEntries(repositoryRoot)
    .map((entry) => entry.path)
    .filter((path) => path === 'patch-work' || path.startsWith('patch-work/'))
    .filter((path, index, paths) => paths.indexOf(path) === index)
    .sort((a, b) => a.localeCompare(b))
}

function readStagedPatchWorkFiles(repositoryRoot: string): string[] {
  return runGit(repositoryRoot, [
    'diff',
    '--cached',
    '--name-only',
    '--',
    'patch-work',
    'patch-work/**',
  ])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

function readUnmergedFiles(repositoryRoot: string): string[] {
  return runGit(repositoryRoot, ['diff', '--name-only', '--diff-filter=U'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

function readContributingGuidelines(repositoryRoot: string): {
  content?: string
  relativePath?: string
} {
  const realRepositoryRoot = realpathSync(repositoryRoot)
  for (const relativePath of [
    'CONTRIBUTING.md',
    'CONTRIBUTING',
    '.github/CONTRIBUTING.md',
    'docs/CONTRIBUTING.md',
  ]) {
    const candidatePath = resolve(repositoryRoot, relativePath)
    if (!existsSync(candidatePath)) continue
    const stat = lstatSync(candidatePath)
    if (stat.isSymbolicLink() || !stat.isFile()) continue
    const realCandidatePath = realpathSync(candidatePath)
    if (!isInsideOrEqual(realRepositoryRoot, realCandidatePath)) continue
    return {
      content: readFileSync(candidatePath, 'utf-8'),
      relativePath,
    }
  }

  return {}
}

function buildDiffSummaryMarkdown(input: {
  changedFiles: PipelinePatchSetFile[]
  additions: number
  deletions: number
  baseBranch?: string
  workingBranch?: string
  headCommit?: string
  testEvidence: PipelineTestEvidence[]
}): string {
  return [
    '# Diff 摘要',
    '',
    '## 分支',
    `- Base branch: ${input.baseBranch ?? 'unknown'}`,
    `- Working branch: ${input.workingBranch ?? 'unknown'}`,
    `- HEAD: ${input.headCommit ?? 'unknown'}`,
    '',
    '## 统计',
    `- 文件数：${input.changedFiles.length}`,
    `- 新增：${input.additions}`,
    `- 删除：${input.deletions}`,
    '',
    '## 文件',
    ...(input.changedFiles.length
      ? input.changedFiles.map((file) =>
        `- \`${file.path}\` (${file.changeType}, +${file.additions ?? 0} / -${file.deletions ?? 0})`)
      : ['- 无源码变更。']),
    '',
    '## 测试证据',
    ...(input.testEvidence.length
      ? input.testEvidence.map((item) => `- ${item.status}: \`${item.command}\` - ${item.summary}`)
      : ['- 未记录测试证据。']),
    '',
    '## 排除项',
    '- patch-work/** 已从 patch-set 中排除。',
    '',
  ].join('\n')
}

function buildSubmissionDiffSummaryMarkdown(input: {
  changedFiles: PipelinePatchSetFile[]
  additions: number
  deletions: number
  workingBranch?: string
  headCommit?: string
  contributingGuidelinesPath?: string
}): string {
  return [
    '# 提交候选摘要',
    '',
    '## 分支',
    `- Working branch: ${input.workingBranch ?? 'unknown'}`,
    `- HEAD: ${input.headCommit ?? 'unknown'}`,
    '',
    '## 贡献规范',
    `- ${input.contributingGuidelinesPath ?? '未发现 CONTRIBUTING 文件。'}`,
    '',
    '## 统计',
    `- 文件数：${input.changedFiles.length}`,
    `- 新增：${input.additions}`,
    `- 删除：${input.deletions}`,
    '',
    '## 文件',
    ...(input.changedFiles.length
      ? input.changedFiles.map((file) =>
        `- \`${file.path}\` (${file.changeType}, +${file.additions ?? 0} / -${file.deletions ?? 0})`)
      : ['- 无源码变更。']),
    '',
    '## 排除项',
    '- patch-work/** 已从提交候选中排除。',
    '',
  ].join('\n')
}

export function buildPipelinePatchSetDraft(
  input: BuildPipelinePatchSetDraftInput,
): PipelinePatchSetDraft {
  const repositoryRoot = ensureGitRepository(input.repositoryRoot)
  const changedFiles = buildChangedFiles(repositoryRoot)
  const additions = changedFiles.reduce((sum, file) => sum + (file.additions ?? 0), 0)
  const deletions = changedFiles.reduce((sum, file) => sum + (file.deletions ?? 0), 0)
  const workingBranch = resolveBranchName(repositoryRoot)
  const headCommit = runGit(repositoryRoot, ['rev-parse', 'HEAD']).trim()
  const patch = buildPatch(repositoryRoot, changedFiles)
  const excludesPatchWork = !patchHasPatchWorkFileHeader(patch)
    && changedFiles.every((file) => file.path !== 'patch-work' && !file.path.startsWith('patch-work/'))

  return {
    patch,
    changedFiles,
    diffSummaryMarkdown: buildDiffSummaryMarkdown({
      changedFiles,
      additions,
      deletions,
      workingBranch,
      headCommit,
      testEvidence: input.testEvidence,
    }),
    testEvidence: input.testEvidence,
    additions,
    deletions,
    excludesPatchWork,
    workingBranch,
    headCommit,
  }
}

export function readPipelineSubmissionDraftContext(input: {
  repositoryRoot: string
}): PipelineSubmissionDraftContext {
  const repositoryRoot = ensureGitRepository(input.repositoryRoot)
  const changedFiles = buildChangedFiles(repositoryRoot)
  const additions = changedFiles.reduce((sum, file) => sum + (file.additions ?? 0), 0)
  const deletions = changedFiles.reduce((sum, file) => sum + (file.deletions ?? 0), 0)
  const workingBranch = resolveBranchName(repositoryRoot)
  const headCommit = runGit(repositoryRoot, ['rev-parse', 'HEAD']).trim()
  const statusPorcelain = readStatusPorcelain(repositoryRoot)
  const contributing = readContributingGuidelines(repositoryRoot)
  const excludesPatchWork = changedFiles.every((file) =>
    file.path !== 'patch-work' && !file.path.startsWith('patch-work/'))

  return {
    changedFiles,
    statusPorcelain,
    diffSummaryMarkdown: buildSubmissionDiffSummaryMarkdown({
      changedFiles,
      additions,
      deletions,
      workingBranch,
      headCommit,
      contributingGuidelinesPath: contributing.relativePath,
    }),
    additions,
    deletions,
    excludesPatchWork,
    contributingGuidelines: contributing.content,
    contributingGuidelinesPath: contributing.relativePath,
    workingBranch,
    headCommit,
  }
}

export function validateCommitPreconditions(
  input: ValidateCommitPreconditionsInput,
): PipelineLocalCommitPlan {
  const repositoryRoot = ensureGitRepository(input.repositoryRoot)
  const commitMessage = input.commitMessage.trim()
  const changedFiles = buildChangedFiles(repositoryRoot)
  const excludedFiles = readExcludedPatchWorkFiles(repositoryRoot)
  const stagedPatchWorkFiles = readStagedPatchWorkFiles(repositoryRoot)
  const unmergedFiles = readUnmergedFiles(repositoryRoot)
  const workingBranch = resolveBranchName(repositoryRoot)
  const headCommit = runGit(repositoryRoot, ['rev-parse', 'HEAD']).trim()
  const blockers: string[] = []

  if (!input.operationId.trim()) {
    blockers.push('缺少本地 commit operation id')
  }
  if (!commitMessage) {
    blockers.push('缺少 commit message')
  }
  if (!workingBranch) {
    blockers.push('当前不在具名分支，禁止自动本地 commit')
  }
  if (changedFiles.length === 0) {
    blockers.push('没有可提交的源码变更')
  }
  if (unmergedFiles.length > 0) {
    blockers.push(`存在未解决冲突文件: ${unmergedFiles.join(', ')}`)
  }
  if (stagedPatchWorkFiles.length > 0) {
    blockers.push(`patch-work/** 已进入 Git index，禁止本地 commit: ${stagedPatchWorkFiles.join(', ')}`)
  }

  return {
    operationId: input.operationId,
    commitMessage,
    canCommit: blockers.length === 0,
    blockers,
    changedFiles,
    excludedFiles,
    workingBranch,
    headCommit,
  }
}

export function createLocalPipelineCommit(
  input: CreateLocalPipelineCommitInput,
): PipelineLocalCommitResult {
  if (!input.confirmed) {
    throw new Error('用户未确认本地 commit，禁止执行 git commit')
  }

  const repositoryRoot = ensureGitRepository(input.repositoryRoot)
  const plan = validateCommitPreconditions({
    repositoryRoot,
    commitMessage: input.commitMessage,
    operationId: input.operationId,
  })
  if (!plan.canCommit) {
    throw new Error(`本地 commit 前置条件未满足: ${plan.blockers.join('；')}`)
  }

  runGit(repositoryRoot, ['add', '--', ...plan.changedFiles.map((file) => toLiteralPathspec(file.path))])
  const stagedPatchWorkFiles = readStagedPatchWorkFiles(repositoryRoot)
  if (stagedPatchWorkFiles.length > 0) {
    throw new Error(`patch-work/** 已进入 Git index，禁止本地 commit: ${stagedPatchWorkFiles.join(', ')}`)
  }
  runGit(repositoryRoot, ['commit', '-m', plan.commitMessage])
  const commitHash = runGit(repositoryRoot, ['rev-parse', 'HEAD']).trim()

  return {
    operationId: plan.operationId,
    commitMessage: plan.commitMessage,
    status: 'created',
    commitHash,
    files: plan.changedFiles,
    excludedFiles: plan.excludedFiles,
    baseBranch: plan.baseBranch,
    workingBranch: plan.workingBranch,
    headCommit: plan.headCommit,
    createdAt: Date.now(),
  }
}

function readRemotePushUrl(repositoryRoot: string, remoteName: string): string | undefined {
  try {
    return runGit(repositoryRoot, ['remote', 'get-url', '--push', remoteName]).trim()
  } catch {
    return undefined
  }
}

export function parseGitHubRepoFromRemoteUrl(remoteUrl: string): string | undefined {
  const trimmed = remoteUrl.trim()
  if (!trimmed) return undefined

  const normalizePath = (path: string): string | undefined => {
    const parts = path
      .replace(/^\/+/, '')
      .replace(/\.git$/, '')
      .split('/')
      .filter(Boolean)
    const owner = parts[0]
    const repo = parts[1]
    if (!owner || !repo) return undefined
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return undefined
    return `${owner}/${repo}`
  }

  try {
    const url = new URL(trimmed)
    if (url.hostname !== 'github.com') return undefined
    return normalizePath(url.pathname)
  } catch {
    const scpLike = trimmed.match(/^[^@]+@github\.com:([^/]+)\/(.+?)(?:\.git)?$/)
    if (!scpLike) return undefined
    return normalizePath(`${scpLike[1]}/${scpLike[2]}`)
  }
}

function extractPullRequestUrl(output: string): string | undefined {
  const match = output.match(/https?:\/\/\S+/)
  return match?.[0]
}

function extractPullRequestNumber(url: string | undefined): number | undefined {
  if (!url) return undefined
  const match = url.match(/\/pull\/(\d+)(?:\b|$)/)
  return match ? Number(match[1]) : undefined
}

function isSafeRemoteName(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value)
    && !value.startsWith('-')
    && !value.includes('..')
}

function isValidBranchName(repositoryRoot: string, value: string): boolean {
  if (!value || value.startsWith('-')) return false
  try {
    runGit(repositoryRoot, ['check-ref-format', '--branch', value])
    return true
  } catch {
    return false
  }
}

function isProtectedHeadBranch(headBranch: string, baseBranch: string): boolean {
  const normalizedHead = headBranch.toLowerCase()
  return headBranch === baseBranch || normalizedHead === 'main' || normalizedHead === 'master'
}

function readPatchWorkFilesAtCommit(repositoryRoot: string, commitHash: string): string[] {
  return runGit(repositoryRoot, [
    'ls-tree',
    '-r',
    '--name-only',
    commitHash,
    '--',
    'patch-work',
  ])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line === 'patch-work' || line.startsWith('patch-work/'))
    .sort((a, b) => a.localeCompare(b))
}

function readRemoteTrackingRef(repositoryRoot: string, remoteName: string, baseBranch: string): string | undefined {
  const ref = `refs/remotes/${remoteName}/${baseBranch}`
  try {
    runGit(repositoryRoot, ['rev-parse', '--verify', ref])
    return ref
  } catch {
    return undefined
  }
}

function readPatchWorkFilesInPushRange(
  repositoryRoot: string,
  remoteName: string,
  baseBranch: string,
  commitHash: string,
): { verified: boolean; files: string[] } {
  const remoteTrackingRef = readRemoteTrackingRef(repositoryRoot, remoteName, baseBranch)
  if (!remoteTrackingRef) {
    return { verified: false, files: [] }
  }

  const output = runGit(repositoryRoot, [
    'log',
    '--format=',
    '--name-only',
    `${remoteTrackingRef}..${commitHash}`,
    '--',
    'patch-work',
    'patch-work/**',
  ])
  const files = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line === 'patch-work' || line.startsWith('patch-work/'))
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .sort((a, b) => a.localeCompare(b))

  return { verified: true, files }
}

function remoteBaseBranchExists(
  repositoryRoot: string,
  remoteName: string,
  baseBranch: string,
  runner?: PipelineRemoteCommandRunner,
): boolean {
  try {
    const output = runRemoteCommand(repositoryRoot, 'git', [
      'ls-remote',
      '--exit-code',
      '--heads',
      remoteName,
      `refs/heads/${baseBranch}`,
    ], runner)
    return output.trim().length > 0
  } catch {
    return false
  }
}

function readExistingPullRequestUrl(
  repositoryRoot: string,
  plan: PipelineRemoteSubmissionPlan,
  runner?: PipelineRemoteCommandRunner,
): string | undefined {
  if (!plan.githubRepo) return undefined

  try {
    const output = runRemoteCommand(repositoryRoot, 'gh', [
      'pr',
      'view',
      '--repo',
      plan.githubRepo,
      '--head',
      plan.headBranch,
      '--json',
      'url,number',
      '--jq',
      '.url',
    ], runner)
    return extractPullRequestUrl(output) ?? (output.trim() || undefined)
  } catch {
    return undefined
  }
}

export function validateRemoteSubmissionPreconditions(
  input: ValidateRemoteSubmissionPreconditionsInput,
): PipelineRemoteSubmissionPlan {
  const repositoryRoot = ensureGitRepository(input.repositoryRoot)
  const operationId = input.operationId.trim()
  const commitHash = input.commitHash.trim()
  const prTitle = input.prTitle.trim()
  const prBody = input.prBody.trim()
  const remoteName = input.remoteName?.trim() || 'origin'
  const remoteNameSafe = isSafeRemoteName(remoteName)
  const workingBranch = resolveBranchName(repositoryRoot)
  const headBranch = input.headBranch?.trim() || workingBranch || ''
  const baseBranch = input.baseBranch?.trim() || 'main'
  const remoteUrl = remoteNameSafe ? readRemotePushUrl(repositoryRoot, remoteName) : undefined
  const sanitizedRemoteUrl = remoteUrl ? sanitizeRemoteUrl(remoteUrl) : undefined
  const githubRepo = remoteUrl ? parseGitHubRepoFromRemoteUrl(remoteUrl) : undefined
  const currentHead = runGit(repositoryRoot, ['rev-parse', 'HEAD']).trim()
  const stagedPatchWorkFiles = readStagedPatchWorkFiles(repositoryRoot)
  const blockers: string[] = []

  if (!input.allowRemoteWrites) {
    blockers.push('用户未允许远端写能力')
  }
  if (!operationId) {
    blockers.push('缺少远端提交 operation id')
  }
  if (!commitHash) {
    blockers.push('缺少待推送 commit hash')
  }
  if (commitHash && currentHead !== commitHash) {
    blockers.push('当前 HEAD 与待推送 commit hash 不一致')
  }
  if (!remoteUrl && remoteNameSafe) {
    blockers.push(`缺少 Git remote: ${remoteName}`)
  }
  if (!remoteNameSafe) {
    blockers.push('remote 名称包含不安全字符')
  }
  if (!headBranch) {
    blockers.push('当前不在具名分支，禁止远端写')
  } else if (!isValidBranchName(repositoryRoot, headBranch)) {
    blockers.push('head branch 包含不安全字符')
  } else if (baseBranch && isProtectedHeadBranch(headBranch, baseBranch)) {
    blockers.push('远端 head branch 不能是 base/default 分支')
  }
  if (!baseBranch) {
    blockers.push('缺少 PR base branch')
  } else if (!isValidBranchName(repositoryRoot, baseBranch)) {
    blockers.push('base branch 包含不安全字符')
  }
  if (remoteUrl && !githubRepo) {
    blockers.push('远端写首版仅支持 GitHub remote URL')
  }
  if (!prTitle) {
    blockers.push('缺少 PR title')
  }
  if (!prBody) {
    blockers.push('缺少 PR body')
  }
  if (stagedPatchWorkFiles.length > 0) {
    blockers.push(`patch-work/** 已进入 Git index，禁止远端写: ${stagedPatchWorkFiles.join(', ')}`)
  }

  if (blockers.length === 0) {
    const patchWorkTreeFiles = readPatchWorkFilesAtCommit(repositoryRoot, commitHash)
    if (patchWorkTreeFiles.length > 0) {
      blockers.push(`patch-work/** 已存在于待推送 commit tree，禁止远端写: ${patchWorkTreeFiles.join(', ')}`)
    }
  }

  if (blockers.length === 0) {
    const rangeCheck = readPatchWorkFilesInPushRange(repositoryRoot, remoteName, baseBranch, commitHash)
    if (!rangeCheck.verified) {
      blockers.push(`缺少本地 ${remoteName}/${baseBranch} 引用，无法验证 push range 中是否包含 patch-work/**`)
    } else if (rangeCheck.files.length > 0) {
      blockers.push(`patch-work/** 曾出现在待推送历史，禁止远端写: ${rangeCheck.files.join(', ')}`)
    }
  }

  if (blockers.length === 0 && !remoteBaseBranchExists(repositoryRoot, remoteName, baseBranch, input.commandRunner)) {
    blockers.push(`目标 remote base branch 不存在或不可访问: ${remoteName}/${baseBranch}`)
  }

  if (blockers.length === 0) {
    try {
      runRemoteCommand(repositoryRoot, 'gh', ['auth', 'status'], input.commandRunner)
    } catch {
      blockers.push('GitHub auth 不可用，请先完成 gh 登录或配置 git credential')
    }
  }

  return {
    operationId,
    commitHash,
    canSubmit: blockers.length === 0,
    blockers,
    remoteName,
    sanitizedRemoteUrl,
    githubRepo,
    baseBranch,
    headBranch,
    prTitle,
    prBody,
    draft: input.draft ?? true,
    pushedRef: `refs/heads/${headBranch}`,
  }
}

export function createRemotePipelineSubmission(
  input: CreateRemotePipelineSubmissionInput,
): PipelineRemoteSubmissionSummary {
  if (!input.confirmed) {
    throw new Error('用户未确认远端写，禁止执行 push 或创建 PR')
  }

  const repositoryRoot = ensureGitRepository(input.repositoryRoot)
  const plan = validateRemoteSubmissionPreconditions({
    ...input,
    repositoryRoot,
  })
  if (!plan.canSubmit) {
    throw new Error(`远端提交前置条件未满足: ${plan.blockers.join('；')}`)
  }

  const pushedAt = Date.now()
  if (!input.skipPush) {
    runRemoteCommand(repositoryRoot, 'git', [
      'push',
      plan.remoteName,
      `${plan.commitHash}:${plan.pushedRef}`,
    ], input.commandRunner)
  }

  const prArgs = [
    'pr',
    'create',
    '--repo',
    plan.githubRepo ?? '',
    '--title',
    plan.prTitle,
    '--body',
    plan.prBody,
    '--base',
    plan.baseBranch,
    '--head',
    plan.headBranch,
  ]
  if (plan.draft) {
    prArgs.push('--draft')
  }
  const prOutput = (() => {
    try {
      return runRemoteCommand(repositoryRoot, 'gh', prArgs, input.commandRunner)
    } catch (error) {
      const existingPrUrl = readExistingPullRequestUrl(repositoryRoot, plan, input.commandRunner)
      if (existingPrUrl) {
        return existingPrUrl
      }

      const message = error instanceof Error ? error.message : String(error)
      const remoteSubmission: PipelineRemoteSubmissionSummary = {
        attempted: true,
        operationId: plan.operationId,
        status: 'pushed',
        type: 'pull_request',
        commitHash: plan.commitHash,
        remoteName: plan.remoteName,
        sanitizedRemoteUrl: plan.sanitizedRemoteUrl,
        githubRepo: plan.githubRepo,
        baseBranch: plan.baseBranch,
        headBranch: plan.headBranch,
        pushedRef: plan.pushedRef,
        prTitle: plan.prTitle,
        prBody: plan.prBody,
        draft: plan.draft,
        error: redactSecretText(message),
        pushedAt,
        createdAt: Date.now(),
      }
      throw new PipelineRemoteSubmissionError(message, remoteSubmission)
    }
  })()
  const prUrl = extractPullRequestUrl(prOutput)

  return {
    attempted: true,
    operationId: plan.operationId,
    status: 'created',
    type: 'pull_request',
    commitHash: plan.commitHash,
    remoteName: plan.remoteName,
    sanitizedRemoteUrl: plan.sanitizedRemoteUrl,
    githubRepo: plan.githubRepo,
    baseBranch: plan.baseBranch,
    headBranch: plan.headBranch,
    pushedRef: plan.pushedRef,
    prTitle: plan.prTitle,
    prBody: plan.prBody,
    prUrl,
    prNumber: extractPullRequestNumber(prUrl),
    draft: plan.draft,
    pushedAt,
    createdAt: Date.now(),
  }
}

/**
 * Pipeline v2 patch-work 服务
 *
 * 负责在贡献仓库内安全维护 ./patch-work/ 文件事实源。
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
  sep,
  win32,
} from 'node:path'
import type {
  PatchWorkFileKind,
  PatchWorkFileRef,
  PatchWorkManifest,
  PatchWorkNodeKind,
  PipelineExplorerReportRef,
} from '@codeinsights/shared'
import { readJsonFileSafe } from './safe-file'

interface PatchWorkInitInput {
  contributionTaskId: string
  pipelineSessionId: string
  repositoryRoot: string
}

interface PatchWorkWriteInput extends PatchWorkInitInput {
  kind: PatchWorkFileKind
  createdByNode: PatchWorkNodeKind
  content: string
  relativePath?: string
  displayName?: string
}

interface FixedPatchWorkFileDefinition {
  relativePath: string
  displayName: string
}

const MANIFEST_VERSION = 1
const MARKDOWN_EXTENSION_PATTERN = /\.md$/i

const FIXED_FILE_DEFINITIONS: Partial<Record<PatchWorkFileKind, FixedPatchWorkFileDefinition>> = {
  selected_task: {
    relativePath: 'selected-task.md',
    displayName: '已选任务.md',
  },
  implementation_plan: {
    relativePath: 'plan.md',
    displayName: '开发方案.md',
  },
  test_plan: {
    relativePath: 'test-plan.md',
    displayName: '测试方案.md',
  },
  dev_doc: {
    relativePath: 'dev.md',
    displayName: '开发文档.md',
  },
  review_doc: {
    relativePath: 'review.md',
    displayName: '审查报告.md',
  },
  test_result: {
    relativePath: 'result.md',
    displayName: '测试报告.md',
  },
  patch: {
    relativePath: 'patch-set/changes.patch',
    displayName: '代码补丁.patch',
  },
  changed_files: {
    relativePath: 'patch-set/changed-files.json',
    displayName: '变更文件.json',
  },
  diff_summary: {
    relativePath: 'patch-set/diff-summary.md',
    displayName: 'Diff 摘要.md',
  },
  test_evidence: {
    relativePath: 'patch-set/test-evidence.json',
    displayName: '测试证据.json',
  },
  commit_doc: {
    relativePath: 'commit.md',
    displayName: 'Commit 准备.md',
  },
  pr_doc: {
    relativePath: 'pr.md',
    displayName: 'PR 草稿.md',
  },
}

const FILE_KINDS = new Set<PatchWorkFileKind>([
  'explorer_report',
  'selected_task',
  'implementation_plan',
  'test_plan',
  'dev_doc',
  'review_doc',
  'test_result',
  'patch',
  'changed_files',
  'diff_summary',
  'test_evidence',
  'commit_doc',
  'pr_doc',
])

const NODE_KINDS = new Set<PatchWorkNodeKind>([
  'preflight',
  'explorer',
  'planner',
  'developer',
  'reviewer',
  'tester',
  'committer',
])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

function ensureRepositoryRoot(repositoryRoot: string): string {
  const root = resolve(repositoryRoot)
  if (!existsSync(root)) {
    throw new Error(`仓库目录不存在: ${repositoryRoot}`)
  }
  return root
}

export function resolvePatchWorkDir(
  repositoryRoot: string,
  options: { create?: boolean } = {},
): string {
  const root = ensureRepositoryRoot(repositoryRoot)
  const patchWorkDir = resolve(root, 'patch-work')
  if (!isInsideOrEqual(root, patchWorkDir) || patchWorkDir === root) {
    throw new Error('patch-work 目录越界')
  }

  if (options.create !== false && !existsSync(patchWorkDir)) {
    mkdirSync(patchWorkDir, { recursive: true })
  }

  if (existsSync(patchWorkDir)) {
    if (lstatSync(patchWorkDir).isSymbolicLink()) {
      throw new Error('patch-work 目录越界')
    }
    const rootRealPath = realpathSync(root)
    const patchWorkRealPath = realpathSync(patchWorkDir)
    if (!isInsideOrEqual(rootRealPath, patchWorkRealPath) || patchWorkRealPath === rootRealPath) {
      throw new Error('patch-work 目录越界')
    }
  }

  return patchWorkDir
}

function normalizeRelativePath(relativePath: string): string {
  const raw = relativePath.trim()
  if (!raw || isAbsolute(raw) || win32.isAbsolute(raw)) {
    throw new Error('patch-work 文件路径越界')
  }

  const normalized = posix.normalize(raw.replace(/\\/g, '/'))
  if (
    normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized.startsWith('/')
    || normalized.split('/').includes('..')
  ) {
    throw new Error('patch-work 文件路径越界')
  }

  return normalized
}

function assertWritablePatchWorkPath(relativePath: string): void {
  const normalized = normalizeRelativePath(relativePath)
  if (
    normalized === 'manifest.json'
    || normalized.startsWith('manifest.json/')
    || normalized === 'manifest.json.tmp'
    || normalized === 'manifest.json.bak'
    || normalized === 'revisions'
    || normalized.startsWith('revisions/')
    || normalized.startsWith('.tmp')
    || normalized.includes('/.tmp')
  ) {
    throw new Error(`patch-work 文件路径保留: ${relativePath}`)
  }
}

function assertManifestPathSafe(manifestPath: string): void {
  for (const path of [manifestPath, `${manifestPath}.tmp`, `${manifestPath}.bak`]) {
    try {
      if (lstatSync(path).isSymbolicLink()) {
        throw new Error('patch-work manifest 不能是软链')
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        continue
      }
      throw error
    }
  }
}

function ensureSafeParentDir(
  patchWorkDir: string,
  normalizedRelativePath: string,
  createParent: boolean,
): string {
  const parentRelativePath = posix.dirname(normalizedRelativePath)
  if (parentRelativePath === '.') return patchWorkDir

  const patchWorkRealDir = realpathSync(patchWorkDir)
  let currentDir = patchWorkDir

  for (const segment of parentRelativePath.split('/')) {
    if (!segment) continue

    const nextDir = join(currentDir, segment)
    if (existsSync(nextDir)) {
      const stat = lstatSync(nextDir)
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error('patch-work 文件路径越界')
      }

      const realNextDir = realpathSync(nextDir)
      if (!isInsideOrEqual(patchWorkRealDir, realNextDir)) {
        throw new Error('patch-work 文件路径越界')
      }
    } else if (createParent) {
      mkdirSync(nextDir)
    } else {
      throw new Error(`patch-work 文件不存在: ${normalizedRelativePath}`)
    }

    currentDir = nextDir
  }

  return currentDir
}

function resolvePatchWorkFilePath(
  repositoryRoot: string,
  relativePath: string,
  options: { createParent?: boolean; mustExist?: boolean } = {},
): string {
  const patchWorkDir = resolvePatchWorkDir(repositoryRoot)
  const normalized = normalizeRelativePath(relativePath)
  const target = resolve(patchWorkDir, normalized)
  if (!isInsideOrEqual(patchWorkDir, target) || target === patchWorkDir) {
    throw new Error('patch-work 文件路径越界')
  }

  const parentDir = ensureSafeParentDir(
    patchWorkDir,
    normalized,
    options.createParent === true,
  )

  const patchWorkRealDir = realpathSync(patchWorkDir)
  const parentRealDir = realpathSync(parentDir)
  if (!isInsideOrEqual(patchWorkRealDir, parentRealDir)) {
    throw new Error('patch-work 文件路径越界')
  }

  if (options.mustExist) {
    if (!existsSync(target)) {
      throw new Error(`patch-work 文件不存在: ${normalized}`)
    }
    if (lstatSync(target).isSymbolicLink()) {
      throw new Error('patch-work 文件路径越界')
    }
    const targetRealPath = realpathSync(target)
    if (!isInsideOrEqual(patchWorkRealDir, targetRealPath)) {
      throw new Error('patch-work 文件路径越界')
    }
  }

  return target
}

function getManifestPath(repositoryRoot: string): string {
  const manifestPath = join(resolvePatchWorkDir(repositoryRoot), 'manifest.json')
  assertManifestPathSafe(manifestPath)
  return manifestPath
}

function checksum(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex')
}

function createEmptyManifest(input: PatchWorkInitInput): PatchWorkManifest {
  const repositoryRoot = ensureRepositoryRoot(input.repositoryRoot)
  return {
    version: MANIFEST_VERSION,
    contributionTaskId: input.contributionTaskId,
    pipelineSessionId: input.pipelineSessionId,
    repositoryRoot,
    patchWorkDir: resolvePatchWorkDir(repositoryRoot),
    files: [],
    checksums: {},
    updatedAt: 0,
  }
}

function normalizeFileRef(value: unknown): PatchWorkFileRef | null {
  if (!isObject(value)) return null
  if (!FILE_KINDS.has(value.kind as PatchWorkFileKind)) return null
  if (!NODE_KINDS.has(value.createdByNode as PatchWorkNodeKind)) return null
  if (typeof value.displayName !== 'string' || !value.displayName.trim()) return null
  if (typeof value.relativePath !== 'string' || !value.relativePath.trim()) return null
  if (typeof value.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(value.checksum)) return null
  if (typeof value.revision !== 'number' || value.revision < 1) return null
  if (typeof value.updatedAt !== 'number') return null

  try {
    const relativePath = normalizeRelativePath(value.relativePath)
    assertWritablePatchWorkPath(relativePath)
    return {
      kind: value.kind as PatchWorkFileKind,
      displayName: value.displayName,
      relativePath,
      createdByNode: value.createdByNode as PatchWorkNodeKind,
      revision: Math.floor(value.revision),
      checksum: value.checksum,
      updatedAt: value.updatedAt,
      acceptedRevision: typeof value.acceptedRevision === 'number'
        ? Math.floor(value.acceptedRevision)
        : undefined,
      acceptedAt: typeof value.acceptedAt === 'number' ? value.acceptedAt : undefined,
      acceptedByGateId: typeof value.acceptedByGateId === 'string' ? value.acceptedByGateId : undefined,
    }
  } catch {
    return null
  }
}

function normalizeManifest(
  input: PatchWorkInitInput,
  manifest: PatchWorkManifest | null,
): PatchWorkManifest {
  const emptyManifest = createEmptyManifest(input)
  if (!isObject(manifest)) return emptyManifest

  const files = Array.isArray(manifest.files)
    ? manifest.files
      .map(normalizeFileRef)
      .filter((file): file is PatchWorkFileRef => file !== null)
    : []
  const checksums = Object.fromEntries(files.map((file) => [file.relativePath, file.checksum]))

  return {
    version: MANIFEST_VERSION,
    contributionTaskId: input.contributionTaskId || (
      typeof manifest.contributionTaskId === 'string' ? manifest.contributionTaskId : ''
    ),
    pipelineSessionId: input.pipelineSessionId || (
      typeof manifest.pipelineSessionId === 'string' ? manifest.pipelineSessionId : ''
    ),
    repositoryRoot: emptyManifest.repositoryRoot,
    patchWorkDir: emptyManifest.patchWorkDir,
    selectedReportId: typeof manifest.selectedReportId === 'string' ? manifest.selectedReportId : undefined,
    files,
    checksums,
    updatedAt: typeof manifest.updatedAt === 'number' ? manifest.updatedAt : 0,
  }
}

function writeManifest(manifest: PatchWorkManifest): void {
  const manifestPath = join(manifest.patchWorkDir, 'manifest.json')
  assertManifestPathSafe(manifestPath)
  const tmpPath = join(manifest.patchWorkDir, `.tmp-manifest-${randomUUID()}.json`)

  try {
    writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), {
      encoding: 'utf-8',
      flag: 'wx',
    })
    renameSync(tmpPath, manifestPath)
  } catch (error) {
    try {
      if (existsSync(tmpPath)) {
        unlinkSync(tmpPath)
      }
    } catch {
      // 清理失败不覆盖原始错误
    }
    throw error
  }
}

function updateManifest(
  repositoryRoot: string,
  transform: (manifest: PatchWorkManifest) => PatchWorkManifest,
): PatchWorkManifest {
  const manifest = readPatchWorkManifest(repositoryRoot)
  const nextManifest = transform(manifest)
  writeManifest(nextManifest)
  return nextManifest
}

export function initializePatchWork(input: PatchWorkInitInput): PatchWorkManifest {
  const manifest = normalizeManifest(
    input,
    readJsonFileSafe<PatchWorkManifest>(getManifestPath(input.repositoryRoot)),
  )
  writeManifest(manifest)
  return manifest
}

export function readPatchWorkManifest(repositoryRoot: string): PatchWorkManifest {
  const input: PatchWorkInitInput = {
    contributionTaskId: '',
    pipelineSessionId: '',
    repositoryRoot,
  }
  return normalizeManifest(
    input,
    readJsonFileSafe<PatchWorkManifest>(getManifestPath(repositoryRoot)),
  )
}

function writeFileAtomic(filePath: string, content: string): void {
  const tmpPath = join(dirname(filePath), `.tmp-${randomUUID()}`)
  writeFileSync(tmpPath, content, 'utf-8')
  renameSync(tmpPath, filePath)
}

function archiveRevision(
  input: PatchWorkWriteInput,
  relativePath: string,
  revision: number,
  content: string,
): void {
  const revisionPath = [
    'revisions',
    input.createdByNode,
    `${String(revision).padStart(3, '0')}-${basename(relativePath)}`,
  ].join('/')
  const revisionFilePath = resolvePatchWorkFilePath(
    input.repositoryRoot,
    revisionPath,
    { createParent: true },
  )
  writeFileAtomic(revisionFilePath, content)
}

function resolveWriteDefinition(input: PatchWorkWriteInput): FixedPatchWorkFileDefinition {
  if (input.relativePath) {
    const relativePath = normalizeRelativePath(input.relativePath)
    assertWritablePatchWorkPath(relativePath)
    return {
      relativePath,
      displayName: input.displayName ?? basename(input.relativePath),
    }
  }

  const definition = FIXED_FILE_DEFINITIONS[input.kind]
  if (!definition) {
    throw new Error(`patch-work 文件类型需要显式 relativePath: ${input.kind}`)
  }
  assertWritablePatchWorkPath(definition.relativePath)
  return definition
}

export function writePatchWorkFile(input: PatchWorkWriteInput): PatchWorkFileRef {
  if (!FILE_KINDS.has(input.kind)) {
    throw new Error(`无效 patch-work 文件类型: ${input.kind}`)
  }
  if (!NODE_KINDS.has(input.createdByNode)) {
    throw new Error(`无效 patch-work 节点类型: ${input.createdByNode}`)
  }

  const definition = resolveWriteDefinition(input)
  const targetPath = resolvePatchWorkFilePath(
    input.repositoryRoot,
    definition.relativePath,
    { createParent: true },
  )
  const manifest = normalizeManifest(
    input,
    readJsonFileSafe<PatchWorkManifest>(getManifestPath(input.repositoryRoot)),
  )
  const existing = manifest.files.find((file) => file.relativePath === definition.relativePath)
  const revision = (existing?.revision ?? 0) + 1
  const updatedAt = Date.now()
  const fileChecksum = checksum(input.content)

  writeFileAtomic(targetPath, input.content)
  archiveRevision(input, definition.relativePath, revision, input.content)

  const fileRef: PatchWorkFileRef = {
    kind: input.kind,
    displayName: input.displayName ?? definition.displayName,
    relativePath: definition.relativePath,
    createdByNode: input.createdByNode,
    revision,
    checksum: fileChecksum,
    updatedAt,
  }

  const nextFiles = manifest.files.filter((file) => file.relativePath !== definition.relativePath)
  const nextManifest: PatchWorkManifest = {
    ...manifest,
    contributionTaskId: input.contributionTaskId,
    pipelineSessionId: input.pipelineSessionId,
    files: [...nextFiles, fileRef],
    checksums: {
      ...manifest.checksums,
      [definition.relativePath]: fileChecksum,
    },
    updatedAt,
  }
  writeManifest(nextManifest)
  return fileRef
}

export function readPatchWorkFile(input: {
  repositoryRoot: string
  relativePath: string
}): string {
  const targetPath = resolvePatchWorkFilePath(
    input.repositoryRoot,
    input.relativePath,
    { mustExist: true },
  )
  return readFileSync(targetPath, 'utf-8')
}

function readVerifiedPatchWorkFile(
  repositoryRoot: string,
  file: PatchWorkFileRef,
): string {
  const content = readPatchWorkFile({
    repositoryRoot,
    relativePath: file.relativePath,
  })
  const currentChecksum = checksum(content)
  if (currentChecksum !== file.checksum) {
    throw new Error(`patch-work 文件 checksum 已变化，请刷新后重试: ${file.relativePath}`)
  }
  return content
}

function assertManifestChecksumFresh(
  manifest: PatchWorkManifest,
  file: PatchWorkFileRef,
): void {
  const manifestChecksum = manifest.checksums[file.relativePath]
  if (manifestChecksum !== file.checksum) {
    throw new Error(`patch-work 文件 checksum 已变化，请刷新后重试: ${file.relativePath}`)
  }
}

export function readPatchWorkManifestFile(input: {
  repositoryRoot: string
  relativePath: string
}): string {
  const manifest = readPatchWorkManifest(input.repositoryRoot)
  const file = manifest.files.find((item) => item.relativePath === normalizeRelativePath(input.relativePath))
  if (!file) {
    throw new Error(`patch-work 文件未登记，无法读取: ${input.relativePath}`)
  }

  assertManifestChecksumFresh(manifest, file)
  return readVerifiedPatchWorkFile(input.repositoryRoot, file)
}

function reportIdFromRelativePath(relativePath: string): string {
  return basename(relativePath).replace(MARKDOWN_EXTENSION_PATTERN, '')
}

function titleFromReportContent(content: string, fallback: string): string {
  const heading = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '))
    ?.replace(/^#\s+/, '')
    .replace(/^探索报告[:：]\s*/, '')
    .trim()

  return heading || fallback.replace(MARKDOWN_EXTENSION_PATTERN, '')
}

function summaryFromReportContent(content: string): string | undefined {
  const lines = content.split('\n').map((line) => line.trim())
  const overviewIndex = lines.findIndex((line) => /^##\s+贡献点概述/.test(line))
  const searchStart = overviewIndex >= 0 ? overviewIndex + 1 : 0

  for (const line of lines.slice(searchStart)) {
    if (!line || line.startsWith('#')) continue
    return line
  }

  return undefined
}

function toExplorerReportRef(
  file: PatchWorkFileRef,
  content: string,
): PipelineExplorerReportRef {
  const title = titleFromReportContent(content, file.displayName)
  return {
    reportId: reportIdFromRelativePath(file.relativePath),
    title,
    summary: summaryFromReportContent(content),
    displayName: file.displayName,
    relativePath: file.relativePath,
    checksum: file.checksum,
    revision: file.revision,
  }
}

export function listPatchWorkExplorerReports(input: {
  repositoryRoot: string
}): PipelineExplorerReportRef[] {
  const manifest = readPatchWorkManifest(input.repositoryRoot)
  return manifest.files
    .filter((file) => file.kind === 'explorer_report')
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .map((file) => {
      assertManifestChecksumFresh(manifest, file)
      return toExplorerReportRef(
        file,
        readVerifiedPatchWorkFile(input.repositoryRoot, file),
      )
    })
}

export interface SelectPatchWorkTaskInput {
  repositoryRoot: string
  selectedReportId: string
  gateId?: string
}

export interface SelectPatchWorkTaskResult {
  selectedReport: PipelineExplorerReportRef
  selectedTaskRef: PatchWorkFileRef
  manifest: PatchWorkManifest
}

export function selectPatchWorkTask(input: SelectPatchWorkTaskInput): SelectPatchWorkTaskResult {
  const manifest = readPatchWorkManifest(input.repositoryRoot)
  const reportFile = manifest.files
    .filter((file) => file.kind === 'explorer_report')
    .find((file) => reportIdFromRelativePath(file.relativePath) === input.selectedReportId)

  if (!reportFile) {
    throw new Error(`未找到 explorer report: ${input.selectedReportId}`)
  }

  assertManifestChecksumFresh(manifest, reportFile)
  const reportContent = readVerifiedPatchWorkFile(input.repositoryRoot, reportFile)
  const selectedReport = toExplorerReportRef(reportFile, reportContent)
  const selectedTaskContent = [
    `# 已选任务：${selectedReport.title}`,
    '',
    `来源报告：\`${reportFile.relativePath}\``,
    `报告 ID：\`${selectedReport.reportId}\``,
    `报告 checksum：\`${reportFile.checksum}\``,
    '',
    '---',
    '',
    reportContent.trim(),
    '',
  ].join('\n')
  const selectedTaskRef = writePatchWorkFile({
    contributionTaskId: manifest.contributionTaskId,
    pipelineSessionId: manifest.pipelineSessionId,
    repositoryRoot: input.repositoryRoot,
    kind: 'selected_task',
    createdByNode: 'explorer',
    content: selectedTaskContent,
  })
  const acceptedAt = Date.now()
  const nextManifest = updateManifest(input.repositoryRoot, (latestManifest) => ({
    ...latestManifest,
    selectedReportId: input.selectedReportId,
    files: latestManifest.files.map((file) => {
      if (file.relativePath !== reportFile.relativePath) return file
      return {
        ...file,
        acceptedRevision: file.revision,
        acceptedAt,
        acceptedByGateId: input.gateId,
      }
    }),
    updatedAt: acceptedAt,
  }))

  return {
    selectedReport,
    selectedTaskRef,
    manifest: nextManifest,
  }
}

export function acceptPatchWorkDocuments(input: {
  repositoryRoot: string
  gateId: string
  kinds: PatchWorkFileKind[]
}): PatchWorkFileRef[] {
  assertPatchWorkDocumentsAcceptable(input)

  const acceptedAt = Date.now()
  const acceptedFiles: PatchWorkFileRef[] = []
  updateManifest(input.repositoryRoot, (manifest) => {
    const files = manifest.files.map((file) => {
      if (!input.kinds.includes(file.kind)) return file
      assertManifestChecksumFresh(manifest, file)
      readVerifiedPatchWorkFile(input.repositoryRoot, file)
      const acceptedFile = {
        ...file,
        acceptedRevision: file.revision,
        acceptedAt,
        acceptedByGateId: input.gateId,
      }
      acceptedFiles.push(acceptedFile)
      return acceptedFile
    })

    const acceptedKinds = new Set(acceptedFiles.map((file) => file.kind))
    for (const kind of input.kinds) {
      if (!acceptedKinds.has(kind)) {
        throw new Error(`patch-work 文档不存在，无法接受: ${kind}`)
      }
    }

    return {
      ...manifest,
      files,
      updatedAt: acceptedAt,
    }
  })

  return input.kinds
    .map((kind) => acceptedFiles.find((file) => file.kind === kind))
    .filter((file): file is PatchWorkFileRef => Boolean(file))
}

export function assertPatchWorkDocumentsAcceptable(input: {
  repositoryRoot: string
  kinds: PatchWorkFileKind[]
}): PatchWorkFileRef[] {
  const manifest = readPatchWorkManifest(input.repositoryRoot)

  return input.kinds.map((kind) => {
    const file = manifest.files.find((item) => item.kind === kind)
    if (!file) {
      throw new Error(`patch-work 文档不存在，无法接受: ${kind}`)
    }

    assertManifestChecksumFresh(manifest, file)
    readVerifiedPatchWorkFile(input.repositoryRoot, file)
    return file
  })
}

export function clearPatchWorkFilesByKind(input: {
  repositoryRoot: string
  kind: PatchWorkFileKind
}): PatchWorkManifest {
  if (!FILE_KINDS.has(input.kind)) {
    throw new Error(`无效 patch-work 文件类型: ${input.kind}`)
  }

  const updatedAt = Date.now()
  return updateManifest(input.repositoryRoot, (manifest) => {
    const files = manifest.files.filter((file) => file.kind !== input.kind)
    const checksums = Object.fromEntries(files.map((file) => [file.relativePath, file.checksum]))
    return {
      ...manifest,
      files,
      checksums,
      selectedReportId: input.kind === 'explorer_report' ? undefined : manifest.selectedReportId,
      updatedAt,
    }
  })
}

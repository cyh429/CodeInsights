import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import type { AgentRuntimeManifest, AgentWorkspace, WorkspaceMcpConfig } from '@rv-insights/shared'
import { buildAgentRuntimeManifest } from './agent-runtime-manifest-registry'
import { materializePluginSnapshot } from './agent-plugin-catalog'
import { getAgentSessionRuntimeManifestPath, getAgentSessionRuntimeCwdPath } from './config-paths'
import { readJsonFileSafe, writeJsonFileAtomic } from './safe-file'

const SETTINGS_CONFLICT_FILE = '.rv-insights-conflicts.json'
interface MaterializeAgentRuntimeInput {
  workspace: AgentWorkspace
  sessionId: string
  workspacesRoot?: string
  generatedAt?: string
}

interface SettingsConflict {
  key: string
  existing: unknown
  desired: unknown
}

interface RuntimeSettingsConflictReport {
  generatedAt: string
  settingsPath: string
  conflicts: SettingsConflict[]
}

export class AgentRuntimeMaterializationError extends Error {
  constructor(message: string, readonly conflictsPath?: string) {
    super(message)
    this.name = 'AgentRuntimeMaterializationError'
  }
}

export function materializeAgentRuntimeForNewSession(input: MaterializeAgentRuntimeInput): AgentRuntimeManifest {
  const manifest = buildAgentRuntimeManifest({
    workspace: input.workspace,
    sessionId: input.sessionId,
    workspacesRoot: input.workspacesRoot,
    generatedAt: input.generatedAt,
  })

  if (!manifest.sessionCwd || !manifest.sessionRuntimeManifestPath) {
    throw new Error('Runtime manifest 缺少 session cwd 或 session manifest 路径')
  }

  assertSafeExistingPath(manifest.workspaceRoot, manifest.workspaceRoot)
  for (const path of [
    manifest.runtimeRoot,
    manifest.claudeConfigDir,
    manifest.skillsDir,
    manifest.pluginsDir,
    manifest.sessionCwd,
    dirname(manifest.sessionRuntimeManifestPath),
  ]) {
    ensureSafeDirectory(manifest.workspaceRoot, path)
  }

  writeRuntimeSettings(manifest)
  writeRuntimeMcpConfig(manifest)
  writeRuntimeClaudeMd(manifest)
  materializeSkillSnapshots(manifest)
  materializePluginSnapshots(manifest)
  ensureSafeDirectory(manifest.workspaceRoot, join(manifest.sessionCwd, '.context'))
  writeJsonTarget(manifest.workspaceRoot, manifest.sessionRuntimeManifestPath, manifest)

  return manifest
}

export function hasMaterializedAgentRuntime(workspaceSlug: string, sessionId: string, workspacesRoot?: string): boolean {
  return readMaterializedAgentRuntime(workspaceSlug, sessionId, workspacesRoot) !== null
}

export function readMaterializedAgentRuntime(workspaceSlug: string, sessionId: string, workspacesRoot?: string): AgentRuntimeManifest | null {
  const manifestPath = resolveSessionRuntimeManifestPath(workspaceSlug, sessionId, workspacesRoot)
  if (!existsSync(manifestPath)) return null
  const stat = lstatSync(manifestPath)
  if (stat.isSymbolicLink() || !stat.isFile()) return null

  const manifest = readJsonFileSafe<AgentRuntimeManifest>(manifestPath)
  const expectedSessionCwd = resolveSessionRuntimeCwdPath(workspaceSlug, sessionId, workspacesRoot)
  if (
    !manifest
    || manifest.manifestVersion !== 1
    || manifest.workspaceSlug !== workspaceSlug
    || manifest.sessionId !== sessionId
    || manifest.sessionCwd !== expectedSessionCwd
    || manifest.sessionRuntimeManifestPath !== manifestPath
  ) {
    return null
  }

  return manifest
}

export function getMaterializedAgentRuntimeCwd(workspaceSlug: string, sessionId: string): string {
  return getAgentSessionRuntimeCwdPath(workspaceSlug, sessionId)
}

function resolveSessionRuntimeManifestPath(workspaceSlug: string, sessionId: string, workspacesRoot?: string): string {
  if (!workspacesRoot) return getAgentSessionRuntimeManifestPath(workspaceSlug, sessionId)
  return join(resolve(workspacesRoot), workspaceSlug, 'sessions', sessionId, 'runtime-manifest.json')
}

function resolveSessionRuntimeCwdPath(workspaceSlug: string, sessionId: string, workspacesRoot?: string): string {
  if (!workspacesRoot) return getAgentSessionRuntimeCwdPath(workspaceSlug, sessionId)
  return join(resolve(workspacesRoot), workspaceSlug, 'sessions', sessionId, 'cwd')
}

function writeRuntimeSettings(manifest: AgentRuntimeManifest): void {
  const desiredSettings: Record<string, unknown> = {
    enabledPlugins: manifest.enabledPlugins.map((plugin) => ({
      type: 'local',
      path: plugin.snapshotPath,
    })),
    plansDirectory: '.context',
    skipWebFetchPreflight: true,
  }
  writeManagedSettingsFile(manifest, manifest.settingsPath, desiredSettings)

  if (manifest.sessionCwd) {
    writeManagedSettingsFile(
      manifest,
      join(manifest.sessionCwd, '.claude', 'settings.json'),
      desiredSettings,
    )
  }
}

function writeManagedSettingsFile(
  manifest: AgentRuntimeManifest,
  settingsPath: string,
  desiredSettings: Record<string, unknown>,
): void {
  const existingSettings = readJsonFileSafe<Record<string, unknown>>(settingsPath) ?? {}
  const conflicts: SettingsConflict[] = []

  for (const [key, desired] of Object.entries(desiredSettings)) {
    if (key in existingSettings && JSON.stringify(existingSettings[key]) !== JSON.stringify(desired)) {
      conflicts.push({ key, existing: existingSettings[key], desired })
    }
  }

  if (conflicts.length > 0) {
    const conflictsPath = join(dirname(settingsPath), SETTINGS_CONFLICT_FILE)
    const report: RuntimeSettingsConflictReport = {
      generatedAt: new Date().toISOString(),
      settingsPath,
      conflicts,
    }
    writeJsonTarget(manifest.workspaceRoot, conflictsPath, report)
    throw new AgentRuntimeMaterializationError(`Runtime settings 存在 RV 管理字段冲突: ${conflicts.map((c) => c.key).join(', ')}`, conflictsPath)
  }

  writeJsonTarget(manifest.workspaceRoot, settingsPath, {
    ...existingSettings,
    ...desiredSettings,
  })
}

function writeRuntimeMcpConfig(manifest: AgentRuntimeManifest): void {
  const sourcePath = join(manifest.workspaceRoot, 'mcp.json')
  const config = existsSync(sourcePath)
    ? JSON.parse(readFileSync(sourcePath, 'utf-8')) as WorkspaceMcpConfig
    : { servers: {} }

  writeJsonTarget(manifest.workspaceRoot, manifest.mcpConfigPath, { servers: config.servers ?? {} })
}

function writeRuntimeClaudeMd(manifest: AgentRuntimeManifest): void {
  const lines = [
    '# RV-Insights Agent Runtime',
    '',
    '本文件由 RV-Insights 为当前 Agent workspace 自动生成。',
    '',
    `- Workspace: ${manifest.workspaceSlug}`,
    `- Runtime root: ${manifest.runtimeRoot}`,
    `- Session cwd: ${manifest.sessionCwd ?? manifest.defaultCwd}`,
    `- Workspace files: ${manifest.defaultCwd}`,
    '',
    '会话临时文件优先写入当前 cwd；需要跨会话保留的文件写入 workspace-files。',
    '',
  ]
  writeTextTarget(manifest.workspaceRoot, manifest.claudeMdPath, lines.join('\n'))
}

function materializeSkillSnapshots(manifest: AgentRuntimeManifest): void {
  for (const skill of manifest.enabledSkills) {
    assertSafeExistingPath(manifest.workspaceRoot, skill.sourcePath)
    assertPathInsideWorkspace(manifest.workspaceRoot, skill.snapshotPath)
    replacePath(manifest.workspaceRoot, skill.snapshotPath)
    cpSync(skill.sourcePath, skill.snapshotPath, { recursive: true })
  }
}

function materializePluginSnapshots(manifest: AgentRuntimeManifest): void {
  for (const plugin of manifest.enabledPlugins) {
    materializePluginSnapshot(manifest.workspaceRoot, plugin)
  }
}

function replacePath(workspaceRoot: string, targetPath: string): void {
  assertPathInsideWorkspace(workspaceRoot, targetPath)
  if (!existsSync(targetPath)) return
  assertSafeExistingPath(workspaceRoot, targetPath)
  rmSync(targetPath, { recursive: true, force: true })
}

function writeJsonTarget(workspaceRoot: string, targetPath: string, data: object): void {
  ensureSafeDirectory(workspaceRoot, dirname(targetPath))
  assertSafeWriteTarget(workspaceRoot, targetPath)
  assertSafeWriteTarget(workspaceRoot, `${targetPath}.tmp`)
  writeJsonFileAtomic(targetPath, data, true)
}

function writeTextTarget(workspaceRoot: string, targetPath: string, content: string): void {
  ensureSafeDirectory(workspaceRoot, dirname(targetPath))
  assertSafeWriteTarget(workspaceRoot, targetPath)
  writeFileSync(targetPath, content, 'utf-8')
}

function ensureSafeDirectory(workspaceRoot: string, targetPath: string): void {
  assertPathInsideWorkspace(workspaceRoot, targetPath)
  assertSafeExistingPath(workspaceRoot, dirname(targetPath))
  if (existsSync(targetPath)) {
    assertSafeExistingPath(workspaceRoot, targetPath)
    if (!lstatSync(targetPath).isDirectory()) {
      throw new Error(`Runtime 路径不是目录: ${targetPath}`)
    }
    return
  }
  mkdirSync(targetPath, { recursive: true })
}

function assertSafeWriteTarget(workspaceRoot: string, targetPath: string): void {
  assertPathInsideWorkspace(workspaceRoot, targetPath)
  if (existsSync(targetPath)) {
    assertSafeExistingPath(workspaceRoot, targetPath)
    if (lstatSync(targetPath).isDirectory()) {
      throw new Error(`Runtime 写入目标是目录: ${targetPath}`)
    }
  }
}

function assertSafeExistingPath(workspaceRoot: string, targetPath: string): void {
  const rootReal = realpathSync(workspaceRoot)
  const resolvedTarget = resolve(targetPath)
  const relativeTarget = relative(resolve(workspaceRoot), resolvedTarget)
  if (isOutside(relativeTarget)) {
    throw new Error(`路径不在工作区内: ${targetPath}`)
  }

  const segments = relativeTarget ? relativeTarget.split(/[\\/]/) : []
  let cursor = resolve(workspaceRoot)
  assertNotSymlink(cursor)
  for (const segment of segments) {
    cursor = join(cursor, segment)
    if (!existsSync(cursor)) break
    assertNotSymlink(cursor)
  }

  if (existsSync(resolvedTarget)) {
    const targetReal = realpathSync(resolvedTarget)
    const rel = relative(rootReal, targetReal)
    if (isOutside(rel)) {
      throw new Error(`真实路径不在工作区内: ${targetPath}`)
    }
  }
}

function assertPathInsideWorkspace(workspaceRoot: string, targetPath: string): void {
  const rel = relative(resolve(workspaceRoot), resolve(targetPath))
  if (isOutside(rel)) {
    throw new Error(`Runtime 路径越界: ${targetPath}`)
  }
}

function assertNotSymlink(path: string): void {
  if (lstatSync(path).isSymbolicLink()) {
    throw new Error(`拒绝解析符号链接路径: ${path}`)
  }
}

function isOutside(relativePath: string): boolean {
  return relativePath === '..' || relativePath.startsWith('../') || relativePath.startsWith('..\\')
}

export function hashMaterializedFile(path: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`
}

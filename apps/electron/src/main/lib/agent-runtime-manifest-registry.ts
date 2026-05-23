import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type {
  AgentRuntimeManifest,
  AgentRuntimeManifestMcpServer,
  AgentRuntimeManifestSkill,
  AgentWorkspace,
  WorkspaceMcpConfig,
} from '@codeinsights/shared'
import { buildWorkspacePluginSnapshots } from './agent-plugin-catalog'
import { AGENT_HOST_BRIDGE_READONLY_TOOLS, AGENT_HOST_BRIDGE_VERSION } from './agent-host-mcp-server'
import { getAgentWorkspacesDir } from './config-paths'

export const AGENT_RUNTIME_MATERIALIZER_VERSION = '2026-05-18.1'

const EMPTY_HASH = hashString('')

export interface BuildAgentRuntimeManifestInput {
  workspace: AgentWorkspace
  sessionId?: string
  workspacesRoot?: string
  generatedAt?: string
}

export function buildAgentRuntimeManifest(input: BuildAgentRuntimeManifestInput): AgentRuntimeManifest {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const workspacesRoot = resolve(input.workspacesRoot ?? getAgentWorkspacesDir())
  assertSafeExistingPath(workspacesRoot, workspacesRoot)
  assertSafeWorkspaceSlug(input.workspace.slug)
  const workspaceRoot = resolve(workspacesRoot, input.workspace.slug)
  assertSafeExistingPath(workspacesRoot, workspaceRoot)

  const runtimeRoot = join(workspaceRoot, 'runtime')
  const claudeConfigDir = join(runtimeRoot, '.claude')
  const defaultCwd = join(workspaceRoot, 'workspace-files')
  const sessionCwd = input.sessionId ? join(workspaceRoot, 'sessions', input.sessionId, 'cwd') : undefined
  const sessionRuntimeManifestPath = input.sessionId ? join(workspaceRoot, 'sessions', input.sessionId, 'runtime-manifest.json') : undefined
  const mcpConfigPath = join(runtimeRoot, 'mcp.json')
  const settingsPath = join(claudeConfigDir, 'settings.json')
  const claudeMdPath = join(runtimeRoot, 'CLAUDE.md')
  const skillsDir = join(claudeConfigDir, 'skills')
  const pluginsDir = join(claudeConfigDir, 'plugins')

  for (const path of [runtimeRoot, claudeConfigDir, defaultCwd, mcpConfigPath, settingsPath, claudeMdPath, skillsDir, pluginsDir]) {
    assertPathInsideWorkspace(workspaceRoot, path)
  }
  if (sessionCwd) assertPathInsideWorkspace(workspaceRoot, sessionCwd)
  if (sessionRuntimeManifestPath) assertPathInsideWorkspace(workspaceRoot, sessionRuntimeManifestPath)

  const legacyMcpPath = join(workspaceRoot, 'mcp.json')
  const legacySkillsDir = join(workspaceRoot, 'skills')
  const legacyInactiveSkillsDir = join(workspaceRoot, 'skills-inactive')
  const workspaceConfigPath = join(workspaceRoot, 'config.json')

  const mcpConfig = readLegacyMcpConfig(workspaceRoot, legacyMcpPath)
  const enabledMcpServers = buildMcpServerEntries(mcpConfig)
  const enabledSkills = readLegacySkills(workspaceRoot, legacySkillsDir, skillsDir)
  const enabledPlugins = buildWorkspacePluginSnapshots({ workspaceRoot, pluginsDir })
  const additionalDirectories = readAttachedDirectories(workspaceRoot, workspaceConfigPath).map((path) => ({
    path,
    mode: 'read' as const,
  }))

  const settingsHash = hashString('readonly-settings:v1')
  const mcpHash = existsSync(legacyMcpPath) ? hashFile(workspaceRoot, legacyMcpPath) : EMPTY_HASH
  const skillsSnapshotHash = hashJson(enabledSkills.map(({ id, sourcePath, hash, enabled }) => ({ id, sourcePath, hash, enabled })))
  const inactiveSkillsSourceHash = existsSync(legacyInactiveSkillsDir) ? hashDirectory(workspaceRoot, legacyInactiveSkillsDir) : EMPTY_HASH
  const pluginsSnapshotHash = hashJson(enabledPlugins.map(({ id, sourcePath, hash, commands, enabled, sourceType }) => ({
    id,
    sourcePath,
    hash,
    commands: commands.map(({ name, handler, hash }) => ({ name, handler, hash })),
    enabled,
    sourceType,
  })))
  const hostBridge = {
    enabled: true,
    tools: [...AGENT_HOST_BRIDGE_READONLY_TOOLS],
    version: AGENT_HOST_BRIDGE_VERSION,
    configHash: hashJson({
      version: AGENT_HOST_BRIDGE_VERSION,
      tools: AGENT_HOST_BRIDGE_READONLY_TOOLS,
    }),
  }
  const sourceConfigHash = hashJson({
    mcpHash,
    skillsSnapshotHash,
    inactiveSkillsSourceHash,
    pluginsSnapshotHash,
    additionalDirectories,
    hostBridge,
  })
  const runtimeHash = hashJson({
    materializerVersion: AGENT_RUNTIME_MATERIALIZER_VERSION,
    settingsHash,
    sourceConfigHash,
    hostBridge: hostBridge.configHash,
  })

  return {
    manifestVersion: 1,
    materializerVersion: AGENT_RUNTIME_MATERIALIZER_VERSION,
    workspaceId: input.workspace.id,
    workspaceSlug: input.workspace.slug,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    workspaceRoot,
    runtimeRoot,
    claudeConfigDir,
    defaultCwd,
    ...(sessionCwd ? { sessionCwd } : {}),
    mcpConfigPath,
    settingsPath,
    claudeMdPath,
    skillsDir,
    pluginsDir,
    ...(sessionRuntimeManifestPath ? { sessionRuntimeManifestPath } : {}),
    settingsHash,
    mcpHash,
    skillsSnapshotHash,
    pluginsSnapshotHash,
    runtimeHash,
    enabledMcpServers,
    enabledSkills,
    enabledPlugins,
    additionalDirectories,
    hostBridge,
    createdAt: new Date(input.workspace.createdAt).toISOString(),
    updatedAt: new Date(input.workspace.updatedAt).toISOString(),
    generatedAt,
    sourceConfigHash,
  }
}

function buildMcpServerEntries(config: WorkspaceMcpConfig): AgentRuntimeManifestMcpServer[] {
  return Object.entries(config.servers ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, entry]) => ({
      id,
      scope: 'workspace' as const,
      enabled: entry.enabled !== false,
      type: entry.type,
      hash: hashJson({ id, entry }),
    }))
}

function readLegacyMcpConfig(workspaceRoot: string, mcpPath: string): WorkspaceMcpConfig {
  if (!existsSync(mcpPath)) return { servers: {} }
  assertSafeExistingPath(workspaceRoot, mcpPath)
  const parsed = JSON.parse(readFileSync(mcpPath, 'utf-8')) as Partial<WorkspaceMcpConfig>
  return { servers: parsed.servers ?? {} }
}

function readLegacySkills(workspaceRoot: string, sourceDir: string, snapshotRoot: string): AgentRuntimeManifestSkill[] {
  if (!existsSync(sourceDir)) return []
  assertSafeExistingPath(workspaceRoot, sourceDir)

  const skills: AgentRuntimeManifestSkill[] = []

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new Error(`拒绝解析符号链接路径: ${join(sourceDir, entry.name)}`)
    }
    if (!entry.isDirectory()) continue

    const sourcePath = join(sourceDir, entry.name)
    const skillMdPath = join(sourcePath, 'SKILL.md')
    assertSafeExistingPath(workspaceRoot, sourcePath)
    if (!existsSync(skillMdPath)) continue
    assertSafeExistingPath(workspaceRoot, skillMdPath)
    skills.push({
      id: entry.name,
      sourcePath,
      snapshotPath: join(snapshotRoot, entry.name),
      materializeMode: 'readonly-source',
      enabled: true,
      hash: hashDirectory(workspaceRoot, sourcePath),
    })
  }

  return skills.sort((a, b) => a.id.localeCompare(b.id))
}

function readAttachedDirectories(workspaceRoot: string, configPath: string): string[] {
  if (!existsSync(configPath)) return []
  assertSafeExistingPath(workspaceRoot, configPath)
  const parsed = JSON.parse(readFileSync(configPath, 'utf-8')) as { attachedDirectories?: unknown }
  if (!Array.isArray(parsed.attachedDirectories)) return []
  return parsed.attachedDirectories.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
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
    throw new Error(`Manifest 路径越界: ${targetPath}`)
  }
}

function isOutside(relativePath: string): boolean {
  return relativePath === '..' || relativePath.startsWith('../') || relativePath.startsWith('..\\')
}

function assertNotSymlink(path: string): void {
  if (lstatSync(path).isSymbolicLink()) {
    throw new Error(`拒绝解析符号链接路径: ${path}`)
  }
}

function hashDirectory(workspaceRoot: string, dir: string): string {
  const files = collectFiles(workspaceRoot, dir)
  return hashJson(files.map((file) => ({
    path: relative(dir, file),
    hash: hashFile(workspaceRoot, file),
  })))
}

function collectFiles(workspaceRoot: string, dir: string): string[] {
  assertSafeExistingPath(workspaceRoot, dir)
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    assertSafeExistingPath(workspaceRoot, path)
    if (entry.isDirectory()) {
      files.push(...collectFiles(workspaceRoot, path))
    } else if (entry.isFile()) {
      files.push(path)
    } else if (entry.isSymbolicLink()) {
      throw new Error(`拒绝解析符号链接路径: ${path}`)
    }
  }
  return files.sort()
}

function hashFile(workspaceRoot: string, path: string): string {
  assertSafeExistingPath(workspaceRoot, path)
  return hashString(readFileSync(path, 'utf-8'))
}

function hashJson(value: unknown): string {
  return hashString(JSON.stringify(value))
}

function hashString(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function assertSafeWorkspaceSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`非法 workspace slug: ${slug}`)
  }
}

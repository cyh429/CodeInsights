import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import type {
  AgentPluginCatalogEntry,
  AgentPluginCommandIndexEntry,
  AgentPluginEnabledRef,
  AgentRuntimeManifestPlugin,
} from '@rv-insights/shared'
import { readJsonFileSafe, writeJsonFileAtomic } from './safe-file'

interface WorkspacePluginConfig {
  pluginCatalog?: unknown
  enabledPlugins?: unknown
  attachedDirectories?: unknown
  permissionMode?: unknown
}

interface PluginManifest {
  name?: string
  description?: string
  commands?: unknown
}

export interface BuildWorkspacePluginSnapshotInput {
  workspaceRoot: string
  pluginsDir: string
}

export interface ImportLocalClaudePluginInput {
  workspaceRoot: string
  sourcePath: string
  enabled?: boolean
}

export interface ExpandDmiSlashCommandInput {
  prompt: string
  commands: AgentPluginCommandIndexEntry[]
}

export interface ExpandDmiSlashCommandResult {
  expanded: boolean
  prompt: string
  command?: AgentPluginCommandIndexEntry
}

interface ResolvedPluginSource {
  id: string
  name: string
  sourcePath: string
  sourceType: 'legacy-workspace' | 'local'
  enabled: boolean
  description?: string
}

export function buildWorkspacePluginSnapshots(input: BuildWorkspacePluginSnapshotInput): AgentRuntimeManifestPlugin[] {
  const workspaceRoot = resolve(input.workspaceRoot)
  assertSafeExistingWorkspacePath(workspaceRoot, workspaceRoot)
  const pluginsDir = resolve(input.pluginsDir)
  assertPathInsideWorkspace(workspaceRoot, pluginsDir)

  const sources = resolveWorkspacePluginSources(workspaceRoot, pluginsDir)
  return sources.map((source) => {
    const snapshotPath = join(pluginsDir, source.id)
    assertPathInsideWorkspace(workspaceRoot, snapshotPath)
    const hash = hashDirectory(source.sourcePath)
    const commands = buildPluginCommandIndex({
      pluginId: source.id,
      sourceRoot: source.sourcePath,
      snapshotRoot: snapshotPath,
    })

    return {
      id: source.id,
      name: source.name,
      sourcePath: source.sourcePath,
      snapshotPath,
      hash,
      commands,
      enabled: source.enabled,
      sourceType: source.sourceType,
    }
  }).sort((a, b) => a.id.localeCompare(b.id))
}

export function materializePluginSnapshot(workspaceRoot: string, plugin: AgentRuntimeManifestPlugin): void {
  assertSafeExistingWorkspacePath(workspaceRoot, workspaceRoot)
  assertSafeExistingSourcePath(plugin.sourcePath, plugin.sourcePath)
  assertPathInsideWorkspace(workspaceRoot, plugin.snapshotPath)
  ensureSafeWorkspaceDirectory(workspaceRoot, dirname(plugin.snapshotPath))
  replaceWorkspacePath(workspaceRoot, plugin.snapshotPath)
  cpSync(plugin.sourcePath, plugin.snapshotPath, { recursive: true, force: true })

  const materializedHash = hashDirectory(plugin.snapshotPath)
  if (materializedHash !== plugin.hash) {
    throw new Error(`Plugin snapshot hash 不一致，已阻断运行: ${plugin.id}`)
  }
}

export function importLocalClaudePlugin(input: ImportLocalClaudePluginInput): AgentPluginCatalogEntry {
  const workspaceRoot = resolve(input.workspaceRoot)
  assertSafeExistingWorkspacePath(workspaceRoot, workspaceRoot)
  const sourcePath = resolvePluginRoot(input.sourcePath)
  const manifest = readPluginManifest(sourcePath)
  const id = sanitizePluginId(manifest.name?.trim() || basename(sourcePath))
  const entry: AgentPluginCatalogEntry = {
    id,
    name: manifest.name?.trim() || id,
    sourcePath,
    sourceType: 'local',
    enabledByDefault: input.enabled ?? true,
    ...(manifest.description ? { description: manifest.description } : {}),
    hash: hashDirectory(sourcePath),
  }

  const configPath = join(workspaceRoot, 'config.json')
  assertSafeWorkspaceWriteTarget(workspaceRoot, configPath)
  const config = readJsonFileSafe<WorkspacePluginConfig>(configPath) ?? {}
  const catalog = readPluginCatalog(config)
  const enabledRefs = readEnabledPluginRefs(config)
  const nextCatalog = [...catalog.filter((item) => item.id !== entry.id), entry].sort((a, b) => a.id.localeCompare(b.id))
  const nextEnabledRefs = [
    ...enabledRefs.filter((item) => item.id !== entry.id),
    { id: entry.id, enabled: input.enabled ?? true } satisfies AgentPluginEnabledRef,
  ].sort((a, b) => a.id.localeCompare(b.id))

  writeJsonFileAtomic(configPath, {
    ...config,
    pluginCatalog: nextCatalog,
    enabledPlugins: nextEnabledRefs,
  })

  return entry
}

export function expandDmiSlashCommand(input: ExpandDmiSlashCommandInput): ExpandDmiSlashCommandResult {
  const trimmed = input.prompt.trimStart()
  if (!trimmed.startsWith('/')) return { expanded: false, prompt: input.prompt }

  const match = trimmed.match(/^\/([A-Za-z0-9._-]+)(?:\s+([\s\S]*))?$/)
  if (!match) return { expanded: false, prompt: input.prompt }

  const [, commandName, rest = ''] = match
  const command = input.commands.find((entry) => entry.name === commandName && entry.handler === 'app-dmi')
  if (!command) return { expanded: false, prompt: input.prompt }

  const commandPath = existsSync(command.snapshotPath) ? command.snapshotPath : command.sourcePath
  const template = readFileSync(commandPath, 'utf-8')
  const body = stripFrontmatter(template).trim()
  const prompt = [
    body,
    rest.trim() ? `\n用户参数：\n${rest.trim()}` : '',
  ].join('').trim()

  return { expanded: true, prompt, command }
}

function resolveWorkspacePluginSources(workspaceRoot: string, pluginsDir: string): ResolvedPluginSource[] {
  const config = readJsonFileSafe<WorkspacePluginConfig>(join(workspaceRoot, 'config.json')) ?? {}
  const catalog = readPluginCatalog(config)
  const enabledRefs = readEnabledPluginRefs(config)
  const enabledById = new Map(enabledRefs.map((ref) => [ref.id, ref]))
  const sources: ResolvedPluginSource[] = []

  for (const entry of catalog) {
    const ref = enabledById.get(entry.id)
    const enabled = ref?.enabled ?? entry.enabledByDefault === true
    if (!enabled) continue
    const sourcePath = resolvePluginRoot(ref?.sourcePath ?? entry.sourcePath)
    const manifest = readPluginManifest(sourcePath)
    const id = sanitizePluginId(entry.id)
    sources.push({
      id,
      name: manifest.name?.trim() || entry.name || id,
      sourcePath,
      sourceType: 'local',
      enabled,
      description: manifest.description ?? entry.description,
    })
  }

  const legacyPluginRoot = join(workspaceRoot, '.claude-plugin')
  if (existsSync(join(legacyPluginRoot, 'plugin.json'))) {
    assertSafeExistingWorkspacePath(workspaceRoot, legacyPluginRoot)
    const manifest = readPluginManifest(legacyPluginRoot)
    const id = sanitizePluginId(manifest.name?.trim() || 'legacy-workspace-plugin')
    if (!sources.some((source) => source.id === id)) {
      sources.push({
        id,
        name: manifest.name?.trim() || id,
        sourcePath: legacyPluginRoot,
        sourceType: 'legacy-workspace',
        enabled: true,
        description: manifest.description,
      })
    }
  }

  for (const source of sources) {
    const snapshotPath = join(pluginsDir, source.id)
    assertPathInsideWorkspace(workspaceRoot, snapshotPath)
  }

  return sources
}

function readPluginCatalog(config: WorkspacePluginConfig): AgentPluginCatalogEntry[] {
  if (!Array.isArray(config.pluginCatalog)) return []
  return config.pluginCatalog.flatMap((entry): AgentPluginCatalogEntry[] => {
    if (!entry || typeof entry !== 'object') return []
    const item = entry as Partial<AgentPluginCatalogEntry>
    if (typeof item.id !== 'string' || typeof item.sourcePath !== 'string') return []
    return [{
      id: sanitizePluginId(item.id),
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : item.id,
      sourcePath: item.sourcePath,
      sourceType: 'local',
      enabledByDefault: item.enabledByDefault === true,
      ...(typeof item.description === 'string' ? { description: item.description } : {}),
      ...(typeof item.hash === 'string' ? { hash: item.hash } : {}),
    }]
  })
}

function readEnabledPluginRefs(config: WorkspacePluginConfig): AgentPluginEnabledRef[] {
  if (!Array.isArray(config.enabledPlugins)) return []
  return config.enabledPlugins.flatMap((entry): AgentPluginEnabledRef[] => {
    if (typeof entry === 'string') return [{ id: sanitizePluginId(entry), enabled: true }]
    if (!entry || typeof entry !== 'object') return []
    const item = entry as Partial<AgentPluginEnabledRef>
    if (typeof item.id !== 'string') return []
    return [{
      id: sanitizePluginId(item.id),
      ...(typeof item.sourcePath === 'string' ? { sourcePath: item.sourcePath } : {}),
      enabled: item.enabled !== false,
    }]
  })
}

function resolvePluginRoot(sourcePath: string): string {
  const resolved = resolve(sourcePath)
  const claudeManifest = join(resolved, '.claude-plugin', 'plugin.json')
  const codexManifest = join(resolved, '.codex-plugin', 'plugin.json')
  const directManifest = join(resolved, 'plugin.json')

  if (existsSync(claudeManifest)) return join(resolved, '.claude-plugin')
  if (existsSync(codexManifest)) return join(resolved, '.codex-plugin')
  if (existsSync(directManifest)) return resolved
  if (sourcePath.endsWith('plugin.json') && existsSync(resolved)) return dirname(resolved)

  throw new Error(`未找到 Claude plugin manifest: ${sourcePath}`)
}

function readPluginManifest(pluginRoot: string): PluginManifest {
  assertSafeExistingSourcePath(pluginRoot, pluginRoot)
  const manifestPath = join(pluginRoot, 'plugin.json')
  assertSafeExistingSourcePath(pluginRoot, manifestPath)
  return JSON.parse(readFileSync(manifestPath, 'utf-8')) as PluginManifest
}

function buildPluginCommandIndex(input: {
  pluginId: string
  sourceRoot: string
  snapshotRoot: string
}): AgentPluginCommandIndexEntry[] {
  const commands: AgentPluginCommandIndexEntry[] = []
  const candidateDirs = [
    join(input.sourceRoot, 'commands'),
    join(input.sourceRoot, '.claude', 'commands'),
  ]

  for (const dir of candidateDirs) {
    if (!existsSync(dir)) continue
    assertSafeExistingSourcePath(input.sourceRoot, dir)
    const files = collectFiles(dir).filter((file) => file.endsWith('.md'))
    for (const file of files) {
      const relativePath = relative(input.sourceRoot, file)
      const content = readFileSync(file, 'utf-8')
      const metadata = parseCommandFrontmatter(content)
      const name = sanitizeCommandName(metadata.name ?? basename(file, '.md'))
      commands.push({
        name,
        pluginId: input.pluginId,
        sourcePath: file,
        snapshotPath: join(input.snapshotRoot, relativePath),
        handler: metadata.dmi ? 'app-dmi' : 'sdk',
        ...(metadata.description ? { description: metadata.description } : {}),
        hash: hashString(content),
      })
    }
  }

  return commands.sort((a, b) => a.name.localeCompare(b.name))
}

function parseCommandFrontmatter(content: string): { name?: string; description?: string; dmi: boolean } {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!fmMatch?.[1]) return { dmi: false }
  const metadata: { name?: string; description?: string; dmi: boolean } = { dmi: false }

  for (const line of fmMatch[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const raw = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key === 'name' && raw) metadata.name = raw
    if (key === 'description' && raw) metadata.description = raw
    if ((key === 'dmi' || key === 'rv-dmi') && raw === 'true') metadata.dmi = true
  }

  return metadata
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*/, '')
}

function collectFiles(dir: string): string[] {
  assertSafeExistingSourcePath(dir, dir)
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    assertSafeExistingSourcePath(dir, path)
    if (entry.isSymbolicLink()) {
      throw new Error(`拒绝解析符号链接路径: ${path}`)
    }
    if (entry.isDirectory()) {
      files.push(...collectFiles(path))
    } else if (entry.isFile()) {
      files.push(path)
    }
  }
  return files.sort()
}

function hashDirectory(dir: string): string {
  const files = collectFiles(dir)
  return hashString(JSON.stringify(files.map((file) => ({
    path: relative(dir, file),
    hash: hashString(readFileSync(file, 'utf-8')),
  }))))
}

function hashString(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function replaceWorkspacePath(workspaceRoot: string, targetPath: string): void {
  assertPathInsideWorkspace(workspaceRoot, targetPath)
  if (!existsSync(targetPath)) return
  assertSafeExistingWorkspacePath(workspaceRoot, targetPath)
  rmSync(targetPath, { recursive: true, force: true })
}

function ensureSafeWorkspaceDirectory(workspaceRoot: string, targetPath: string): void {
  assertPathInsideWorkspace(workspaceRoot, targetPath)
  assertSafeExistingWorkspacePath(workspaceRoot, dirname(targetPath))
  if (!existsSync(targetPath)) {
    mkdirSync(targetPath, { recursive: true })
    return
  }
  assertSafeExistingWorkspacePath(workspaceRoot, targetPath)
  if (!lstatSync(targetPath).isDirectory()) {
    throw new Error(`Plugin snapshot 路径不是目录: ${targetPath}`)
  }
}

function assertSafeWorkspaceWriteTarget(workspaceRoot: string, targetPath: string): void {
  assertPathInsideWorkspace(workspaceRoot, targetPath)
  if (!existsSync(targetPath)) return
  assertSafeExistingWorkspacePath(workspaceRoot, targetPath)
  if (lstatSync(targetPath).isDirectory()) {
    throw new Error(`Plugin 配置写入目标是目录: ${targetPath}`)
  }
}

function assertSafeExistingWorkspacePath(workspaceRoot: string, targetPath: string): void {
  assertSafeExistingPath(resolve(workspaceRoot), resolve(workspaceRoot), targetPath, '路径不在工作区内')
}

function assertSafeExistingSourcePath(sourceRoot: string, targetPath: string): void {
  assertSafeExistingPath(resolve(sourceRoot), resolve(sourceRoot), targetPath, '路径不在 plugin source 内')
}

function assertSafeExistingPath(realRootInput: string, lexicalRootInput: string, targetPath: string, outsideMessage: string): void {
  const rootReal = realpathSync(realRootInput)
  const resolvedTarget = resolve(targetPath)
  const relativeTarget = relative(resolve(lexicalRootInput), resolvedTarget)
  if (isOutside(relativeTarget)) {
    throw new Error(`${outsideMessage}: ${targetPath}`)
  }

  const segments = relativeTarget ? relativeTarget.split(/[\\/]/) : []
  let cursor = resolve(lexicalRootInput)
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
      throw new Error(`真实路径越界: ${targetPath}`)
    }
  }
}

function assertPathInsideWorkspace(workspaceRoot: string, targetPath: string): void {
  const rel = relative(resolve(workspaceRoot), resolve(targetPath))
  if (isOutside(rel)) {
    throw new Error(`Plugin snapshot 路径越界: ${targetPath}`)
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

function sanitizePluginId(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^\.+|\.+$/g, '')
  if (!sanitized || sanitized.includes('..')) {
    throw new Error(`非法 plugin id: ${id}`)
  }
  return sanitized
}

function sanitizeCommandName(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^\.+|\.+$/g, '')
  if (!sanitized || sanitized.includes('..')) {
    throw new Error(`非法 plugin command: ${name}`)
  }
  return sanitized
}

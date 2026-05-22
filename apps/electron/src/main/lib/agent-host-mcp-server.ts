import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import type { AgentRuntimeManifest } from '@codeinsights/shared'
import { getMemoryConfig } from './memory-service'
import { addMemory, formatSearchResult, searchMemory } from './memos-client'

export const AGENT_HOST_MCP_SERVER_NAME = 'codeinsights_host'

export const AGENT_HOST_BRIDGE_TOOLS = [
  'codeinsights_workspace_search',
  'codeinsights_list_workspace_files',
  'codeinsights_memory_search',
  'codeinsights_open_file',
  'codeinsights_memory_append',
  'codeinsights_send_channel_message',
  'codeinsights_schedule_task',
] as const

export const AGENT_HOST_BRIDGE_READONLY_TOOLS = [
  'codeinsights_workspace_search',
  'codeinsights_list_workspace_files',
  'codeinsights_memory_search',
  'codeinsights_open_file',
] as const satisfies readonly AgentHostBridgeToolName[]

export const AGENT_HOST_BRIDGE_VERSION = '2026-05-18.1'

export type AgentHostBridgeToolName = typeof AGENT_HOST_BRIDGE_TOOLS[number]

interface HostBridgeTextResult {
  [key: string]: unknown
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

interface HostBridgeDependencyOverrides {
  memorySearch?: typeof searchMemory
  memoryAppend?: typeof addMemory
  formatMemorySearchResult?: typeof formatSearchResult
  channelSender?: (input: HostBridgeSendChannelMessageInput) => Promise<string>
  taskScheduler?: (input: HostBridgeScheduleTaskInput) => Promise<string>
}

export interface AgentHostBridgeContext {
  manifest: AgentRuntimeManifest
  dependencies?: HostBridgeDependencyOverrides
}

export interface HostBridgeWorkspaceSearchInput {
  query: string
  root?: string
  maxResults?: number
}

export interface HostBridgeListWorkspaceFilesInput {
  root?: string
  maxDepth?: number
  maxEntries?: number
}

export interface HostBridgeOpenFileInput {
  path: string
  maxBytes?: number
}

export interface HostBridgeMemorySearchInput {
  query: string
  limit?: number
}

export interface HostBridgeMemoryAppendInput {
  userMessage: string
  assistantMessage?: string
  conversationId?: string
  tags?: string[]
}

export interface HostBridgeSendChannelMessageInput {
  channel: string
  target: string
  message: string
}

export interface HostBridgeScheduleTaskInput {
  title: string
  prompt: string
  scheduledAt?: string
}

interface AllowedRoot {
  label: string
  path: string
  realPath: string
}

const DEFAULT_MAX_SEARCH_RESULTS = 20
const DEFAULT_MAX_FILE_BYTES = 64 * 1024
const MAX_FILE_BYTES = 512 * 1024
const DEFAULT_MAX_LIST_ENTRIES = 200
const MAX_LIST_ENTRIES = 500
const DEFAULT_MAX_DEPTH = 3
const MAX_DEPTH = 6

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'runtime', 'sessions', '.claude'])
const TEXT_EXTENSIONS = new Set([
  '.cjs', '.css', '.csv', '.js', '.json', '.jsx', '.log', '.md', '.mjs', '.toml',
  '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
])

export async function createAgentHostMcpServer(
  sdk: typeof import('@anthropic-ai/claude-agent-sdk'),
  context: AgentHostBridgeContext,
): Promise<Record<string, unknown>> {
  const { z } = await import('zod')
  const enabledTools = new Set(context.manifest.hostBridge.tools)

  const server = sdk.createSdkMcpServer({
    name: AGENT_HOST_MCP_SERVER_NAME,
    version: '1.0.0',
    tools: [
      sdk.tool(
        'codeinsights_workspace_search',
        'Search text files in the current CodeInsights workspace runtime. Only reads workspace/session/additional directories allowed by the runtime manifest.',
        {
          query: z.string().min(1).describe('Search query'),
          root: z.string().optional().describe('Optional path or label under the allowed roots'),
          maxResults: z.number().int().min(1).max(MAX_LIST_ENTRIES).optional(),
        },
        async (args) => runHostBridgeTool(() => handleWorkspaceSearch(context, args)),
        { annotations: { readOnlyHint: true } },
      ),
      sdk.tool(
        'codeinsights_list_workspace_files',
        'List files in the current CodeInsights workspace runtime. Only lists allowed workspace/session/additional directories.',
        {
          root: z.string().optional().describe('Optional path or label under the allowed roots'),
          maxDepth: z.number().int().min(0).max(MAX_DEPTH).optional(),
          maxEntries: z.number().int().min(1).max(MAX_LIST_ENTRIES).optional(),
        },
        async (args) => runHostBridgeTool(() => handleListWorkspaceFiles(context, args)),
        { annotations: { readOnlyHint: true } },
      ),
      sdk.tool(
        'codeinsights_memory_search',
        'Search CodeInsights long-term memory when memory is enabled.',
        {
          query: z.string().min(1).describe('Search query'),
          limit: z.number().int().min(1).max(20).optional(),
        },
        async (args) => runHostBridgeTool(() => handleMemorySearch(context, args)),
        { annotations: { readOnlyHint: true } },
      ),
      sdk.tool(
        'codeinsights_open_file',
        'Read a text file from the allowed CodeInsights runtime roots.',
        {
          path: z.string().min(1).describe('File path under an allowed root'),
          maxBytes: z.number().int().min(1).max(MAX_FILE_BYTES).optional(),
        },
        async (args) => runHostBridgeTool(() => handleOpenFile(context, args)),
        { annotations: { readOnlyHint: true } },
      ),
      sdk.tool(
        'codeinsights_memory_append',
        'Append a meaningful exchange to CodeInsights long-term memory when memory is enabled.',
        {
          userMessage: z.string().min(1),
          assistantMessage: z.string().optional(),
          conversationId: z.string().optional(),
          tags: z.array(z.string()).optional(),
        },
        async (args) => runHostBridgeTool(() => handleMemoryAppend(context, args)),
      ),
      sdk.tool(
        'codeinsights_send_channel_message',
        'Send a message through an CodeInsights external channel when a channel adapter is available.',
        {
          channel: z.string().min(1),
          target: z.string().min(1),
          message: z.string().min(1),
        },
        async (args) => runHostBridgeTool(() => handleSendChannelMessage(context, args)),
      ),
      sdk.tool(
        'codeinsights_schedule_task',
        'Schedule a follow-up task through CodeInsights when a scheduler adapter is available.',
        {
          title: z.string().min(1),
          prompt: z.string().min(1),
          scheduledAt: z.string().optional(),
        },
        async (args) => runHostBridgeTool(() => handleScheduleTask(context, args)),
      ),
    ].filter((_, index) => enabledTools.has(AGENT_HOST_BRIDGE_TOOLS[index]!)),
  })

  return server as unknown as Record<string, unknown>
}

export async function handleWorkspaceSearch(
  context: AgentHostBridgeContext,
  input: HostBridgeWorkspaceSearchInput,
): Promise<HostBridgeTextResult> {
  try {
    const query = input.query.trim()
    if (!query) return errorResult('搜索关键词不能为空')

    const startDir = resolveAllowedDirectory(context.manifest, input.root)
    const maxResults = clampInt(input.maxResults, DEFAULT_MAX_SEARCH_RESULTS, MAX_LIST_ENTRIES)
    const matches: string[] = []

    walkFiles(startDir.path, {
      rootRealPath: startDir.realPath,
      maxEntries: maxResults,
      onFile: (filePath) => {
        if (matches.length >= maxResults || !isReadableTextFile(filePath)) return
        const stat = statSync(filePath)
        if (stat.size > MAX_FILE_BYTES) return
        const text = readFileSync(filePath, 'utf-8')
        const line = findMatchingLine(text, query)
        if (!line) return
        matches.push(`${formatRelativePath(context.manifest, filePath)}:${line.lineNumber}: ${line.text}`)
      },
    })

    if (matches.length === 0) {
      return textResult('未找到匹配内容。')
    }
    return textResult(matches.join('\n'))
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error))
  }
}

export async function handleListWorkspaceFiles(
  context: AgentHostBridgeContext,
  input: HostBridgeListWorkspaceFilesInput,
): Promise<HostBridgeTextResult> {
  try {
    const startDir = resolveAllowedDirectory(context.manifest, input.root)
    const maxDepth = clampInt(input.maxDepth, DEFAULT_MAX_DEPTH, MAX_DEPTH)
    const maxEntries = clampInt(input.maxEntries, DEFAULT_MAX_LIST_ENTRIES, MAX_LIST_ENTRIES)
    const entries: string[] = []

    walkFiles(startDir.path, {
      rootRealPath: startDir.realPath,
      maxDepth,
      maxEntries,
      includeDirectories: true,
      onEntry: (entryPath, kind) => {
        entries.push(`${kind === 'directory' ? 'dir' : 'file'} ${formatRelativePath(context.manifest, entryPath)}`)
      },
    })

    return textResult(entries.length > 0 ? entries.join('\n') : '目录为空。')
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error))
  }
}

export async function handleOpenFile(
  context: AgentHostBridgeContext,
  input: HostBridgeOpenFileInput,
): Promise<HostBridgeTextResult> {
  try {
    const filePath = resolveAllowedFile(context.manifest, input.path)
    if (!isReadableTextFile(filePath.path)) return errorResult('只允许读取文本文件')

    const maxBytes = clampInt(input.maxBytes, DEFAULT_MAX_FILE_BYTES, MAX_FILE_BYTES)
    const stat = statSync(filePath.path)
    if (stat.size > maxBytes) {
      return errorResult(`文件过大：${stat.size} bytes，当前上限 ${maxBytes} bytes`)
    }

    return textResult(readFileSync(filePath.path, 'utf-8'))
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error))
  }
}

export async function handleMemorySearch(
  context: AgentHostBridgeContext,
  input: HostBridgeMemorySearchInput,
): Promise<HostBridgeTextResult> {
  const config = getMemoryConfig()
  if (!config.enabled || !config.apiKey) {
    return errorResult('记忆服务未启用或未配置 API Key')
  }
  const search = context.dependencies?.memorySearch ?? searchMemory
  const format = context.dependencies?.formatMemorySearchResult ?? formatSearchResult
  const result = await search(
    { apiKey: config.apiKey, userId: config.userId?.trim() || 'codeinsights-user', baseUrl: config.baseUrl },
    input.query,
    input.limit,
  )
  return textResult(format(result))
}

export async function handleMemoryAppend(
  context: AgentHostBridgeContext,
  input: HostBridgeMemoryAppendInput,
): Promise<HostBridgeTextResult> {
  const config = getMemoryConfig()
  if (!config.enabled || !config.apiKey) {
    return errorResult('记忆服务未启用或未配置 API Key')
  }
  const append = context.dependencies?.memoryAppend ?? addMemory
  await append(
    { apiKey: config.apiKey, userId: config.userId?.trim() || 'codeinsights-user', baseUrl: config.baseUrl },
    input,
  )
  return textResult('Memory stored successfully.')
}

export async function handleSendChannelMessage(
  context: AgentHostBridgeContext,
  input: HostBridgeSendChannelMessageInput,
): Promise<HostBridgeTextResult> {
  if (!context.dependencies?.channelSender) {
    return errorResult('当前运行时未注入外部渠道发送器，无法发送消息')
  }
  return textResult(await context.dependencies.channelSender(input))
}

export async function handleScheduleTask(
  context: AgentHostBridgeContext,
  input: HostBridgeScheduleTaskInput,
): Promise<HostBridgeTextResult> {
  if (!context.dependencies?.taskScheduler) {
    return errorResult('当前运行时未注入任务调度器，无法创建计划任务')
  }
  return textResult(await context.dependencies.taskScheduler(input))
}

function runHostBridgeTool(operation: () => Promise<HostBridgeTextResult>): Promise<HostBridgeTextResult> {
  return operation().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    return errorResult(`Host bridge 工具执行失败: ${message}`)
  })
}

function textResult(text: string): HostBridgeTextResult {
  return { content: [{ type: 'text', text }] }
}

function errorResult(text: string): HostBridgeTextResult {
  return { content: [{ type: 'text', text }], isError: true }
}

function resolveAllowedDirectory(manifest: AgentRuntimeManifest, requestedPath?: string): AllowedRoot {
  if (!requestedPath || requestedPath === '.') {
    return getAllowedRoots(manifest)[0]!
  }
  const resolved = resolveAllowedPath(manifest, requestedPath)
  if (!lstatSync(resolved.path).isDirectory()) {
    throw new Error(`路径不是目录: ${requestedPath}`)
  }
  return resolved
}

function resolveAllowedFile(manifest: AgentRuntimeManifest, requestedPath: string): AllowedRoot {
  const resolved = resolveAllowedPath(manifest, requestedPath)
  if (!lstatSync(resolved.path).isFile()) {
    throw new Error(`路径不是文件: ${requestedPath}`)
  }
  return resolved
}

function resolveAllowedPath(manifest: AgentRuntimeManifest, requestedPath: string): AllowedRoot {
  const normalized = requestedPath.trim()
  if (!normalized) throw new Error('路径不能为空')
  if (normalized.includes('\0')) throw new Error('路径包含非法字符')

  const roots = getAllowedRoots(manifest)
  const labelMatch = roots.find((root) => normalized === root.label || normalized.startsWith(`${root.label}/`))
  const candidates = labelMatch
    ? [join(labelMatch.path, normalized.slice(labelMatch.label.length).replace(/^[\\/]/, ''))]
    : [resolve(normalized), ...roots.map((root) => resolve(root.path, normalized))]

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    const root = roots.find((allowedRoot) => isInsideRealPath(candidate, allowedRoot.realPath))
    if (!root) continue
    assertNoSymlinkTraversal(root.path, candidate)
    return { label: root.label, path: resolve(candidate), realPath: realpathSync(candidate) }
  }

  throw new Error(`路径不在允许的运行时范围内: ${requestedPath}`)
}

function getAllowedRoots(manifest: AgentRuntimeManifest): AllowedRoot[] {
  const rawRoots: Array<{ label: string; path: string }> = [
    ...(manifest.sessionCwd ? [{ label: 'session', path: manifest.sessionCwd }] : []),
    { label: 'workspace', path: manifest.defaultCwd },
    ...manifest.additionalDirectories.map((dir, index) => ({ label: `additional-${index + 1}`, path: dir.path })),
  ]

  return rawRoots
    .filter((root) => existsSync(root.path) && lstatSync(root.path).isDirectory())
    .map((root) => ({ ...root, realPath: realpathSync(root.path) }))
}

function isInsideRealPath(targetPath: string, rootRealPath: string): boolean {
  const targetRealPath = realpathSync(targetPath)
  const rel = relative(rootRealPath, targetRealPath)
  return rel === '' || (!rel.startsWith('..') && !rel.includes(':'))
}

function assertNoSymlinkTraversal(rootPath: string, targetPath: string): void {
  let cursor = resolve(rootPath)
  const segments = relative(cursor, resolve(targetPath)).split(/[\\/]/).filter(Boolean)
  for (const segment of segments) {
    cursor = join(cursor, segment)
    if (!existsSync(cursor)) break
    if (lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`拒绝读取符号链接路径: ${cursor}`)
    }
  }
}

function walkFiles(
  rootPath: string,
  options: {
    rootRealPath: string
    maxDepth?: number
    maxEntries: number
    includeDirectories?: boolean
    onEntry?: (path: string, kind: 'file' | 'directory') => void
    onFile?: (path: string) => void
  },
): void {
  let count = 0
  const visit = (dir: string, depth: number): void => {
    if (count >= options.maxEntries) return
    assertNoSymlinkTraversal(rootPath, dir)
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (count >= options.maxEntries) return
      const path = join(dir, entry.name)
      if (!isInsideRealPath(path, options.rootRealPath)) continue
      if (entry.isSymbolicLink()) throw new Error(`拒绝读取符号链接路径: ${path}`)
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        if (options.includeDirectories) {
          count += 1
          options.onEntry?.(path, 'directory')
        }
        if (depth < (options.maxDepth ?? MAX_DEPTH)) visit(path, depth + 1)
      } else if (entry.isFile()) {
        count += 1
        options.onEntry?.(path, 'file')
        options.onFile?.(path)
      }
    }
  }
  visit(rootPath, 0)
}

function isReadableTextFile(path: string): boolean {
  const ext = basename(path).includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : ''
  return TEXT_EXTENSIONS.has(ext) || basename(path).toLowerCase() === 'claude.md'
}

function findMatchingLine(text: string, query: string): { lineNumber: number; text: string } | null {
  const needle = query.toLowerCase()
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (line.toLowerCase().includes(needle)) {
      return { lineNumber: index + 1, text: line.trim().slice(0, 240) }
    }
  }
  return null
}

function formatRelativePath(manifest: AgentRuntimeManifest, path: string): string {
  const roots = getAllowedRoots(manifest)
  const root = roots.find((candidate) => isInsideRealPath(path, candidate.realPath))
  if (!root) return path
  const rel = relative(root.path, path)
  return rel ? `${root.label}/${rel}` : root.label
}

function clampInt(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isInteger(value)) return fallback
  return Math.max(1, Math.min(value as number, max))
}

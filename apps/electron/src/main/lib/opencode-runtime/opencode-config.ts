import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, lstat, mkdir, realpath, rename, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep, resolve } from 'node:path'
import type { CodeInsightsPermissionMode } from '@codeinsights/shared'
import type { OpencodeMcpConfig } from './opencode-mcp-config'

export type OpencodeProviderAuthConfig =
  | { source: 'native' }
  | {
    source: 'channel'
    providerId: string
    baseUrl?: string
    apiKeyEnvName: string
  }

export interface BuildOpencodeConfigInput {
  modelId: string
  agentName: string
  auth: OpencodeProviderAuthConfig
  permissionMode: CodeInsightsPermissionMode
  mcp: OpencodeMcpConfig
  opencodeVersion?: string
}

export interface BuildOpencodeConfigResult {
  config: OpencodeConfig
  inlinePolicy: OpencodeInlinePolicy
  configContent: string
  inlinePolicyContent: string
  runtimeConfigHash: string
  redactedSummary: Record<string, unknown>
}

export interface WriteOpencodeRuntimeConfigInput {
  rootDir: string
  built: BuildOpencodeConfigResult
}

export interface WriteOpencodeRuntimeConfigResult extends BuildOpencodeConfigResult {
  configPath: string
  configDir: string
}

export interface ApplyOpencodeRuntimeConfigEnvInput {
  env: Record<string, string>
  configPath: string
  configDir: string
  inlinePolicyContent: string
  includeConfigDir?: boolean
}

export interface OpencodeConfig {
  $schema: string
  model: string
  autoupdate: false
  share: 'disabled'
  server: {
    hostname: '127.0.0.1'
    cors: []
  }
  permission: OpencodePermissionPolicy
  mcp: OpencodeMcpConfig['mcp']
  agent: Record<string, unknown>
  provider?: Record<string, OpencodeProviderConfig>
  enabled_providers?: string[]
}

export interface OpencodeProviderConfig {
  npm: string
  name: string
  options: {
    baseURL?: string
    apiKey: string
  }
  models: Record<string, { name: string }>
}

export interface OpencodeInlinePolicy {
  share: 'disabled'
  autoupdate: false
  server: {
    hostname: '127.0.0.1'
    cors: []
  }
  permission: {
    doom_loop: 'deny'
  }
}

export interface OpencodePermissionPolicy {
  '*': 'ask' | 'allow'
  read: Record<string, 'allow' | 'deny'>
  glob: 'allow'
  grep: 'allow'
  edit: 'ask' | 'deny' | 'allow'
  bash: Record<string, 'ask' | 'allow' | 'deny'>
  task?: 'ask' | 'allow'
  skill?: 'ask' | 'allow'
  lsp?: 'ask' | 'allow'
  question?: 'ask' | 'allow'
  webfetch: 'ask' | 'allow'
  websearch: 'ask' | 'allow'
  external_directory: 'ask'
  doom_loop: 'deny'
}

const OPENCODE_CONFIG_SCHEMA = 'https://opencode.ai/config.json'
const CONFIG_SCHEMA_VERSION = 1
const RUNTIME_ADAPTER_VERSION = 1
const CODEINSIGHTS_PROVIDER_ID = 'codeinsights-openai-compatible'

export function buildOpencodeConfig(input: BuildOpencodeConfigInput): BuildOpencodeConfigResult {
  const provider = buildProviderConfig(input)
  const model = input.auth.source === 'channel'
    ? `${CODEINSIGHTS_PROVIDER_ID}/${input.modelId}`
    : input.modelId
  const config: OpencodeConfig = {
    $schema: OPENCODE_CONFIG_SCHEMA,
    model,
    autoupdate: false,
    share: 'disabled',
    server: {
      hostname: '127.0.0.1',
      cors: [],
    },
    permission: buildOpencodePermissionPolicy(input.permissionMode),
    mcp: input.mcp.mcp,
    agent: {},
    ...(provider ? { provider: { [CODEINSIGHTS_PROVIDER_ID]: provider } } : {}),
    ...(provider ? { enabled_providers: [CODEINSIGHTS_PROVIDER_ID] } : {}),
  }
  const inlinePolicy = buildOpencodeInlinePolicy()
  const configContent = `${stableStringify(config, 2)}\n`
  const inlinePolicyContent = stableStringify(inlinePolicy)
  const runtimeConfigHash = hashRuntimeConfig({
    schemaVersion: CONFIG_SCHEMA_VERSION,
    adapterVersion: RUNTIME_ADAPTER_VERSION,
    opencodeVersion: input.opencodeVersion,
    config,
    inlinePolicy,
  })

  return {
    config,
    inlinePolicy,
    configContent,
    inlinePolicyContent,
    runtimeConfigHash,
    redactedSummary: {
      model,
      agentName: input.agentName,
      authSource: input.auth.source,
      providerIds: provider ? [CODEINSIGHTS_PROVIDER_ID] : [],
      mcpServerCount: Object.keys(input.mcp.mcp).length,
      permissionMode: input.permissionMode,
    },
  }
}

export function buildOpencodeInlinePolicy(): OpencodeInlinePolicy {
  return {
    share: 'disabled',
    autoupdate: false,
    server: {
      hostname: '127.0.0.1',
      cors: [],
    },
    permission: {
      doom_loop: 'deny',
    },
  }
}

export function buildOpencodePermissionPolicy(permissionMode: CodeInsightsPermissionMode): OpencodePermissionPolicy {
  const readPolicy = {
    '*': 'allow',
    '*.env': 'deny',
    '*.env.*': 'deny',
    '*.env.example': 'allow',
  } as const

  if (permissionMode === 'plan') {
    return {
      '*': 'ask',
      read: readPolicy,
      glob: 'allow',
      grep: 'allow',
      edit: 'deny',
      bash: {
        '*': 'ask',
        'git status*': 'allow',
        'git diff*': 'allow',
        'git log*': 'allow',
        'git commit*': 'deny',
        'git push*': 'deny',
        'git reset*': 'deny',
      },
      webfetch: 'ask',
      websearch: 'ask',
      external_directory: 'ask',
      doom_loop: 'deny',
    }
  }

  if (permissionMode === 'bypassPermissions') {
    return {
      '*': 'allow',
      read: readPolicy,
      glob: 'allow',
      grep: 'allow',
      edit: 'allow',
      bash: {
        '*': 'allow',
        'git commit*': 'deny',
        'git push*': 'deny',
        'git reset*': 'deny',
        'rm -rf*': 'deny',
      },
      task: 'allow',
      skill: 'allow',
      lsp: 'allow',
      question: 'allow',
      webfetch: 'allow',
      websearch: 'allow',
      external_directory: 'ask',
      doom_loop: 'deny',
    }
  }

  return {
    '*': 'ask',
    read: readPolicy,
    glob: 'allow',
    grep: 'allow',
    edit: 'ask',
    bash: {
      '*': 'ask',
      'git status*': 'allow',
      'git diff*': 'allow',
      'git log*': 'allow',
      'git commit*': 'deny',
      'git push*': 'deny',
      'git reset*': 'deny',
      'rm -rf*': 'deny',
    },
    task: 'ask',
    skill: 'ask',
    lsp: 'ask',
    question: 'ask',
    webfetch: 'ask',
    websearch: 'ask',
    external_directory: 'ask',
    doom_loop: 'deny',
  }
}

export async function writeOpencodeRuntimeConfig(
  input: WriteOpencodeRuntimeConfigInput,
): Promise<WriteOpencodeRuntimeConfigResult> {
  const rootDir = resolve(input.rootDir)
  const runtimeDir = join(rootDir, 'runtime')
  const opencodeDir = join(runtimeDir, 'opencode')
  const configDir = join(opencodeDir, 'config-dir')
  const configPath = join(opencodeDir, 'opencode.jsonc')

  await ensureSafeDirectory(rootDir, runtimeDir)
  await ensureSafeDirectory(rootDir, opencodeDir)
  await ensureSafeDirectory(rootDir, configDir)
  for (const name of ['agents', 'commands', 'plugins', 'skills', 'tools']) {
    await ensureSafeDirectory(rootDir, join(configDir, name))
  }

  await assertSafeWriteTarget(rootDir, configPath)
  await writeFileAtomic0600(configPath, input.built.configContent)

  return {
    ...input.built,
    configPath,
    configDir,
  }
}

export function applyOpencodeRuntimeConfigEnv(input: ApplyOpencodeRuntimeConfigEnvInput): Record<string, string> {
  const env = { ...input.env }
  env.OPENCODE_CONFIG = input.configPath
  env.OPENCODE_CONFIG_CONTENT = input.inlinePolicyContent
  if (input.includeConfigDir) {
    env.OPENCODE_CONFIG_DIR = input.configDir
  }
  return env
}

function buildProviderConfig(input: BuildOpencodeConfigInput): OpencodeProviderConfig | null {
  if (input.auth.source !== 'channel') return null
  return {
    npm: '@ai-sdk/openai-compatible',
    name: 'CodeInsights Channel',
    options: {
      ...(input.auth.baseUrl ? { baseURL: input.auth.baseUrl } : {}),
      apiKey: `{env:${input.auth.apiKeyEnvName}}`,
    },
    models: {
      [input.modelId]: { name: input.modelId },
    },
  }
}

async function ensureSafeDirectory(rootDir: string, targetDir: string): Promise<void> {
  assertPathInsideRoot(rootDir, targetDir)
  await assertNoSymlinkParents(rootDir, targetDir)
  await mkdir(targetDir, { recursive: true, mode: 0o700 })
  await chmod(targetDir, 0o700)
}

async function assertSafeWriteTarget(rootDir: string, targetPath: string): Promise<void> {
  assertPathInsideRoot(rootDir, targetPath)
  await assertNoSymlinkParents(rootDir, dirname(targetPath))
  if (existsSync(targetPath)) {
    const stat = await lstat(targetPath)
    if (stat.isSymbolicLink()) {
      throw new Error(`拒绝写入符号链接目标: ${targetPath}`)
    }
  }
}

async function assertNoSymlinkParents(rootDir: string, targetPath: string): Promise<void> {
  const rootReal = existsSync(rootDir) ? await realpath(rootDir) : resolve(rootDir)
  const resolvedTarget = resolve(targetPath)
  const relativePath = relative(rootDir, resolvedTarget)
  const segments = relativePath.split(/[\\/]+/).filter(Boolean)
  let current = rootDir
  for (const segment of segments) {
    current = join(current, segment)
    if (!existsSync(current)) continue
    const stat = await lstat(current)
    if (stat.isSymbolicLink()) {
      throw new Error(`拒绝穿过符号链接路径: ${current}`)
    }
    const currentReal = await realpath(current)
    if (!isPathInside(rootReal, currentReal)) {
      throw new Error(`拒绝访问工作区外路径: ${current}`)
    }
  }
}

function assertPathInsideRoot(rootDir: string, targetPath: string): void {
  if (!isPathInside(resolve(rootDir), resolve(targetPath))) {
    throw new Error(`拒绝写入工作区外路径: ${targetPath}`)
  }
}

function isPathInside(rootDir: string, targetPath: string): boolean {
  const rel = relative(rootDir, targetPath)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

async function writeFileAtomic0600(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tmpPath, content, { mode: 0o600, encoding: 'utf-8' })
  await chmod(tmpPath, 0o600)
  await rename(tmpPath, filePath)
  await chmod(filePath, 0o600)
}

function hashRuntimeConfig(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`
}

function stableStringify(value: unknown, space?: number): string {
  const normalized = normalizeForStableStringify(value)
  return JSON.stringify(normalized, null, space)
}

function normalizeForStableStringify(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => normalizeForStableStringify(item))
  const record = value as Record<string, unknown>
  const next: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) {
    const item = record[key]
    if (item !== undefined) {
      next[key] = normalizeForStableStringify(item)
    }
  }
  return next
}

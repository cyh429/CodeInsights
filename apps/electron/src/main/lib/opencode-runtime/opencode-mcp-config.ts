import { createHash } from 'node:crypto'
import type { McpServerEntry, WorkspaceMcpConfig } from '@codeinsights/shared'
import { isUnsafeGitEnvironmentKey } from '../codex-runtime/codex-env'

export type OpencodeMcpSkipReason =
  | 'missing_command'
  | 'missing_url'
  | 'name_conflict'
  | 'invalid_env_name'
  | 'reserved_env_name'
  | 'env_name_conflict'
  | 'unsafe_args'
  | 'unsafe_url'
  | 'unsupported_transport'

export interface OpencodeMcpConfigSkip {
  name: string
  reason: OpencodeMcpSkipReason
}

export interface OpencodeLocalMcpServerConfig {
  type: 'local'
  command: string[]
  enabled: boolean
  timeout?: number
  environment?: Record<string, string>
}

export interface OpencodeRemoteMcpServerConfig {
  type: 'remote'
  url: string
  enabled: boolean
  headers?: Record<string, string>
  oauth?: boolean
  timeout?: number
}

export type OpencodeMcpServerConfig =
  | OpencodeLocalMcpServerConfig
  | OpencodeRemoteMcpServerConfig

export interface OpencodeMcpConfig {
  mcp: Record<string, OpencodeMcpServerConfig>
}

export interface OpencodeMcpConfigBuildResult {
  config: OpencodeMcpConfig
  env: Record<string, string>
  serverCount: number
  skipped: OpencodeMcpConfigSkip[]
}

export type OpencodeMcpRuntimeStatus =
  | 'connected'
  | 'disabled'
  | 'failed'
  | 'needs_auth'
  | 'needs_client_registration'
  | 'unknown'

export interface OpencodeMcpStatusSummary {
  configuredCount: number
  statusCount?: number
  connectedCount?: number
  skippedCount: number
  serverNames: string[]
  statuses?: Record<string, OpencodeMcpRuntimeStatus>
  skipped?: OpencodeMcpConfigSkip[]
}

const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

export function buildOpencodeMcpConfigFromWorkspace(
  workspaceConfig: WorkspaceMcpConfig,
): OpencodeMcpConfigBuildResult {
  const mcp: Record<string, OpencodeMcpServerConfig> = {}
  const env: Record<string, string> = {}
  const skipped: OpencodeMcpConfigSkip[] = []
  const usedNames = new Set<string>()

  for (const [displayName, entry] of Object.entries(workspaceConfig.servers ?? {})) {
    if (!entry.enabled) continue
    const configName = sanitizeOpencodeMcpName(displayName)
    if (usedNames.has(configName)) {
      skipped.push({ name: displayName, reason: 'name_conflict' })
      continue
    }

    const built = buildOpencodeMcpServerConfig(configName, entry)
    if ('reason' in built) {
      skipped.push({ name: displayName, reason: built.reason })
      continue
    }
    if (hasEnvNameConflict(env, built.env)) {
      skipped.push({ name: displayName, reason: 'env_name_conflict' })
      continue
    }

    usedNames.add(configName)
    mcp[configName] = built.config
    Object.assign(env, built.env)
  }

  return {
    config: { mcp },
    env,
    serverCount: Object.keys(mcp).length,
    skipped,
  }
}

export function sanitizeOpencodeMcpName(name: string): string {
  const sanitized = name
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return sanitized || 'mcp_server'
}

export function createOpencodeMcpStatusSummary(
  config: OpencodeMcpConfig,
  skipped: OpencodeMcpConfigSkip[] = [],
  runtimeStatus?: unknown,
): OpencodeMcpStatusSummary {
  const configuredNames = Object.keys(config.mcp).sort()
  const statuses = summarizeOpencodeMcpStatusResponse(runtimeStatus)
  const statusNames = Object.keys(statuses).sort()
  const serverNames = [...new Set([...configuredNames, ...statusNames])].sort()
  const connectedCount = Object.values(statuses).filter((status) => status === 'connected').length

  return {
    configuredCount: configuredNames.length,
    ...(statusNames.length > 0 ? { statusCount: statusNames.length } : {}),
    ...(statusNames.length > 0 ? { connectedCount } : {}),
    skippedCount: skipped.length,
    serverNames,
    ...(statusNames.length > 0 ? { statuses } : {}),
    ...(skipped.length > 0 ? { skipped } : {}),
  }
}

export function summarizeOpencodeMcpStatusResponse(value: unknown): Record<string, OpencodeMcpRuntimeStatus> {
  const record = toRecord(value)
  const statuses: Record<string, OpencodeMcpRuntimeStatus> = {}
  for (const [name, item] of Object.entries(record)) {
    statuses[name] = normalizeMcpRuntimeStatus(toRecord(item).status)
  }
  return statuses
}

function buildOpencodeMcpServerConfig(
  configName: string,
  entry: McpServerEntry,
): { config: OpencodeMcpServerConfig; env: Record<string, string> } | { reason: OpencodeMcpSkipReason } {
  if (entry.type === 'stdio') {
    const command = entry.command?.trim()
    if (!command) return { reason: 'missing_command' }
    const envValidation = validateLocalMcpEnv(entry.env)
    if (envValidation) return { reason: envValidation }
    if (hasSecretLikeMcpArgs(entry.args)) return { reason: 'unsafe_args' }

    const env: Record<string, string> = {}
    const environment: Record<string, string> = {}
    for (const [key, value] of Object.entries(entry.env ?? {})) {
      const scopedName = buildMcpEnvName(configName, 'ENV', key)
      env[scopedName] = value
      environment[key] = `{env:${scopedName}}`
    }

    return {
      env,
      config: {
        type: 'local',
        command: [command, ...(entry.args ?? [])],
        enabled: true,
        ...(entry.timeout && entry.timeout > 0 ? { timeout: entry.timeout * 1000 } : {}),
        ...(Object.keys(environment).length > 0 ? { environment } : {}),
      },
    }
  }

  if (entry.type === 'http' || entry.type === 'sse') {
    const url = entry.url?.trim()
    if (!url) return { reason: 'missing_url' }
    if (hasSecretLikeMcpUrl(url)) return { reason: 'unsafe_url' }
    const env: Record<string, string> = {}
    const headers: Record<string, string> = {}
    for (const [headerName, headerValue] of Object.entries(entry.headers ?? {})) {
      const scopedName = buildMcpEnvName(configName, 'HEADER', headerName)
      const bearerToken = headerValue.match(/^Bearer\s+(.+)$/i)?.[1]
      env[scopedName] = bearerToken ?? headerValue
      headers[headerName] = bearerToken ? `Bearer {env:${scopedName}}` : `{env:${scopedName}}`
    }

    return {
      env,
      config: {
        type: 'remote',
        url,
        enabled: true,
        ...(entry.timeout && entry.timeout > 0 ? { timeout: entry.timeout * 1000 } : {}),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      },
    }
  }

  return { reason: 'unsupported_transport' }
}

function hasSecretLikeMcpArgs(args: string[] | undefined): boolean {
  const secretFlagPattern = /^--?(?:api[-_]?key|token|access[-_]?token|secret|password|passwd|auth|authorization|credential|credentials)(?:=|$)/i
  let previousWasSecretFlag = false
  for (const arg of args ?? []) {
    const trimmed = arg.trim()
    if (!trimmed) {
      previousWasSecretFlag = false
      continue
    }
    if (previousWasSecretFlag) return true
    if (secretFlagPattern.test(trimmed)) return true
    if (/\bbearer\s+\S+/i.test(trimmed)) return true
    if (/\bsk-[A-Za-z0-9_-]{8,}\b/.test(trimmed)) return true
    previousWasSecretFlag = /^--?(?:api[-_]?key|token|access[-_]?token|secret|password|passwd|auth|authorization|credential|credentials)$/i.test(trimmed)
  }
  return false
}

function hasSecretLikeMcpUrl(value: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  if (parsed.username || parsed.password) return true
  for (const [key, queryValue] of parsed.searchParams) {
    if (isSecretLikeUrlQueryKey(key)) return true
    if (/\bbearer\s+\S+/i.test(queryValue)) return true
    if (/\bsk-[A-Za-z0-9_-]{8,}\b/.test(queryValue)) return true
  }
  return false
}

function isSecretLikeUrlQueryKey(key: string): boolean {
  const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, '')
  return normalized === 'apikey'
    || normalized === 'key'
    || normalized === 'token'
    || normalized === 'accesstoken'
    || normalized === 'refreshtoken'
    || normalized === 'secret'
    || normalized === 'clientsecret'
    || normalized === 'password'
    || normalized === 'passwd'
    || normalized === 'authorization'
    || normalized === 'credential'
    || normalized === 'credentials'
    || normalized === 'signature'
    || normalized === 'sig'
}

function validateLocalMcpEnv(entryEnv: Record<string, string> | undefined): OpencodeMcpSkipReason | undefined {
  for (const key of Object.keys(entryEnv ?? {})) {
    if (!ENV_NAME_RE.test(key)) return 'invalid_env_name'
    if (isReservedOpencodeMcpEnvName(key)) return 'reserved_env_name'
  }
  return undefined
}

function isReservedOpencodeMcpEnvName(key: string): boolean {
  const normalized = key.toUpperCase()
  return normalized === 'PATH'
    || normalized === 'HOME'
    || normalized === 'USERPROFILE'
    || normalized === 'SHELL'
    || normalized === 'HTTP_PROXY'
    || normalized === 'HTTPS_PROXY'
    || normalized === 'ALL_PROXY'
    || normalized === 'NO_PROXY'
    || normalized === 'OPENCODE_CONFIG'
    || normalized === 'OPENCODE_CONFIG_DIR'
    || normalized === 'OPENCODE_CONFIG_CONTENT'
    || normalized === 'OPENCODE_SERVER_USERNAME'
    || normalized === 'OPENCODE_SERVER_PASSWORD'
    || normalized === 'CODEINSIGHTS_GIT_DISABLED'
    || normalized === 'CODEINSIGHTS_REAL_GIT'
    || normalized.startsWith('OPENCODE_')
    || normalized.startsWith('CODEINSIGHTS_')
    || normalized.startsWith('GIT_')
    || isUnsafeGitEnvironmentKey(normalized)
}

function buildMcpEnvName(configName: string, scope: 'ENV' | 'HEADER', rawKey: string): string {
  const digest = createHash('sha256')
    .update(`${configName}\0${scope}\0${rawKey}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase()
  return [
    'CODEINSIGHTS_OPENCODE_MCP',
    sanitizeEnvNamePart(configName).slice(0, 32),
    scope,
    sanitizeEnvNamePart(rawKey).slice(0, 32),
    digest,
  ].join('_')
}

function sanitizeEnvNamePart(value: string): string {
  const sanitized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return sanitized || 'VALUE'
}

function hasEnvNameConflict(
  currentEnv: Record<string, string>,
  nextEnv: Record<string, string>,
): boolean {
  return Object.entries(nextEnv).some(([key, value]) => currentEnv[key] !== undefined && currentEnv[key] !== value)
}

function normalizeMcpRuntimeStatus(value: unknown): OpencodeMcpRuntimeStatus {
  if (
    value === 'connected'
    || value === 'disabled'
    || value === 'failed'
    || value === 'needs_auth'
    || value === 'needs_client_registration'
  ) {
    return value
  }
  return 'unknown'
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

import { createHash } from 'node:crypto'
import type { McpServerEntry, WorkspaceMcpConfig } from '@codeinsights/shared'
import type { CodexOptions } from '@openai/codex-sdk'
import { isUnsafeGitEnvironmentKey } from './codex-env'

type CodexConfigObject = NonNullable<CodexOptions['config']>

export interface CodexMcpConfigSkip {
  name: string
  reason:
    | 'env_name_conflict'
    | 'invalid_header_name'
    | 'invalid_env_name'
    | 'invalid_name'
    | 'missing_command'
    | 'missing_url'
    | 'reserved_env_name'
    | 'unsupported_transport'
}

export interface CodexMcpConfigBuildResult {
  config?: CodexConfigObject
  env: Record<string, string>
  serverCount: number
  skipped: CodexMcpConfigSkip[]
}

interface CodexMcpConfigBuildOptions {
  pathEnv?: string
}

const CODEX_MCP_SERVER_NAME_RE = /^[A-Za-z0-9_-]+$/
const CODEX_MCP_CONFIG_BARE_KEY_RE = /^[A-Za-z0-9_-]+$/
const CODEX_ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const CODEX_RESERVED_MCP_ENV_NAMES = new Set([
  'ALL_PROXY',
  'CODEX_API_KEY',
  'CODEX_HOME',
  'CODEX_INTERNAL_ORIGINATOR_OVERRIDE',
  'CODEINSIGHTS_GIT_DISABLED',
  'CODEINSIGHTS_REAL_GIT',
  'COMSPEC',
  'GCM_INTERACTIVE',
  'GIT_ASKPASS',
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_NOSYSTEM',
  'HOME',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'NODE_EXTRA_CA_CERTS',
  'NO_PROXY',
  'OPENAI_API_KEY',
  'PATH',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'SSH_AUTH_SOCK',
  'SSH_ASKPASS',
  'SYSTEMROOT',
  'TEMP',
  'TERM',
  'TMP',
  'TMPDIR',
  'USERPROFILE',
  'XDG_CONFIG_HOME',
])

export function buildCodexMcpConfigFromWorkspace(
  workspaceConfig: WorkspaceMcpConfig,
  options: CodexMcpConfigBuildOptions = {},
): CodexMcpConfigBuildResult {
  const mcpServers: Record<string, CodexConfigObject> = {}
  const env: Record<string, string> = {}
  const skipped: CodexMcpConfigSkip[] = []

  for (const [name, entry] of Object.entries(workspaceConfig.servers ?? {})) {
    if (!entry.enabled) continue
    if (!CODEX_MCP_SERVER_NAME_RE.test(name)) {
      skipped.push({ name, reason: 'invalid_name' })
      continue
    }

    const serverConfig = buildCodexMcpServerConfig(name, entry, options)
    if (serverConfig.reason) {
      skipped.push({ name, reason: serverConfig.reason })
      continue
    }
    if (hasEnvNameConflict(env, serverConfig.env)) {
      skipped.push({ name, reason: 'env_name_conflict' })
      continue
    }

    mcpServers[name] = serverConfig.config
    Object.assign(env, serverConfig.env)
  }

  const serverCount = Object.keys(mcpServers).length
  return {
    env,
    serverCount,
    skipped,
    ...(serverCount > 0 ? { config: { mcp_servers: mcpServers } } : {}),
  }
}

function buildCodexMcpServerConfig(
  name: string,
  entry: McpServerEntry,
  options: CodexMcpConfigBuildOptions,
): { config: CodexConfigObject; env: Record<string, string>; reason?: never } | { reason: CodexMcpConfigSkip['reason'] } {
  if (entry.type === 'stdio') {
    const command = entry.command?.trim()
    if (!command) return { reason: 'missing_command' }
    const envValidationError = validateStdioMcpEnv(entry.env)
    if (envValidationError) return { reason: envValidationError }

    const env = { ...(entry.env ?? {}) }
    const envVars = buildStdioMcpEnvVars(options.pathEnv, env)
    const config: CodexConfigObject = {
      command,
      enabled: true,
      required: false,
      ...(entry.args?.length ? { args: entry.args } : {}),
      ...(envVars.length > 0 ? { env_vars: envVars } : {}),
      startup_timeout_sec: entry.timeout && entry.timeout > 0 ? entry.timeout : 30,
    }
    return { config, env }
  }

  if (entry.type === 'http') {
    const url = entry.url?.trim()
    if (!url) return { reason: 'missing_url' }
    const invalidHeaderName = Object.keys(entry.headers ?? {})
      .find((headerName) => !CODEX_MCP_CONFIG_BARE_KEY_RE.test(headerName))
    if (invalidHeaderName) return { reason: 'invalid_header_name' }

    const { env, envHttpHeaders } = buildHttpMcpHeaderEnv(name, entry.headers)
    const config: CodexConfigObject = {
      url,
      enabled: true,
      required: false,
      ...(Object.keys(envHttpHeaders).length > 0 ? { env_http_headers: envHttpHeaders } : {}),
    }
    return { config, env }
  }

  return { reason: 'unsupported_transport' }
}

function buildStdioMcpEnvVars(
  pathEnv: string | undefined,
  entryEnv: Record<string, string> | undefined,
): string[] {
  return [
    ...(pathEnv ? ['PATH'] : []),
    ...Object.keys(entryEnv ?? {}),
  ]
}

function validateStdioMcpEnv(entryEnv: Record<string, string> | undefined): CodexMcpConfigSkip['reason'] | undefined {
  for (const key of Object.keys(entryEnv ?? {})) {
    if (!CODEX_ENV_NAME_RE.test(key)) return 'invalid_env_name'
    if (isReservedCodexMcpEnvName(key)) return 'reserved_env_name'
  }
  return undefined
}

export function isReservedCodexMcpEnvName(key: string): boolean {
  const normalized = key.toUpperCase()
  return CODEX_RESERVED_MCP_ENV_NAMES.has(normalized)
    || isUnsafeGitEnvironmentKey(normalized)
    || normalized.startsWith('GIT_')
}

function buildHttpMcpHeaderEnv(
  serverName: string,
  headers: Record<string, string> | undefined,
): { env: Record<string, string>; envHttpHeaders: Record<string, string> } {
  const env: Record<string, string> = {}
  const envHttpHeaders: Record<string, string> = {}
  for (const [headerName, headerValue] of Object.entries(headers ?? {})) {
    const envName = buildHeaderEnvName(serverName, headerName)
    env[envName] = headerValue
    envHttpHeaders[headerName] = envName
  }
  return { env, envHttpHeaders }
}

function buildHeaderEnvName(serverName: string, headerName: string): string {
  const digest = createHash('sha256')
    .update(`${serverName}\0${headerName}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase()
  return [
    'CODEINSIGHTS_MCP',
    sanitizeEnvNamePart(serverName).slice(0, 32),
    'HEADER',
    sanitizeEnvNamePart(headerName).slice(0, 32),
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

import { isUnsafeGitEnvironmentKey } from '../codex-runtime/codex-env'

const OPENCODE_BASE_ENV_ALLOWLIST = new Set([
  'PATH',
  'Path',
  'HOME',
  'USERPROFILE',
  'SystemRoot',
  'ComSpec',
  'TMPDIR',
  'TMP',
  'TEMP',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'SHELL',
  'TERM',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'NODE_EXTRA_CA_CERTS',
  'NO_PROXY',
  'no_proxy',
])

const OPENCODE_RESERVED_EXTERNAL_ENV_NAMES = new Set([
  'ALL_PROXY',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'NPM_TOKEN',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GITHUB_PAT',
  'SSH_AUTH_SOCK',
  'PATH',
  'HOME',
  'USERPROFILE',
  'SHELL',
  'OPENCODE_CONFIG',
  'OPENCODE_CONFIG_DIR',
  'OPENCODE_CONFIG_CONTENT',
  'OPENCODE_SERVER_USERNAME',
  'OPENCODE_SERVER_PASSWORD',
  'CODEINSIGHTS_GIT_DISABLED',
  'CODEINSIGHTS_REAL_GIT',
])

const OPENCODE_SCOPED_SECRET_ENV_RE = /^CODEINSIGHTS_OPENCODE_(CHANNEL|MCP|SMOKE)_[A-Z0-9_]+$/

export function buildOpencodeBaseEnv(sourceEnv: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (value === undefined) continue
    if (!OPENCODE_BASE_ENV_ALLOWLIST.has(key)) continue
    env[key] = value
  }
  return env
}

export function mergeOpencodeScopedSecretEnv(
  baseEnv: Record<string, string>,
  scopedSecretEnv: Record<string, string>,
): Record<string, string> {
  const merged = { ...baseEnv }
  for (const [key, value] of Object.entries(scopedSecretEnv)) {
    if (isReservedOpencodeExternalEnvName(key) && !isScopedOpencodeSecretEnvName(key)) {
      throw new Error(`禁止注入 opencode 外部环境变量: ${key}`)
    }
    if (!isScopedOpencodeSecretEnvName(key)) {
      throw new Error(`禁止注入 opencode 外部环境变量: ${key}`)
    }
    if (merged[key] !== undefined && merged[key] !== value) {
      throw new Error(`opencode 外部环境变量存在冲突: ${key}`)
    }
    merged[key] = value
  }
  return merged
}

export function isReservedOpencodeExternalEnvName(key: string): boolean {
  const normalized = key.toUpperCase()
  return OPENCODE_RESERVED_EXTERNAL_ENV_NAMES.has(normalized)
    || normalized.startsWith('OPENCODE_')
    || normalized.startsWith('CODEINSIGHTS_')
    || normalized.endsWith('_PROXY')
    || normalized.includes('TOKEN')
    || normalized.includes('SECRET')
    || normalized.includes('PASSWORD')
    || normalized.includes('API_KEY')
    || normalized.startsWith('GIT_')
    || isUnsafeGitEnvironmentKey(normalized)
}

export function isScopedOpencodeSecretEnvName(key: string): boolean {
  return OPENCODE_SCOPED_SECRET_ENV_RE.test(key)
}

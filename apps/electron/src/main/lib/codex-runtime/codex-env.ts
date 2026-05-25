import { getEffectiveProxyUrl } from '../proxy-settings-service'

const CODEX_BASE_ENV_ALLOWLIST = new Set([
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
  'CODEX_API_KEY',
  'CODEX_HOME',
])

export function isUnsafeGitEnvironmentKey(key: string): boolean {
  return key === 'GIT_DIR'
    || key === 'GIT_WORK_TREE'
    || key === 'GIT_INDEX_FILE'
    || key === 'GIT_ASKPASS'
    || key === 'SSH_ASKPASS'
    || key === 'GIT_SSH'
    || key === 'GIT_SSH_COMMAND'
    || key === 'GIT_CONFIG'
    || key === 'GIT_CONFIG_GLOBAL'
    || key === 'GIT_CONFIG_SYSTEM'
    || key === 'GIT_CONFIG_NOSYSTEM'
    || key === 'GIT_CONFIG_COUNT'
    || key.startsWith('GIT_CONFIG_KEY_')
    || key.startsWith('GIT_CONFIG_VALUE_')
}

export function buildInternalGitEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const nextEnv: NodeJS.ProcessEnv = { ...env }
  for (const key of Object.keys(nextEnv)) {
    if (isUnsafeGitEnvironmentKey(key)) {
      delete nextEnv[key]
    }
  }
  return nextEnv
}

export async function buildCodexEnv(
  sourceEnv: NodeJS.ProcessEnv = process.env,
): Promise<Record<string, string>> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (key === 'CODEX_THREAD_ID') continue
    if (value !== undefined && CODEX_BASE_ENV_ALLOWLIST.has(key)) {
      env[key] = value
    }
  }

  const proxyUrl = await getEffectiveProxyUrl()
  if (proxyUrl) {
    env.HTTPS_PROXY = proxyUrl
    env.HTTP_PROXY = proxyUrl
  }

  return env
}

export function sanitizeCodexGitEnvironment(env: Record<string, string>): Record<string, string> {
  const sanitized = { ...env }
  for (const key of [
    'GH_TOKEN',
    'GITHUB_TOKEN',
    'GITHUB_PAT',
    'HUB_CONFIG',
    'SSH_AUTH_SOCK',
    'GIT_SSH',
    'GIT_SSH_COMMAND',
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_ASKPASS',
    'SSH_ASKPASS',
    'CODEINSIGHTS_REAL_GIT',
  ]) {
    delete sanitized[key]
  }
  for (const key of Object.keys(sanitized)) {
    if (isUnsafeGitEnvironmentKey(key)) {
      delete sanitized[key]
    }
  }
  return sanitized
}

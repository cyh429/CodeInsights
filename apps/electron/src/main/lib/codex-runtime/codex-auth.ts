import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { CodexRuntimeOptions } from './codex-channel'

export interface CodexAuthState {
  kind: 'api_key' | 'native'
  codexHome?: string
}

export function resolveNativeCodexHome(env: Record<string, string>): string {
  const explicitCodexHome = env.CODEX_HOME?.trim()
  if (explicitCodexHome) return resolve(explicitCodexHome)

  const homeDir = env.HOME || env.USERPROFILE || homedir()
  return join(homeDir, '.codex')
}

export function getNativeCodexAuthPath(env: Record<string, string>): string {
  return join(resolveNativeCodexHome(env), 'auth.json')
}

export function resolveCodexAuth(
  runtime: CodexRuntimeOptions,
  env: Record<string, string>,
): CodexAuthState {
  if (runtime.apiKey) {
    return { kind: 'api_key' }
  }

  const codexHome = resolveNativeCodexHome(env)
  const authPath = getNativeCodexAuthPath(env)
  if (existsSync(authPath)) {
    return {
      kind: 'native',
      codexHome,
    }
  }

  if (env.CODEX_API_KEY) {
    return { kind: 'api_key' }
  }

  throw new Error('Codex 节点未配置 Pipeline Codex 渠道，且未检测到 CODEX_API_KEY、CODEX_HOME/auth.json 或本机 ~/.codex/auth.json，请配置 OpenAI/Custom Codex 渠道或先完成本机 Codex 登录')
}

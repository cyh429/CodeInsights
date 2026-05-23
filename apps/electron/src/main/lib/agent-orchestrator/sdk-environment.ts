import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { ProviderType } from '@codeinsights/shared'
import { normalizeAnthropicBaseUrlForSdk } from '@codeinsights/core'
import { getSdkConfigDir } from '../config-paths'
import { getEffectiveProxyUrl } from '../proxy-settings-service'
import { getRuntimeStatus } from '../runtime-init'

const DEFAULT_ANTHROPIC_URL = 'https://api.anthropic.com'

export type SdkEnvironment = Record<string, string | undefined>

export interface BuildSdkEnvInput {
  apiKey: string
  baseUrl?: string
  provider: ProviderType
}

interface RuntimeShellStatus {
  gitBash?: {
    available: boolean
    path?: string
    error?: string
  }
  wsl?: {
    available: boolean
    version?: string
    defaultDistro?: string
    error?: string
  }
}

interface RuntimeStatusForSdkEnv {
  shell?: RuntimeShellStatus
}

export interface SdkEnvironmentBuilderDeps {
  env?: Record<string, string | undefined>
  platform?: NodeJS.Platform
  getEffectiveProxyUrl?: () => Promise<string | undefined>
  getRuntimeStatus?: () => RuntimeStatusForSdkEnv | null
  getSdkConfigDir?: () => string
  normalizeAnthropicBaseUrlForSdk?: (baseUrl: string) => string
}

export interface ResolveSDKCliPathDeps {
  platform?: NodeJS.Platform
  arch?: string
  moduleFilename?: string
  moduleDir?: string
  isPackaged?: boolean
  resolveWithCreateRequire?: (specifier: string, moduleFilename: string) => string
  resolveWithRequire?: (specifier: string) => string
}

/**
 * 构建 SDK 环境变量
 *
 * 注入 API Key、Base URL、代理、Shell 配置等。
 * 对 Kimi Coding Plan：使用 Bearer 认证（ANTHROPIC_AUTH_TOKEN），注入 User-Agent。
 */
export async function buildSdkEnv(
  input: BuildSdkEnvInput,
  deps: SdkEnvironmentBuilderDeps = {},
): Promise<SdkEnvironment> {
  const env = deps.env ?? process.env
  const platform = deps.platform ?? process.platform
  const readProxyUrl = deps.getEffectiveProxyUrl ?? getEffectiveProxyUrl
  const readRuntimeStatus = deps.getRuntimeStatus ?? getRuntimeStatus
  const readSdkConfigDir = deps.getSdkConfigDir ?? getSdkConfigDir
  const normalizeBaseUrl = deps.normalizeAnthropicBaseUrlForSdk ?? normalizeAnthropicBaseUrlForSdk

  // 从 process.env 继承系统变量，但清理所有 ANTHROPIC_ 前缀的变量，
  // 防止本地开发环境（如 ANTHROPIC_AUTH_TOKEN、ANTHROPIC_API_KEY、
  // ANTHROPIC_BASE_URL 等）干扰 SDK 的认证和请求目标。
  // 即使 index.ts 启动时已清理过一次，initializeRuntime() 中的
  // loadShellEnv() 可能从 shell 配置文件（~/.zshrc 等）重新注入这些变量。
  const cleanEnv: SdkEnvironment = {}
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('ANTHROPIC_')) {
      cleanEnv[key] = value
    }
  }

  const sdkEnv: SdkEnvironment = {
    ...cleanEnv,
    // 提升输出 token 上限，避免 "exceeded 32000 output token maximum" 错误
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: '64000',
    // 启用 Tasks 功能
    CLAUDE_CODE_ENABLE_TASKS: 'true',
    // 禁用实验性 beta 功能，使用稳定模式
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
    // 配置隔离：让 SDK 使用独立的配置目录，不读取用户的 ~/.claude.json
    CLAUDE_CONFIG_DIR: readSdkConfigDir(),
  }

  // 认证方式按 provider 分支
  // - Kimi Coding Plan：只认 Bearer，且必须伪装成 coding agent（User-Agent）
  //   用 ANTHROPIC_AUTH_TOKEN 让 SDK 发 Authorization: Bearer，
  //   通过 ANTHROPIC_CUSTOM_HEADERS 注入 User-Agent
  // - 其它：ANTHROPIC_API_KEY（SDK 内部会同时带上 x-api-key 和 Bearer）
  if (input.provider === 'kimi-coding') {
    sdkEnv.ANTHROPIC_AUTH_TOKEN = input.apiKey
    sdkEnv.ANTHROPIC_CUSTOM_HEADERS = 'User-Agent: KimiCLI/1.3'
  } else {
    sdkEnv.ANTHROPIC_API_KEY = input.apiKey
  }

  // 显式控制 ANTHROPIC_BASE_URL：仅在用户配置了自定义 Base URL 时注入
  // 使用统一的 normalizeAnthropicBaseUrlForSdk 规范化，SDK 内部会自动拼接 /v1/messages
  if (input.baseUrl && input.baseUrl !== DEFAULT_ANTHROPIC_URL) {
    sdkEnv.ANTHROPIC_BASE_URL = normalizeBaseUrl(input.baseUrl)
  }

  const proxyUrl = await readProxyUrl()
  if (proxyUrl) {
    sdkEnv.HTTPS_PROXY = proxyUrl
    sdkEnv.HTTP_PROXY = proxyUrl
  }

  // Windows 平台：配置 Shell 环境
  if (platform === 'win32') {
    const runtimeStatus = readRuntimeStatus()
    const shellStatus = runtimeStatus?.shell

    if (shellStatus) {
      if (shellStatus.gitBash?.available && shellStatus.gitBash.path) {
        sdkEnv.CLAUDE_CODE_SHELL = shellStatus.gitBash.path
        console.log(`[Agent 编排] 配置 Shell 环境: Git Bash (${shellStatus.gitBash.path})`)
      } else if (shellStatus.wsl?.available) {
        sdkEnv.CLAUDE_CODE_SHELL = 'wsl'
        console.log(`[Agent 编排] 配置 Shell 环境: WSL ${shellStatus.wsl.version} (${shellStatus.wsl.defaultDistro})`)
      } else {
        console.warn('[Agent 编排] Windows 平台未检测到可用的 Shell 环境（Git Bash / WSL）')
      }
      sdkEnv.CLAUDE_BASH_NO_LOGIN = '1'
    }
  }

  // 针对 claude-agent-sdk 0.2.111+ 的 options.env 叠加语义加固：
  // SDK 将 options.env 叠加到 process.env 之上传递给子进程。
  // 若 shell 中存在 ANTHROPIC_CUSTOM_HEADERS、ANTHROPIC_MODEL 等变量，
  // 且 sdkEnv 未显式管理，叠加后会回流到 SDK 子进程。
  // 对于 sdkEnv 未显式管理的 ANTHROPIC_* 变量，显式置空字符串以覆盖回流。
  for (const key of Object.keys(env)) {
    if (key.startsWith('ANTHROPIC_') && !(key in sdkEnv)) {
      sdkEnv[key] = ''
    }
  }

  return sdkEnv
}

/**
 * 解析 SDK native CLI binary 路径
 *
 * 0.2.113+ 起 SDK 改为按平台分发 native binary，通过 optionalDependencies 安装到
 * `@anthropic-ai/claude-agent-sdk-{platform}-{arch}` 子包，与主包 `@anthropic-ai/claude-agent-sdk`
 * 同级。binary 名 macOS/Linux 为 `claude`，Windows 为 `claude.exe`。
 *
 * SDK 作为 esbuild external 依赖，require.resolve 可在运行时解析主包入口路径，
 * 再沿父目录 `@anthropic-ai/` 找到同级的平台子包。
 *
 * 多种策略降级：createRequire → 全局 require → cwd/node_modules 手动查找
 * 打包环境下：asar 内的路径需要转换为 asar.unpacked 路径（即便 CodeInsights 当前 `asar: false`
 * 兜底不伤人）。
 */
export function resolveSDKCliPath(deps: ResolveSDKCliPathDeps = {}): string {
  const platform = deps.platform ?? process.platform
  const arch = deps.arch ?? process.arch
  const subpkg = `claude-agent-sdk-${platform}-${arch}`
  const binaryName = platform === 'win32' ? 'claude.exe' : 'claude'
  const moduleFilename = deps.moduleFilename ?? __filename
  const moduleDir = deps.moduleDir ?? __dirname
  const isPackaged = deps.isPackaged ?? app.isPackaged
  let binaryPath: string | null = null

  // 策略 1：createRequire（标准 ESM/CJS 互操作）
  try {
    const sdkEntryPath = deps.resolveWithCreateRequire
      ? deps.resolveWithCreateRequire('@anthropic-ai/claude-agent-sdk', moduleFilename)
      : createRequire(moduleFilename).resolve('@anthropic-ai/claude-agent-sdk')
    // sdkEntryPath: .../@anthropic-ai/claude-agent-sdk/sdk.mjs
    // anthropicDir:  .../@anthropic-ai
    const anthropicDir = dirname(dirname(sdkEntryPath))
    binaryPath = join(anthropicDir, subpkg, binaryName)
    console.log(`[Agent 编排] SDK binary 路径 (createRequire): ${binaryPath}`)
  } catch (e) {
    console.warn('[Agent 编排] createRequire 解析 SDK 路径失败:', e)
  }

  // 策略 2：全局 require（esbuild CJS bundle 可能保留）
  if (!binaryPath) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sdkEntryPath = deps.resolveWithRequire
        ? deps.resolveWithRequire('@anthropic-ai/claude-agent-sdk')
        : require.resolve('@anthropic-ai/claude-agent-sdk')
      const anthropicDir = dirname(dirname(sdkEntryPath))
      binaryPath = join(anthropicDir, subpkg, binaryName)
      console.log(`[Agent 编排] SDK binary 路径 (require.resolve): ${binaryPath}`)
    } catch (e) {
      console.warn('[Agent 编排] require.resolve 解析 SDK 路径失败:', e)
    }
  }

  // 策略 3：从当前模块目录手动查找（打包后 __dirname 指向 app/dist/，上一级即 app/）
  // 注意：不使用 process.cwd()，因为打包后的 Electron 应用 cwd 通常是 '/'
  // 或用户主目录，与 app 安装目录无关。
  if (!binaryPath) {
    binaryPath = join(moduleDir, '..', 'node_modules', '@anthropic-ai', subpkg, binaryName)
    console.log(`[Agent 编排] SDK binary 路径 (手动): ${binaryPath}`)
  }

  // 打包环境：将 .asar/ 路径转换为 .asar.unpacked/
  if (isPackaged && binaryPath.includes('.asar')) {
    binaryPath = binaryPath.replace(/\.asar([/\\])/, '.asar.unpacked$1')
    console.log(`[Agent 编排] 转换为 asar.unpacked 路径: ${binaryPath}`)
  }

  return binaryPath
}

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import type {
  AgentRuntimeEvent,
  AgentStreamEnvelope,
  CodeInsightsPermissionMode,
  WorkspaceMcpConfig,
} from '@codeinsights/shared'
import { CodexAgentRuntime } from '../src/main/lib/agent-runtimes/codex-runtime'
import { resolveCodexCliPath } from '../src/main/lib/codex-runtime/codex-binary'
import type { CodexAuthState } from '../src/main/lib/codex-runtime/codex-auth'
import type { CodexRuntimeOptions } from '../src/main/lib/codex-runtime/codex-channel'
import { buildCodexMcpConfigFromWorkspace } from '../src/main/lib/codex-runtime/codex-mcp-config'

interface SmokeOptions {
  strict: boolean
  includeWebSearch: boolean
  cleanup: boolean
  only?: Set<string>
  model?: string
  modelReasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
  baseUrl?: string
  apiKey?: string
}

interface SmokeContext {
  readonly rootDir: string
  readonly codeinsightsConfigDir: string
  readonly nativeCodexHome: string
  readonly apiKeyCodexHome: string
  readonly mcpCodexHome: string
  readonly workspaceDir: string
  readonly model?: string
  readonly modelReasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
}

type SmokeStatus = 'passed' | 'failed' | 'skipped'

interface SmokeResult {
  name: string
  status: SmokeStatus
  detail: string
  terminal?: AgentRuntimeEvent['type']
  threadId?: string
  workspaceFile?: string
}

interface RuntimeRunResult {
  terminal?: AgentRuntimeEvent
  threadId?: string
  assistantText: string
  envelopes: AgentStreamEnvelope[]
}

interface AvailableCredential {
  codexHome: string
  runtime: CodexRuntimeOptions
  auth: CodexAuthState
}

export interface NativeCodexSource {
  authPath: string
  configPath?: string
}

if (isMainModule()) {
  const options = parseOptions(process.argv.slice(2))
  let context: SmokeContext | undefined
  let exitCode = 1

  try {
    context = await createSmokeContext(options)
    exitCode = await runSmoke(options, context)
  } finally {
    if (context) {
      await cleanupSmokeContext(context, options)
    }
  }

  process.exit(exitCode)
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1]
  return Boolean(entryPoint) && import.meta.url === pathToFileURL(entryPoint!).href
}

async function runSmoke(options: SmokeOptions, context: SmokeContext): Promise<number> {
  const results: SmokeResult[] = []

  process.env.CODEINSIGHTS_CONFIG_DIR = context.codeinsightsConfigDir
  process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME = '1'

  const packageVersions = readPackageVersions()
  const binaryPath = resolveCodexCliPath()
  const binaryVersion = resolveBinaryVersion(binaryPath)

  if (shouldRun(options, 'binary')) {
    results.push({
      name: `binary.${process.platform}-${process.arch}`,
      status: existsSync(binaryPath) ? 'passed' : 'failed',
      detail: existsSync(binaryPath)
        ? `Codex CLI 可解析: ${binaryVersion}`
        : `Codex CLI 不存在: ${binaryPath}`,
    })
  }

  if (shouldRun(options, 'native')) await runNativeAuthSmoke(context, results, options)
  if (shouldRun(options, 'api-key')) await runApiKeySmoke(context, results, options)
  if (shouldRun(options, 'workspace-write')) await runWorkspaceWriteSmoke(context, results, options)
  if (shouldRun(options, 'readonly')) await runReadOnlySmoke(context, results, options)
  if (shouldRun(options, 'stop')) await runStopSmoke(context, results, options)
  if (shouldRun(options, 'resume')) await runResumeSmoke(context, results, options)
  if (shouldRun(options, 'web-search')) await runWebSearchSmoke(context, results, options)
  if (shouldRun(options, 'mcp')) await runMcpConfigSmoke(context, results)

  const failed = results.filter((result) => result.status === 'failed')
  const skipped = results.filter((result) => result.status === 'skipped')
  const summary = {
    packageVersions,
    binaryPath,
    binaryVersion,
    artifactRoot: options.cleanup ? 'cleanup enabled' : context.rootDir,
    codeinsightsConfigDir: options.cleanup ? 'cleanup enabled' : context.codeinsightsConfigDir,
    workspaceDir: options.cleanup ? 'cleanup enabled' : context.workspaceDir,
    results,
  }

  console.log(JSON.stringify(summary, null, 2))

  return failed.length > 0 || (options.strict && skipped.length > 0) ? 1 : 0
}

function parseOptions(args: string[]): SmokeOptions {
  const only = parseOnly(args)
  const options: SmokeOptions = {
    strict: args.includes('--strict'),
    includeWebSearch: args.includes('--web-search')
      || only?.has('web-search') === true
      || process.env.CODEINSIGHTS_CODEX_SMOKE_WEB_SEARCH === '1',
    cleanup: !args.includes('--keep-artifacts'),
    only,
    model: process.env.CODEX_SMOKE_MODEL || process.env.CODEINSIGHTS_AGENT_CODEX_MODEL,
    modelReasoningEffort: parseReasoningEffort(process.env.CODEX_SMOKE_REASONING_EFFORT),
    baseUrl: process.env.CODEX_SMOKE_BASE_URL,
    apiKey: process.env.CODEX_SMOKE_API_KEY
      || (args.includes('--use-openai-api-key') ? process.env.OPENAI_API_KEY : undefined),
  }
  const modelIndex = args.indexOf('--model')
  if (modelIndex >= 0 && args[modelIndex + 1]) {
    options.model = args[modelIndex + 1]
  }
  return options
}

function parseReasoningEffort(value: string | undefined): SmokeOptions['modelReasoningEffort'] {
  if (
    value === 'minimal'
    || value === 'low'
    || value === 'medium'
    || value === 'high'
    || value === 'xhigh'
  ) {
    return value
  }
  return undefined
}

function parseOnly(args: string[]): Set<string> | undefined {
  const values: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--only' && args[index + 1]) {
      values.push(args[index + 1]!)
      index += 1
      continue
    }
    if (arg?.startsWith('--only=')) {
      values.push(arg.slice('--only='.length))
    }
  }
  const names = values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
  return names.length > 0 ? new Set(names) : undefined
}

function shouldRun(options: SmokeOptions, name: string): boolean {
  return !options.only || options.only.has(name)
}

async function createSmokeContext(options: SmokeOptions): Promise<SmokeContext> {
  const rootDir = await mkdtemp(join(tmpdir(), 'codeinsights-agent-codex-smoke-'))
  try {
    const codeinsightsConfigDir = join(rootDir, 'codeinsights-config')
    const nativeCodexHome = join(rootDir, 'codex-native-home')
    const apiKeyCodexHome = join(rootDir, 'codex-api-key-home')
    const mcpCodexHome = join(rootDir, 'codex-mcp-home')
    const workspaceDir = join(rootDir, 'workspace')

    await mkdir(codeinsightsConfigDir, { recursive: true })
    await mkdir(nativeCodexHome, { recursive: true })
    await mkdir(apiKeyCodexHome, { recursive: true })
    await mkdir(mcpCodexHome, { recursive: true })
    await mkdir(workspaceDir, { recursive: true })

    const nativeSource = resolveNativeCodexSource()
    if (nativeSource) {
      await copyNativeCodexSource(nativeSource, nativeCodexHome)
    }

    return {
      rootDir,
      codeinsightsConfigDir,
      nativeCodexHome,
      apiKeyCodexHome,
      mcpCodexHome,
      workspaceDir,
      model: options.model,
      modelReasoningEffort: options.modelReasoningEffort,
    }
  } catch (error) {
    await rm(rootDir, { recursive: true, force: true })
    throw error
  }
}

async function cleanupSmokeContext(context: SmokeContext, options: SmokeOptions): Promise<void> {
  await Promise.all([
    rm(join(context.nativeCodexHome, 'auth.json'), { force: true }),
    rm(join(context.nativeCodexHome, 'config.toml'), { force: true }),
    rm(join(context.apiKeyCodexHome, 'auth.json'), { force: true }),
    rm(join(context.apiKeyCodexHome, 'config.toml'), { force: true }),
    rm(join(context.mcpCodexHome, 'config.toml'), { force: true }),
  ])
  if (options.cleanup) {
    await rm(context.rootDir, { recursive: true, force: true })
  }
}

export function resolveNativeCodexSource(env: NodeJS.ProcessEnv = process.env): NativeCodexSource | null {
  const explicitCodexHome = env.CODEX_HOME?.trim()
  const homeDir = env.HOME || env.USERPROFILE || homedir()
  const candidates = [
    explicitCodexHome ? explicitCodexHome : '',
    join(homeDir, '.codex'),
  ].filter(Boolean)

  for (const codexHome of candidates) {
    const authPath = join(codexHome, 'auth.json')
    if (!existsSync(authPath)) continue
    const configPath = join(codexHome, 'config.toml')
    return {
      authPath,
      configPath: existsSync(configPath) ? configPath : undefined,
    }
  }

  return null
}

export async function copyNativeCodexSource(
  source: NativeCodexSource,
  targetCodexHome: string,
): Promise<void> {
  await mkdir(targetCodexHome, { recursive: true })
  const targetAuthPath = join(targetCodexHome, 'auth.json')
  await copyFile(source.authPath, targetAuthPath)
  await chmod(targetAuthPath, 0o600)

  if (source.configPath) {
    const targetConfigPath = join(targetCodexHome, 'config.toml')
    await copyFile(source.configPath, targetConfigPath)
    await chmod(targetConfigPath, 0o600)
  }
}

async function runNativeAuthSmoke(
  context: SmokeContext,
  results: SmokeResult[],
  options: SmokeOptions,
): Promise<void> {
  if (!existsSync(join(context.nativeCodexHome, 'auth.json'))) {
    results.push({
      name: 'native-auth.readonly',
      status: 'skipped',
      detail: '未检测到本机 Codex auth.json，跳过 native auth smoke。',
    })
    return
  }

  const run = await runRuntimeScenario({
    context,
    name: 'native-auth',
    prompt: '只回答 codeinsights-codex-native-ok，不要读取或修改任何文件。',
    permissionMode: 'plan',
    codexHome: context.nativeCodexHome,
    runtime: {},
    expectAuth: { kind: 'native', codexHome: context.nativeCodexHome },
    timeoutMs: 120_000,
  })

  results.push({
    name: 'native-auth.readonly',
    status: run.assistantText.includes('codeinsights-codex-native-ok') && run.terminal?.type === 'run_completed'
      ? 'passed'
      : 'failed',
    detail: summarizeRun(run),
    terminal: run.terminal?.type,
    threadId: run.threadId,
  })

  if (options.strict && run.terminal?.type !== 'run_completed') {
    throw new Error('native auth smoke 未完成')
  }
}

async function runApiKeySmoke(
  context: SmokeContext,
  results: SmokeResult[],
  options: SmokeOptions,
): Promise<void> {
  if (!options.apiKey) {
    results.push({
      name: 'channel-api-key.readonly',
      status: 'skipped',
      detail: '未设置 CODEX_SMOKE_API_KEY，且未显式传 --use-openai-api-key，跳过 channel API key smoke。',
    })
    return
  }

  const run = await runRuntimeScenario({
    context,
    name: 'channel-api-key',
    prompt: '只回答 codeinsights-codex-api-key-ok，不要读取或修改任何文件。',
    permissionMode: 'plan',
    codexHome: context.apiKeyCodexHome,
    runtime: {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: context.model,
    },
    expectAuth: { kind: 'api_key' },
    timeoutMs: 120_000,
  })

  results.push({
    name: 'channel-api-key.readonly',
    status: run.assistantText.includes('codeinsights-codex-api-key-ok') && run.terminal?.type === 'run_completed'
      ? 'passed'
      : 'failed',
    detail: summarizeRun(run),
    terminal: run.terminal?.type,
    threadId: run.threadId,
  })
}

async function runWorkspaceWriteSmoke(
  context: SmokeContext,
  results: SmokeResult[],
  options: SmokeOptions,
): Promise<void> {
  const credential = getAvailableCredential(context, options)
  if (!credential) {
    results.push({
      name: 'workspace-write.file-edit',
      status: 'skipped',
      detail: '未检测到 native Codex auth 或 CODEX_SMOKE_API_KEY。',
    })
    return
  }

  const filePath = join(context.workspaceDir, 'codex-smoke-write.txt')
  await writeFile(filePath, 'before\n', 'utf-8')

  const run = await runRuntimeScenario({
    context,
    name: 'workspace-write',
    prompt: [
      '将当前工作目录里的 codex-smoke-write.txt 内容替换为：',
      'phase7 workspace write ok',
      '不要修改其他文件。完成后用一句中文说明结果。',
    ].join('\n'),
    permissionMode: 'auto',
    codexHome: credential.codexHome,
    runtime: credential.runtime,
    expectAuth: credential.auth,
    timeoutMs: 180_000,
  })

  const content = await readFile(filePath, 'utf-8')
  results.push({
    name: 'workspace-write.file-edit',
    status: content.includes('phase7 workspace write ok') && run.terminal?.type === 'run_completed'
      ? 'passed'
      : 'failed',
    detail: `文件内容: ${JSON.stringify(content.trim())}; ${summarizeRun(run)}`,
    terminal: run.terminal?.type,
    threadId: run.threadId,
    workspaceFile: filePath,
  })
}

async function runReadOnlySmoke(
  context: SmokeContext,
  results: SmokeResult[],
  options: SmokeOptions,
): Promise<void> {
  const credential = getAvailableCredential(context, options)
  if (!credential) {
    results.push({
      name: 'readonly-plan.no-write',
      status: 'skipped',
      detail: '未检测到 native Codex auth 或 CODEX_SMOKE_API_KEY。',
    })
    return
  }

  const filePath = join(context.workspaceDir, 'codex-smoke-readonly.txt')
  await writeFile(filePath, 'before-readonly\n', 'utf-8')

  const run = await runRuntimeScenario({
    context,
    name: 'readonly-plan',
    prompt: [
      '请尝试把 codex-smoke-readonly.txt 改成 phase7 read-only should not write。',
      '如果当前权限不允许写入，请不要绕过限制，只解释不能写入。',
    ].join('\n'),
    permissionMode: 'plan',
    codexHome: credential.codexHome,
    runtime: credential.runtime,
    expectAuth: credential.auth,
    timeoutMs: 180_000,
  })

  const content = await readFile(filePath, 'utf-8')
  results.push({
    name: 'readonly-plan.no-write',
    status: content === 'before-readonly\n' && run.terminal?.type === 'run_completed' ? 'passed' : 'failed',
    detail: `文件内容: ${JSON.stringify(content.trim())}; ${summarizeRun(run)}`,
    terminal: run.terminal?.type,
    threadId: run.threadId,
    workspaceFile: filePath,
  })
}

async function runStopSmoke(
  context: SmokeContext,
  results: SmokeResult[],
  options: SmokeOptions,
): Promise<void> {
  const credential = getAvailableCredential(context, options)
  if (!credential) {
    results.push({
      name: 'stop.long-run',
      status: 'skipped',
      detail: '未检测到 native Codex auth 或 CODEX_SMOKE_API_KEY。',
    })
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2_000)
  try {
    const run = await runRuntimeScenario({
      context,
      name: 'stop-long-run',
      prompt: '持续输出从 1 到 100000，每个数字一行，直到被停止。',
      permissionMode: 'plan',
      codexHome: credential.codexHome,
      runtime: credential.runtime,
      expectAuth: credential.auth,
      abortSignal: controller.signal,
      timeoutMs: 60_000,
    })
    results.push({
      name: 'stop.long-run',
      status: run.terminal?.type === 'run_stopped' ? 'passed' : 'failed',
      detail: summarizeRun(run),
      terminal: run.terminal?.type,
      threadId: run.threadId,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function runResumeSmoke(
  context: SmokeContext,
  results: SmokeResult[],
  options: SmokeOptions,
): Promise<void> {
  const credential = getAvailableCredential(context, options)
  if (!credential) {
    results.push({
      name: 'resume.context',
      status: 'skipped',
      detail: '未检测到 native Codex auth 或 CODEX_SMOKE_API_KEY。',
    })
    return
  }

  const token = `CODEINSIGHTS_PHASE7_${randomUUID().slice(0, 8)}`
  const first = await runRuntimeScenario({
    context,
    name: 'resume-first',
    prompt: `请记住口令 ${token}，只回答“已记住”。`,
    permissionMode: 'plan',
    codexHome: credential.codexHome,
    runtime: credential.runtime,
    expectAuth: credential.auth,
    timeoutMs: 120_000,
  })

  if (!first.threadId) {
    results.push({
      name: 'resume.context',
      status: 'failed',
      detail: '首轮没有返回 Codex thread id。',
      terminal: first.terminal?.type,
    })
    return
  }

  const second = await runRuntimeScenario({
    context,
    name: 'resume-second',
    prompt: '刚才让你记住的口令是什么？只输出口令。',
    permissionMode: 'plan',
    codexHome: credential.codexHome,
    runtime: credential.runtime,
    expectAuth: credential.auth,
    externalSessionId: first.threadId,
    timeoutMs: 120_000,
  })

  results.push({
    name: 'resume.context',
    status: second.assistantText.includes(token) && second.terminal?.type === 'run_completed' ? 'passed' : 'failed',
    detail: summarizeRun(second),
    terminal: second.terminal?.type,
    threadId: first.threadId,
  })
}

async function runWebSearchSmoke(
  context: SmokeContext,
  results: SmokeResult[],
  options: SmokeOptions,
): Promise<void> {
  if (!options.includeWebSearch) {
    results.push({
      name: 'web-search.current-support',
      status: 'skipped',
      detail: '未传 --web-search 或 --only web-search，避免默认 smoke 发起外部搜索。',
    })
    return
  }
  const credential = getAvailableCredential(context, options)
  if (!credential) {
    results.push({
      name: 'web-search.current-support',
      status: 'skipped',
      detail: '未检测到 native Codex auth 或 CODEX_SMOKE_API_KEY。',
    })
    return
  }

  const run = await runRuntimeScenario({
    context,
    name: 'web-search',
    prompt: '使用 web search 查询 @openai/codex-sdk 当前 npm 最新版本，只输出版本号。',
    permissionMode: 'bypassPermissions',
    codexHome: credential.codexHome,
    runtime: credential.runtime,
    expectAuth: credential.auth,
    webSearchMode: 'live',
    networkAccessEnabled: true,
    timeoutMs: 180_000,
  })

  const sawWebSearch = run.envelopes.some((envelope) => {
    const event = envelope.event
    return event.type === 'tool_started' && event.name === 'WebSearch'
  })
  results.push({
    name: 'web-search.current-support',
    status: sawWebSearch && run.terminal?.type === 'run_completed' ? 'passed' : 'failed',
    detail: summarizeRun(run),
    terminal: run.terminal?.type,
    threadId: run.threadId,
  })
}

async function runMcpConfigSmoke(
  context: SmokeContext,
  results: SmokeResult[],
): Promise<void> {
  const serverName = 'codeinsights_smoke'
  const httpServerName = 'codeinsights_http_smoke'
  const workspaceConfig: WorkspaceMcpConfig = {
    servers: {
      [serverName]: {
        type: 'stdio',
        command: process.execPath,
        args: ['-e', 'process.exit(0)'],
        env: { SMOKE_TOKEN: 'smoke-token' },
        enabled: true,
      },
      [httpServerName]: {
        type: 'http',
        url: 'https://mcp.example.test/mcp',
        headers: { 'X-Api-Key': 'smoke-http-token' },
        enabled: true,
      },
    },
  }
  const codexConfig = buildCodexMcpConfigFromWorkspace(workspaceConfig)
  if (!codexConfig.config || codexConfig.serverCount !== 2) {
    results.push({
      name: 'mcp.config-injection',
      status: 'failed',
      detail: `MCP 配置转换失败: ${JSON.stringify(codexConfig.skipped)}`,
    })
    return
  }
  const generatedServers = codexConfig.config.mcp_servers as Record<string, {
    args?: string[]
    command?: string
    enabled?: boolean
    env_vars?: string[]
    required?: boolean
    startup_timeout_sec?: number
    url?: string
    env_http_headers?: Record<string, string>
  }>
  const generatedServer = generatedServers[serverName]
  const generatedHttpServer = generatedServers[httpServerName]
  if (!generatedServer || !generatedHttpServer) {
    results.push({
      name: 'mcp.config-injection',
      status: 'failed',
      detail: 'MCP 配置转换缺少 smoke server。',
    })
    return
  }

  try {
    const output = execFileSync(
      resolveCodexCliPath(),
      [
        'mcp',
        'list',
        '--json',
        ...buildCodexConfigOverrideArgs(codexConfig.config as Record<string, unknown>),
      ],
      {
        encoding: 'utf-8',
        env: {
          PATH: process.env.PATH ?? '',
          HOME: homedir(),
          USERPROFILE: homedir(),
          CODEX_HOME: context.mcpCodexHome,
          ...codexConfig.env,
        },
      },
    )
    const servers = JSON.parse(output) as Array<{
      name?: string
      enabled?: boolean
      startup_timeout_sec?: number
      transport?: {
        type?: string
        command?: string
        args?: string[]
        env_vars?: string[]
        url?: string
        env_http_headers?: Record<string, string>
      }
    }>
    const server = servers.find((item) => item.name === serverName)
    const httpServer = servers.find((item) => item.name === httpServerName)
    const passed = server?.enabled === true
      && server.transport?.type === 'stdio'
      && server.transport.command === generatedServer.command
      && server.transport.args?.join('\u0000') === generatedServer.args?.join('\u0000')
      && server.transport.env_vars?.join('\u0000') === generatedServer.env_vars?.join('\u0000')
      && server.startup_timeout_sec === generatedServer.startup_timeout_sec
      && httpServer?.enabled === true
      && httpServer.transport?.type === 'streamable_http'
      && httpServer.transport.url === generatedHttpServer.url
      && JSON.stringify(httpServer.transport.env_http_headers) === JSON.stringify(generatedHttpServer.env_http_headers)

    results.push({
      name: 'mcp.config-injection',
      status: passed ? 'passed' : 'failed',
      detail: passed
        ? 'CodeInsights workspace MCP 已映射为 Codex 原生 mcp_servers 配置，Codex CLI mcp list 可识别 stdio/http 配置。'
        : 'Codex CLI mcp list 未识别生成的 MCP 配置。',
    })
  } catch (error) {
    results.push({
      name: 'mcp.config-injection',
      status: 'failed',
      detail: error instanceof Error ? error.message : 'MCP 配置 smoke 执行失败',
    })
  }
}

function buildCodexConfigOverrideArgs(config: Record<string, unknown>): string[] {
  return flattenCodexConfigOverrides(config)
    .flatMap((override) => ['--config', override])
}

function flattenCodexConfigOverrides(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (isPlainRecord(child)) {
      return flattenCodexConfigOverrides(child, path)
    }
    return [`${path}=${toTomlLiteral(child)}`]
  })
}

function toTomlLiteral(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return `[${value.map((item) => toTomlLiteral(item)).join(',')}]`
  }
  throw new Error(`无法序列化 Codex config override: ${String(value)}`)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
}

async function runRuntimeScenario(input: {
  context: SmokeContext
  name: string
  prompt: string
  permissionMode: CodeInsightsPermissionMode
  codexHome: string
  runtime: CodexRuntimeOptions
  expectAuth: CodexAuthState
  timeoutMs: number
  externalSessionId?: string
  abortSignal?: AbortSignal
  webSearchMode?: 'disabled' | 'cached' | 'live'
  networkAccessEnabled?: boolean
}): Promise<RuntimeRunResult> {
  const timeout = createTimeoutController(input.timeoutMs)
  const signal = mergeAbortSignals(timeout.signal, input.abortSignal)
  const envelopes: AgentStreamEnvelope[] = []
  const runtime = new CodexAgentRuntime({
    resolveCodexRuntime: () => input.runtime,
    buildCodexEnv: async () => ({
      PATH: process.env.PATH ?? '',
      HOME: homedir(),
      USERPROFILE: homedir(),
      TMPDIR: tmpdir(),
      TMP: tmpdir(),
      TEMP: tmpdir(),
      SHELL: process.env.SHELL ?? '/bin/sh',
      LANG: process.env.LANG ?? 'en_US.UTF-8',
      CODEX_HOME: input.codexHome,
    }),
    resolveCodexAuth: () => input.expectAuth,
  })

  try {
    for await (const envelope of runtime.run({
      sessionId: `smoke-${input.name}-${randomUUID()}`,
      prompt: input.prompt,
      model: input.context.model,
      workingDirectory: input.context.workspaceDir,
      permissionMode: input.permissionMode,
      externalSessionId: input.externalSessionId,
      channelId: input.runtime.apiKey ? 'smoke-channel' : null,
      runtimeHash: 'phase7-smoke',
      runnerMode: 'runner-v2',
      repositoryRoot: input.context.workspaceDir,
      abortSignal: signal,
      modelReasoningEffort: input.context.modelReasoningEffort,
      networkAccessEnabled: input.networkAccessEnabled,
      webSearchMode: input.webSearchMode ?? 'disabled',
    })) {
      envelopes.push(envelope)
      if (isTerminalEvent(envelope.event)) break
    }
  } finally {
    timeout.clear()
    runtime.dispose()
  }

  return {
    terminal: envelopes.find((envelope) => isTerminalEvent(envelope.event))?.event,
    threadId: findThreadId(envelopes),
    assistantText: collectAssistantText(envelopes),
    envelopes,
  }
}

function createTimeoutController(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}

function mergeAbortSignals(timeout: AbortSignal, external?: AbortSignal): AbortSignal {
  if (!external) return timeout
  const controller = new AbortController()
  const abort = (): void => controller.abort()
  timeout.addEventListener('abort', abort, { once: true })
  external.addEventListener('abort', abort, { once: true })
  if (timeout.aborted || external.aborted) controller.abort()
  return controller.signal
}

function getAvailableCredential(context: SmokeContext, options: SmokeOptions): AvailableCredential | null {
  if (options.apiKey) {
    return {
      codexHome: context.apiKeyCodexHome,
      runtime: {
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        model: context.model,
      },
      auth: { kind: 'api_key' },
    }
  }
  if (existsSync(join(context.nativeCodexHome, 'auth.json'))) {
    return {
      codexHome: context.nativeCodexHome,
      runtime: {},
      auth: { kind: 'native', codexHome: context.nativeCodexHome },
    }
  }
  return null
}

function collectAssistantText(envelopes: AgentStreamEnvelope[]): string {
  return envelopes
    .flatMap((envelope) => envelope.event.type === 'assistant_message'
      ? envelope.event.contentBlocks
      : [])
    .map((block) => isTextContentBlock(block) ? block.text : '')
    .join('\n')
}

function findThreadId(envelopes: AgentStreamEnvelope[]): string | undefined {
  for (const envelope of envelopes) {
    if (envelope.event.type === 'sdk_session') {
      return envelope.event.sdkSessionId
    }
  }
  return undefined
}

function isTerminalEvent(event: AgentRuntimeEvent): boolean {
  return event.type === 'run_completed'
    || event.type === 'run_failed'
    || event.type === 'run_stopped'
}

function isTextContentBlock(value: unknown): value is { type: 'text'; text: string } {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && 'text' in value
    && (value as { type?: unknown }).type === 'text'
    && typeof (value as { text?: unknown }).text === 'string'
}

function summarizeAssistant(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length > 240 ? `${compact.slice(0, 240)}...` : compact
}

function summarizeRun(run: RuntimeRunResult): string {
  if (run.terminal?.type === 'run_failed') {
    return `error: ${run.terminal.error.message}`
  }
  const assistant = summarizeAssistant(run.assistantText)
  return assistant ? `assistant: ${assistant}` : `terminal: ${run.terminal?.type ?? 'none'}`
}

function readPackageVersions(): Record<string, string> {
  const require = createRequire(import.meta.url)
  const packages = ['@openai/codex-sdk', '@openai/codex'] as const
  return Object.fromEntries(packages.map((packageName) => {
    const packageJsonPath = require.resolve(`${packageName}/package.json`)
    const packageJson = require(packageJsonPath) as { version?: string }
    return [packageName, packageJson.version ?? 'unknown']
  }))
}

function resolveBinaryVersion(binaryPath: string): string {
  try {
    return execFileSync(binaryPath, ['--version'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    return error instanceof Error ? error.message : 'version check failed'
  }
}

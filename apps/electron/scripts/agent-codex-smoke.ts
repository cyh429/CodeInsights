import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import type {
  AgentRuntimeEvent,
  AgentStreamEnvelope,
  CodeInsightsPermissionMode,
} from '@codeinsights/shared'
import { CodexAgentRuntime } from '../src/main/lib/agent-runtimes/codex-runtime'
import { resolveCodexCliPath } from '../src/main/lib/codex-runtime/codex-binary'
import type { CodexAuthState } from '../src/main/lib/codex-runtime/codex-auth'
import type { CodexRuntimeOptions } from '../src/main/lib/codex-runtime/codex-channel'

interface SmokeOptions {
  strict: boolean
  includeWebSearch: boolean
  cleanup: boolean
  only?: Set<string>
  model?: string
  baseUrl?: string
  apiKey?: string
}

interface SmokeContext {
  readonly rootDir: string
  readonly codeinsightsConfigDir: string
  readonly nativeCodexHome: string
  readonly apiKeyCodexHome: string
  readonly workspaceDir: string
  readonly model?: string
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

  if (shouldRun(options, 'mcp')) {
    results.push({
      name: 'mcp.current-support',
      status: 'skipped',
      detail: 'Phase 7 未注入 CodeInsights workspace MCP 到 Codex 原生配置；本轮记录为未配置。',
    })
  }

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
    const workspaceDir = join(rootDir, 'workspace')

    await mkdir(codeinsightsConfigDir, { recursive: true })
    await mkdir(nativeCodexHome, { recursive: true })
    await mkdir(apiKeyCodexHome, { recursive: true })
    await mkdir(workspaceDir, { recursive: true })

    const sourceAuthPath = resolveNativeAuthPath()
    if (sourceAuthPath) {
      const targetAuthPath = join(nativeCodexHome, 'auth.json')
      await copyFile(sourceAuthPath, targetAuthPath)
      await chmod(targetAuthPath, 0o600)
    }

    return {
      rootDir,
      codeinsightsConfigDir,
      nativeCodexHome,
      apiKeyCodexHome,
      workspaceDir,
      model: options.model,
    }
  } catch (error) {
    await rm(rootDir, { recursive: true, force: true })
    throw error
  }
}

async function cleanupSmokeContext(context: SmokeContext, options: SmokeOptions): Promise<void> {
  await Promise.all([
    rm(join(context.nativeCodexHome, 'auth.json'), { force: true }),
    rm(join(context.apiKeyCodexHome, 'auth.json'), { force: true }),
  ])
  if (options.cleanup) {
    await rm(context.rootDir, { recursive: true, force: true })
  }
}

function resolveNativeAuthPath(): string | null {
  const explicitCodexHome = process.env.CODEX_HOME?.trim()
  const candidates = [
    explicitCodexHome ? join(explicitCodexHome, 'auth.json') : '',
    join(homedir(), '.codex', 'auth.json'),
  ].filter(Boolean)
  return candidates.find((candidate) => existsSync(candidate)) ?? null
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
      modelReasoningEffort: 'minimal',
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

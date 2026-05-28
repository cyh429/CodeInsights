import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocket } from 'undici'
import type { AgentStreamEnvelope, SDKMessage } from '@codeinsights/shared'

interface SmokeOptions {
  appPath: string
  cleanup: boolean
  timeoutMs: number
  runtime: 'codex' | 'opencode'
}

interface SmokeContext {
  rootDir: string
  codeinsightsConfigDir: string
  userDataDir: string
  sessionId: string
  titleToken: string
  userToken: string
  assistantToken: string
}

interface SmokeLaunchResult {
  name: string
  status: 'passed' | 'failed'
  detail: string
  targetUrl?: string
}

interface CdpTarget {
  type?: string
  title?: string
  url?: string
  webSocketDebuggerUrl?: string
}

interface CdpResponse {
  id?: number
  result?: unknown
  error?: {
    message?: string
    data?: string
  }
  method?: string
  params?: unknown
}

interface RuntimeEvaluateResult {
  result?: {
    value?: unknown
  }
  exceptionDetails?: {
    text?: string
  }
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

class CdpClient {
  private websocket: WebSocket | null = null
  private nextId = 1
  private readonly pending = new Map<number, PendingRequest>()

  constructor(private readonly wsUrl: string) {}

  async connect(): Promise<void> {
    this.websocket = new WebSocket(this.wsUrl)
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => rejectPromise(new Error('CDP WebSocket 连接超时')), 10_000)
      this.websocket?.addEventListener('open', () => {
        clearTimeout(timer)
        resolvePromise()
      }, { once: true })
      this.websocket?.addEventListener('error', (event: { error?: unknown }) => {
        clearTimeout(timer)
        rejectPromise(event.error instanceof Error ? event.error : new Error('CDP WebSocket 连接失败'))
      }, { once: true })
    })
    this.websocket.addEventListener('message', (event: { data: unknown }) => this.handleMessage(event.data))
  }

  send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.websocket) throw new Error('CDP WebSocket 尚未连接')
    const id = this.nextId
    this.nextId += 1
    this.websocket.send(JSON.stringify({ id, method, params }))
    return new Promise<T>((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => {
        const pending = this.pending.get(id)
        if (!pending) return
        this.pending.delete(id)
        rejectPromise(new Error(`${method} 超时`))
      }, 30_000)
      this.pending.set(id, {
        resolve: (value: unknown) => resolvePromise(value as T),
        reject: rejectPromise,
        timer,
      })
    })
  }

  async evaluate(expression: string): Promise<unknown> {
    const result = await this.send<RuntimeEvaluateResult>('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? 'Runtime.evaluate 失败')
    }
    return result.result?.value
  }

  close(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error(`CDP 请求已取消: ${id}`))
    }
    this.pending.clear()
    this.websocket?.close()
    this.websocket = null
  }

  private handleMessage(data: unknown): void {
    const message = JSON.parse(typeof data === 'string' ? data : Buffer.from(data as ArrayBuffer).toString('utf-8')) as CdpResponse
    if (!message.id) return
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    clearTimeout(pending.timer)
    if (message.error) {
      const detail = message.error.data ? `: ${message.error.data}` : ''
      pending.reject(new Error(`${message.error.message ?? 'CDP 错误'}${detail}`))
      return
    }
    pending.resolve(message.result ?? {})
  }
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const electronRoot = dirname(scriptDir)

const options = parseOptions(process.argv.slice(2))
let context: SmokeContext | undefined
let exitCode = 1

try {
  context = await createSmokeContext()
  await seedHistoryReloadFixture(context)
  const first = await verifyPackagedReloadLaunch(options, context, 'history-reload.first-open')
  const second = await verifyPackagedReloadLaunch(options, context, 'history-reload.reopen')
  const results = [first, second]
  const failed = results.filter((result) => result.status === 'failed')
  console.log(JSON.stringify({
    appPath: options.appPath,
    runtime: options.runtime,
    artifactRoot: options.cleanup ? 'cleanup enabled' : context.rootDir,
    codeinsightsConfigDir: options.cleanup ? 'cleanup enabled' : context.codeinsightsConfigDir,
    userDataDir: options.cleanup ? 'cleanup enabled' : context.userDataDir,
    sessionId: context.sessionId,
    tokens: {
      title: context.titleToken,
      user: context.userToken,
      assistant: context.assistantToken,
    },
    results,
  }, null, 2))
  exitCode = failed.length === 0 ? 0 : 1
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  exitCode = 1
} finally {
  if (context && options.cleanup) {
    await rm(context.rootDir, { recursive: true, force: true })
  }
}

process.exit(exitCode)

function parseOptions(args: string[]): SmokeOptions {
  const appIndex = args.indexOf('--app')
  const timeoutIndex = args.indexOf('--timeout-ms')
  const runtimeIndex = args.indexOf('--runtime')
  const runtime = runtimeIndex >= 0 && args[runtimeIndex + 1] === 'opencode' ? 'opencode' : 'codex'
  return {
    appPath: resolve(appIndex >= 0 && args[appIndex + 1] ? args[appIndex + 1]! : defaultPackagedAppPath()),
    cleanup: !args.includes('--keep-artifacts'),
    timeoutMs: timeoutIndex >= 0 && args[timeoutIndex + 1] ? Number(args[timeoutIndex + 1]) : 45_000,
    runtime,
  }
}

function defaultPackagedAppPath(): string {
  if (process.platform === 'darwin') {
    const archDir = process.arch === 'arm64' ? 'mac-arm64' : 'mac'
    return join(electronRoot, 'out', archDir, 'CodeInsights.app', 'Contents', 'MacOS', 'CodeInsights')
  }
  if (process.platform === 'win32') {
    return join(electronRoot, 'out', 'win-unpacked', 'CodeInsights.exe')
  }
  return join(electronRoot, 'out', 'linux-unpacked', 'CodeInsights')
}

async function createSmokeContext(): Promise<SmokeContext> {
  const rootDir = await mkdtemp(join(tmpdir(), 'codeinsights-agent-history-ui-'))
  const codeinsightsConfigDir = join(rootDir, 'codeinsights-config')
  const userDataDir = join(rootDir, 'electron-user-data')
  const token = randomUUID().slice(0, 8)
  await mkdir(join(codeinsightsConfigDir, 'agent-sessions'), { recursive: true })
  await mkdir(userDataDir, { recursive: true })
  return {
    rootDir,
    codeinsightsConfigDir,
    userDataDir,
    sessionId: `history-reload-smoke-${token}`,
    titleToken: `History Reload Smoke ${token}`,
    userToken: `codeinsights-history-user-${token}`,
    assistantToken: `codeinsights-history-assistant-${token}`,
  }
}

async function seedHistoryReloadFixture(context: SmokeContext): Promise<void> {
  const now = Date.now()
  const runtime = options.runtime
  const threadId = runtime === 'opencode'
    ? `ses_opencode_${context.sessionId.replaceAll('-', '_')}`
    : `codex-thread-${context.sessionId}`
  const runId = `run-${context.sessionId}`
  await writeJson(join(context.codeinsightsConfigDir, 'settings.json'), {
    themeMode: 'system',
    onboardingCompleted: true,
    environmentCheckSkipped: true,
    agentRuntimeKind: runtime,
    ...(runtime === 'codex'
      ? { agentCodexChannelId: null }
      : {
        agentOpencodeChannelId: null,
        agentOpencodeUseNativeAuth: true,
        agentOpencodeModelId: 'anthropic/claude-sonnet-4-5',
        agentOpencodeAgentName: 'build',
      }),
    tabState: {
      tabs: [{
        id: context.sessionId,
        type: 'agent',
        sessionId: context.sessionId,
        title: context.titleToken,
      }],
      activeTabId: context.sessionId,
    },
  })
  await writeJson(join(context.codeinsightsConfigDir, 'agent-sessions.json'), {
    version: 1,
    sessions: [{
      id: context.sessionId,
      title: context.titleToken,
      runtimeKind: runtime,
      runtimeSession: {
        kind: runtime,
        externalSessionId: threadId,
        channelId: null,
        model: runtime === 'opencode' ? 'anthropic/claude-sonnet-4-5' : 'gpt-5-codex',
        ...(runtime === 'opencode' ? { agent: 'build', authSource: 'native' } : {}),
        createdAt: now - 5_000,
        updatedAt: now - 1_000,
      },
      createdAt: now - 5_000,
      updatedAt: now - 1_000,
    }],
  })

  const userMessage: SDKMessage = {
    type: 'user',
    message: {
      content: [{ type: 'text', text: context.userToken }],
    },
    parent_tool_use_id: null,
      session_id: threadId,
    uuid: `user-${context.sessionId}`,
    _createdAt: now - 4_000,
  }
  await writeFile(
    join(context.codeinsightsConfigDir, 'agent-sessions', `${context.sessionId}.jsonl`),
    `${JSON.stringify(userMessage)}\n`,
    'utf-8',
  )

  const events: AgentStreamEnvelope[] = [
    createEnvelope(context.sessionId, runId, 0, now - 3_500, {
      type: 'run_started',
      model: runtime === 'opencode' ? 'anthropic/claude-sonnet-4-5' : 'gpt-5-codex',
      cwd: context.rootDir,
      permissionMode: 'plan',
      runtimeHash: 'history-reload-ui-smoke',
      runnerMode: 'runner-v2',
      runtimeKind: runtime,
    }, runtime),
    createEnvelope(context.sessionId, runId, 1, now - 3_250, {
      type: 'sdk_session',
      sdkSessionId: threadId,
    }, runtime),
    createEnvelope(context.sessionId, runId, 2, now - 3_000, {
      type: 'assistant_message',
      messageId: `assistant-${context.sessionId}`,
      contentBlocks: [{ type: 'text', text: context.assistantToken }],
      status: 'complete',
    }, runtime),
    createEnvelope(context.sessionId, runId, 3, now - 2_500, {
      type: 'run_completed',
      resultSubtype: 'success',
      usage: {},
      sdkSessionId: threadId,
    }, runtime),
  ]
  await writeFile(
    join(context.codeinsightsConfigDir, 'agent-sessions', `${context.sessionId}.events.jsonl`),
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
    'utf-8',
  )
}

function createEnvelope(
  sessionId: string,
  runId: string,
  sequence: number,
  createdAt: number,
  event: AgentStreamEnvelope['event'],
  runtime: 'codex' | 'opencode',
): AgentStreamEnvelope {
  return {
    schemaVersion: 1,
    sessionId,
    runId,
    sequence,
    createdAt: new Date(createdAt).toISOString(),
    source: event.type === 'run_started' || event.type === 'run_completed'
      ? 'runtime_service'
      : runtime === 'opencode' ? 'opencode_server' : 'codex_sdk',
    event,
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

async function verifyPackagedReloadLaunch(
  options: SmokeOptions,
  context: SmokeContext,
  name: string,
): Promise<SmokeLaunchResult> {
  if (!existsSync(options.appPath)) {
    return {
      name,
      status: 'failed',
      detail: `packaged app 不存在: ${options.appPath}`,
    }
  }

  const port = await findFreePort()
  const child = spawn(options.appPath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${context.userDataDir}`,
  ], {
    env: buildChildEnv(context),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const logs: string[] = []
  child.stdout.on('data', (chunk) => appendLog(logs, chunk))
  child.stderr.on('data', (chunk) => appendLog(logs, chunk))

  let client: CdpClient | null = null
  try {
    const target = await waitForMainTarget(port, child, options.timeoutMs)
    client = new CdpClient(target.webSocketDebuggerUrl!)
    await client.connect()
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Page.bringToFront')
    const text = await waitForUiText(client, context, options.timeoutMs)
    return {
      name,
      status: 'passed',
      detail: summarizeText(text),
      targetUrl: target.url,
    }
  } catch (error) {
    return {
      name,
      status: 'failed',
      detail: `${error instanceof Error ? error.message : String(error)}; logs=${redactSensitiveText(logs.join('\n')).slice(-1_500)}`,
    }
  } finally {
    client?.close()
    await terminateChild(child)
  }
}

function appendLog(logs: string[], chunk: Buffer): void {
  logs.push(chunk.toString('utf-8').trim())
  if (logs.length > 80) logs.splice(0, logs.length - 80)
}

async function waitForMainTarget(
  port: number,
  child: ChildProcess,
  timeoutMs: number,
): Promise<CdpTarget> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`packaged app 提前退出: code=${child.exitCode}`)
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (response.ok) {
        const targets = await response.json() as CdpTarget[]
        const target = targets.find((item) =>
          item.type === 'page'
          && typeof item.webSocketDebuggerUrl === 'string'
          && !item.url?.includes('window=quick-task')
          && !item.url?.startsWith('devtools://')
          && isExpectedAppTarget(item.url)
        )
        if (target?.webSocketDebuggerUrl) return target
      }
    } catch {
      // CDP 端口尚未就绪，继续等待。
    }
    await wait(300)
  }
  throw new Error(`等待 CDP 主窗口 target 超时: port=${port}`)
}

function buildChildEnv(context: SmokeContext): NodeJS.ProcessEnv {
  const allowedEnvKeys = [
    'PATH',
    'HOME',
    'SHELL',
    'TMPDIR',
    'TMP',
    'TEMP',
    'LANG',
    'LC_ALL',
    'USER',
    'USERNAME',
    'SystemRoot',
    'WINDIR',
  ] as const
  const env: NodeJS.ProcessEnv = {}
  for (const key of allowedEnvKeys) {
    const value = process.env[key]
    if (typeof value === 'string') env[key] = value
  }
  env.CODEINSIGHTS_AUTOMATION = '1'
  env.CODEINSIGHTS_CONFIG_DIR = context.codeinsightsConfigDir
  env.CODEINSIGHTS_USER_DATA_DIR = context.userDataDir
  if (options.runtime === 'opencode') {
    env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME = '1'
  } else {
    env.CODEINSIGHTS_AGENT_CODEX_RUNTIME = '1'
  }
  env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
  return env
}

function redactSensitiveText(value: string): string {
  let redacted = value
  for (const [key, secret] of Object.entries(process.env)) {
    if (!isSensitiveEnvKey(key) || !secret || secret.length < 4) continue
    redacted = redacted.split(secret).join(`[REDACTED:${key}]`)
  }
  redacted = redacted.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [REDACTED]')
  redacted = redacted.replace(/(api[_-]?key|token|secret|authorization)(["'=:\s]+)([^\s"',}]+)/gi, '$1$2[REDACTED]')
  return redacted
}

function isSensitiveEnvKey(key: string): boolean {
  return /(?:TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL|AUTH|COOKIE)/i.test(key)
}

function isExpectedAppTarget(url: string | undefined): boolean {
  if (!url) return false
  return url.startsWith('file://') && url.includes('/dist/renderer/index.html')
}

async function waitForUiText(
  client: CdpClient,
  context: SmokeContext,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await client.evaluate('document.body.innerText')
    const text = typeof value === 'string' ? value : ''
    if (
      text.includes(context.titleToken)
      && text.includes(context.userToken)
      && text.includes(context.assistantToken)
    ) {
      return text
    }
    await wait(500)
  }
  throw new Error([
    '等待 history reload UI 文本超时',
    `title=${context.titleToken}`,
    `user=${context.userToken}`,
    `assistant=${context.assistantToken}`,
  ].join('; '))
}

function summarizeText(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length > 260 ? `${compact.slice(0, 260)}...` : compact
}

async function findFreePort(): Promise<number> {
  return await new Promise<number>((resolvePromise, rejectPromise) => {
    const server = createServer()
    server.once('error', rejectPromise)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (address && typeof address === 'object') resolvePromise(address.port)
        else rejectPromise(new Error('无法分配本地端口'))
      })
    })
  })
}

async function terminateChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  const exited = await Promise.race([
    new Promise<boolean>((resolvePromise) => child.once('exit', () => resolvePromise(true))),
    wait(5_000).then(() => false),
  ])
  if (!exited && child.exitCode === null) {
    child.kill('SIGKILL')
    await new Promise<void>((resolvePromise) => child.once('exit', () => resolvePromise()))
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

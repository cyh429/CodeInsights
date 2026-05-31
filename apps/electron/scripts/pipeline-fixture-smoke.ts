import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocket } from 'undici'
import { setupPipelineFixtureRepository } from '../src/main/lib/pipeline-fixture-runner'

interface SmokeOptions {
  appPath: string
  cleanup: boolean
  timeoutMs: number
  only?: Set<SmokeScenario>
}

type SmokeScenario = 'draft-only' | 'local-commit'
type SmokeStatus = 'passed' | 'failed' | 'skipped'

interface SmokeContext {
  rootDir: string
  codeinsightsConfigDir: string
  userDataDir: string
}

interface SmokeResult {
  name: SmokeScenario
  status: SmokeStatus
  detail: string
  sessionId?: string
  repositoryRoot?: string
}

interface CdpTarget {
  type?: string
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

interface WorkspaceAndSession {
  workspace: {
    id: string
    slug: string
  }
  session: {
    id: string
  }
}

interface PipelineGate {
  gateId: string
  sessionId: string
  node?: string
  kind?: string
}

interface PipelineStateResult {
  status?: string
  stageOutputs?: {
    committer?: {
      submissionStatus?: string
      localCommit?: {
        status?: string
        operationId?: string
      }
    }
  }
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

  async evaluate<T>(expression: string): Promise<T> {
    const result = await this.send<RuntimeEvaluateResult>('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? 'Runtime.evaluate 失败')
    }
    return result.result?.value as T
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
const scenarios: SmokeScenario[] = ['draft-only', 'local-commit']
const options = parseOptions(process.argv.slice(2))
let context: SmokeContext | undefined
let exitCode = 1

try {
  context = await createSmokeContext()
  const results: SmokeResult[] = []
  for (const scenario of scenarios) {
    if (options.only && !options.only.has(scenario)) {
      results.push({
        name: scenario,
        status: 'skipped',
        detail: '未包含在 --only 中',
      })
      continue
    }
    results.push(await runPackagedPipelineSmoke(options, context, scenario))
  }

  const failed = results.filter((result) => result.status === 'failed')
  console.log(JSON.stringify({
    appPath: options.appPath,
    artifactRoot: options.cleanup ? 'cleanup enabled' : context.rootDir,
    codeinsightsConfigDir: options.cleanup ? 'cleanup enabled' : context.codeinsightsConfigDir,
    results,
    remoteSmoke: '[!] 未执行真实 GitHub remote smoke：未获得用户明确授权',
  }, null, 2))
  exitCode = failed.length === 0 ? 0 : 1
} catch (error) {
  console.error(redactSensitiveText(error instanceof Error ? error.message : String(error)))
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
  return {
    appPath: resolve(appIndex >= 0 && args[appIndex + 1] ? args[appIndex + 1]! : defaultPackagedAppPath()),
    cleanup: !args.includes('--keep-artifacts'),
    timeoutMs: timeoutIndex >= 0 && args[timeoutIndex + 1] ? Number(args[timeoutIndex + 1]) : 90_000,
    only: parseOnly(args),
  }
}

function parseOnly(args: string[]): Set<SmokeScenario> | undefined {
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
  const selected = values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value): value is SmokeScenario => value === 'draft-only' || value === 'local-commit')
  return selected.length > 0 ? new Set(selected) : undefined
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
  const rootDir = await mkdtemp(join(tmpdir(), 'codeinsights-pipeline-fixture-smoke-'))
  const codeinsightsConfigDir = join(rootDir, 'codeinsights-config')
  const userDataDir = join(rootDir, 'electron-user-data')
  await mkdir(codeinsightsConfigDir, { recursive: true })
  await mkdir(userDataDir, { recursive: true })
  return {
    rootDir,
    codeinsightsConfigDir,
    userDataDir,
  }
}

async function runPackagedPipelineSmoke(
  options: SmokeOptions,
  context: SmokeContext,
  scenario: SmokeScenario,
): Promise<SmokeResult> {
  if (!existsSync(options.appPath)) {
    return {
      name: scenario,
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

    const created = await createWorkspaceAndSession(client, scenario)
    const repositoryRoot = join(
      context.codeinsightsConfigDir,
      'agent-workspaces',
      created.workspace.slug,
      created.session.id,
    )
    setupPipelineFixtureRepository(repositoryRoot)
    const result = await drivePipelineScenario(client, created.session.id, scenario, options.timeoutMs)
    assertScenarioState(result, scenario)

    return {
      name: scenario,
      status: 'passed',
      detail: `${scenario} completed: ${result.stageOutputs?.committer?.submissionStatus}`,
      sessionId: created.session.id,
      repositoryRoot: options.cleanup ? 'cleanup enabled' : repositoryRoot,
    }
  } catch (error) {
    return {
      name: scenario,
      status: 'failed',
      detail: `${error instanceof Error ? error.message : String(error)}; logs=${redactSensitiveText(logs.join('\n')).slice(-1_500)}`,
    }
  } finally {
    client?.close()
    await terminateChild(child)
  }
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
  env.CODEINSIGHTS_PIPELINE_FIXTURE_RUNNER = '1'
  env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
  return env
}

async function createWorkspaceAndSession(
  client: CdpClient,
  scenario: SmokeScenario,
): Promise<WorkspaceAndSession> {
  return client.evaluate<WorkspaceAndSession>(`(async () => {
    const workspace = await window.electronAPI.createAgentWorkspace(${JSON.stringify(`Pipeline Fixture ${scenario}`)});
    const session = await window.electronAPI.createPipelineSession(${JSON.stringify(`Pipeline Fixture ${scenario}`)}, 'channel-smoke', workspace.id, 2);
    return { workspace: { id: workspace.id, slug: workspace.slug }, session: { id: session.id } };
  })()`)
}

async function drivePipelineScenario(
  client: CdpClient,
  sessionId: string,
  scenario: SmokeScenario,
  timeoutMs: number,
): Promise<PipelineStateResult> {
  await client.evaluate<string>(`(async () => {
    window.__pipelineFixtureSmoke = { done: false, error: null };
    window.__pipelineFixtureSmoke.promise = window.electronAPI.startPipeline({
      sessionId: ${JSON.stringify(sessionId)},
      userInput: '运行 packaged Pipeline fixture smoke',
      channelId: 'channel-smoke',
      workspaceId: undefined,
    }).then(() => {
      window.__pipelineFixtureSmoke.done = true;
    }).catch((error) => {
      window.__pipelineFixtureSmoke.error = error?.message || String(error);
    });
    return 'started';
  })()`)

  const gates: Array<{ kind: string; node: string; response: Record<string, unknown> }> = [
    {
      kind: 'task_selection',
      node: 'explorer',
      response: { selectedReportId: 'report-001' },
    },
    { kind: 'document_review', node: 'planner', response: {} },
    { kind: 'document_review', node: 'developer', response: {} },
    { kind: 'document_review', node: 'tester', response: {} },
    {
      kind: 'submission_review',
      node: 'committer',
      response: {
        submissionMode: scenario === 'local-commit' ? 'local_commit' : 'local_patch',
        localCommitOperationId: `op-packaged-${scenario}`,
      },
    },
  ]

  for (const item of gates) {
    const gate = await waitForGate(client, sessionId, item.kind, item.node, timeoutMs)
    await respondGate(client, gate, item.response)
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const state = await client.evaluate<{ done?: boolean; error?: string | null }>('window.__pipelineFixtureSmoke || {}')
    if (state.error) throw new Error(state.error)
    if (state.done) {
      return client.evaluate<PipelineStateResult>(
        `window.electronAPI.getPipelineSessionState(${JSON.stringify(sessionId)})`,
      )
    }
    await wait(300)
  }
  throw new Error(`等待 Pipeline fixture smoke 完成超时: ${scenario}`)
}

async function waitForGate(
  client: CdpClient,
  sessionId: string,
  kind: string,
  node: string,
  timeoutMs: number,
): Promise<PipelineGate> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const gates = await client.evaluate<PipelineGate[]>('window.electronAPI.getPendingPipelineGates()')
    const gate = gates.find((item) =>
      item.sessionId === sessionId
      && item.kind === kind
      && item.node === node)
    if (gate) return gate
    await wait(300)
  }
  throw new Error(`等待 packaged Pipeline gate 超时: ${node}/${kind}`)
}

async function respondGate(
  client: CdpClient,
  gate: PipelineGate,
  response: Record<string, unknown>,
): Promise<void> {
  await client.evaluate<void>(`window.electronAPI.respondPipelineGate({
    gateId: ${JSON.stringify(gate.gateId)},
    sessionId: ${JSON.stringify(gate.sessionId)},
    kind: ${JSON.stringify(gate.kind)},
    action: 'approve',
    createdAt: Date.now(),
    ...${JSON.stringify(response)}
  })`)
}

function assertScenarioState(state: PipelineStateResult, scenario: SmokeScenario): void {
  if (state.status !== 'completed') {
    throw new Error(`Pipeline 未完成: ${state.status ?? 'unknown'}`)
  }
  const committer = state.stageOutputs?.committer
  if (scenario === 'draft-only' && committer?.submissionStatus !== 'draft_only') {
    throw new Error(`draft-only 状态不正确: ${committer?.submissionStatus ?? 'missing'}`)
  }
  if (scenario === 'local-commit') {
    if (committer?.submissionStatus !== 'local_commit_created') {
      throw new Error(`local commit 状态不正确: ${committer?.submissionStatus ?? 'missing'}`)
    }
    if (committer.localCommit?.status !== 'created') {
      throw new Error(`local commit 结果缺失: ${committer.localCommit?.status ?? 'missing'}`)
    }
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

function isExpectedAppTarget(url: string | undefined): boolean {
  if (!url) return false
  return url.startsWith('file://') && url.includes('/dist/renderer/index.html')
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

function wait(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

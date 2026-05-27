import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import {
  applyOpencodeRuntimeConfigEnv,
  buildOpencodeBaseEnv,
  buildOpencodeConfig,
  buildOpencodeMcpConfigFromWorkspace,
  createOpencodeAuthState,
  createOpencodeClientWrapper,
  createOpencodeServerKey,
  detectOpencodeBinaryVersion,
  mergeOpencodeScopedSecretEnv,
  OpencodeClientError,
  OpencodeServerManager,
  redactSecretText,
  resolveOpencodeCliPath,
  writeOpencodeRuntimeConfig,
  type OpencodeClientWrapper,
  type OpencodeServerEntry,
} from '../src/main/lib/opencode-runtime'

type SmokeName =
  | 'binary'
  | 'server'
  | 'config'
  | 'permission'
  | 'abort'
  | 'resume'
  | 'readonly'
  | 'channel'
  | 'native'

type SmokeStatus = 'passed' | 'failed' | 'skipped'

interface SmokeOptions {
  only: Set<SmokeName>
  strict: boolean
  keepArtifacts: boolean
}

interface SmokeResult {
  name: SmokeName
  status: SmokeStatus
  durationMs: number
  reason?: string
  details?: Record<string, unknown>
}

interface SmokeContext {
  rootDir: string
  workspaceDir: string
  manager: OpencodeServerManager
  binary?: {
    path: string
    source: string
    version: string
  }
}

interface SmokeServerLease {
  entry: OpencodeServerEntry
  client: OpencodeClientWrapper
  runtimeConfigHash: string
  authSourceHash: string
  configSummary: Record<string, unknown>
}

const ALL_SMOKES: SmokeName[] = [
  'binary',
  'server',
  'config',
  'permission',
  'abort',
  'resume',
  'readonly',
  'channel',
  'native',
]

const OPENCODE_SDK_VERSION = '1.15.11'

let context: SmokeContext | undefined

try {
  const options = parseOptions(process.argv.slice(2))
  context = await createSmokeContext()
  const results = await runSmoke(options, context)
  const summary = createSummary(context, results)
  const json = JSON.stringify(summary, null, 2)
  assertSecretlessSummary(json)
  console.log(json)
  process.exitCode = results.some((result) => result.status === 'failed')
    || (options.strict && results.some((result) => result.status === 'skipped'))
    ? 1
    : 0
} catch (error) {
  const message = redactSecretText(error instanceof Error ? error.message : String(error))
  console.error(JSON.stringify({
    status: 'failed',
    error: message,
  }, null, 2))
  process.exitCode = 1
} finally {
  if (context && !parseOptions(process.argv.slice(2)).keepArtifacts) {
    await cleanupSmokeContext(context)
  }
}

export function parseOptions(args: string[]): SmokeOptions {
  const only = new Set<SmokeName>()
  let strict = false
  let keepArtifacts = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--strict') {
      strict = true
      continue
    }
    if (arg === '--keep-artifacts') {
      keepArtifacts = true
      continue
    }
    if (arg === '--only') {
      for (const name of parseSmokeNames(args[index + 1] ?? '')) only.add(name)
      index += 1
      continue
    }
    if (arg?.startsWith('--only=')) {
      for (const name of parseSmokeNames(arg.slice('--only='.length))) only.add(name)
    }
  }

  return {
    only: only.size > 0 ? only : new Set(ALL_SMOKES),
    strict,
    keepArtifacts,
  }
}

async function runSmoke(options: SmokeOptions, ctx: SmokeContext): Promise<SmokeResult[]> {
  const results: SmokeResult[] = []
  for (const name of ALL_SMOKES) {
    if (!options.only.has(name)) continue
    results.push(await runSmokeStep(name, ctx))
  }
  return results
}

async function runSmokeStep(name: SmokeName, ctx: SmokeContext): Promise<SmokeResult> {
  const startedAt = Date.now()
  try {
    const details = await runNamedSmoke(name, ctx)
    return {
      name,
      status: details?.skipped ? 'skipped' : 'passed',
      durationMs: Date.now() - startedAt,
      ...(details?.reason ? { reason: details.reason } : {}),
      ...(details?.details ? { details: details.details } : {}),
    }
  } catch (error) {
    return {
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      reason: redactSecretText(error instanceof Error ? error.message : String(error)),
    }
  }
}

async function runNamedSmoke(
  name: SmokeName,
  ctx: SmokeContext,
): Promise<{ skipped?: boolean; reason?: string; details?: Record<string, unknown> } | undefined> {
  switch (name) {
    case 'binary':
      return { details: await runBinarySmoke(ctx) }
    case 'server':
      return { details: await runServerSmoke(ctx) }
    case 'config':
      return { details: await runConfigSmoke(ctx) }
    case 'permission':
      return { details: await runPermissionSmoke(ctx) }
    case 'abort':
      return { details: await runAbortSmoke(ctx) }
    case 'resume':
      return { details: await runResumeSmoke(ctx) }
    case 'readonly':
      return await runReadonlySmoke(ctx)
    case 'channel':
      return await runChannelAuthSmoke(ctx)
    case 'native':
      return await runNativeAuthSmoke(ctx)
  }
}

async function createSmokeContext(): Promise<SmokeContext> {
  const rootDir = await mkdtemp(join(tmpdir(), 'codeinsights-agent-opencode-smoke-'))
  const workspaceDir = join(rootDir, 'workspace')
  await mkdir(workspaceDir, { recursive: true })
  return {
    rootDir,
    workspaceDir,
    manager: new OpencodeServerManager({ idleTimeoutMs: 0, healthTimeoutMs: 20_000, authMode: 'basic' }),
  }
}

async function cleanupSmokeContext(ctx: SmokeContext): Promise<void> {
  await ctx.manager.stopAll()
  await rm(ctx.rootDir, { recursive: true, force: true })
}

async function runBinarySmoke(ctx: SmokeContext): Promise<Record<string, unknown>> {
  const binary = resolveOpencodeCliPath({
    allowSystemPathFallback: process.env.CODEINSIGHTS_AGENT_OPENCODE_ALLOW_SYSTEM_PATH === '1',
  })
  const version = await detectOpencodeBinaryVersion(binary)
  ctx.binary = {
    path: redactHomePath(version.path),
    source: version.source,
    version: version.version,
  }
  return ctx.binary
}

async function runServerSmoke(ctx: SmokeContext): Promise<Record<string, unknown>> {
  const lease = await ensureSmokeServer(ctx)
  try {
    const health = await lease.client.getHealth()
    const event = await readEventAfterTrigger(lease.client, async () => {
      await lease.client.createSession({ directory: ctx.workspaceDir })
    })
    const basicAuth = await verifyBasicAuthOnLease(lease)
    return {
      endpointHost: '127.0.0.1',
      healthy: health.healthy,
      version: health.version,
      firstEventType: typeof event.type === 'string' ? event.type : 'unknown',
      basicAuth,
    }
  } finally {
    await ctx.manager.stop(lease.entry.key)
  }
}

async function verifyBasicAuthOnLease(lease: SmokeServerLease): Promise<Record<string, unknown>> {
  const unauthClient = createOpencodeClientWrapper({
    baseUrl: lease.entry.endpoint,
    timeoutMs: 5000,
  })
  let unauthStatus = 'unknown'
  try {
    await unauthClient.getHealth()
    unauthStatus = 'unexpected_success'
  } catch (error) {
    unauthStatus = error instanceof OpencodeClientError && error.status === 401
      ? 'rejected_401'
      : 'rejected'
  }
  const authHealth = await lease.client.getHealth()
  return {
    mode: lease.entry.auth ? 'basic' : 'none',
    unauthStatus,
    authenticatedHealthy: authHealth.healthy,
  }
}

async function runConfigSmoke(ctx: SmokeContext): Promise<Record<string, unknown>> {
  const lease = await ensureSmokeServer(ctx)
  try {
    const config = await lease.client.getConfigSummary()
    assertEqual(config.server?.hostname, '127.0.0.1', 'server.hostname')
    assertEqual(config.server?.corsCount, 0, 'server.cors')
    assertEqual(config.share, 'disabled', 'share')
    assertEqual(config.autoupdate, false, 'autoupdate')
    assertEqual(config.permission?.doomLoop, 'deny', 'permission.doom_loop')
    return {
      runtimeConfigHash: lease.runtimeConfigHash,
      authSourceHash: lease.authSourceHash,
      config,
    }
  } finally {
    await ctx.manager.stop(lease.entry.key)
  }
}

async function runPermissionSmoke(ctx: SmokeContext): Promise<Record<string, unknown>> {
  const lease = await ensureSmokeServer(ctx)
  try {
    const config = await lease.client.getConfigSummary()
    assertEqual(config.permission?.doomLoop, 'deny', 'permission.doom_loop')
    assertEqual(config.permission?.externalDirectory, 'ask', 'permission.external_directory')
    if (typeof config.permission?.bashRuleCount !== 'number' || config.permission.bashRuleCount < 1) {
      throw new Error('permission.bash 规则未生效')
    }
    const responseEndpoint = await runPermissionResponseProbe(ctx, lease)
    return {
      permission: config.permission,
      responseEndpoint,
    }
  } finally {
    await ctx.manager.stop(lease.entry.key)
  }
}

async function runPermissionResponseProbe(
  ctx: SmokeContext,
  lease: SmokeServerLease,
): Promise<Record<string, unknown>> {
  const session = await lease.client.createSession({ directory: ctx.workspaceDir })
  const configuredPermissionId = process.env.OPENCODE_SMOKE_PERMISSION_ID?.trim()
  if (configuredPermissionId) {
    const response = parsePermissionResponse(process.env.OPENCODE_SMOKE_PERMISSION_RESPONSE)
    const accepted = await lease.client.respondPermission({
      sessionId: session.id,
      permissionId: configuredPermissionId,
      response,
      directory: ctx.workspaceDir,
    })
    return {
      status: 'passed',
      permissionIdSource: 'env',
      response,
      accepted,
    }
  }

  try {
    await lease.client.respondPermission({
      sessionId: session.id,
      permissionId: 'perm_codeinsights_smoke_missing',
      response: 'reject',
      directory: ctx.workspaceDir,
    })
    return {
      status: 'unexpected_success',
      permissionIdSource: 'synthetic',
    }
  } catch (error) {
    if (error instanceof OpencodeClientError && error.status === 404) {
      return {
        status: 'skipped',
        reason: '无真实 permission request id；synthetic reply endpoint 已返回 404 PermissionNotFound',
        syntheticStatus: 404,
      }
    }
    throw error
  }
}

async function runAbortSmoke(ctx: SmokeContext): Promise<Record<string, unknown>> {
  const lease = await ensureSmokeServer(ctx)
  try {
    const session = await lease.client.createSession({ directory: ctx.workspaceDir })
    await lease.client.promptAsync({
      sessionId: session.id,
      prompt: 'CodeInsights opencode abort smoke no-reply prompt',
      directory: ctx.workspaceDir,
      noReply: true,
    })
    const aborted = await lease.client.abortSession({ sessionId: session.id, directory: ctx.workspaceDir })
    return {
      sessionIdPrefix: session.id.slice(0, 4),
      aborted,
    }
  } finally {
    await ctx.manager.stop(lease.entry.key)
  }
}

async function runResumeSmoke(ctx: SmokeContext): Promise<Record<string, unknown>> {
  const lease = await ensureSmokeServer(ctx)
  try {
    const session = await lease.client.createSession({ directory: ctx.workspaceDir })
    await lease.client.promptAsync({
      sessionId: session.id,
      prompt: 'CodeInsights opencode resume smoke first no-reply prompt',
      directory: ctx.workspaceDir,
      noReply: true,
    })
    await lease.client.promptAsync({
      sessionId: session.id,
      prompt: 'CodeInsights opencode resume smoke second no-reply prompt',
      directory: ctx.workspaceDir,
      noReply: true,
    })
    const messages = await lease.client.listMessages({ sessionId: session.id, directory: ctx.workspaceDir, limit: 10 })
    return {
      sessionIdPrefix: session.id.slice(0, 4),
      messageCount: messages.length,
      reusedSession: true,
    }
  } finally {
    await ctx.manager.stop(lease.entry.key)
  }
}

async function runReadonlySmoke(
  ctx: SmokeContext,
): Promise<{ skipped?: boolean; reason?: string; details?: Record<string, unknown> }> {
  if (process.env.OPENCODE_SMOKE_ENABLE_MODEL !== '1') {
    return { skipped: true, reason: 'OPENCODE_SMOKE_ENABLE_MODEL 未设置，跳过真实模型 readonly prompt' }
  }
  const lease = await ensureSmokeServer(ctx)
  const session = await lease.client.createSession({ directory: ctx.workspaceDir })
  await lease.client.promptAsync({
    sessionId: session.id,
    prompt: '只回复 OK，用于 CodeInsights opencode readonly smoke。',
    directory: ctx.workspaceDir,
  })
  await ctx.manager.stop(lease.entry.key)
  return { details: { sessionIdPrefix: session.id.slice(0, 4), promptAccepted: true } }
}

async function runChannelAuthSmoke(
  ctx: SmokeContext,
): Promise<{ skipped?: boolean; reason?: string; details?: Record<string, unknown> }> {
  const apiKey = process.env.OPENCODE_SMOKE_API_KEY
  if (!apiKey) {
    return { skipped: true, reason: 'OPENCODE_SMOKE_API_KEY 未设置，跳过 channel auth smoke' }
  }
  const auth = createOpencodeAuthState({
    source: 'smoke',
    providerId: 'smoke-openai-compatible',
    baseUrl: process.env.OPENCODE_SMOKE_BASE_URL,
    modelId: process.env.OPENCODE_SMOKE_MODEL_ID,
    apiKey,
  })
  return {
    details: {
      source: auth.redactedSummary.source,
      providerId: auth.redactedSummary.providerId,
      apiKeyFingerprint: auth.redactedSummary.apiKeyFingerprint,
    },
  }
}

async function runNativeAuthSmoke(
  _ctx: SmokeContext,
): Promise<{ skipped?: boolean; reason?: string; details?: Record<string, unknown> }> {
  if (process.env.OPENCODE_SMOKE_ENABLE_NATIVE !== '1') {
    return { skipped: true, reason: 'OPENCODE_SMOKE_ENABLE_NATIVE 未设置，跳过 native auth smoke' }
  }
  return {
    details: {
      source: 'native',
      note: '复用 opencode 原生 auth；本 smoke 不读取 auth 文件内容',
    },
  }
}

async function ensureSmokeServer(
  ctx: SmokeContext,
  manager: OpencodeServerManager = ctx.manager,
): Promise<SmokeServerLease> {
  const binary = resolveOpencodeCliPath({
    allowSystemPathFallback: process.env.CODEINSIGHTS_AGENT_OPENCODE_ALLOW_SYSTEM_PATH === '1',
  })
  const version = await detectOpencodeBinaryVersion(binary)
  ctx.binary = {
    path: redactHomePath(version.path),
    source: version.source,
    version: version.version,
  }
  const auth = createOpencodeAuthState({ source: 'native', modelId: 'anthropic/claude-sonnet-4-5' })
  const mcp = buildOpencodeMcpConfigFromWorkspace({ servers: {} })
  const built = buildOpencodeConfig({
    modelId: 'anthropic/claude-sonnet-4-5',
    agentName: 'build',
    auth: { source: 'native' },
    permissionMode: 'auto',
    mcp: mcp.config,
    opencodeVersion: version.version,
  })
  const written = await writeOpencodeRuntimeConfig({
    rootDir: ctx.workspaceDir,
    built,
  })
  const env = applyOpencodeRuntimeConfigEnv({
    env: mergeOpencodeScopedSecretEnv(buildOpencodeBaseEnv(), {
      ...auth.env,
      ...mcp.env,
    }),
    configPath: written.configPath,
    configDir: written.configDir,
    inlinePolicyContent: written.inlinePolicyContent,
    includeConfigDir: process.env.OPENCODE_SMOKE_ENABLE_CONFIG_DIR === '1',
  })
  const key = createOpencodeServerKey({
    workspaceId: 'smoke',
    workingDirectory: ctx.workspaceDir,
    authSourceHash: auth.authSourceHash,
    runtimeConfigHash: written.runtimeConfigHash,
  })
  const entry = await manager.ensure({
    key,
    binaryPath: version.path,
    cwd: ctx.workspaceDir,
    env,
  })
  return {
    entry,
    client: createOpencodeClientWrapper({
      baseUrl: entry.endpoint,
      auth: entry.auth,
      timeoutMs: 10_000,
    }),
    runtimeConfigHash: written.runtimeConfigHash,
    authSourceHash: auth.authSourceHash,
    configSummary: written.redactedSummary,
  }
}

async function readEventAfterTrigger(
  client: OpencodeClientWrapper,
  trigger: () => Promise<void>,
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  try {
    const stream = await client.subscribeEvents({ signal: controller.signal, maxRetryAttempts: 0 })
    const iterator = stream[Symbol.asyncIterator]()
    const nextEvent = iterator.next()
    await new Promise((resolve) => setTimeout(resolve, 200))
    await trigger()
    const first = await withTimeout(nextEvent, 5000, '等待 opencode server event 超时')
    if (first.done || !first.value) throw new Error('opencode event stream 未返回首包')
    return first.value
  } finally {
    controller.abort()
  }
}

function createSummary(ctx: SmokeContext, results: SmokeResult[]): Record<string, unknown> {
  return {
    tool: 'agent-opencode-smoke',
    status: results.some((result) => result.status === 'failed') ? 'failed' : 'completed',
    opencodeVersion: ctx.binary?.version,
    sdkVersion: OPENCODE_SDK_VERSION,
    binary: ctx.binary,
    artifactRoot: redactHomePath(ctx.rootDir),
    results,
  }
}

function parseSmokeNames(value: string): SmokeName[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is SmokeName => isSmokeName(item))
}

function isSmokeName(value: string): value is SmokeName {
  return (ALL_SMOKES as string[]).includes(value)
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} 期望 ${String(expected)}，实际 ${String(actual)}`)
  }
}

function parsePermissionResponse(value: string | undefined): 'once' | 'always' | 'reject' {
  if (value === 'once' || value === 'always' || value === 'reject') return value
  return 'reject'
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function redactHomePath(path: string): string {
  const home = homedir()
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

function assertSecretlessSummary(summary: string): void {
  const forbidden = [
    process.env.OPENCODE_SMOKE_API_KEY,
    process.env.OPENCODE_SERVER_PASSWORD,
    process.env.CODEINSIGHTS_OPENCODE_CHANNEL_API_KEY,
  ].filter((value): value is string => Boolean(value && value.length >= 4))
  for (const value of forbidden) {
    if (summary.includes(value)) {
      throw new OpencodeClientError('smoke_summary_secret_leak', 'opencode smoke summary 包含 secret')
    }
  }
  if (/Basic\s+[A-Za-z0-9+/=]+/.test(summary) || /Bearer\s+[A-Za-z0-9._~+/=-]+/.test(summary)) {
    throw new OpencodeClientError('smoke_summary_secret_leak', 'opencode smoke summary 包含认证头')
  }
}

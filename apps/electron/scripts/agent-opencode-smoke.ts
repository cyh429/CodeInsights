import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  applyOpencodeRuntimeConfigEnv,
  buildOpencodeBaseEnv,
  buildOpencodeConfig,
  buildOpencodeMcpConfigFromWorkspace,
  createOpencodeMcpStatusSummary,
  createOpencodeAuthState,
  createOpencodeClientWrapper,
  createOpencodeServerKey,
  detectOpencodeBinaryVersion,
  mergeOpencodeScopedSecretEnv,
  OpencodeClientError,
  OpencodeServerManager,
  redactSecretText,
  resolveOpencodeCliPath,
  resolveOpencodePlatformPackage,
  writeOpencodeRuntimeConfig,
  type OpencodeClientWrapper,
  type OpencodeMcpConfigBuildResult,
  type OpencodeServerEntry,
} from '../src/main/lib/opencode-runtime'

type SmokeName =
  | 'binary'
  | 'server'
  | 'config'
  | 'permission'
  | 'abort'
  | 'resume'
  | 'mcp'
  | 'packaged'
  | 'readonly'
  | 'channel'
  | 'native'

type SmokeStatus = 'passed' | 'failed' | 'skipped'

interface SmokeOptions {
  only: Set<SmokeName>
  strict: boolean
  keepArtifacts: boolean
  packagedAppPath?: string
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

const DEFAULT_SMOKES: SmokeName[] = [
  'binary',
  'server',
  'config',
  'permission',
  'abort',
  'resume',
  'mcp',
  'readonly',
  'channel',
  'native',
]

const SUPPORTED_SMOKES: SmokeName[] = [
  ...DEFAULT_SMOKES,
  'packaged',
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
  let packagedAppPath: string | undefined

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
      continue
    }
    if (arg === '--app') {
      const value = args[index + 1]
      if (value) packagedAppPath = resolve(value)
      index += 1
      continue
    }
    if (arg?.startsWith('--app=')) {
      packagedAppPath = resolve(arg.slice('--app='.length))
    }
  }

  return {
    only: only.size > 0 ? only : new Set(DEFAULT_SMOKES),
    strict,
    keepArtifacts,
    ...(packagedAppPath ? { packagedAppPath } : {}),
  }
}

async function runSmoke(options: SmokeOptions, ctx: SmokeContext): Promise<SmokeResult[]> {
  const results: SmokeResult[] = []
  for (const name of SUPPORTED_SMOKES) {
    if (!options.only.has(name)) continue
    results.push(await runSmokeStep(name, ctx, options))
  }
  return results
}

async function runSmokeStep(name: SmokeName, ctx: SmokeContext, options: SmokeOptions): Promise<SmokeResult> {
  const startedAt = Date.now()
  try {
    const details = await runNamedSmoke(name, ctx, options)
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
  options: SmokeOptions,
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
    case 'mcp':
      return { details: await runMcpSmoke(ctx) }
    case 'packaged':
      return { details: await runPackagedSmoke(ctx, options) }
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

async function runMcpSmoke(ctx: SmokeContext): Promise<Record<string, unknown>> {
  const fakeMcpPath = await writeFakeMcpServer(ctx)
  const mcp = buildOpencodeMcpConfigFromWorkspace({
    servers: {
      fake_tools: {
        type: 'stdio',
        command: process.execPath,
        args: [fakeMcpPath],
        env: { CI_MCP_TOKEN: 'codeinsights-mcp-secret' },
        timeout: 5,
        enabled: true,
      },
    },
  })
  const serializedConfig = JSON.stringify(mcp.config)
  if (serializedConfig.includes('codeinsights-mcp-secret')) {
    throw new Error('MCP config 泄露了真实 env secret')
  }

  const lease = await ensureSmokeServer(ctx, ctx.manager, {
    mcp,
    includeConfigDir: process.env.OPENCODE_SMOKE_ENABLE_CONFIG_DIR === '1',
  })
  try {
    const config = await lease.client.getConfigSummary()
    if (!config.mcp.serverNames.includes('fake_tools')) {
      throw new Error('opencode resolved config 未包含 fake_tools MCP')
    }
    const status = await waitForMcpStatus(lease.client, 'fake_tools')
    return {
      configDirEnabled: process.env.OPENCODE_SMOKE_ENABLE_CONFIG_DIR === '1',
      configMcp: config.mcp,
      status,
      skipped: mcp.skipped,
    }
  } finally {
    await ctx.manager.stop(lease.entry.key)
  }
}

async function runPackagedSmoke(ctx: SmokeContext, options: SmokeOptions): Promise<Record<string, unknown>> {
  const appPath = options.packagedAppPath ?? defaultPackagedAppPath()
  const appRoot = resolvePackagedAppRoot(appPath)
  const packagePresence = verifyPackagedOpencodePackages(appRoot)
  const binary = resolveOpencodeCliPath({
    isPackaged: true,
    allowSystemPathFallback: false,
    moduleResolve: createPackagedModuleResolve(appRoot),
    env: { PATH: join(ctx.rootDir, 'path-decoy') },
  })
  if (binary.source !== 'bundled') {
    throw new Error(`packaged opencode binary source 不是 bundled: ${binary.source}`)
  }
  if (!binary.path.startsWith(appRoot)) {
    throw new Error(`packaged opencode binary 不在 app resources 内: ${binary.path}`)
  }
  if (!existsSync(binary.path)) {
    throw new Error(`packaged opencode binary 不存在: ${binary.path}`)
  }
  const version = await detectOpencodeBinaryVersion(binary)
  ctx.binary = {
    path: redactHomePath(version.path),
    source: version.source,
    version: version.version,
  }

  const manager = new OpencodeServerManager({ idleTimeoutMs: 0, healthTimeoutMs: 20_000, authMode: 'basic' })
  const lease = await ensureSmokeServer(ctx, manager, { binaryPath: version.path })
  try {
    const health = await lease.client.getHealth()
    return {
      appRoot: redactHomePath(appRoot),
      binary: ctx.binary,
      packagePresence,
      server: {
        healthy: health.healthy,
        version: health.version,
      },
      pathFallback: 'disabled',
    }
  } finally {
    await manager.stop(lease.entry.key)
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
  options: {
    mcp?: OpencodeMcpConfigBuildResult
    includeConfigDir?: boolean
    binaryPath?: string
  } = {},
): Promise<SmokeServerLease> {
  const version = options.binaryPath
    ? await detectOpencodeBinaryVersion({ path: options.binaryPath, source: 'bundled' })
    : await detectOpencodeBinaryVersion(resolveOpencodeCliPath({
      allowSystemPathFallback: process.env.CODEINSIGHTS_AGENT_OPENCODE_ALLOW_SYSTEM_PATH === '1',
    }))
  ctx.binary = {
    path: redactHomePath(version.path),
    source: version.source,
    version: version.version,
  }
  const auth = createOpencodeAuthState({ source: 'native', modelId: 'anthropic/claude-sonnet-4-5' })
  const mcp = options.mcp ?? buildOpencodeMcpConfigFromWorkspace({ servers: {} })
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
    includeConfigDir: options.includeConfigDir ?? process.env.OPENCODE_SMOKE_ENABLE_CONFIG_DIR === '1',
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
    mcp: createOpencodeMcpStatusSummary(mcp.config, mcp.skipped),
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

async function waitForMcpStatus(
  client: OpencodeClientWrapper,
  expectedName: string,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 10_000
  let latest: Awaited<ReturnType<OpencodeClientWrapper['getMcpStatusSummary']>> | undefined
  while (Date.now() < deadline) {
    latest = await client.getMcpStatusSummary()
    if (latest.serverNames.includes(expectedName) && latest.statuses?.[expectedName] !== undefined) {
      return latest as unknown as Record<string, unknown>
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  }
  if (latest?.serverNames.includes(expectedName)) {
    return latest as unknown as Record<string, unknown>
  }
  throw new Error(`等待 opencode /mcp 状态超时: ${expectedName}`)
}

async function writeFakeMcpServer(ctx: SmokeContext): Promise<string> {
  const serverPath = join(ctx.rootDir, 'fake-mcp-server.mjs')
  await writeFile(serverPath, [
    'process.stdin.setEncoding("utf-8")',
    'let buffer = ""',
    'function send(message) { process.stdout.write(`${JSON.stringify(message)}\\n`) }',
    'process.stdin.on("data", (chunk) => {',
    '  buffer += chunk',
    '  while (buffer.includes("\\n")) {',
    '    const index = buffer.indexOf("\\n")',
    '    const line = buffer.slice(0, index).trim()',
    '    buffer = buffer.slice(index + 1)',
    '    if (!line) continue',
    '    const message = JSON.parse(line)',
    '    if (message.method === "initialize") {',
    '      send({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: message.params?.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "codeinsights-fake-mcp", version: "1.0.0" } } })',
    '    } else if (message.method === "tools/list") {',
    '      send({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "echo", description: "Echo text for CodeInsights smoke", inputSchema: { type: "object", properties: { text: { type: "string" } } } }] } })',
    '    } else if (message.method === "tools/call") {',
    '      send({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "ok" }] } })',
    '    } else if (message.id !== undefined) {',
    '      send({ jsonrpc: "2.0", id: message.id, result: {} })',
    '    }',
    '  }',
    '})',
    'setInterval(() => {}, 1000)',
    '',
  ].join('\n'), 'utf-8')
  return serverPath
}

function defaultPackagedAppPath(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const electronRoot = dirname(scriptDir)
  if (process.platform === 'darwin') {
    const archDir = process.arch === 'arm64' ? 'mac-arm64' : 'mac'
    return join(electronRoot, 'out', archDir, 'CodeInsights.app', 'Contents', 'MacOS', 'CodeInsights')
  }
  if (process.platform === 'win32') {
    return join(electronRoot, 'out', 'win-unpacked', 'CodeInsights.exe')
  }
  return join(electronRoot, 'out', 'linux-unpacked', 'CodeInsights')
}

function resolvePackagedAppRoot(appPath: string): string {
  const resolved = resolve(appPath)
  if (process.platform === 'darwin') {
    const marker = `${join('Contents', 'MacOS')}`
    const markerIndex = resolved.indexOf(marker)
    if (markerIndex >= 0) {
      const bundleRoot = resolved.slice(0, markerIndex)
      return join(bundleRoot, 'Contents', 'Resources', 'app')
    }
    if (resolved.endsWith('.app')) {
      return join(resolved, 'Contents', 'Resources', 'app')
    }
  }
  return join(dirname(resolved), 'resources', 'app')
}

function verifyPackagedOpencodePackages(appRoot: string): Record<string, unknown> {
  const packages = [
    '@opencode-ai/sdk',
    'opencode-ai',
    resolveOpencodePlatformPackage(),
  ]
  const presence: Record<string, string> = {}
  for (const packageName of packages) {
    const packageJsonPath = join(appRoot, 'node_modules', packageName, 'package.json')
    if (!existsSync(packageJsonPath)) {
      throw new Error(`packaged app 缺少 opencode package: ${packageName}`)
    }
    presence[packageName] = redactHomePath(packageJsonPath)
  }
  return presence
}

function createPackagedModuleResolve(appRoot: string): (specifier: string) => string {
  return (specifier: string): string => {
    const packageJsonPath = join(appRoot, 'node_modules', specifier)
    if (existsSync(packageJsonPath)) return packageJsonPath
    throw new Error(`packaged module missing: ${specifier}`)
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
  return (SUPPORTED_SMOKES as string[]).includes(value)
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
    'codeinsights-mcp-secret',
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

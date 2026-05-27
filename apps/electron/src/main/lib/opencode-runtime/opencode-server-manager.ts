import { randomBytes } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer } from 'node:net'
import { redactSecretText, type OpencodeServerAuth } from './opencode-sdk-client'

export type OpencodeServerState =
  | 'idle'
  | 'starting'
  | 'healthy'
  | 'degraded'
  | 'stopping'
  | 'stopped'
  | 'failed'

export interface OpencodeManagedProcess {
  kill(signal?: NodeJS.Signals): boolean
}

export interface OpencodeServerProcessFactoryStartInput {
  binaryPath: string
  args: string[]
  cwd: string
  env: Record<string, string>
}

export interface OpencodeServerProcessFactory {
  start(input: OpencodeServerProcessFactoryStartInput): OpencodeManagedProcess
}

export interface OpencodeHealthCheckInput {
  endpoint: string
  auth: OpencodeServerAuth
}

export interface OpencodeHealthCheckResult {
  healthy: boolean
  version?: string
}

export type OpencodeHealthCheck = (input: OpencodeHealthCheckInput) => Promise<OpencodeHealthCheckResult>

export interface OpencodeServerManagerOptions {
  processFactory?: OpencodeServerProcessFactory
  healthCheck?: OpencodeHealthCheck
  portAllocator?: () => Promise<number>
  randomPassword?: () => string
  healthTimeoutMs?: number
  idleTimeoutMs?: number
}

export interface OpencodeServerEnsureInput {
  key: string
  binaryPath: string
  cwd: string
  env: Record<string, string>
  cleanup?: () => Promise<void>
}

export interface OpencodeServerEntry {
  key: string
  state: Exclude<OpencodeServerState, 'idle'>
  endpoint: string
  port: number
  auth: OpencodeServerAuth
  process: OpencodeManagedProcess
  spawn: OpencodeServerProcessFactoryStartInput
  version?: string
  lastError?: string
  cleanup?: () => Promise<void>
  idleTimer?: ReturnType<typeof setTimeout>
  updatedAt: number
}

export interface OpencodeServerStatus {
  key: string
  state: OpencodeServerState
  endpoint?: string
  version?: string
  lastError?: string
  updatedAt: number
}

export interface CreateOpencodeServerKeyInput {
  workspaceId: string
  workingDirectory: string
  authSourceHash: string
  runtimeConfigHash: string
}

export function createOpencodeServerKey(input: CreateOpencodeServerKeyInput): string {
  return [
    input.workspaceId,
    input.workingDirectory,
    input.authSourceHash,
    input.runtimeConfigHash,
  ].join('\0')
}

export class OpencodeServerManager {
  private readonly processFactory: OpencodeServerProcessFactory
  private readonly healthCheck: OpencodeHealthCheck
  private readonly portAllocator: () => Promise<number>
  private readonly randomPassword: () => string
  private readonly healthTimeoutMs: number
  private readonly idleTimeoutMs: number
  private readonly entries = new Map<string, OpencodeServerEntry>()
  private readonly statuses = new Map<string, OpencodeServerStatus>()
  private readonly ensurePromises = new Map<string, Promise<OpencodeServerEntry>>()

  constructor(options: OpencodeServerManagerOptions = {}) {
    this.processFactory = options.processFactory ?? defaultProcessFactory
    this.healthCheck = options.healthCheck ?? defaultHealthCheck
    this.portAllocator = options.portAllocator ?? allocateFreePort
    this.randomPassword = options.randomPassword ?? randomServerPassword
    this.healthTimeoutMs = options.healthTimeoutMs ?? 5000
    this.idleTimeoutMs = options.idleTimeoutMs ?? 0
  }

  async ensure(input: OpencodeServerEnsureInput): Promise<OpencodeServerEntry> {
    const existing = this.entries.get(input.key)
    if (existing?.state === 'healthy' || existing?.state === 'degraded') {
      this.clearIdleTimer(existing)
      return existing
    }

    const pending = this.ensurePromises.get(input.key)
    if (pending) return await pending

    const promise = this.startServer(input)
    this.ensurePromises.set(input.key, promise)
    try {
      return await promise
    } finally {
      this.ensurePromises.delete(input.key)
    }
  }

  getStatus(key: string): OpencodeServerStatus | undefined {
    return this.statuses.get(key)
  }

  async stop(key: string): Promise<void> {
    const entry = this.entries.get(key)
    if (!entry) {
      const status = this.statuses.get(key)
      if (status) {
        this.statuses.set(key, { ...status, state: 'stopped', updatedAt: Date.now() })
      }
      return
    }

    this.clearIdleTimer(entry)
    entry.state = 'stopping'
    this.statuses.set(key, toStatus(entry))
    entry.process.kill('SIGTERM')
    await entry.cleanup?.()
    entry.state = 'stopped'
    entry.updatedAt = Date.now()
    this.statuses.set(key, toStatus(entry))
    this.entries.delete(key)
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.entries.keys()].map((key) => this.stop(key)))
  }

  release(key: string): void {
    const entry = this.entries.get(key)
    if (!entry || this.idleTimeoutMs <= 0) return
    this.clearIdleTimer(entry)
    entry.idleTimer = setTimeout(() => {
      void this.stop(key)
    }, this.idleTimeoutMs)
  }

  private async startServer(input: OpencodeServerEnsureInput): Promise<OpencodeServerEntry> {
    const port = await this.portAllocator()
    const endpoint = `http://127.0.0.1:${port}`
    const auth: OpencodeServerAuth = {
      username: 'opencode',
      password: this.randomPassword(),
    }
    const args = ['serve', '--hostname', '127.0.0.1', '--port', String(port)]
    const spawnInput: OpencodeServerProcessFactoryStartInput = {
      binaryPath: input.binaryPath,
      args,
      cwd: input.cwd,
      env: {
        ...input.env,
        OPENCODE_SERVER_USERNAME: auth.username,
        OPENCODE_SERVER_PASSWORD: auth.password,
      },
    }

    const process = this.processFactory.start(spawnInput)
    const entry: OpencodeServerEntry = {
      key: input.key,
      state: 'starting',
      endpoint,
      port,
      auth,
      process,
      spawn: spawnInput,
      cleanup: input.cleanup,
      updatedAt: Date.now(),
    }
    this.entries.set(input.key, entry)
    this.statuses.set(input.key, toStatus(entry))

    try {
      const health = await withTimeout(
        this.healthCheck({ endpoint, auth }),
        this.healthTimeoutMs,
        'opencode server health check timeout',
      )
      if (!health.healthy) {
        throw new Error('health check returned unhealthy')
      }
      entry.state = 'healthy'
      entry.version = health.version
      entry.updatedAt = Date.now()
      this.statuses.set(input.key, toStatus(entry))
      return entry
    } catch (error) {
      const message = redactSecretText(error instanceof Error ? error.message : String(error))
      entry.state = 'failed'
      entry.lastError = message
      entry.updatedAt = Date.now()
      this.statuses.set(input.key, toStatus(entry))
      entry.process.kill('SIGTERM')
      await input.cleanup?.()
      this.entries.delete(input.key)
      throw new Error(`opencode server 启动失败: ${message}`)
    }
  }

  private clearIdleTimer(entry: OpencodeServerEntry): void {
    if (!entry.idleTimer) return
    clearTimeout(entry.idleTimer)
    entry.idleTimer = undefined
  }
}

const defaultProcessFactory: OpencodeServerProcessFactory = {
  start(input) {
    return spawn(input.binaryPath, input.args, {
      cwd: input.cwd,
      env: input.env,
      stdio: 'pipe',
      windowsHide: true,
    }) as ChildProcessWithoutNullStreams
  },
}

async function defaultHealthCheck(): Promise<OpencodeHealthCheckResult> {
  throw new Error('opencode healthCheck 尚未配置')
}

function toStatus(entry: OpencodeServerEntry): OpencodeServerStatus {
  return {
    key: entry.key,
    state: entry.state,
    endpoint: entry.endpoint,
    ...(entry.version ? { version: entry.version } : {}),
    ...(entry.lastError ? { lastError: entry.lastError } : {}),
    updatedAt: entry.updatedAt,
  }
}

async function allocateFreePort(): Promise<number> {
  return await new Promise<number>((resolvePromise, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('无法分配 opencode server 端口')))
        return
      }
      const port = address.port
      server.close(() => resolvePromise(port))
    })
  })
}

function randomServerPassword(): string {
  return randomBytes(32).toString('base64url')
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  if (timeoutMs <= 0) return await promise
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

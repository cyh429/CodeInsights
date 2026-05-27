import { describe, expect, test } from 'bun:test'
import {
  OpencodeServerManager,
  createOpencodeServerKey,
  type OpencodeManagedProcess,
  type OpencodeServerProcessFactory,
} from './opencode-server-manager'

class FakeProcess implements OpencodeManagedProcess {
  killed = false
  killSignal?: NodeJS.Signals

  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true
    this.killSignal = signal
    return true
  }
}

describe('opencode-server-manager', () => {
  test('同一 server key 并发 ensure 只启动一次并进入 healthy', async () => {
    let starts = 0
    const process = new FakeProcess()
    const factory: OpencodeServerProcessFactory = {
      start: () => {
        starts += 1
        return process
      },
    }
    const manager = new OpencodeServerManager({
      processFactory: factory,
      healthCheck: async () => ({ healthy: true, version: '1.15.11' }),
      portAllocator: async () => 4101,
      randomPassword: () => 'server-password',
    })
    const key = createOpencodeServerKey({
      workspaceId: 'workspace',
      workingDirectory: '/repo',
      authSourceHash: 'sha256:auth',
      runtimeConfigHash: 'sha256:config',
    })

    const [first, second] = await Promise.all([
      manager.ensure({ key, binaryPath: '/bin/opencode', cwd: '/repo', env: {} }),
      manager.ensure({ key, binaryPath: '/bin/opencode', cwd: '/repo', env: {} }),
    ])

    expect(first).toBe(second)
    expect(starts).toBe(1)
    expect(first.state).toBe('healthy')
    expect(first.endpoint).toBe('http://127.0.0.1:4101')
    expect(first.auth.password).toBe('server-password')
    expect(first.spawn.env.OPENCODE_SERVER_PASSWORD).toBe('server-password')
  })

  test('health 失败时进入 failed 且清理进程', async () => {
    const process = new FakeProcess()
    const manager = new OpencodeServerManager({
      processFactory: { start: () => process },
      healthCheck: async () => {
        throw new Error('boom secret-password')
      },
      portAllocator: async () => 4102,
      randomPassword: () => 'secret-password',
    })
    const key = createOpencodeServerKey({
      workspaceId: 'workspace',
      workingDirectory: '/repo',
      authSourceHash: 'sha256:auth',
      runtimeConfigHash: 'sha256:config',
    })

    await expect(manager.ensure({ key, binaryPath: '/bin/opencode', cwd: '/repo', env: {} })).rejects.toThrow(/opencode server 启动失败/)

    expect(process.killed).toBe(true)
    expect(manager.getStatus(key)).toMatchObject({
      state: 'failed',
      lastError: 'boom [REDACTED]',
    })
  })

  test('stopAll 停止所有 server 并执行 cleanup', async () => {
    let cleaned = 0
    const process = new FakeProcess()
    const manager = new OpencodeServerManager({
      processFactory: { start: () => process },
      healthCheck: async () => ({ healthy: true }),
      portAllocator: async () => 4103,
      randomPassword: () => 'server-password',
    })
    const key = createOpencodeServerKey({
      workspaceId: 'workspace',
      workingDirectory: '/repo',
      authSourceHash: 'sha256:auth',
      runtimeConfigHash: 'sha256:config',
    })

    await manager.ensure({
      key,
      binaryPath: '/bin/opencode',
      cwd: '/repo',
      env: {},
      cleanup: async () => {
        cleaned += 1
      },
    })
    await manager.stopAll()

    expect(process.killed).toBe(true)
    expect(cleaned).toBe(1)
    expect(manager.getStatus(key)?.state).toBe('stopped')
  })

  test('health timeout 会失败并清理进程', async () => {
    const process = new FakeProcess()
    const manager = new OpencodeServerManager({
      processFactory: { start: () => process },
      healthCheck: async () => await new Promise<never>(() => undefined),
      portAllocator: async () => 4104,
      randomPassword: () => 'server-password',
      healthTimeoutMs: 1,
    })
    const key = createOpencodeServerKey({
      workspaceId: 'workspace',
      workingDirectory: '/repo',
      authSourceHash: 'sha256:auth',
      runtimeConfigHash: 'sha256:config',
    })

    await expect(manager.ensure({ key, binaryPath: '/bin/opencode', cwd: '/repo', env: {} })).rejects.toThrow(/health check timeout/)
    expect(process.killed).toBe(true)
  })
})

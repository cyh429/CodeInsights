import { describe, expect, test } from 'bun:test'
import { createAgentSessionRefreshController } from './agent-session-refresh-controller'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('createAgentSessionRefreshController', () => {
  test('会合并突发刷新请求，只执行一次刷新', async () => {
    const calls: Array<{ syncStoppedByUser: boolean; syncTitles: boolean }> = []
    const controller = createAgentSessionRefreshController({
      run: async (options) => {
        calls.push(options)
      },
    })

    controller.schedule({ delayMs: 20 })
    controller.schedule({ delayMs: 20, syncTitles: true })
    controller.schedule({ delayMs: 5, syncStoppedByUser: true })

    await sleep(40)
    controller.dispose()

    expect(calls).toEqual([
      {
        syncStoppedByUser: true,
        syncTitles: true,
      },
    ])
  })

  test('刷新进行中收到新请求时，会在当前刷新结束后串行补跑一次', async () => {
    const calls: Array<{ syncStoppedByUser: boolean; syncTitles: boolean }> = []
    let releaseFirstRun!: () => void
    const firstRunCompleted = new Promise<void>((resolve) => {
      releaseFirstRun = resolve
    })

    const controller = createAgentSessionRefreshController({
      run: async (options) => {
        calls.push(options)
        if (calls.length === 1) {
          await firstRunCompleted
        }
      },
    })

    controller.schedule()
    await sleep(10)
    controller.schedule({ syncTitles: true })
    releaseFirstRun()

    await sleep(20)
    controller.dispose()

    expect(calls).toEqual([
      {
        syncStoppedByUser: false,
        syncTitles: false,
      },
      {
        syncStoppedByUser: false,
        syncTitles: true,
      },
    ])
  })
})

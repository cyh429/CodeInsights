import { describe, expect, test } from 'bun:test'
import { PIPELINE_IPC_CHANNELS } from '@codeinsights/shared'
import { PipelineStreamBus, type PipelineStreamTarget } from './pipeline-stream-bus'

class FakePipelineStreamTarget implements PipelineStreamTarget {
  readonly sent: Array<{ channel: string; payload: unknown }> = []
  private destroyed = false
  private destroyedListeners: Array<() => void> = []
  throwOnSend = false

  constructor(readonly id: number) {}

  isDestroyed(): boolean {
    return this.destroyed
  }

  once(event: 'destroyed', listener: () => void): this {
    if (event === 'destroyed') {
      this.destroyedListeners.push(listener)
    }
    return this
  }

  removeListener(event: 'destroyed', listener: () => void): this {
    if (event === 'destroyed') {
      this.destroyedListeners = this.destroyedListeners.filter((item) => item !== listener)
    }
    return this
  }

  destroyedListenerCount(): number {
    return this.destroyedListeners.length
  }

  send(channel: string, payload: unknown): void {
    if (this.throwOnSend) {
      throw new Error('target send failed')
    }

    this.sent.push({ channel, payload })
  }

  destroy(): void {
    this.destroyed = true
    for (const listener of this.destroyedListeners) {
      listener()
    }
  }
}

describe('PipelineStreamBus', () => {
  test('会把 Pipeline stream 广播给所有当前订阅者', () => {
    const bus = new PipelineStreamBus()
    const first = new FakePipelineStreamTarget(1)
    const second = new FakePipelineStreamTarget(2)

    bus.subscribe(first)
    bus.subscribe(second)
    bus.createCallbacks().onEvent?.({
      sessionId: 'session-1',
      event: {
        type: 'node_start',
        node: 'explorer',
        createdAt: 1,
      },
    })

    expect(first.sent).toEqual([{
      channel: PIPELINE_IPC_CHANNELS.STREAM_EVENT,
      payload: {
        sessionId: 'session-1',
        event: {
          type: 'node_start',
          node: 'explorer',
          createdAt: 1,
        },
      },
    }])
    expect(second.sent).toHaveLength(1)
  })

  test('取消订阅或窗口销毁后不会继续发送 stream', () => {
    const bus = new PipelineStreamBus()
    const first = new FakePipelineStreamTarget(1)
    const second = new FakePipelineStreamTarget(2)

    bus.subscribe(first)
    bus.subscribe(second)
    bus.unsubscribe(first.id)
    second.destroy()

    bus.createCallbacks().onError?.({
      sessionId: 'session-1',
      error: 'boom',
    })

    expect(first.sent).toHaveLength(0)
    expect(second.sent).toHaveLength(0)
    expect(bus.size()).toBe(0)
  })

  test('重复订阅不会累积 destroyed listener，发送失败会移除订阅者', () => {
    const bus = new PipelineStreamBus()
    const target = new FakePipelineStreamTarget(1)
    const originalWarn = console.warn

    try {
      console.warn = () => undefined
      bus.subscribe(target)
      bus.subscribe(target)
      expect(target.destroyedListenerCount()).toBe(1)

      target.throwOnSend = true
      bus.createCallbacks().onComplete?.({
        sessionId: 'session-1',
        state: {
          sessionId: 'session-1',
          currentNode: 'tester',
          status: 'completed',
          reviewIteration: 0,
          pendingGate: null,
          updatedAt: 1,
        },
      })

      expect(bus.size()).toBe(0)
    } finally {
      console.warn = originalWarn
    }
  })
})

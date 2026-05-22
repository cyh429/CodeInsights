import { PIPELINE_IPC_CHANNELS } from '@codeinsights/shared'
import type {
  PipelineStreamCompletePayload,
  PipelineStreamErrorPayload,
  PipelineStreamPayload,
} from '@codeinsights/shared'
import type { PipelineServiceCallbacks } from './pipeline-service'

export interface PipelineStreamTarget {
  id: number
  isDestroyed(): boolean
  send(channel: string, payload: unknown): void
  once(event: 'destroyed', listener: () => void): this
  removeListener?(event: 'destroyed', listener: () => void): this
}

export class PipelineStreamBus {
  private readonly subscribers = new Map<number, PipelineStreamTarget>()
  private readonly cleanupListeners = new Map<number, () => void>()

  subscribe(target: PipelineStreamTarget): void {
    if (target.isDestroyed()) return

    this.unsubscribe(target.id)

    const cleanup = () => {
      this.unsubscribe(target.id)
    }
    this.subscribers.set(target.id, target)
    this.cleanupListeners.set(target.id, cleanup)
    target.once('destroyed', cleanup)
  }

  unsubscribe(targetId: number): void {
    const target = this.subscribers.get(targetId)
    const cleanup = this.cleanupListeners.get(targetId)
    if (target && cleanup) {
      target.removeListener?.('destroyed', cleanup)
    }

    this.subscribers.delete(targetId)
    this.cleanupListeners.delete(targetId)
  }

  size(): number {
    return this.subscribers.size
  }

  createCallbacks(): PipelineServiceCallbacks {
    return {
      onEvent: (payload) => this.broadcast(PIPELINE_IPC_CHANNELS.STREAM_EVENT, payload),
      onComplete: (payload) => this.broadcast(PIPELINE_IPC_CHANNELS.STREAM_COMPLETE, payload),
      onError: (payload) => this.broadcast(PIPELINE_IPC_CHANNELS.STREAM_ERROR, payload),
    }
  }

  broadcast(
    channel: typeof PIPELINE_IPC_CHANNELS.STREAM_EVENT,
    payload: PipelineStreamPayload,
  ): void
  broadcast(
    channel: typeof PIPELINE_IPC_CHANNELS.STREAM_COMPLETE,
    payload: PipelineStreamCompletePayload,
  ): void
  broadcast(
    channel: typeof PIPELINE_IPC_CHANNELS.STREAM_ERROR,
    payload: PipelineStreamErrorPayload,
  ): void
  broadcast(channel: string, payload: unknown): void {
    for (const [targetId, target] of this.subscribers.entries()) {
      if (target.isDestroyed()) {
        this.unsubscribe(targetId)
        continue
      }

      try {
        target.send(channel, payload)
      } catch (error) {
        console.warn('[PipelineStreamBus] stream 广播失败，已移除订阅者:', error)
        this.unsubscribe(targetId)
      }
    }
  }
}

export const pipelineStreamBus = new PipelineStreamBus()

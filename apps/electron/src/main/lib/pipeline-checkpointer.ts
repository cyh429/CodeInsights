import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunnableConfig } from '@langchain/core/runnables'
import { MemorySaver } from '@langchain/langgraph'
import type {
  Checkpoint,
  CheckpointMetadata,
} from '@langchain/langgraph'
import {
  getPipelineCheckpointsDir,
  getPipelineSessionCheckpointDir,
} from './config-paths'

interface PersistedMemorySaverState {
  storage: unknown
  writes: unknown
}

type CheckpointPendingWrite = [string, unknown]

function encodeValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return {
      __type: 'uint8array',
      data: Array.from(value),
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => encodeValue(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, encodeValue(item)]),
    )
  }

  return value
}

function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => decodeValue(item))
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.__type === 'uint8array' && Array.isArray(record.data)) {
      return new Uint8Array(record.data as number[])
    }

    return Object.fromEntries(
      Object.entries(record).map(([key, item]) => [key, decodeValue(item)]),
    )
  }

  return value
}

function resolveThreadId(config: RunnableConfig): string | undefined {
  const threadId = config.configurable?.thread_id
  return typeof threadId === 'string' && threadId.length > 0 ? threadId : undefined
}

export class PipelineCheckpointer extends MemorySaver {
  private readonly baseDir: string
  private readonly corruptedThreadIds = new Set<string>()

  constructor(baseDir = getPipelineCheckpointsDir()) {
    super()
    this.baseDir = baseDir
    this.loadAll()
  }

  private loadAll(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true })
      return
    }

    for (const entry of readdirSync(this.baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const filePath = join(this.baseDir, entry.name, 'memory-saver.json')
      if (!existsSync(filePath)) continue

      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as PersistedMemorySaverState
        Object.assign(this.storage, decodeValue(parsed.storage))
        Object.assign(this.writes, decodeValue(parsed.writes))
      } catch (error) {
        this.corruptedThreadIds.add(entry.name)
        console.warn(`[Pipeline Checkpointer] 读取 ${filePath} 失败:`, error)
      }
    }
  }

  private persistThread(threadId: string): void {
    const threadDir = getPipelineSessionCheckpointDir(threadId)
    const filePath = join(threadDir, 'memory-saver.json')
    const payload: PersistedMemorySaverState = {
      storage: encodeValue({
        [threadId]: this.storage[threadId],
      }),
      writes: encodeValue({
        [threadId]: this.writes[threadId],
      }),
    }
    writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
  }

  override async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    const result = await super.put(config, checkpoint, metadata)
    const threadId = resolveThreadId(config)
    if (threadId) {
      this.persistThread(threadId)
    }
    return result
  }

  override async putWrites(
    config: RunnableConfig,
    writes: CheckpointPendingWrite[],
    taskId: string,
  ): Promise<void> {
    await super.putWrites(config, writes, taskId)
    const threadId = resolveThreadId(config)
    if (threadId) {
      this.persistThread(threadId)
    }
  }

  override async deleteThread(threadId: string): Promise<void> {
    await super.deleteThread(threadId)
    this.corruptedThreadIds.delete(threadId)
    rmSync(getPipelineSessionCheckpointDir(threadId), {
      recursive: true,
      force: true,
    })
  }

  hasCorruptedThread(threadId: string): boolean {
    return this.corruptedThreadIds.has(threadId)
  }
}

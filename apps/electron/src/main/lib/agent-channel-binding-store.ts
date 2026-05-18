import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { readJsonFileSafe, writeJsonFileAtomic } from './safe-file'
import { getAgentChannelBindingEventsPath, getAgentChannelBindingsPath } from './config-paths'
import type { AgentChannelType } from './agent-channel'

export interface AgentChannelSessionBinding {
  id: string
  channelType: AgentChannelType
  channelId: string
  targetId: string
  sessionId: string
  workspaceId?: string
  modelId?: string
  mode: 'agent' | 'chat'
  createdAt: number
  updatedAt: number
  metadata?: Record<string, string>
}

export interface AgentChannelBindingEvent {
  type: 'upserted' | 'removed'
  bindingId: string
  channelType: AgentChannelType
  channelId: string
  targetId: string
  sessionId?: string
  createdAt: string
}

interface AgentChannelBindingIndex {
  version: number
  bindings: AgentChannelSessionBinding[]
}

export interface UpsertAgentChannelBindingInput {
  channelType: AgentChannelType
  channelId: string
  targetId: string
  sessionId: string
  workspaceId?: string
  modelId?: string
  mode: 'agent' | 'chat'
  metadata?: Record<string, string>
}

const INDEX_VERSION = 1

export class FileAgentChannelBindingStore {
  constructor(
    private readonly indexPath = getAgentChannelBindingsPath(),
    private readonly eventsPath = getAgentChannelBindingEventsPath(),
  ) {}

  list(): AgentChannelSessionBinding[] {
    return this.readIndex().bindings
  }

  findByTarget(channelType: AgentChannelType, channelId: string, targetId: string): AgentChannelSessionBinding | undefined {
    return this.list().find((binding) => (
      binding.channelType === channelType
      && binding.channelId === channelId
      && binding.targetId === targetId
    ))
  }

  findBySession(sessionId: string): AgentChannelSessionBinding[] {
    return this.list().filter((binding) => binding.sessionId === sessionId)
  }

  upsert(input: UpsertAgentChannelBindingInput): AgentChannelSessionBinding {
    const index = this.readIndex()
    const now = Date.now()
    const existingIndex = index.bindings.findIndex((binding) => (
      binding.channelType === input.channelType
      && binding.channelId === input.channelId
      && binding.targetId === input.targetId
    ))

    const binding: AgentChannelSessionBinding = existingIndex >= 0
      ? {
          ...index.bindings[existingIndex]!,
          sessionId: input.sessionId,
          workspaceId: input.workspaceId,
          modelId: input.modelId,
          mode: input.mode,
          metadata: input.metadata,
          updatedAt: now,
        }
      : {
          id: randomUUID(),
          channelType: input.channelType,
          channelId: input.channelId,
          targetId: input.targetId,
          sessionId: input.sessionId,
          workspaceId: input.workspaceId,
          modelId: input.modelId,
          mode: input.mode,
          metadata: input.metadata,
          createdAt: now,
          updatedAt: now,
        }

    if (existingIndex >= 0) index.bindings[existingIndex] = binding
    else index.bindings.push(binding)

    this.writeIndex(index)
    this.appendEvent({
      type: 'upserted',
      bindingId: binding.id,
      channelType: binding.channelType,
      channelId: binding.channelId,
      targetId: binding.targetId,
      sessionId: binding.sessionId,
      createdAt: new Date(now).toISOString(),
    })
    return binding
  }

  remove(bindingId: string): boolean {
    const index = this.readIndex()
    const binding = index.bindings.find((item) => item.id === bindingId)
    if (!binding) return false
    index.bindings = index.bindings.filter((item) => item.id !== bindingId)
    this.writeIndex(index)
    this.appendEvent({
      type: 'removed',
      bindingId,
      channelType: binding.channelType,
      channelId: binding.channelId,
      targetId: binding.targetId,
      sessionId: binding.sessionId,
      createdAt: new Date().toISOString(),
    })
    return true
  }

  private readIndex(): AgentChannelBindingIndex {
    return readJsonFileSafe<AgentChannelBindingIndex>(this.indexPath) ?? {
      version: INDEX_VERSION,
      bindings: [],
    }
  }

  private writeIndex(index: AgentChannelBindingIndex): void {
    mkdirSync(dirname(this.indexPath), { recursive: true })
    writeJsonFileAtomic(this.indexPath, index)
  }

  private appendEvent(event: AgentChannelBindingEvent): void {
    mkdirSync(dirname(this.eventsPath), { recursive: true })
    appendFileSync(this.eventsPath, `${JSON.stringify(event)}\n`, 'utf-8')
  }
}

export const agentChannelBindingStore = new FileAgentChannelBindingStore()

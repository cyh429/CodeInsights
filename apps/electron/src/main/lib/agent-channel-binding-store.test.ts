import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'bun:test'
import { FileAgentChannelBindingStore } from './agent-channel-binding-store'

describe('FileAgentChannelBindingStore', () => {
  test('upserts channel binding to JSON index and JSONL event log', () => {
    const dir = mkdtempSync(join(tmpdir(), 'codeinsights-channel-store-'))
    const store = new FileAgentChannelBindingStore(
      join(dir, 'bindings.json'),
      join(dir, 'bindings.events.jsonl'),
    )

    const first = store.upsert({
      channelType: 'feishu',
      channelId: 'bot-a',
      targetId: 'chat-a',
      sessionId: 'session-a',
      workspaceId: 'workspace-a',
      modelId: 'model-a',
      mode: 'agent',
      metadata: { chatType: 'group' },
    })
    const second = store.upsert({
      channelType: 'feishu',
      channelId: 'bot-a',
      targetId: 'chat-a',
      sessionId: 'session-b',
      workspaceId: 'workspace-b',
      modelId: 'model-b',
      mode: 'agent',
    })

    expect(second.id).toBe(first.id)
    expect(store.list()).toHaveLength(1)
    expect(store.findByTarget('feishu', 'bot-a', 'chat-a')?.sessionId).toBe('session-b')
    expect(store.findBySession('session-b')).toHaveLength(1)

    const events = readFileSync(join(dir, 'bindings.events.jsonl'), 'utf-8').trim().split('\n')
    expect(events).toHaveLength(2)
    expect(JSON.parse(events[0]!) as { type: string }).toMatchObject({ type: 'upserted' })
  })

  test('removes binding and appends audit event', () => {
    const dir = mkdtempSync(join(tmpdir(), 'codeinsights-channel-store-'))
    const store = new FileAgentChannelBindingStore(
      join(dir, 'bindings.json'),
      join(dir, 'bindings.events.jsonl'),
    )

    const binding = store.upsert({
      channelType: 'electron',
      channelId: 'desktop',
      targetId: 'window-1',
      sessionId: 'session-a',
      mode: 'agent',
    })

    expect(store.remove(binding.id)).toBe(true)
    expect(store.list()).toHaveLength(0)

    const events = readFileSync(join(dir, 'bindings.events.jsonl'), 'utf-8').trim().split('\n')
    expect(JSON.parse(events[1]!) as { type: string }).toMatchObject({ type: 'removed' })
  })
})

import type { AgentRuntimeUsagePayload, AgentStreamEnvelope, SDKMessage, SDKUserMessage } from '@codeinsights/shared'

export type RuntimeTranscriptItem =
  | RuntimeTranscriptUserItem
  | RuntimeTranscriptAssistantItem
  | RuntimeTranscriptToolItem
  | RuntimeTranscriptStatusItem

export interface RuntimeTranscriptUserItem {
  kind: 'user'
  id: string
  text: string
  createdAt?: number
}

export interface RuntimeTranscriptAssistantItem {
  kind: 'assistant'
  id: string
  text: string
  createdAt?: number
}

export interface RuntimeTranscriptToolItem {
  kind: 'tool'
  id: string
  name: string
  inputSummary: string
  outputSummary?: string
  status: 'running' | 'success' | 'error' | 'denied' | 'stopped'
  createdAt?: number
}

export interface RuntimeTranscriptStatusItem {
  kind: 'status'
  id: string
  tone: 'neutral' | 'danger' | 'stopped'
  text: string
  usage?: AgentRuntimeUsagePayload
  createdAt?: number
}

export interface RuntimeTranscriptSelection {
  items: RuntimeTranscriptItem[]
  hasRuntimeEvents: boolean
  terminal?: RuntimeTranscriptStatusItem
}

export interface SelectRuntimeTranscriptInput {
  runtimeEvents: AgentStreamEnvelope[]
  sdkMessages: SDKMessage[]
  liveMessages?: SDKMessage[]
}

interface UserMessageView {
  id: string
  text: string
  createdAt?: number
}

export function selectRuntimeTranscript(input: SelectRuntimeTranscriptInput): RuntimeTranscriptSelection {
  const envelopes = input.runtimeEvents.slice()
  const users = extractUserMessages([...(input.sdkMessages ?? []), ...(input.liveMessages ?? [])])
  const items: RuntimeTranscriptItem[] = []
  const assistantItems = new Map<string, RuntimeTranscriptAssistantItem>()
  const toolItems = new Map<string, RuntimeTranscriptToolItem>()
  let userIndex = 0
  let lastRunId: string | null = null
  let terminal: RuntimeTranscriptStatusItem | undefined

  for (const envelope of envelopes) {
    if (envelope.runId !== lastRunId) {
      lastRunId = envelope.runId
      const user = users[userIndex]
      if (user) {
        items.push({ kind: 'user', ...user })
        userIndex += 1
      }
    }

    const createdAt = parseEnvelopeCreatedAt(envelope)
    const event = envelope.event

    if (event.type === 'assistant_delta') {
      const existing = assistantItems.get(event.messageId)
      if (existing) {
        existing.text += event.delta
      } else {
        const item: RuntimeTranscriptAssistantItem = {
          kind: 'assistant',
          id: event.messageId,
          text: event.delta,
          createdAt,
        }
        assistantItems.set(event.messageId, item)
        items.push(item)
      }
      continue
    }

    if (event.type === 'assistant_message') {
      const text = event.contentBlocks.map(extractRuntimeBlockText).join('')
      const existing = assistantItems.get(event.messageId)
      if (existing) {
        existing.text = text || existing.text
      } else {
        const item: RuntimeTranscriptAssistantItem = {
          kind: 'assistant',
          id: event.messageId,
          text,
          createdAt,
        }
        assistantItems.set(event.messageId, item)
        items.push(item)
      }
      continue
    }

    if (event.type === 'tool_started') {
      const existing = toolItems.get(event.toolCallId)
      if (existing) {
        existing.name = event.name
        existing.inputSummary = event.inputSummary
        existing.status = 'running'
      } else {
        const item: RuntimeTranscriptToolItem = {
          kind: 'tool',
          id: event.toolCallId,
          name: event.name,
          inputSummary: event.inputSummary,
          status: 'running',
          createdAt,
        }
        toolItems.set(event.toolCallId, item)
        items.push(item)
      }
      continue
    }

    if (event.type === 'tool_completed') {
      const existing = toolItems.get(event.toolCallId)
      if (existing) {
        existing.status = event.status
        existing.outputSummary = event.outputSummary
      } else {
        const item: RuntimeTranscriptToolItem = {
          kind: 'tool',
          id: event.toolCallId,
          name: event.toolCallId,
          inputSummary: '',
          outputSummary: event.outputSummary,
          status: event.status,
          createdAt,
        }
        toolItems.set(event.toolCallId, item)
        items.push(item)
      }
      continue
    }

    if (event.type === 'run_failed') {
      terminal = {
        kind: 'status',
        id: `${envelope.runId}:failed:${envelope.sequence}`,
        tone: 'danger',
        text: event.error.message,
        createdAt,
      }
      items.push(terminal)
      continue
    }

    if (event.type === 'run_stopped') {
      terminal = {
        kind: 'status',
        id: `${envelope.runId}:stopped:${envelope.sequence}`,
        tone: 'stopped',
        text: event.stoppedBy === 'user' ? '已由用户停止' : '运行已停止',
        createdAt,
      }
      items.push(terminal)
      continue
    }

    if (event.type === 'run_completed') {
      terminal = {
        kind: 'status',
        id: `${envelope.runId}:completed:${envelope.sequence}`,
        tone: 'neutral',
        text: '运行完成',
        usage: event.usage,
        createdAt,
      }
    }
  }

  while (userIndex < users.length) {
    const user = users[userIndex]
    if (user) items.push({ kind: 'user', ...user })
    userIndex += 1
  }

  return {
    items: items.filter((item) => item.kind !== 'assistant' || item.text.trim().length > 0),
    hasRuntimeEvents: envelopes.length > 0,
    terminal,
  }
}

function extractUserMessages(messages: SDKMessage[]): UserMessageView[] {
  const seen = new Set<string>()
  const users: UserMessageView[] = []

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (!message) continue
    if (message.type !== 'user') continue
    const userMessage = message as SDKUserMessage
    if (userMessage.isSynthetic) continue
    const text = extractUserText(userMessage)
    if (!text.trim()) continue
    const id = userMessage.uuid ?? `user-${index}-${text.slice(0, 24)}`
    if (seen.has(id)) continue
    seen.add(id)
    users.push({
      id,
      text,
      createdAt: extractCreatedAt(userMessage),
    })
  }

  return users
}

function extractUserText(message: SDKUserMessage): string {
  const content = message.message?.content ?? []
  return content
    .filter((block) => block.type === 'text' && typeof (block as { text?: unknown }).text === 'string')
    .map((block) => (block as { text: string }).text)
    .join('\n')
}

function extractCreatedAt(message: SDKMessage): number | undefined {
  const value = (message as { _createdAt?: unknown })._createdAt
  return typeof value === 'number' ? value : undefined
}

function parseEnvelopeCreatedAt(envelope: AgentStreamEnvelope): number | undefined {
  const value = Date.parse(envelope.createdAt)
  return Number.isNaN(value) ? undefined : value
}

function extractRuntimeBlockText(block: unknown): string {
  if (typeof block === 'string') return block
  if (typeof block === 'object' && block !== null && 'text' in block) {
    const text = (block as { text?: unknown }).text
    return typeof text === 'string' ? text : ''
  }
  return ''
}

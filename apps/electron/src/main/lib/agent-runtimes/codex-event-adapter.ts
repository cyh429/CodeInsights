import {
  createAgentStreamEnvelope,
  isAgentRuntimeTerminalEvent,
  validateAgentStreamEnvelope,
  type AgentEventSource,
  type AgentRuntimeEvent,
  type AgentRuntimeUsagePayload,
  type AgentStreamEnvelope,
} from '@codeinsights/shared'
import type {
  AgentMessageItem,
  CommandExecutionItem,
  ErrorItem,
  FileChangeItem,
  McpToolCallItem,
  ReasoningItem,
  ThreadEvent,
  ThreadItem,
  TodoListItem,
  Usage,
  WebSearchItem,
} from '@openai/codex-sdk'

type CodexEventPhase = 'started' | 'updated' | 'completed'
type CodexEventSource = Extract<AgentEventSource, 'codex_sdk' | 'codex_cli'>

interface TextUpdate {
  changed: boolean
  appendOnly: boolean
  value: string
}

interface TodoTaskState {
  text: string
  completed: boolean
  completedEventWritten: boolean
}

export interface CodexEventAdapterContext {
  sessionId: string
  runId: string
  initialThreadId?: string
  source?: CodexEventSource
  createdAt?: () => string
  nextSequence?: () => number
}

export const CODEX_THREAD_ITEM_MAPPINGS = {
  agent_message: 'assistant_message',
  reasoning: 'agent_task',
  command_execution: 'Bash',
  file_change: 'PatchApply',
  mcp_tool_call: 'server.tool',
  web_search: 'WebSearch',
  todo_list: 'agent_task',
  error: 'tool_error',
} satisfies Record<ThreadItem['type'], string>

export class CodexEventAdapter {
  private sequence = 0
  private terminalWritten = false
  private threadId: string | undefined
  private readonly startedItems = new Set<string>()
  private readonly completedItems = new Set<string>()
  private readonly textByItemId = new Map<string, string>()
  private readonly outputByItemId = new Map<string, string>()
  private readonly todoTasks = new Map<string, TodoTaskState>()

  constructor(private readonly context: CodexEventAdapterContext) {
    this.threadId = context.initialThreadId
  }

  adapt(event: ThreadEvent): AgentStreamEnvelope[] {
    if (this.terminalWritten) return []
    const runtimeEvents = this.adaptToRuntimeEvents(event)
    if (runtimeEvents.some(isAgentRuntimeTerminalEvent)) {
      this.terminalWritten = true
    }
    return runtimeEvents
      .map((runtimeEvent) => this.createEnvelope(runtimeEvent))
      .filter((envelope): envelope is AgentStreamEnvelope => envelope !== null)
  }

  private adaptToRuntimeEvents(event: ThreadEvent): AgentRuntimeEvent[] {
    switch (event.type) {
      case 'thread.started':
        return this.adaptThreadStarted(event.thread_id)
      case 'turn.started':
        return []
      case 'turn.completed':
        return this.adaptTurnCompleted(event.usage)
      case 'turn.failed':
        return [createRunFailed('codex_turn_failed', 'Codex 回合执行失败', event.error.message)]
      case 'error':
        if (isTransientCodexStreamError(event.message)) {
          return this.adaptTransientStreamError(event.message)
        }
        return [createRunFailed('codex_stream_error', 'Codex 流式事件失败', event.message)]
      case 'item.started':
        return this.adaptItem('started', event.item)
      case 'item.updated':
        return this.adaptItem('updated', event.item)
      case 'item.completed':
        return this.adaptItem('completed', event.item)
      default:
        return assertNever(event)
    }
  }

  private adaptThreadStarted(threadId: string): AgentRuntimeEvent[] {
    if (this.threadId === threadId) return []
    this.threadId = threadId
    return [{ type: 'sdk_session', sdkSessionId: threadId }]
  }

  private adaptTurnCompleted(usage: Usage): AgentRuntimeEvent[] {
    const adaptedUsage = adaptUsage(usage)
    return [
      { type: 'usage_updated', usage: adaptedUsage },
      {
        type: 'run_completed',
        resultSubtype: 'success',
        terminalReason: 'completed',
        usage: adaptedUsage,
        sdkSessionId: this.threadId,
      },
    ]
  }

  private adaptItem(phase: CodexEventPhase, item: ThreadItem): AgentRuntimeEvent[] {
    if (phase === 'completed' && this.completedItems.has(item.id)) return []

    const events = this.adaptItemByType(phase, item)
    if (phase === 'completed') {
      this.completedItems.add(item.id)
    }
    return events
  }

  private adaptItemByType(phase: CodexEventPhase, item: ThreadItem): AgentRuntimeEvent[] {
    switch (item.type) {
      case 'agent_message':
        return this.adaptAgentMessage(phase, item)
      case 'reasoning':
        return this.adaptReasoning(phase, item)
      case 'command_execution':
        return this.adaptCommandExecution(phase, item)
      case 'file_change':
        return this.adaptFileChange(phase, item)
      case 'mcp_tool_call':
        return this.adaptMcpToolCall(phase, item)
      case 'web_search':
        return this.adaptWebSearch(phase, item)
      case 'todo_list':
        return this.adaptTodoList(phase, item)
      case 'error':
        return this.adaptErrorItem(phase, item)
      default:
        return assertNever(item)
    }
  }

  private adaptAgentMessage(phase: CodexEventPhase, item: AgentMessageItem): AgentRuntimeEvent[] {
    if (phase === 'completed' && !this.textByItemId.has(item.id)) {
      this.textByItemId.set(item.id, item.text)
      return [{
        type: 'assistant_message',
        messageId: item.id,
        contentBlocks: [{ type: 'text', text: item.text }],
        status: 'complete',
      }]
    }

    const events = this.createTextEvents(item.id, item.text)
    if (phase === 'completed') {
      events.push({
        type: 'assistant_message',
        messageId: item.id,
        contentBlocks: [{ type: 'text', text: item.text }],
        status: 'complete',
      })
    }
    return events
  }

  private adaptReasoning(phase: CodexEventPhase, item: ReasoningItem): AgentRuntimeEvent[] {
    const events = this.ensureTaskStarted(item.id, 'Codex reasoning')
    const update = this.updateText(item.id, item.text)
    if (update.changed) {
      events.push({
        type: 'agent_task_progress',
        taskId: item.id,
        message: update.value,
      })
    }
    if (phase === 'completed') {
      events.push({
        type: 'agent_task_completed',
        taskId: item.id,
        status: 'completed',
        summary: item.text,
      })
    }
    return events
  }

  private adaptCommandExecution(phase: CodexEventPhase, item: CommandExecutionItem): AgentRuntimeEvent[] {
    const events = this.ensureToolStarted(item.id, 'Bash', safeStringify({ command: item.command }), 'normal')
    const outputUpdate = this.updateOutput(item.id, item.aggregated_output)
    if (outputUpdate.changed && outputUpdate.value.length > 0 && phase !== 'completed') {
      events.push({
        type: 'tool_progress',
        toolCallId: item.id,
        message: outputUpdate.value,
      })
    }
    if (phase === 'completed') {
      if (outputUpdate.changed && outputUpdate.value.length > 0) {
        events.push({
          type: 'tool_progress',
          toolCallId: item.id,
          message: outputUpdate.value,
        })
      }
      events.push({
        type: 'tool_completed',
        toolCallId: item.id,
        status: commandSucceeded(item) ? 'success' : 'error',
        outputSummary: summarizeCommand(item),
      })
    }
    return events
  }

  private adaptFileChange(phase: CodexEventPhase, item: FileChangeItem): AgentRuntimeEvent[] {
    const inputSummary = safeStringify({ changes: item.changes })
    const events = this.ensureToolStarted(item.id, 'PatchApply', inputSummary, 'normal')
    if (phase !== 'completed') {
      events.push({
        type: 'tool_progress',
        toolCallId: item.id,
        message: summarizeFileChanges(item),
      })
      return events
    }
    events.push({
      type: 'tool_completed',
      toolCallId: item.id,
      status: item.status === 'completed' ? 'success' : 'error',
      outputSummary: summarizeFileChanges(item),
    })
    return events
  }

  private adaptMcpToolCall(phase: CodexEventPhase, item: McpToolCallItem): AgentRuntimeEvent[] {
    const toolName = `${item.server}.${item.tool}`
    const events = this.ensureToolStarted(item.id, toolName, safeStringify(item.arguments), 'normal')
    if (phase !== 'completed') {
      if (phase === 'updated') {
        events.push({
          type: 'tool_progress',
          toolCallId: item.id,
          message: `${toolName} 执行中`,
        })
      }
      return events
    }
    events.push({
      type: 'tool_completed',
      toolCallId: item.id,
      status: item.status === 'completed' ? 'success' : 'error',
      outputSummary: summarizeMcpToolCall(item),
    })
    return events
  }

  private adaptWebSearch(phase: CodexEventPhase, item: WebSearchItem): AgentRuntimeEvent[] {
    const events = this.ensureToolStarted(item.id, 'WebSearch', safeStringify({ query: item.query }), 'normal')
    if (phase === 'completed') {
      events.push({
        type: 'tool_completed',
        toolCallId: item.id,
        status: 'success',
        outputSummary: `query: ${item.query}`,
      })
    }
    return events
  }

  private adaptTodoList(phase: CodexEventPhase, item: TodoListItem): AgentRuntimeEvent[] {
    const events: AgentRuntimeEvent[] = []

    item.items.forEach((todo, index) => {
      const taskId = `${item.id}:${index}`
      const existing = this.todoTasks.get(taskId)
      if (!existing) {
        events.push({ type: 'agent_task_started', taskId, description: todo.text })
      }

      const state: TodoTaskState = existing ?? {
        text: todo.text,
        completed: false,
        completedEventWritten: false,
      }
      const changed = state.text !== todo.text || state.completed !== todo.completed || phase !== 'started'
      if (changed) {
        events.push({
          type: 'agent_task_progress',
          taskId,
          message: `${todo.completed ? '已完成' : '待处理'}: ${todo.text}`,
        })
      }
      if (todo.completed && !state.completedEventWritten) {
        events.push({
          type: 'agent_task_completed',
          taskId,
          status: 'completed',
          summary: todo.text,
        })
        state.completedEventWritten = true
      }
      state.text = todo.text
      state.completed = todo.completed
      this.todoTasks.set(taskId, state)
    })

    if (phase === 'completed') {
      for (const [taskId, state] of this.todoTasks.entries()) {
        if (!taskId.startsWith(`${item.id}:`) || state.completedEventWritten) continue
        events.push({
          type: 'agent_task_completed',
          taskId,
          status: 'stopped',
          summary: state.text,
        })
        state.completedEventWritten = true
      }
    }
    return events
  }

  private adaptTransientStreamError(message: string): AgentRuntimeEvent[] {
    return [
      ...this.ensureTaskStarted('codex-stream-reconnect', 'Codex stream reconnect'),
      {
        type: 'agent_task_progress',
        taskId: 'codex-stream-reconnect',
        message,
      },
    ]
  }

  private adaptErrorItem(phase: CodexEventPhase, item: ErrorItem): AgentRuntimeEvent[] {
    const events = this.ensureToolStarted(item.id, 'CodexError', item.message, 'normal')
    if (phase === 'completed') {
      events.push({
        type: 'tool_completed',
        toolCallId: item.id,
        status: 'error',
        outputSummary: item.message,
      })
    }
    return events
  }

  private ensureToolStarted(
    toolCallId: string,
    name: string,
    inputSummary: string,
    riskLevel: Extract<AgentRuntimeEvent, { type: 'tool_started' }>['riskLevel'],
  ): AgentRuntimeEvent[] {
    if (this.startedItems.has(toolCallId)) return []
    this.startedItems.add(toolCallId)
    return [{
      type: 'tool_started',
      toolCallId,
      name,
      inputSummary,
      riskLevel,
    }]
  }

  private ensureTaskStarted(taskId: string, description: string): AgentRuntimeEvent[] {
    if (this.startedItems.has(taskId)) return []
    this.startedItems.add(taskId)
    return [{ type: 'agent_task_started', taskId, description }]
  }

  private createTextEvents(messageId: string, text: string): AgentRuntimeEvent[] {
    const update = this.updateText(messageId, text)
    if (!update.changed) return []
    if (update.appendOnly) {
      return [{ type: 'assistant_delta', messageId, delta: update.value }]
    }
    return [{
      type: 'assistant_message',
      messageId,
      contentBlocks: [{ type: 'text', text }],
      status: 'complete',
    }]
  }

  private updateText(itemId: string, nextText: string): TextUpdate {
    return updateTextMap(this.textByItemId, itemId, nextText)
  }

  private updateOutput(itemId: string, nextOutput: string): TextUpdate {
    return updateTextMap(this.outputByItemId, itemId, nextOutput)
  }

  private createEnvelope(event: AgentRuntimeEvent): AgentStreamEnvelope | null {
    const envelope = createAgentStreamEnvelope({
      sessionId: this.context.sessionId,
      runId: this.context.runId,
      sequence: this.context.nextSequence?.() ?? this.sequence++,
      createdAt: this.context.createdAt?.(),
      source: this.context.source ?? 'codex_sdk',
      event,
    })
    const validation = validateAgentStreamEnvelope(envelope)
    if (!validation.ok) {
      console.warn(`[Codex EventAdapter] envelope 校验失败，已跳过: ${validation.errors.join('; ')}`)
      return null
    }
    return envelope
  }
}

function isTransientCodexStreamError(message: string): boolean {
  return /^Reconnecting\.\.\.\s+\d+\/\d+/i.test(message.trim())
}

function updateTextMap(values: Map<string, string>, itemId: string, nextText: string): TextUpdate {
  const previous = values.get(itemId) ?? ''
  values.set(itemId, nextText)
  if (previous === nextText) {
    return { changed: false, appendOnly: true, value: '' }
  }
  if (nextText.startsWith(previous)) {
    return { changed: true, appendOnly: true, value: nextText.slice(previous.length) }
  }
  return { changed: true, appendOnly: false, value: nextText }
}

function adaptUsage(usage: Usage): AgentRuntimeUsagePayload {
  return {
    inputTokens: usage.input_tokens,
    cacheReadTokens: usage.cached_input_tokens,
    outputTokens: usage.output_tokens,
    reasoningOutputTokens: usage.reasoning_output_tokens,
  }
}

function createRunFailed(code: string, title: string, message: string): AgentRuntimeEvent {
  return {
    type: 'run_failed',
    recoverable: false,
    error: {
      code,
      title,
      message,
      retryable: false,
    },
  }
}

function commandSucceeded(item: CommandExecutionItem): boolean {
  return item.status === 'completed' && (item.exit_code === undefined || item.exit_code === 0)
}

function summarizeCommand(item: CommandExecutionItem): string {
  return [
    `command: ${item.command}`,
    `status: ${item.status}`,
    `exit_code=${item.exit_code ?? 'unknown'}`,
    item.aggregated_output,
  ].filter((line) => line.length > 0).join('\n')
}

function summarizeFileChanges(item: FileChangeItem): string {
  return item.changes.map((change) => `${change.kind} ${change.path}`).join('\n')
}

function summarizeMcpToolCall(item: McpToolCallItem): string {
  if (item.status === 'failed') {
    return item.error?.message ?? 'MCP tool call failed'
  }
  if (!item.result) return 'MCP tool call completed'
  const content = item.result.content.map(summarizeUnknown).join('\n')
  const structured = summarizeUnknown(item.result.structured_content)
  return [content, structured].filter((part) => part.length > 0 && part !== 'null').join('\n')
}

function summarizeUnknown(value: unknown): string {
  if (typeof value === 'string') return value
  if (isRecord(value) && typeof value.text === 'string') return value.text
  return safeStringify(value)
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function assertNever(value: never): never {
  throw new Error(`未支持的 Codex event/item: ${safeStringify(value)}`)
}

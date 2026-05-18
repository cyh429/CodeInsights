import { randomUUID } from 'node:crypto'
import type { AgentRuntimeEvent, AgentStreamEnvelope, SDKMessage } from '@rv-insights/shared'
import type { ClaudeAgentQueryOptions } from './adapters/claude-agent-adapter'
import { shouldKeepChannelOpen } from './adapters/claude-agent-adapter'
import type { PermissionResult } from './agent-permission-service'
import { createRuntimeEnvelope, convertSdkMessageToRuntimeEnvelopes } from './agent-sdk-message-converter'
import { prepareSdkMessageForAccumulation, prepareSdkMessagesForPersistence } from './agent-orchestrator/sdk-message-persistence'
import type {
  AgentRuntimeRunInput,
  AgentRuntimeRunner,
  AgentRuntimeRunnerDeps,
} from './agent-runtime-types'

interface SideEnvelopeQueue {
  push(envelope: AgentStreamEnvelope): void
  shift(): AgentStreamEnvelope | undefined
}

export class InProcessAgentRuntimeRunner implements AgentRuntimeRunner {
  constructor(private readonly deps: AgentRuntimeRunnerDeps) {}

  async *run(input: AgentRuntimeRunInput): AsyncIterable<AgentStreamEnvelope> {
    const runId = this.deps.createRunId?.() ?? randomUUID()
    let nextSequenceValue = 0
    let terminalWritten = false
    let sdkSessionId = input.resumeFrom
    const accumulatedMessages: SDKMessage[] = []
    const queryStartedAt = Date.now()
    const sideQueue = createSideEnvelopeQueue()

    const nextSequence = (): number => {
      const sequence = nextSequenceValue
      nextSequenceValue += 1
      return sequence
    }
    const makeEnvelope = (event: AgentRuntimeEvent, source: Parameters<typeof createRuntimeEnvelope>[1]): AgentStreamEnvelope | null => {
      if (isTerminalEvent(event)) {
        if (terminalWritten) return null
        terminalWritten = true
      }
      return createRuntimeEnvelope(event, source, {
        sessionId: input.sessionId,
        runId,
        nextSequence,
        createdAt: this.deps.now,
      })
    }
    const pushSideEvent = (event: AgentRuntimeEvent, source: Parameters<typeof createRuntimeEnvelope>[1]): void => {
      const envelope = makeEnvelope(event, source)
      if (envelope) sideQueue.push(envelope)
    }

    const runStarted = makeEnvelope({
      type: 'run_started',
      model: input.model,
      cwd: input.cwd,
      permissionMode: input.permissionMode,
      runtimeHash: input.runtimeHash ?? 'in-process-runner',
    }, 'runtime_service')
    if (runStarted) yield runStarted

    if (input.resumeFrom) {
      const resumeEnvelope = makeEnvelope({ type: 'sdk_session', sdkSessionId: input.resumeFrom, resumeFrom: input.resumeFrom }, 'runtime_service')
      if (resumeEnvelope) yield resumeEnvelope
    }

    const queryOptions = this.buildQueryOptions(input, {
      onSdkSession: (capturedSessionId) => {
        sdkSessionId = capturedSessionId
        pushSideEvent({ type: 'sdk_session', sdkSessionId: capturedSessionId, resumeFrom: input.resumeFrom }, 'claude_sdk')
      },
      pushSideEvent,
    })

    try {
      for await (const rawMessage of this.deps.query(queryOptions)) {
        for (const sideEnvelope of drainSideQueue(sideQueue)) yield sideEnvelope
        if (input.abortSignal?.aborted) {
          const stoppedEnvelope = makeEnvelope({ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' }, 'runtime_service')
          if (stoppedEnvelope) yield stoppedEnvelope
          return
        }

        const message = prepareSdkMessageForAccumulation(rawMessage, { channelModelId: input.channelModelId }) ?? rawMessage
        if (message.type === 'assistant' || message.type === 'user' || message.type === 'result' || message.type === 'system') {
          const accumulationMessage = prepareSdkMessageForAccumulation(message, { channelModelId: input.channelModelId })
          if (accumulationMessage) accumulatedMessages.push(accumulationMessage)
        }

        const envelopes = convertSdkMessageToRuntimeEnvelopes(message, {
          sessionId: input.sessionId,
          runId,
          nextSequence,
          source: 'claude_sdk',
          createdAt: this.deps.now,
        }).filter((envelope) => {
          if (!isTerminalEvent(envelope.event)) return true
          if (terminalWritten) return false
          terminalWritten = true
          return true
        })

        for (const envelope of envelopes) yield envelope

        if (message.type === 'result') {
          await this.flushMessages(input.sessionId, accumulatedMessages, Date.now() - queryStartedAt)
          if (!shouldKeepChannelOpen((message as { terminal_reason?: string }).terminal_reason)) {
            for (const sideEnvelope of drainSideQueue(sideQueue)) yield sideEnvelope
          }
        }
      }

      await this.flushMessages(input.sessionId, accumulatedMessages, Date.now() - queryStartedAt)
      for (const sideEnvelope of drainSideQueue(sideQueue)) yield sideEnvelope
      if (input.abortSignal?.aborted && !terminalWritten) {
        const stoppedEnvelope = makeEnvelope({ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' }, 'runtime_service')
        if (stoppedEnvelope) yield stoppedEnvelope
        return
      }
      if (!terminalWritten) {
        const completeEnvelope = makeEnvelope({
          type: 'run_completed',
          resultSubtype: 'success',
          terminalReason: 'completed',
          usage: {},
          sdkSessionId,
        }, 'runtime_service')
        if (completeEnvelope) yield completeEnvelope
      }
    } catch (error) {
      await this.flushMessages(input.sessionId, accumulatedMessages, Date.now() - queryStartedAt)
      for (const sideEnvelope of drainSideQueue(sideQueue)) yield sideEnvelope
      const failedEnvelope = makeEnvelope({
        type: 'run_failed',
        error: {
          code: 'runtime_error',
          title: 'Agent 运行失败',
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
        },
        recoverable: false,
      }, 'runtime_service')
      if (failedEnvelope) yield failedEnvelope
    }
  }

  private buildQueryOptions(
    input: AgentRuntimeRunInput,
    hooks: {
      onSdkSession: (sdkSessionId: string) => void
      pushSideEvent: (event: AgentRuntimeEvent, source: Parameters<typeof createRuntimeEnvelope>[1]) => void
    },
  ): ClaudeAgentQueryOptions {
    const originalCanUseTool = input.queryOptions.canUseTool
    const originalOnSessionId = input.queryOptions.onSessionId
    const originalPrompt = input.queryOptions.prompt

    return {
      ...input.queryOptions,
      prompt: originalPrompt || input.prompt,
      onSessionId: (sdkSessionId) => {
        originalOnSessionId?.(sdkSessionId)
        hooks.onSdkSession(sdkSessionId)
      },
      ...(this.deps.interactions?.requestPermission || this.deps.interactions?.askUser || originalCanUseTool ? {
        canUseTool: async (toolName, toolInput, options): Promise<PermissionResult> => {
          if (toolName === 'AskUserQuestion' && this.deps.interactions?.askUser) {
            const requestId = randomUUID()
            hooks.pushSideEvent({
              type: 'ask_user_requested',
              requestId,
              prompt: summarizeAskUserPrompt(toolInput),
            }, 'ask_user_service')
            const decision = await this.deps.interactions.askUser({
              sessionId: input.sessionId,
              requestId,
              toolInput,
              signal: options.signal,
            })
            hooks.pushSideEvent({
              type: 'ask_user_resolved',
              requestId,
              response: decision.response,
              answeredBy: decision.result.behavior === 'allow' ? 'user' : 'system',
            }, 'ask_user_service')
            return decision.result
          }
          if (!this.deps.interactions?.requestPermission) {
            if (!originalCanUseTool) return { behavior: 'deny', message: 'Runner 未配置权限回调' }
            return originalCanUseTool(toolName, toolInput, options)
          }
          const requestId = randomUUID()
          hooks.pushSideEvent({
            type: 'permission_requested',
            requestId,
            toolName,
            riskLevel: 'normal',
            inputSummary: JSON.stringify(toolInput),
            scopeOptions: ['once', 'session'],
          }, 'permission_service')
          const decision = await this.deps.interactions.requestPermission({
            sessionId: input.sessionId,
            requestId,
            toolName,
            toolInput,
            options,
          })
          hooks.pushSideEvent({
            type: 'permission_resolved',
            requestId,
            decision: decision.result.behavior === 'allow' ? 'allowed' : 'denied',
            decidedBy: 'user',
            scope: decision.scope,
          }, 'permission_service')
          return decision.result
        },
      } : {}),
    }
  }

  private async flushMessages(sessionId: string, messages: SDKMessage[], durationMs: number): Promise<void> {
    if (messages.length === 0) return
    const toPersist = prepareSdkMessagesForPersistence(messages, { durationMs })
    messages.length = 0
    if (toPersist.length === 0) return
    await this.deps.store.appendMessages(sessionId, toPersist)
  }
}

function createSideEnvelopeQueue(): SideEnvelopeQueue {
  const queue: AgentStreamEnvelope[] = []
  return {
    push: (envelope) => queue.push(envelope),
    shift: () => queue.shift(),
  }
}

function drainSideQueue(queue: SideEnvelopeQueue): AgentStreamEnvelope[] {
  const drained: AgentStreamEnvelope[] = []
  let next = queue.shift()
  while (next) {
    drained.push(next)
    next = queue.shift()
  }
  return drained
}

function isTerminalEvent(event: AgentRuntimeEvent): boolean {
  return event.type === 'run_completed' || event.type === 'run_failed' || event.type === 'run_stopped'
}

function summarizeAskUserPrompt(input: Record<string, unknown>): string {
  const questions = input.questions
  if (Array.isArray(questions)) {
    return questions
      .map((question) => {
        if (typeof question === 'string') return question
        if (question && typeof question === 'object' && 'question' in question && typeof question.question === 'string') {
          return question.question
        }
        return JSON.stringify(question)
      })
      .join('\n')
  }
  return JSON.stringify(input)
}

import { randomUUID } from 'node:crypto'
import type { AgentRuntimeEvent, AgentStreamEnvelope, SDKAssistantMessage, SDKMessage } from '@rv-insights/shared'
import type { ClaudeAgentQueryOptions } from './adapters/claude-agent-adapter'
import { extractErrorDetails, friendlyErrorMessage, isPromptTooLongError, mapSDKErrorToTypedError, shouldKeepChannelOpen } from './adapters/claude-agent-adapter'
import type { PermissionResult } from './agent-permission-service'
import { createRuntimeEnvelope, convertSdkMessageToRuntimeEnvelopes } from './agent-sdk-message-converter'
import { prepareSdkMessageForAccumulation, prepareSdkMessagesForPersistence } from './agent-orchestrator/sdk-message-persistence'
import { isAutoRetryableCatchError, isAutoRetryableTypedError } from './agent-orchestrator/retryable-error-classifier'
import { TeamsCoordinator } from './agent-orchestrator/teams-coordinator'
import {
  createCatchErrorSDKMessage,
  createRetryExhaustedSDKMessage,
  createTypedErrorSDKMessage,
} from './agent-orchestrator/agent-error-message'
import type {
  AgentRuntimeRunInput,
  AgentRuntimeRunner,
  AgentRuntimeRunnerDeps,
} from './agent-runtime-types'

const MAX_AUTO_RETRIES = 8
const RETRY_MAX_DELAY_MS = 10_000
const WATCHDOG_INTERVAL_MS = 5_000

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
    const teamsCoordinator = this.deps.createTeamsCoordinator?.(input.resumeFrom)
      ?? new TeamsCoordinator(input.resumeFrom, this.deps.teamsCoordinatorDeps)
    let lastRetryableError: string | undefined
    let retrySucceeded = false
    let deferredResultMessage: SDKMessage | null = null

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
        teamsCoordinator.setCapturedSdkSessionId(capturedSessionId)
        pushSideEvent({ type: 'sdk_session', sdkSessionId: capturedSessionId, resumeFrom: input.resumeFrom }, 'claude_sdk')
      },
      pushSideEvent,
    })

    try {
      for (let attempt = 1; attempt <= MAX_AUTO_RETRIES + 1; attempt += 1) {
        if (attempt > 1) {
          const delayMs = this.deps.retryDelayMs?.(attempt - 1) ?? getRetryDelayMs(attempt - 1)
          const retryReason = lastRetryableError ?? '未知错误'
          const scheduledEnvelope = makeEnvelope({
            type: 'retry_scheduled',
            attempt: attempt - 1,
            maxAttempts: MAX_AUTO_RETRIES,
            reason: retryReason,
            delayMs,
          }, 'runtime_service')
          if (scheduledEnvelope) yield scheduledEnvelope
          const attemptEnvelope = makeEnvelope({
            type: 'retry_attempt',
            attemptData: {
              attempt: attempt - 1,
              timestamp: Date.now(),
              reason: retryReason,
              errorMessage: retryReason,
              delaySeconds: delayMs / 1000,
            },
          }, 'runtime_service')
          if (attemptEnvelope) yield attemptEnvelope
          await timerWithAbort(delayMs, input.abortSignal)
          if (input.abortSignal?.aborted) {
            const stoppedEnvelope = makeEnvelope({ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' }, 'runtime_service')
            if (stoppedEnvelope) yield stoppedEnvelope
            return
          }
        }

        let shouldRetry = false
        let shouldStopForRetryExhausted = false

        try {
          const queryIterator = this.deps.query(queryOptions)[Symbol.asyncIterator]()
          let pendingNext: Promise<IteratorResult<SDKMessage>> | null = null

          while (true) {
            if (!pendingNext) pendingNext = queryIterator.next()

            const raceResult = await Promise.race([
              pendingNext.then((result) => ({ kind: 'event' as const, result })),
              timerWithAbort(this.deps.watchdogIntervalMs ?? WATCHDOG_INTERVAL_MS, input.abortSignal)
                .then(() => ({ kind: 'watchdog_tick' as const })),
            ])

            if (raceResult.kind === 'watchdog_tick') {
              if (input.abortSignal?.aborted) {
                const stoppedEnvelope = makeEnvelope({ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' }, 'runtime_service')
                if (stoppedEnvelope) yield stoppedEnvelope
                return
              }
              if (teamsCoordinator.shouldCheckWorkerIdle() && await teamsCoordinator.areWorkersIdle()) {
                pendingNext.catch(() => {})
                pendingNext = null
                await Promise.race([
                  queryIterator.return?.(undefined as never) ?? Promise.resolve(),
                  new Promise<void>((resolve) => setTimeout(resolve, 1000)),
                ])
                break
              }
              continue
            }

            pendingNext = null
            if (raceResult.result.done) break

            for (const sideEnvelope of drainSideQueue(sideQueue)) yield sideEnvelope
            if (input.abortSignal?.aborted) {
              const stoppedEnvelope = makeEnvelope({ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' }, 'runtime_service')
              if (stoppedEnvelope) yield stoppedEnvelope
              return
            }

            const rawMessage = raceResult.result.value
            const message = prepareSdkMessageForAccumulation(rawMessage, { channelModelId: input.channelModelId }) ?? rawMessage
            const typedErrorResult = this.classifyAssistantTypedError(message, attempt)
            if (typedErrorResult?.kind === 'retry') {
              await this.flushMessages(input.sessionId, accumulatedMessages, Date.now() - queryStartedAt)
              lastRetryableError = typedErrorResult.reason
              shouldRetry = true
              break
            }
            if (typedErrorResult?.kind === 'retry_exhausted') {
              await this.flushMessages(input.sessionId, accumulatedMessages, Date.now() - queryStartedAt)
              shouldStopForRetryExhausted = true
              break
            }
            if (typedErrorResult?.kind === 'fatal') {
              await this.flushMessages(input.sessionId, accumulatedMessages, Date.now() - queryStartedAt)
              const errorMessage = createTypedErrorSDKMessage(typedErrorResult.error)
              await this.persistAndEmit(input.sessionId, [errorMessage])
              const failedEnvelope = makeEnvelope({
                type: 'run_failed',
                error: {
                  code: typedErrorResult.error.code,
                  title: typedErrorResult.error.title,
                  message: typedErrorResult.error.message,
                  retryable: typedErrorResult.error.canRetry,
                  details: typedErrorResult.error.details,
                  originalError: typedErrorResult.error.originalError,
                },
                recoverable: typedErrorResult.error.canRetry,
              }, 'runtime_service')
              if (failedEnvelope) yield failedEnvelope
              return
            }

            if (message.type === 'assistant' || message.type === 'user' || message.type === 'result' || message.type === 'system') {
              const accumulationMessage = prepareSdkMessageForAccumulation(message, { channelModelId: input.channelModelId })
              if (accumulationMessage) accumulatedMessages.push(accumulationMessage)
            }

            if (message.type === 'system') {
              teamsCoordinator.recordSystemMessage(message as Parameters<TeamsCoordinator['recordSystemMessage']>[0])
            }

            if (message.type === 'result' && teamsCoordinator.shouldDeferResultMessage()) {
              deferredResultMessage = message
              await this.flushMessages(input.sessionId, accumulatedMessages, Date.now() - queryStartedAt)
              continue
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
            this.emitSdkMessage(input.sessionId, message)

            if (message.type === 'result') {
              await this.flushMessages(input.sessionId, accumulatedMessages, Date.now() - queryStartedAt)
              if (!shouldKeepChannelOpen((message as { terminal_reason?: string }).terminal_reason)) {
                for (const sideEnvelope of drainSideQueue(sideQueue)) yield sideEnvelope
              }
            }
          }

          if (shouldRetry) continue
          if (shouldStopForRetryExhausted) break

      await this.flushMessages(input.sessionId, accumulatedMessages, Date.now() - queryStartedAt)
      for (const sideEnvelope of drainSideQueue(sideQueue)) yield sideEnvelope
      if (input.abortSignal?.aborted && !terminalWritten) {
        const stoppedEnvelope = makeEnvelope({ type: 'run_stopped', reason: 'user_abort', stoppedBy: 'user' }, 'runtime_service')
        if (stoppedEnvelope) yield stoppedEnvelope
        return
      }
      if (teamsCoordinator.hasAutoResumeContext()) {
        const resumePromptResult = await teamsCoordinator.buildResumePrompt()
        if (resumePromptResult.prompt && sdkSessionId) {
          this.deps.onTeamsWaitingResume?.(input.sessionId, '正在收集 teammate 工作结果...')
          const resumeMessageId = randomUUID()
          this.deps.onTeamsResumeStart?.(input.sessionId, resumeMessageId)
          const resumeMessages = await teamsCoordinator.runResumeQuery({
            adapter: { query: this.deps.query, abort: () => {}, dispose: () => {} },
            baseQueryOptions: queryOptions,
            prompt: resumePromptResult.prompt,
            resumeSessionId: sdkSessionId,
            sessionId: input.sessionId,
            isSessionActive: () => !input.abortSignal?.aborted,
            emitSdkMessage: (message) => this.emitSdkMessage(input.sessionId, message),
          })
          if (resumeMessages.length > 0) {
            await this.flushMessages(input.sessionId, resumeMessages, Date.now() - queryStartedAt)
          }
        }
      }
      if (deferredResultMessage) {
        this.emitSdkMessage(input.sessionId, deferredResultMessage)
        deferredResultMessage = null
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
          if (attempt > 1) {
            const retryClearedEnvelope = makeEnvelope({ type: 'retry_cleared' }, 'runtime_service')
            if (retryClearedEnvelope) yield retryClearedEnvelope
          }
          retrySucceeded = true
          break
        } catch (error) {
          await this.flushMessages(input.sessionId, accumulatedMessages, Date.now() - queryStartedAt)
          const errorMessage = error instanceof Error ? error.message : String(error)
          const isRetryable = isAutoRetryableCatchError(null, errorMessage, '')
          if (isRetryable && attempt <= MAX_AUTO_RETRIES) {
            lastRetryableError = errorMessage || '未知错误'
            continue
          }
          if (isRetryable && attempt > MAX_AUTO_RETRIES && lastRetryableError) {
            break
          }
          throw error
        }
      }

      if (!retrySucceeded && lastRetryableError && !terminalWritten) {
        const failedAttemptEnvelope = makeEnvelope({
          type: 'retry_failed',
          attemptData: {
            attempt: MAX_AUTO_RETRIES,
            timestamp: Date.now(),
            reason: lastRetryableError,
            errorMessage: `重试 ${MAX_AUTO_RETRIES} 次后仍然失败`,
            delaySeconds: 0,
          },
        }, 'runtime_service')
        if (failedAttemptEnvelope) yield failedAttemptEnvelope
        const retryErrorMessage = createRetryExhaustedSDKMessage({
          maxAttempts: MAX_AUTO_RETRIES,
          lastRetryableError,
        })
        await this.persistAndEmit(input.sessionId, [retryErrorMessage])
        const failedEnvelope = makeEnvelope({
          type: 'run_failed',
          error: {
            code: 'retry_exhausted',
            title: 'Agent 重试失败',
            message: `重试 ${MAX_AUTO_RETRIES} 次后仍然失败: ${lastRetryableError}`,
            retryable: true,
          },
          recoverable: true,
        }, 'runtime_service')
        if (failedEnvelope) yield failedEnvelope
      }
    } catch (error) {
      await this.flushMessages(input.sessionId, accumulatedMessages, Date.now() - queryStartedAt)
      for (const sideEnvelope of drainSideQueue(sideQueue)) yield sideEnvelope
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isPromptTooLong = isPromptTooLongError(errorMessage, error instanceof Error ? (error.stack ?? error.message) : String(error))
      const sdkErrorMessage = createCatchErrorSDKMessage({
        userFacingError: friendlyErrorMessage(errorMessage),
        isPromptTooLong,
      })
      await this.persistAndEmit(input.sessionId, [sdkErrorMessage])
      const failedEnvelope = makeEnvelope({
        type: 'run_failed',
        error: {
          code: isPromptTooLong ? 'prompt_too_long' : 'runtime_error',
          title: 'Agent 运行失败',
          message: friendlyErrorMessage(errorMessage),
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

  private async persistAndEmit(sessionId: string, messages: SDKMessage[]): Promise<void> {
    await this.deps.store.appendMessages(sessionId, messages)
    for (const message of messages) this.emitSdkMessage(sessionId, message)
  }

  private emitSdkMessage(sessionId: string, message: SDKMessage): void {
    this.deps.onSdkMessage?.(sessionId, message)
  }

  private classifyAssistantTypedError(
    message: SDKMessage,
    attempt: number,
  ):
    | { kind: 'retry'; reason: string }
    | { kind: 'retry_exhausted' }
    | { kind: 'fatal'; error: ReturnType<typeof mapSDKErrorToTypedError> }
    | null {
    if (message.type !== 'assistant') return null
    const assistantMessage = message as SDKAssistantMessage
    if (!assistantMessage.error) return null

    const { detailedMessage, originalError } = extractErrorDetails(assistantMessage as unknown as Parameters<typeof extractErrorDetails>[0])
    let errorCode = assistantMessage.error.errorType || 'unknown_error'
    if (isPromptTooLongError(detailedMessage, originalError)) {
      errorCode = 'prompt_too_long'
    }
    const typedError = mapSDKErrorToTypedError(errorCode, friendlyErrorMessage(detailedMessage), originalError)
    if (isAutoRetryableTypedError(typedError) && attempt <= MAX_AUTO_RETRIES) {
      return {
        kind: 'retry',
        reason: typedError.title ? `${typedError.title}: ${typedError.message}` : typedError.message,
      }
    }
    if (isAutoRetryableTypedError(typedError) && attempt > MAX_AUTO_RETRIES) {
      return { kind: 'retry_exhausted' }
    }
    return { kind: 'fatal', error: typedError }
  }
}

function getRetryDelayMs(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt - 1), RETRY_MAX_DELAY_MS)
  const jitter = base * (Math.random() * 0.4 - 0.2)
  return Math.max(0, Math.round(base + jitter))
}

function timerWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) { resolve(); return }
    const tid = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(tid); resolve() }, { once: true })
  })
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

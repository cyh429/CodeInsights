import type { AgentProviderAdapter, SDKMessage, SDKSystemMessage } from '@codeinsights/shared'
import type { ClaudeAgentQueryOptions } from '../adapters/claude-agent-adapter'
import {
  findTeamLeadInboxPath,
  pollInboxWithRetry,
  markInboxAsRead,
  formatInboxPrompt,
  formatSummaryFallbackPrompt,
  areAllWorkersIdle,
  INBOX_RETRY_CONFIG,
  type TaskNotificationSummary,
} from '../agent-team-reader'

export interface TeamLeadInboxInfo {
  teamName: string
  inboxPath: string
}

export interface TeamInboxMessage {
  from: string
  text: string
  summary?: string
  timestamp?: string
  read?: boolean
}

export interface TeamInboxRetryConfig {
  maxAttempts: number
  delayMs: number
}

export interface TeamsResumePromptResult {
  prompt: string | null
  source: 'inbox' | 'summary' | null
  teamName?: string
  inboxMessageCount: number
  summaryCount: number
}

export interface TeamsResumeQueryInput {
  adapter: AgentProviderAdapter
  baseQueryOptions: ClaudeAgentQueryOptions
  prompt: string
  resumeSessionId: string
  sessionId: string
  isSessionActive: (sessionId: string) => boolean
  emitSdkMessage: (message: SDKMessage) => void
}

export interface TeamsCoordinatorDeps {
  findTeamLeadInboxPath?: (sdkSessionId: string) => Promise<TeamLeadInboxInfo | null>
  pollInboxWithRetry?: (inboxPath: string, config: TeamInboxRetryConfig) => Promise<TeamInboxMessage[]>
  markInboxAsRead?: (inboxPath: string) => Promise<void>
  formatInboxPrompt?: (messages: TeamInboxMessage[]) => string
  formatSummaryFallbackPrompt?: (summaries: TaskNotificationSummary[]) => string
  areAllWorkersIdle?: (sdkSessionId: string, startedCount: number) => Promise<boolean>
  inboxRetryConfig?: TeamInboxRetryConfig
}

/**
 * Agent Teams 轻量协调器
 *
 * 负责记录 task 状态、判断 Watchdog 是否需要检查、构造 auto-resume prompt，
 * 并封装 resume query 的执行边界。消息持久化仍由 AgentOrchestrator 统一处理。
 */
export class TeamsCoordinator {
  private capturedSdkSessionId: string | undefined
  private readonly startedTaskIds = new Set<string>()
  private readonly completedTaskIds = new Set<string>()
  private readonly taskNotificationSummaries: TaskNotificationSummary[] = []
  private readonly deps: TeamsCoordinatorDeps

  constructor(initialSdkSessionId?: string, deps: TeamsCoordinatorDeps = {}) {
    this.capturedSdkSessionId = initialSdkSessionId
    this.deps = deps
  }

  get sdkSessionId(): string | undefined {
    return this.capturedSdkSessionId
  }

  get startedTaskCount(): number {
    return this.startedTaskIds.size
  }

  get summaryCount(): number {
    return this.taskNotificationSummaries.length
  }

  setCapturedSdkSessionId(sdkSessionId: string): void {
    this.capturedSdkSessionId = sdkSessionId
  }

  hasStartedTasks(): boolean {
    return this.startedTaskIds.size > 0
  }

  hasAutoResumeContext(): boolean {
    return this.startedTaskIds.size > 0 && !!this.capturedSdkSessionId
  }

  shouldDeferResultMessage(): boolean {
    return this.hasStartedTasks()
  }

  shouldCheckWorkerIdle(): boolean {
    return (
      this.startedTaskIds.size > 0 &&
      this.completedTaskIds.size < this.startedTaskIds.size &&
      !!this.capturedSdkSessionId
    )
  }

  async areWorkersIdle(): Promise<boolean> {
    if (!this.capturedSdkSessionId || this.startedTaskIds.size === 0) return false
    const checkWorkersIdle = this.deps.areAllWorkersIdle ?? areAllWorkersIdle
    return checkWorkersIdle(this.capturedSdkSessionId, this.startedTaskIds.size)
  }

  recordSystemMessage(message: SDKSystemMessage): void {
    if (
      message.subtype === 'task_started' &&
      message.task_id &&
      (message.task_type === 'local_agent' || message.task_type === 'remote_agent')
    ) {
      this.startedTaskIds.add(message.task_id)
      return
    }

    if (message.subtype === 'task_notification' && message.task_id) {
      this.completedTaskIds.add(message.task_id)
      if (message.summary) {
        this.taskNotificationSummaries.push({
          taskId: message.task_id,
          status: message.status || 'completed',
          summary: message.summary,
          outputFile: message.output_file,
        })
      }
    }
  }

  async buildResumePrompt(): Promise<TeamsResumePromptResult> {
    const fallbackResult: TeamsResumePromptResult = {
      prompt: null,
      source: null,
      inboxMessageCount: 0,
      summaryCount: this.taskNotificationSummaries.length,
    }

    if (!this.capturedSdkSessionId || this.startedTaskIds.size === 0) {
      return fallbackResult
    }

    const readInboxPath = this.deps.findTeamLeadInboxPath ?? findTeamLeadInboxPath
    const inboxInfo = await readInboxPath(this.capturedSdkSessionId)
    if (inboxInfo) {
      const pollInbox = this.deps.pollInboxWithRetry ?? pollInboxWithRetry
      const unreadMessages = await pollInbox(
        inboxInfo.inboxPath,
        this.deps.inboxRetryConfig ?? INBOX_RETRY_CONFIG,
      )
      if (unreadMessages.length > 0) {
        const markRead = this.deps.markInboxAsRead ?? markInboxAsRead
        const formatPrompt = this.deps.formatInboxPrompt ?? formatInboxPrompt
        await markRead(inboxInfo.inboxPath)
        return {
          prompt: formatPrompt(unreadMessages),
          source: 'inbox',
          teamName: inboxInfo.teamName,
          inboxMessageCount: unreadMessages.length,
          summaryCount: this.taskNotificationSummaries.length,
        }
      }
    }

    if (this.taskNotificationSummaries.length > 0) {
      const formatSummaryPrompt = this.deps.formatSummaryFallbackPrompt ?? formatSummaryFallbackPrompt
      return {
        prompt: formatSummaryPrompt(this.taskNotificationSummaries),
        source: 'summary',
        teamName: inboxInfo?.teamName,
        inboxMessageCount: 0,
        summaryCount: this.taskNotificationSummaries.length,
      }
    }

    return {
      ...fallbackResult,
      teamName: inboxInfo?.teamName,
    }
  }

  async runResumeQuery(input: TeamsResumeQueryInput): Promise<SDKMessage[]> {
    const resumeOptions: ClaudeAgentQueryOptions = {
      ...input.baseQueryOptions,
      prompt: input.prompt,
      resumeSessionId: input.resumeSessionId,
    }
    const resumeMessages: SDKMessage[] = []

    for await (const resumeMsg of input.adapter.query(resumeOptions)) {
      if (!input.isSessionActive(input.sessionId)) break

      if (shouldPersistResumeMessage(resumeMsg)) {
        resumeMessages.push(resumeMsg)
      }
      input.emitSdkMessage(resumeMsg)
    }

    return resumeMessages
  }
}

function shouldPersistResumeMessage(message: SDKMessage): boolean {
  const messageRecord = message as Record<string, unknown>
  if ((message.type === 'assistant' || message.type === 'user') && !messageRecord.isReplay) {
    return true
  }
  return message.type === 'system' && (message as SDKSystemMessage).subtype === 'compact_boundary'
}

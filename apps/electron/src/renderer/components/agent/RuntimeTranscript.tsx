import * as React from 'react'
import { useAtomValue } from 'jotai'
import { AlertTriangle, Bot, CheckCircle2, Clock, Wrench } from 'lucide-react'
import { BasePathsProvider, Message, MessageContent, MessageHeader, MessageResponse, UserMessageContent } from '@/components/ai-elements/message'
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation'
import { WelcomeEmptyState } from '@/components/welcome/WelcomeEmptyState'
import { UserAvatar } from '@/components/chat/UserAvatar'
import { CopyButton } from '@/components/chat/CopyButton'
import { formatMessageTime } from '@/components/chat/ChatMessageItem'
import { userProfileAtom } from '@/atoms/user-profile'
import { channelsAtom } from '@/atoms/chat-atoms'
import { getModelLogo, resolveModelDisplayName } from '@/lib/model-logo'
import { cn } from '@/lib/utils'
import { ToolActivityList } from './ToolActivityItem'
import { AgentRunningIndicator } from './agent-running-indicator'
import { selectRuntimeTranscript, type RuntimeTranscriptItem, type RuntimeTranscriptToolItem } from './runtime-transcript-model'
import type { AgentStreamEnvelope, SDKMessage } from '@codeinsights/shared'
import type { AgentStreamState, ToolActivity } from '@/atoms/agent-atoms'

interface RuntimeTranscriptProps {
  runtimeEvents: AgentStreamEnvelope[]
  sdkMessages: SDKMessage[]
  liveMessages?: SDKMessage[]
  streaming: boolean
  streamState?: AgentStreamState
  sessionModelId?: string
  sessionPath?: string | null
  attachedDirs?: string[]
  messagesLoaded?: boolean
}

export function RuntimeTranscript({
  runtimeEvents,
  sdkMessages,
  liveMessages,
  streaming,
  streamState,
  sessionModelId,
  sessionPath,
  attachedDirs,
  messagesLoaded,
}: RuntimeTranscriptProps): React.ReactElement {
  const selection = React.useMemo(
    () => selectRuntimeTranscript({ runtimeEvents, sdkMessages, liveMessages }),
    [runtimeEvents, sdkMessages, liveMessages],
  )
  const shouldShowMissingEvents = messagesLoaded !== false
    && !selection.hasRuntimeEvents
    && (sdkMessages.length > 0 || (liveMessages?.length ?? 0) > 0)
    && !streaming
  const hasItems = selection.items.length > 0
  const liveContent = streamState?.content?.trim() ?? ''
  const hasRuntimeAssistantWithLiveContent = liveContent.length > 0
    && selection.items.some((item) => item.kind === 'assistant' && item.text.trim() === liveContent)
  const hasLiveContent = streaming && liveContent.length > 0 && !hasRuntimeAssistantWithLiveContent

  return (
    <BasePathsProvider basePaths={attachedDirs}>
      <Conversation resize="smooth" className="agent-conversation-canvas agent-logstream-canvas h-full">
        <ConversationContent className="agent-message-stack agent-logstream-stack relative z-10 gap-5 px-3 py-7 md:px-5">
          {!hasItems && !streaming && !shouldShowMissingEvents ? (
            <WelcomeEmptyState />
          ) : (
            <>
              {shouldShowMissingEvents && <RuntimeEventsMissingNotice />}
              {selection.items.map((item) => (
                <RuntimeTranscriptItemView
                  key={`${item.kind}:${item.id}`}
                  item={item}
                  sessionModelId={sessionModelId}
                  sessionPath={sessionPath}
                  attachedDirs={attachedDirs}
                />
              ))}
              {hasLiveContent && (
                <RuntimeAssistantMessage
                  text={liveContent}
                  sessionModelId={sessionModelId}
                  sessionPath={sessionPath}
                  attachedDirs={attachedDirs}
                  streaming
                  startedAt={streamState?.startedAt}
                />
              )}
              {streaming && !hasLiveContent && (
                <Message from="assistant" className="agent-message-card" data-role="assistant">
                  <RuntimeAssistantHeader sessionModelId={sessionModelId} />
                  <MessageContent>
                    <AgentRunningIndicator startedAt={streamState?.startedAt} label="Codex Runtime 同步中" />
                  </MessageContent>
                </Message>
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </BasePathsProvider>
  )
}

function RuntimeTranscriptItemView({
  item,
  sessionModelId,
  sessionPath,
  attachedDirs,
}: {
  item: RuntimeTranscriptItem
  sessionModelId?: string
  sessionPath?: string | null
  attachedDirs?: string[]
}): React.ReactElement | null {
  if (item.kind === 'user') {
    return <RuntimeUserMessage item={item} />
  }
  if (item.kind === 'assistant') {
    return (
      <RuntimeAssistantMessage
        text={item.text}
        createdAt={item.createdAt}
        sessionModelId={sessionModelId}
        sessionPath={sessionPath}
        attachedDirs={attachedDirs}
      />
    )
  }
  if (item.kind === 'tool') {
    return <RuntimeToolMessage item={item} />
  }
  return <RuntimeStatusMessage item={item} />
}

function RuntimeUserMessage({ item }: { item: RuntimeTranscriptItem & { kind: 'user' } }): React.ReactElement {
  const userProfile = useAtomValue(userProfileAtom)
  return (
    <Message from="user" className="agent-message-card agent-message-card--user" data-role="user">
      <div className="mb-2.5 flex items-start gap-2.5">
        <UserAvatar avatar={userProfile.avatar} size={35} />
        <div className="flex h-[35px] flex-col justify-between">
          <span className="text-sm font-semibold leading-none text-foreground/60">{userProfile.userName}</span>
          {item.createdAt && <span className="text-[10px] leading-none text-foreground/[0.38]">{formatMessageTime(item.createdAt)}</span>}
        </div>
      </div>
      <MessageContent>
        <UserMessageContent>{item.text}</UserMessageContent>
      </MessageContent>
    </Message>
  )
}

function RuntimeAssistantMessage({
  text,
  createdAt,
  sessionModelId,
  sessionPath,
  attachedDirs,
  streaming,
  startedAt,
}: {
  text: string
  createdAt?: number
  sessionModelId?: string
  sessionPath?: string | null
  attachedDirs?: string[]
  streaming?: boolean
  startedAt?: number
}): React.ReactElement {
  return (
    <Message from="assistant" className="agent-message-card" data-role="assistant">
      <RuntimeAssistantHeader sessionModelId={sessionModelId} createdAt={createdAt} />
      <MessageContent className="gap-3">
        <MessageResponse basePath={sessionPath || undefined} basePaths={attachedDirs}>{text}</MessageResponse>
        {streaming && <AgentRunningIndicator startedAt={startedAt} label="Codex Runtime 同步中" />}
      </MessageContent>
      {text && (
        <div className="pl-[46px] mt-0.5">
          <CopyButton content={text} />
        </div>
      )}
    </Message>
  )
}

function RuntimeAssistantHeader({ sessionModelId, createdAt }: { sessionModelId?: string; createdAt?: number }): React.ReactElement {
  const channels = useAtomValue(channelsAtom)
  const model = sessionModelId ? resolveModelDisplayName(sessionModelId, channels) : 'Codex'
  return (
    <MessageHeader
      model={model}
      time={createdAt ? formatMessageTime(createdAt) : formatMessageTime(Date.now())}
      logo={<RuntimeAssistantLogo model={sessionModelId} />}
    />
  )
}

function RuntimeAssistantLogo({ model }: { model?: string }): React.ReactElement {
  if (model) {
    return (
      <img
        src={getModelLogo(model)}
        alt={model}
        className="size-[35px] rounded-[25%] object-cover"
      />
    )
  }
  return (
    <div className="flex size-[35px] items-center justify-center rounded-[25%] bg-primary/10">
      <Bot size={18} className="text-primary" />
    </div>
  )
}

function RuntimeToolMessage({ item }: { item: RuntimeTranscriptToolItem }): React.ReactElement {
  const activity: ToolActivity = {
    toolUseId: item.id,
    toolName: item.name,
    input: parseToolInputSummary(item.inputSummary),
    result: item.outputSummary,
    isError: item.status === 'error' || item.status === 'denied',
    done: item.status !== 'running',
  }
  return (
    <div className="pl-[46px]">
      <ToolActivityList activities={[activity]} />
    </div>
  )
}

function RuntimeStatusMessage({ item }: { item: RuntimeTranscriptItem & { kind: 'status' } }): React.ReactElement {
  const Icon = item.tone === 'danger' ? AlertTriangle : item.tone === 'stopped' ? Clock : CheckCircle2
  return (
    <div
      className={cn(
        'agent-tool-rail flex items-start gap-2 rounded-card px-3 py-2.5 text-sm',
        item.tone === 'danger' && 'border-status-danger-border bg-status-danger-bg text-status-danger-fg',
        item.tone === 'stopped' && 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{item.text}</div>
        {item.usage && (
          <div className="mt-1 text-xs text-current/70">
            输入 {formatTokenCount(item.usage.inputTokens)} · 输出 {formatTokenCount(item.usage.outputTokens)}
          </div>
        )}
      </div>
    </div>
  )
}

function RuntimeEventsMissingNotice(): React.ReactElement {
  return (
    <div className="agent-tool-rail flex items-start gap-2 rounded-card border-status-waiting-border bg-status-waiting-bg px-3 py-2.5 text-sm text-status-waiting-fg">
      <Wrench className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">Codex runtime events 未找到</div>
        <div className="mt-0.5 text-xs text-current/70">该会话缺少可回放的 runtime events，历史内容可能不完整。</div>
      </div>
    </div>
  )
}

function parseToolInputSummary(summary: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(summary)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // inputSummary 可能是普通文本。
  }
  return summary ? { description: summary } : {}
}

function formatTokenCount(value: number | undefined): string {
  return typeof value === 'number' ? value.toLocaleString() : '0'
}

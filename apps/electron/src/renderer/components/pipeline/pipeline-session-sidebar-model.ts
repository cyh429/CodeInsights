import type { PipelineNodeKind, PipelineSessionMeta, PipelineSessionStatus } from '@codeinsights/shared'
import type { PipelineSidebarViewMode } from '@/atoms/pipeline-atoms'
import {
  buildDateSidebarSections,
  sortByUpdatedAtDesc,
} from '@/components/app-shell/sidebar-section-model'
import { getPipelineNodeLabel } from './pipeline-display-model'

export interface PipelineSidebarSection {
  id: string
  label: string
  sessions: PipelineSessionMeta[]
}

export interface BuildPipelineSidebarSectionsInput {
  sessions: PipelineSessionMeta[]
  currentWorkspaceId?: string | null
  draftSessionIds: Set<string>
  viewMode: PipelineSidebarViewMode
  now?: number
}

export type PipelineSidebarSessionTone = 'neutral' | 'running' | 'waiting' | 'failed' | 'success'

export interface PipelineSidebarSessionSummary {
  statusLabel: string
  detailLabel: string
  signalLabel?: string
  tone: PipelineSidebarSessionTone
}

function groupByDate(
  sessions: PipelineSessionMeta[],
  nowValue: number,
): PipelineSidebarSection[] {
  return buildDateSidebarSections(sessions, { now: nowValue }).map((section) => ({
    id: section.id,
    label: section.label,
    sessions: section.items,
  }))
}

function isSameWorkspace(
  session: PipelineSessionMeta,
  currentWorkspaceId?: string | null,
): boolean {
  return !currentWorkspaceId || session.workspaceId === currentWorkspaceId
}

export function getPipelineStatusLabel(status: PipelineSessionStatus): string {
  switch (status) {
    case 'running':
      return '运行中'
    case 'waiting_human':
      return '等待人工审核'
    case 'node_failed':
      return '节点失败'
    case 'completed':
      return '已完成'
    case 'terminated':
      return '已终止'
    case 'recovery_failed':
      return '恢复失败'
    case 'idle':
    default:
      return '空闲'
  }
}

function getPipelineSidebarTone(status: PipelineSessionStatus): PipelineSidebarSessionTone {
  switch (status) {
    case 'running':
      return 'running'
    case 'waiting_human':
      return 'waiting'
    case 'node_failed':
    case 'recovery_failed':
      return 'failed'
    case 'completed':
      return 'success'
    case 'terminated':
    case 'idle':
    default:
      return 'neutral'
  }
}

function getPipelineSignalLabel(status: PipelineSessionStatus): string | undefined {
  switch (status) {
    case 'waiting_human':
      return '待处理'
    case 'node_failed':
    case 'recovery_failed':
      return '需处理'
    case 'running':
      return '运行中'
    default:
      return undefined
  }
}

function buildNodeRoundDetail(node: PipelineNodeKind, reviewIteration: number): string {
  return `${getPipelineNodeLabel(node)} · 第 ${reviewIteration + 1} 轮`
}

export function buildPipelineSidebarSessionSummary(
  session: PipelineSessionMeta,
): PipelineSidebarSessionSummary {
  return {
    statusLabel: getPipelineStatusLabel(session.status),
    detailLabel: buildNodeRoundDetail(session.currentNode, session.reviewIteration),
    signalLabel: getPipelineSignalLabel(session.status),
    tone: getPipelineSidebarTone(session.status),
  }
}

export function buildPipelineSidebarSections({
  sessions,
  currentWorkspaceId,
  draftSessionIds,
  viewMode,
  now = Date.now(),
}: BuildPipelineSidebarSectionsInput): PipelineSidebarSection[] {
  const visibleSessions = sessions.filter((session) =>
    !draftSessionIds.has(session.id) && isSameWorkspace(session, currentWorkspaceId),
  )

  if (viewMode === 'archived') {
    return groupByDate(
      visibleSessions.filter((session) => session.archived),
      now,
    )
  }

  const activeSessions = visibleSessions.filter((session) => !session.archived)
  const pinned = activeSessions.filter((session) => session.pinned)
  const unpinned = activeSessions.filter((session) => !session.pinned)

  const running = unpinned.filter((session) => session.status === 'running')
  const waiting = unpinned.filter((session) => session.status === 'waiting_human')
  const failed = unpinned.filter((session) =>
    session.status === 'node_failed' || session.status === 'recovery_failed',
  )
  const completed = unpinned.filter((session) => session.status === 'completed')
  const recent = unpinned.filter((session) =>
    session.status === 'idle' || session.status === 'terminated',
  )

  return [
    { id: 'pinned', label: '置顶', sessions: sortByUpdatedAtDesc(pinned) },
    { id: 'running', label: '运行中', sessions: sortByUpdatedAtDesc(running) },
    { id: 'waiting_human', label: '等待审核', sessions: sortByUpdatedAtDesc(waiting) },
    { id: 'failed', label: '需要处理', sessions: sortByUpdatedAtDesc(failed) },
    { id: 'completed', label: '已完成', sessions: sortByUpdatedAtDesc(completed) },
    ...groupByDate(recent, now),
  ].filter((section) => section.sessions.length > 0)
}

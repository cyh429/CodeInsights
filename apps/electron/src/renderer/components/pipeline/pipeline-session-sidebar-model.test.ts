import { describe, expect, test } from 'bun:test'
import type { PipelineSessionMeta, PipelineSessionStatus } from '@codeinsights/shared'
import {
  buildPipelineSidebarSessionSummary,
  buildPipelineSidebarSections,
  getPipelineStatusLabel,
} from './pipeline-session-sidebar-model'

function makeSession(
  id: string,
  patch: Partial<PipelineSessionMeta> = {},
): PipelineSessionMeta {
  const now = Date.parse('2026-05-07T12:00:00+08:00')
  return {
    id,
    title: id,
    channelId: 'channel-1',
    workspaceId: 'workspace-1',
    currentNode: 'explorer',
    status: 'idle',
    reviewIteration: 0,
    createdAt: now,
    updatedAt: now,
    ...patch,
  }
}

function sectionIds(sections: ReturnType<typeof buildPipelineSidebarSections>) {
  return sections.map((section) => ({
    id: section.id,
    label: section.label,
    sessions: section.sessions.map((session) => session.id),
  }))
}

describe('buildPipelineSidebarSections', () => {
  test('活跃视图按置顶、生命周期与日期组织，并过滤归档、draft 和其他工作区', () => {
    const now = Date.parse('2026-05-07T12:00:00+08:00')
    const yesterday = Date.parse('2026-05-06T11:00:00+08:00')

    const sections = buildPipelineSidebarSections({
      sessions: [
        makeSession('archived', { archived: true }),
        makeSession('draft'),
        makeSession('other-workspace', { workspaceId: 'workspace-2' }),
        makeSession('completed', { status: 'completed', updatedAt: now - 1 }),
        makeSession('waiting', { status: 'waiting_human', updatedAt: now - 2 }),
        makeSession('running', { status: 'running', updatedAt: now - 3 }),
        makeSession('pinned', { pinned: true, updatedAt: now - 4 }),
        makeSession('idle-yesterday', { updatedAt: yesterday }),
      ],
      currentWorkspaceId: 'workspace-1',
      draftSessionIds: new Set(['draft']),
      viewMode: 'active',
      now,
    })

    expect(sectionIds(sections)).toEqual([
      { id: 'pinned', label: '置顶', sessions: ['pinned'] },
      { id: 'running', label: '运行中', sessions: ['running'] },
      { id: 'waiting_human', label: '等待审核', sessions: ['waiting'] },
      { id: 'completed', label: '已完成', sessions: ['completed'] },
      { id: 'date-yesterday', label: '昨天', sessions: ['idle-yesterday'] },
    ])
  })

  test('归档视图只显示当前工作区已归档会话并按日期分组', () => {
    const now = Date.parse('2026-05-07T12:00:00+08:00')
    const earlier = Date.parse('2026-05-01T12:00:00+08:00')

    const sections = buildPipelineSidebarSections({
      sessions: [
        makeSession('active'),
        makeSession('archived-today', { archived: true, updatedAt: now }),
        makeSession('archived-earlier', { archived: true, updatedAt: earlier }),
        makeSession('archived-other-workspace', { archived: true, workspaceId: 'workspace-2' }),
      ],
      currentWorkspaceId: 'workspace-1',
      draftSessionIds: new Set(),
      viewMode: 'archived',
      now,
    })

    expect(sectionIds(sections)).toEqual([
      { id: 'date-today', label: '今天', sessions: ['archived-today'] },
      { id: 'date-earlier', label: '更早', sessions: ['archived-earlier'] },
    ])
  })
})

describe('getPipelineStatusLabel', () => {
  test.each([
    ['idle', '空闲'],
    ['running', '运行中'],
    ['waiting_human', '等待人工审核'],
    ['node_failed', '节点失败'],
    ['completed', '已完成'],
    ['terminated', '已终止'],
    ['recovery_failed', '恢复失败'],
  ] satisfies Array<[PipelineSessionStatus, string]>)('%s 显示为 %s', (status, label) => {
    expect(getPipelineStatusLabel(status)).toBe(label)
  })
})

describe('buildPipelineSidebarSessionSummary', () => {
  test('展示当前节点、轮次和等待信号', () => {
    expect(buildPipelineSidebarSessionSummary(makeSession('waiting', {
      currentNode: 'reviewer',
      status: 'waiting_human',
      reviewIteration: 1,
    }))).toEqual({
      statusLabel: '等待人工审核',
      detailLabel: '审查 · 第 2 轮',
      signalLabel: '待处理',
      tone: 'waiting',
    })
  })

  test('失败会话展示失败信号并保留节点定位', () => {
    expect(buildPipelineSidebarSessionSummary(makeSession('failed', {
      currentNode: 'tester',
      status: 'recovery_failed',
      reviewIteration: 2,
    }))).toEqual({
      statusLabel: '恢复失败',
      detailLabel: '测试 · 第 3 轮',
      signalLabel: '需处理',
      tone: 'failed',
    })
  })
})

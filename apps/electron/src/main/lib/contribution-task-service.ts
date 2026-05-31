/**
 * 贡献任务服务
 *
 * 使用 JSON 索引 + JSONL 事件保存 Pipeline v2 的贡献领域状态。
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type {
  ContributionMode,
  ContributionTask,
  ContributionTaskEvent,
  ContributionTaskEventType,
  ContributionTaskStatus,
} from '@codeinsights/shared'
import {
  getContributionTaskEventsPath,
  getContributionTasksIndexPath,
} from './config-paths'
import { readJsonFileSafe, writeJsonFileAtomic } from './safe-file'

interface ContributionTasksIndex {
  version: number
  tasks: ContributionTask[]
}

export interface CreateContributionTaskInput {
  id?: string
  pipelineSessionId: string
  workspaceId?: string
  repositoryRoot: string
  repositoryUrl?: string
  issueUrl?: string
  baseBranch?: string
  workingBranch?: string
  baseCommit?: string
  selectedReportId?: string
  selectedTaskTitle?: string
  patchWorkDir: string
  contributionMode: ContributionMode
  allowRemoteWrites: boolean
  currentGateId?: string
  status?: ContributionTaskStatus
}

export interface AppendContributionTaskEventInput {
  id?: string
  pipelineSessionId: string
  type: ContributionTaskEventType
  payload?: Record<string, unknown>
  createdAt?: number
}

const INDEX_VERSION = 1
const CONTRIBUTION_MODES = new Set<ContributionMode>([
  'local_patch',
  'local_commit',
  'remote_pr',
])
const TASK_STATUSES = new Set<ContributionTaskStatus>([
  'created',
  'exploring',
  'task_selected',
  'planning',
  'plan_review',
  'developing',
  'dev_review',
  'reviewing',
  'testing',
  'committing',
  'completed',
  'failed',
])
const EVENT_TYPES = new Set<ContributionTaskEventType>([
  'task_created',
  'task_updated',
  'preflight_completed',
  'patch_work_updated',
  'document_revision_created',
  'local_commit_created',
  'local_commit_failed',
  'remote_write_confirmed',
  'remote_submission_created',
  'remote_submission_failed',
  'task_failed',
])

function isSafeTaskId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id)
}

function assertSafeTaskId(id: string): void {
  if (!isSafeTaskId(id)) {
    throw new Error(`无效贡献任务 ID: ${id}`)
  }
}

function assertContributionMode(mode: ContributionMode): void {
  if (!CONTRIBUTION_MODES.has(mode)) {
    throw new Error(`无效贡献模式: ${mode}`)
  }
}

function assertTaskStatus(status: ContributionTaskStatus): void {
  if (!TASK_STATUSES.has(status)) {
    throw new Error(`无效贡献任务状态: ${status}`)
  }
}

function assertEventType(type: ContributionTaskEventType): void {
  if (!EVENT_TYPES.has(type)) {
    throw new Error(`无效贡献任务事件类型: ${type}`)
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isContributionTaskEvent(value: unknown, taskId: string): value is ContributionTaskEvent {
  if (!isObject(value)) return false
  if (typeof value.id !== 'string' || !value.id.trim()) return false
  if (value.taskId !== taskId) return false
  if (typeof value.pipelineSessionId !== 'string' || !value.pipelineSessionId.trim()) return false
  if (!EVENT_TYPES.has(value.type as ContributionTaskEventType)) return false
  if (typeof value.createdAt !== 'number') return false
  return value.payload === undefined || isObject(value.payload)
}

function readIndex(): ContributionTasksIndex {
  return readJsonFileSafe<ContributionTasksIndex>(getContributionTasksIndexPath())
    ?? { version: INDEX_VERSION, tasks: [] }
}

function writeIndex(index: ContributionTasksIndex): void {
  writeJsonFileAtomic(getContributionTasksIndexPath(), {
    version: INDEX_VERSION,
    tasks: index.tasks,
  })
}

export function listContributionTasks(): ContributionTask[] {
  return readIndex().tasks.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getContributionTask(id: string): ContributionTask | undefined {
  assertSafeTaskId(id)
  return readIndex().tasks.find((task) => task.id === id)
}

export function getContributionTaskByPipelineSessionId(
  pipelineSessionId: string,
): ContributionTask | undefined {
  return readIndex().tasks.find((task) => task.pipelineSessionId === pipelineSessionId)
}

export function createContributionTask(input: CreateContributionTaskInput): ContributionTask {
  const index = readIndex()
  const id = input.id ?? randomUUID()
  assertSafeTaskId(id)
  assertContributionMode(input.contributionMode)
  assertTaskStatus(input.status ?? 'created')

  if (index.tasks.some((task) => task.id === id)) {
    throw new Error(`贡献任务已存在: ${id}`)
  }

  const now = Date.now()
  const task: ContributionTask = {
    id,
    pipelineSessionId: input.pipelineSessionId,
    workspaceId: input.workspaceId,
    repositoryRoot: input.repositoryRoot,
    repositoryUrl: input.repositoryUrl,
    issueUrl: input.issueUrl,
    baseBranch: input.baseBranch,
    workingBranch: input.workingBranch,
    baseCommit: input.baseCommit,
    selectedReportId: input.selectedReportId,
    selectedTaskTitle: input.selectedTaskTitle,
    patchWorkDir: input.patchWorkDir,
    contributionMode: input.contributionMode,
    allowRemoteWrites: input.allowRemoteWrites,
    status: input.status ?? 'created',
    currentGateId: input.currentGateId,
    createdAt: now,
    updatedAt: now,
  }

  index.tasks.push(task)
  writeIndex(index)
  return task
}

export function updateContributionTask(
  id: string,
  patch: Partial<Omit<ContributionTask, 'id' | 'createdAt'>>,
): ContributionTask {
  assertSafeTaskId(id)
  if (patch.contributionMode !== undefined) {
    assertContributionMode(patch.contributionMode)
  }
  if (patch.status !== undefined) {
    assertTaskStatus(patch.status)
  }
  const index = readIndex()
  const target = index.tasks.find((task) => task.id === id)
  if (!target) {
    throw new Error(`未找到贡献任务: ${id}`)
  }

  Object.assign(target, patch, { updatedAt: Date.now() })
  writeIndex(index)
  return target
}

export function appendContributionTaskEvent(
  taskId: string,
  input: AppendContributionTaskEventInput,
): ContributionTaskEvent {
  assertSafeTaskId(taskId)
  assertEventType(input.type)

  const task = getContributionTask(taskId)
  if (!task) {
    throw new Error(`未找到贡献任务: ${taskId}`)
  }
  if (task.pipelineSessionId !== input.pipelineSessionId) {
    throw new Error(`贡献任务事件 session 不匹配: ${taskId}`)
  }

  const event: ContributionTaskEvent = {
    id: input.id ?? randomUUID(),
    taskId,
    pipelineSessionId: input.pipelineSessionId,
    type: input.type,
    payload: input.payload,
    createdAt: input.createdAt ?? Date.now(),
  }

  appendFileSync(
    getContributionTaskEventsPath(taskId),
    JSON.stringify(event) + '\n',
    'utf-8',
  )
  return event
}

export function getContributionTaskEvents(taskId: string): ContributionTaskEvent[] {
  assertSafeTaskId(taskId)
  const filePath = getContributionTaskEventsPath(taskId)
  if (!existsSync(filePath)) return []

  const events: ContributionTaskEvent[] = []
  for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line) as unknown
      if (isContributionTaskEvent(parsed, taskId)) {
        events.push(parsed)
      } else {
        console.warn(`[贡献任务] 跳过无效事件行: ${taskId}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[贡献任务] 跳过损坏事件行: ${taskId}: ${message}`)
    }
  }
  return events
}

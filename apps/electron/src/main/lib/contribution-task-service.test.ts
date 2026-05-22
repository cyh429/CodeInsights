import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appendContributionTaskEvent,
  createContributionTask,
  getContributionTask,
  getContributionTaskEvents,
  listContributionTasks,
  updateContributionTask,
} from './contribution-task-service'

describe('contribution-task-service', () => {
  const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
  let tempConfigDir = ''

  beforeEach(() => {
    tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-contribution-task-'))
    process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
  })

  afterEach(() => {
    if (originalConfigDir == null) {
      delete process.env.CODEINSIGHTS_CONFIG_DIR
    } else {
      process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
    }

    rmSync(tempConfigDir, { recursive: true, force: true })
  })

  test('创建 ContributionTask 后写入 JSON 索引并可读取', () => {
    const task = createContributionTask({
      id: 'task-1',
      pipelineSessionId: 'session-1',
      workspaceId: 'workspace-1',
      repositoryRoot: '/tmp/repo',
      patchWorkDir: '/tmp/repo/patch-work',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      workingBranch: 'rv/task-1',
    })

    expect(task).toMatchObject({
      id: 'task-1',
      pipelineSessionId: 'session-1',
      workspaceId: 'workspace-1',
      status: 'created',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
    })
    expect(getContributionTask('task-1')).toMatchObject({
      id: 'task-1',
      patchWorkDir: '/tmp/repo/patch-work',
    })
    expect(existsSync(join(tempConfigDir, 'contribution-tasks.json'))).toBe(true)
  })

  test('更新任务状态会刷新索引并按 updatedAt 倒序排序', async () => {
    const first = createContributionTask({
      id: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: '/tmp/repo-a',
      patchWorkDir: '/tmp/repo-a/patch-work',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
    })

    await new Promise((resolve) => setTimeout(resolve, 2))

    const second = createContributionTask({
      id: 'task-2',
      pipelineSessionId: 'session-2',
      repositoryRoot: '/tmp/repo-b',
      patchWorkDir: '/tmp/repo-b/patch-work',
      contributionMode: 'local_commit',
      allowRemoteWrites: false,
    })

    updateContributionTask(first.id, {
      status: 'planning',
      currentGateId: 'gate-1',
    })

    const tasks = listContributionTasks()

    expect(tasks[0]?.id).toBe(first.id)
    expect(tasks[1]?.id).toBe(second.id)
    expect(getContributionTask(first.id)).toMatchObject({
      status: 'planning',
      currentGateId: 'gate-1',
    })
  })

  test('贡献任务事件追加到 JSONL 并可按顺序读取', () => {
    createContributionTask({
      id: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: '/tmp/repo',
      patchWorkDir: '/tmp/repo/patch-work',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
    })

    appendContributionTaskEvent('task-1', {
      id: 'event-1',
      pipelineSessionId: 'session-1',
      type: 'task_created',
      payload: { status: 'created' },
      createdAt: 1,
    })
    appendContributionTaskEvent('task-1', {
      id: 'event-2',
      pipelineSessionId: 'session-1',
      type: 'patch_work_updated',
      payload: { relativePath: 'plan.md' },
      createdAt: 2,
    })

    const events = getContributionTaskEvents('task-1')
    const eventsPath = join(tempConfigDir, 'contribution-tasks', 'task-1.jsonl')

    expect(events.map((event) => event.id)).toEqual(['event-1', 'event-2'])
    expect(events[0]).toMatchObject({
      taskId: 'task-1',
      pipelineSessionId: 'session-1',
      type: 'task_created',
    })
    expect(readFileSync(eventsPath, 'utf-8').trim().split('\n')).toHaveLength(2)
  })

  test('拒绝向不存在或 session 不匹配的任务追加事件', () => {
    createContributionTask({
      id: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: '/tmp/repo',
      patchWorkDir: '/tmp/repo/patch-work',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
    })

    expect(() => appendContributionTaskEvent('missing-task', {
      id: 'event-1',
      pipelineSessionId: 'session-1',
      type: 'task_created',
      createdAt: 1,
    })).toThrow('未找到贡献任务')

    expect(() => appendContributionTaskEvent('task-1', {
      id: 'event-2',
      pipelineSessionId: 'other-session',
      type: 'task_updated',
      createdAt: 2,
    })).toThrow('贡献任务事件 session 不匹配')
  })

  test('运行时拒绝非法贡献模式、任务状态和事件类型', () => {
    expect(() => createContributionTask({
      id: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: '/tmp/repo',
      patchWorkDir: '/tmp/repo/patch-work',
      contributionMode: 'bad_mode' as never,
      allowRemoteWrites: false,
    })).toThrow('无效贡献模式')

    expect(() => createContributionTask({
      id: 'task-2',
      pipelineSessionId: 'session-2',
      repositoryRoot: '/tmp/repo',
      patchWorkDir: '/tmp/repo/patch-work',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'bad_status' as never,
    })).toThrow('无效贡献任务状态')

    createContributionTask({
      id: 'task-3',
      pipelineSessionId: 'session-3',
      repositoryRoot: '/tmp/repo',
      patchWorkDir: '/tmp/repo/patch-work',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
    })

    expect(() => updateContributionTask('task-3', {
      status: 'bad_status' as never,
    })).toThrow('无效贡献任务状态')

    expect(() => appendContributionTaskEvent('task-3', {
      id: 'event-1',
      pipelineSessionId: 'session-3',
      type: 'bad_event' as never,
      createdAt: 1,
    })).toThrow('无效贡献任务事件类型')
  })

  test('读取贡献任务事件时跳过损坏 JSONL 行', () => {
    createContributionTask({
      id: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: '/tmp/repo',
      patchWorkDir: '/tmp/repo/patch-work',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
    })

    appendContributionTaskEvent('task-1', {
      id: 'event-1',
      pipelineSessionId: 'session-1',
      type: 'task_created',
      createdAt: 1,
    })
    appendFileSync(
      join(tempConfigDir, 'contribution-tasks', 'task-1.jsonl'),
      [
        '{bad json}',
        JSON.stringify({
          id: 'bad-event',
          taskId: 'task-1',
          pipelineSessionId: 'session-1',
          type: 'bad_event',
          createdAt: 1.5,
        }),
        JSON.stringify({
          id: 'wrong-task',
          taskId: 'other-task',
          pipelineSessionId: 'session-1',
          type: 'task_updated',
          createdAt: 1.6,
        }),
        '',
      ].join('\n'),
      'utf-8',
    )
    appendContributionTaskEvent('task-1', {
      id: 'event-2',
      pipelineSessionId: 'session-1',
      type: 'task_updated',
      createdAt: 2,
    })

    expect(getContributionTaskEvents('task-1').map((event) => event.id)).toEqual([
      'event-1',
      'event-2',
    ])
  })

  test('拒绝包含路径分隔符的 task id，避免 JSONL 路径越界', () => {
    expect(() => createContributionTask({
      id: '../escape',
      pipelineSessionId: 'session-1',
      repositoryRoot: '/tmp/repo',
      patchWorkDir: '/tmp/repo/patch-work',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
    })).toThrow('无效贡献任务 ID')
  })
})

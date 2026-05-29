import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type {
  PipelineGateRequest,
  PipelineGateResponse,
  PipelineStateSnapshot,
  PipelineStreamCompletePayload,
  PipelineStreamPayload,
} from '@codeinsights/shared'
import {
  appendPipelineNodeCompleteRecords,
  createPipelineService,
} from './pipeline-service'
import { getPipelineRecords, updatePipelineSessionMeta } from './pipeline-session-manager'
import { resolvePipelineSessionArtifactsDir } from './pipeline-artifact-service'
import { getPipelineSessionCheckpointDir } from './config-paths'
import {
  createContributionTask,
  getContributionTask,
  getContributionTaskEvents,
  getContributionTaskByPipelineSessionId,
} from './contribution-task-service'
import {
  readPatchWorkManifest,
  writePatchWorkFile,
} from './pipeline-patch-work-service'
import { createAgentWorkspace } from './agent-workspace-manager'
import { PipelineRemoteSubmissionError } from './pipeline-git-submission-service'

function runGit(repoRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function setupPipelineGitRepo(repoRoot: string): void {
  runGit(repoRoot, ['init'])
  runGit(repoRoot, ['config', 'user.name', 'CodeInsights Test'])
  runGit(repoRoot, ['config', 'user.email', 'codeinsights-test@example.com'])
  mkdirSync(join(repoRoot, 'src'), { recursive: true })
  writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 1\n', 'utf-8')
  runGit(repoRoot, ['add', 'src/index.ts'])
  runGit(repoRoot, ['commit', '-m', 'initial'])
}

describe('pipeline-service', () => {
  const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
  let tempConfigDir = ''

  beforeEach(() => {
    tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-'))
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

  test('收到 gate 响应后继续执行并完成', async () => {
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-1',
      sessionId: 'session-1',
      node: 'explorer',
      kind: 'task_selection',
      iteration: 0,
      createdAt: Date.now(),
    }

    const runningState: PipelineStateSnapshot = {
      sessionId: 'session-1',
      currentNode: 'explorer',
      status: 'waiting_human',
      reviewIteration: 0,
      pendingGate: gateRequest,
      updatedAt: Date.now(),
    }

    const completedState: PipelineStateSnapshot = {
      sessionId: 'session-1',
      currentNode: 'tester',
      status: 'completed',
      reviewIteration: 0,
      lastApprovedNode: 'tester',
      pendingGate: null,
      updatedAt: Date.now(),
    }

    const graphCalls: string[] = []
    const events: PipelineStreamPayload[] = []

    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          graphCalls.push('invoke')
          return { state: runningState, interrupted: gateRequest }
        },
        resume: async (input: { sessionId: string; response: PipelineGateResponse }) => {
          graphCalls.push(`resume:${input.response.action}`)
          return { state: completedState }
        },
        getState: async () => completedState,
      }),
    })

    const session = service.createSession('测试 Pipeline', 'channel-1', 'workspace-1')
    const startPromise = service.start(
      {
        sessionId: session.id,
        userInput: '请执行 pipeline',
      },
      {
        onEvent: (payload) => events.push(payload),
      },
    )

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(service.getPendingGates()).toHaveLength(1)

    await service.respondGate({
      gateId: 'gate-1',
      sessionId: session.id,
      kind: 'task_selection',
      action: 'approve',
      selectedReportId: 'report-1',
      createdAt: Date.now(),
    })

    await startPromise

    expect(graphCalls).toEqual(['invoke', 'resume:approve'])
    expect(events.some((payload) => payload.event.type === 'gate_waiting')).toBe(true)
    expect(events.some((payload) => payload.event.type === 'gate_resolved')).toBe(true)
    expect(service.getPendingGates()).toHaveLength(0)
    expect(service.getSessionState(session.id)).resolves.toMatchObject({
      status: 'completed',
      lastApprovedNode: 'tester',
    })
    expect(getPipelineRecords(session.id).find((record) => record.type === 'gate_decision')).toMatchObject({
      type: 'gate_decision',
      kind: 'task_selection',
      selectedReportId: 'report-1',
    })
  })

  test('启动 v2 会话前会创建 ContributionTask 和 patch-work manifest', async () => {
    const workspace = createAgentWorkspace('贡献工作区')
    const service = createPipelineService({
      createGraph: (meta) => ({
        invoke: async () => ({
          state: {
            sessionId: meta.id,
            version: 2,
            currentNode: 'committer',
            status: 'completed',
            reviewIteration: 0,
            lastApprovedNode: 'committer',
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async () => ({
          sessionId: meta.id,
          version: 2,
          currentNode: 'committer',
          status: 'completed',
          reviewIteration: 0,
          lastApprovedNode: 'committer',
          pendingGate: null,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('贡献 Pipeline', 'channel-1', workspace.id, 2)
    await service.start({
      sessionId: session.id,
      userInput: '请执行 v2 贡献流程',
      channelId: 'channel-1',
      workspaceId: workspace.id,
    })

    const task = getContributionTaskByPipelineSessionId(session.id)
    expect(task).toMatchObject({
      pipelineSessionId: session.id,
      workspaceId: workspace.id,
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'exploring',
    })
    expect(readPatchWorkManifest(task!.repositoryRoot)).toMatchObject({
      contributionTaskId: task!.id,
      pipelineSessionId: session.id,
    })
  })

  test('task_selection gate 必须选择 report，并写回 selected-task.md 和 ContributionTask', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-task-selection',
      sessionId: 'session-task-selection',
      node: 'explorer',
      kind: 'task_selection',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => ({
          state: {
            sessionId: 'session-task-selection',
            version: 2,
            currentNode: 'planner',
            status: 'waiting_human',
            reviewIteration: 0,
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-task-selection',
          version: 2,
          currentNode: 'explorer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })
    try {
      const session = service.createSession('任务选择测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'explorer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-selection',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'exploring',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-selection',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'explorer_report',
        relativePath: 'explorer/report-001.md',
        createdByNode: 'explorer',
        content: '# 探索报告：任务选择闭环\n\n## 贡献点概述\n选择后才能进入 planner。\n',
      })

      await expect(service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'task_selection',
        action: 'approve',
        createdAt: Date.now(),
      })).rejects.toThrow('请选择 explorer report')

      await service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'task_selection',
        action: 'approve',
        selectedReportId: 'report-001',
        createdAt: Date.now(),
      })

      expect(getContributionTask('task-selection')).toMatchObject({
        selectedReportId: 'report-001',
        selectedTaskTitle: '任务选择闭环',
        status: 'task_selected',
      })
      expect(readPatchWorkManifest(repoRoot)).toMatchObject({
        selectedReportId: 'report-001',
      })
      expect(readFileSync(join(repoRoot, 'patch-work', 'selected-task.md'), 'utf-8')).toContain('任务选择闭环')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('planner document_review approve 会记录 plan.md 和 test-plan.md 的 accepted checksum', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-plan-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-plan-review',
      sessionId: 'session-plan-review',
      node: 'planner',
      kind: 'document_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => ({
          state: {
            sessionId: 'session-plan-review',
            version: 2,
            currentNode: 'developer',
            status: 'running',
            reviewIteration: 0,
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-plan-review',
          version: 2,
          currentNode: 'planner',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })
    try {
      const session = service.createSession('文档审核测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'planner',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-plan-review',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'plan_review',
      })
      const planRef = writePatchWorkFile({
        contributionTaskId: 'task-plan-review',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'implementation_plan',
        createdByNode: 'planner',
        content: '# 开发方案\n\n实现任务选择。\n',
      })
      const testPlanRef = writePatchWorkFile({
        contributionTaskId: 'task-plan-review',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'test_plan',
        createdByNode: 'planner',
        content: '# 测试方案\n\n验证任务选择。\n',
      })

      await service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'document_review',
        action: 'approve',
        createdAt: Date.now(),
      })

      const manifest = readPatchWorkManifest(repoRoot)
      expect(manifest.files.find((file) => file.relativePath === 'plan.md')).toMatchObject({
        acceptedRevision: planRef.revision,
        acceptedByGateId: gateRequest.gateId,
        checksum: planRef.checksum,
      })
      expect(manifest.files.find((file) => file.relativePath === 'test-plan.md')).toMatchObject({
        acceptedRevision: testPlanRef.revision,
        acceptedByGateId: gateRequest.gateId,
        checksum: testPlanRef.checksum,
      })
      expect(getContributionTask('task-plan-review')).toMatchObject({
        status: 'developing',
      })
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('developer document_review approve 会记录 dev.md accepted checksum 并进入 reviewing', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-dev-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-dev-review',
      sessionId: 'session-dev-review',
      node: 'developer',
      kind: 'document_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => ({
          state: {
            sessionId: 'session-dev-review',
            version: 2,
            currentNode: 'reviewer',
            status: 'running',
            reviewIteration: 0,
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-dev-review',
          version: 2,
          currentNode: 'developer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('开发文档审核测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'developer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-dev-review',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'dev_review',
      })
      const devRef = writePatchWorkFile({
        contributionTaskId: 'task-dev-review',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'dev_doc',
        createdByNode: 'developer',
        content: '# 开发文档\n\n## 实现摘要\n完成 developer gate。\n',
      })

      await service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'document_review',
        action: 'approve',
        createdAt: Date.now(),
      })

      const manifest = readPatchWorkManifest(repoRoot)
      expect(manifest.files.find((file) => file.relativePath === 'dev.md')).toMatchObject({
        acceptedRevision: devRef.revision,
        acceptedByGateId: gateRequest.gateId,
        checksum: devRef.checksum,
      })
      expect(getContributionTask('task-dev-review')).toMatchObject({
        status: 'reviewing',
      })
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('review iteration limit gate 按用户选择进入 testing 或回 developer', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-review-limit-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-review-limit',
      sessionId: 'session-review-limit',
      node: 'reviewer',
      kind: 'review_iteration_limit',
      iteration: 3,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async (_input: { sessionId: string; response: PipelineGateResponse }) => ({
          state: {
            sessionId: 'session-review-limit',
            version: 2,
            currentNode: 'tester',
            status: 'running',
            reviewIteration: 3,
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-review-limit',
          version: 2,
          currentNode: 'reviewer',
          status: 'waiting_human',
          reviewIteration: 3,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('review 上限测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'reviewer',
        status: 'waiting_human',
        reviewIteration: 3,
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-review-limit',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'reviewing',
      })

      await service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'review_iteration_limit',
        action: 'approve',
        createdAt: Date.now(),
      })

      expect(getContributionTask('task-review-limit')).toMatchObject({
        status: 'testing',
      })
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('tester document_review approve 会接受 result.md 和 patch-set 并进入 committing', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-tester-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-tester-result',
      sessionId: 'session-tester-result',
      node: 'tester',
      kind: 'document_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => ({
          state: {
            sessionId: 'session-tester-result',
            version: 2,
            currentNode: 'committer',
            status: 'running',
            reviewIteration: 0,
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-tester-result',
          version: 2,
          currentNode: 'tester',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('tester 产物审核测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'tester',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-tester-result',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'testing',
      })
      const refs = [
        writePatchWorkFile({
          contributionTaskId: 'task-tester-result',
          pipelineSessionId: session.id,
          repositoryRoot: repoRoot,
          kind: 'test_result',
          createdByNode: 'tester',
          content: '# 测试报告\n\n通过。\n',
        }),
        writePatchWorkFile({
          contributionTaskId: 'task-tester-result',
          pipelineSessionId: session.id,
          repositoryRoot: repoRoot,
          kind: 'patch',
          createdByNode: 'tester',
          content: 'diff --git a/src/index.ts b/src/index.ts\n',
        }),
        writePatchWorkFile({
          contributionTaskId: 'task-tester-result',
          pipelineSessionId: session.id,
          repositoryRoot: repoRoot,
          kind: 'changed_files',
          createdByNode: 'tester',
          content: '[{"path":"src/index.ts"}]\n',
        }),
        writePatchWorkFile({
          contributionTaskId: 'task-tester-result',
          pipelineSessionId: session.id,
          repositoryRoot: repoRoot,
          kind: 'diff_summary',
          createdByNode: 'tester',
          content: '# Diff 摘要\n',
        }),
        writePatchWorkFile({
          contributionTaskId: 'task-tester-result',
          pipelineSessionId: session.id,
          repositoryRoot: repoRoot,
          kind: 'test_evidence',
          createdByNode: 'tester',
          content: '[{"command":"bun test","status":"passed","summary":"通过"}]\n',
        }),
      ]

      await service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'document_review',
        action: 'approve',
        createdAt: Date.now(),
      })

      const manifest = readPatchWorkManifest(repoRoot)
      for (const ref of refs) {
        expect(manifest.files.find((file) => file.relativePath === ref.relativePath)).toMatchObject({
          acceptedRevision: ref.revision,
          acceptedByGateId: gateRequest.gateId,
          checksum: ref.checksum,
        })
      }
      expect(getContributionTask('task-tester-result')).toMatchObject({
        status: 'committing',
      })
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('committer submission_review local_commit 会创建本地提交并通过 operation id 保持幂等', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-committer-repo-'))
    setupPipelineGitRepo(repoRoot)
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-committer-submission',
      sessionId: 'session-committer-submission',
      node: 'committer',
      kind: 'submission_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async (input: { sessionId: string }) => ({
          state: {
            sessionId: input.sessionId,
            version: 2,
            currentNode: 'committer',
            status: 'completed',
            reviewIteration: 0,
            lastApprovedNode: 'committer',
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-committer-submission',
          version: 2,
          currentNode: 'committer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })
    const completePayloads: PipelineStreamCompletePayload[] = []

    try {
      const session = service.createSession('committer 草稿审核测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'committer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-committer-submission',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_commit',
        allowRemoteWrites: false,
        status: 'committing',
      })
      writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 2\n', 'utf-8')
      const commitCountBefore = Number(runGit(repoRoot, ['rev-list', '--count', 'HEAD']))
      const commitRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-submission',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'commit_doc',
        createdByNode: 'committer',
        content: '# Commit 准备\n',
      })
      const prRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-submission',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'pr_doc',
        createdByNode: 'committer',
        content: '# PR 草稿\n',
      })
      appendPipelineNodeCompleteRecords(session.id, {
        type: 'node_complete',
        node: 'committer',
        output: '{}',
        summary: '提交材料已生成',
        approved: true,
        issues: [],
        artifact: {
          node: 'committer',
          summary: '提交材料已生成',
          commitMessage: 'feat(pipeline): add draft submission',
          prTitle: 'Add draft submission materials',
          prBody: '## Summary\n- Add draft submission',
          submissionStatus: 'draft_only',
          blockers: [],
          risks: ['未执行真实 commit'],
          commitDocRef: commitRef,
          prDocRef: prRef,
          localCommit: {
            attempted: false,
            status: 'not_requested',
          },
          remoteSubmission: {
            attempted: false,
            status: 'not_requested',
          },
          content: '{}',
        },
        createdAt: Date.now(),
      })

      const response: PipelineGateResponse = {
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'submission_review',
        action: 'approve',
        submissionMode: 'local_commit',
        localCommitOperationId: 'op-service-local-commit',
        createdAt: Date.now(),
      }

      await service.respondGate(response, {
        onComplete: (payload) => completePayloads.push(payload),
      })

      const manifest = readPatchWorkManifest(repoRoot)
      expect(manifest.files.find((file) => file.relativePath === commitRef.relativePath)).toMatchObject({
        acceptedRevision: commitRef.revision,
        acceptedByGateId: gateRequest.gateId,
      })
      expect(manifest.files.find((file) => file.relativePath === prRef.relativePath)).toMatchObject({
        acceptedRevision: prRef.revision,
        acceptedByGateId: gateRequest.gateId,
      })
      expect(getContributionTask('task-committer-submission')).toMatchObject({
        status: 'completed',
        contributionMode: 'local_commit',
      })
      expect(Number(runGit(repoRoot, ['rev-list', '--count', 'HEAD']))).toBe(commitCountBefore + 1)
      const commitHash = runGit(repoRoot, ['rev-parse', 'HEAD'])
      expect(runGit(repoRoot, ['show', '--name-only', '--pretty=format:', 'HEAD'])
        .split('\n')
        .filter(Boolean)).toEqual(['src/index.ts'])
      const events = getContributionTaskEvents('task-committer-submission')
        .filter((event) => event.type === 'local_commit_created')
      expect(events).toHaveLength(1)
      expect(events[0]?.payload).toMatchObject({
        operationId: 'op-service-local-commit',
        commitHash,
        files: ['src/index.ts'],
      })
      await expect(service.getSessionState(session.id)).resolves.toMatchObject({
        stageOutputs: {
          committer: {
            submissionStatus: 'local_commit_created',
            localCommit: {
              attempted: true,
              status: 'created',
              operationId: 'op-service-local-commit',
              commitHash,
            },
          },
        },
      })
      expect(completePayloads[0]?.state.stageOutputs?.committer).toMatchObject({
        submissionStatus: 'local_commit_created',
        localCommit: {
          attempted: true,
          status: 'created',
          operationId: 'op-service-local-commit',
          commitHash,
        },
      })
      expect(getPipelineRecords(session.id).find((record) => record.type === 'gate_decision')).toMatchObject({
        type: 'gate_decision',
        kind: 'submission_review',
        submissionMode: 'local_commit',
        localCommitOperationId: 'op-service-local-commit',
      })

      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'committer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      await service.respondGate(response)
      expect(Number(runGit(repoRoot, ['rev-list', '--count', 'HEAD']))).toBe(commitCountBefore + 1)
      expect(getContributionTaskEvents('task-committer-submission')
        .filter((event) => event.type === 'local_commit_created')).toHaveLength(1)
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  }, 10_000)

  test('committer remote_pr 未经过独立高风险确认时不会执行远端写', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-remote-denied-repo-'))
    setupPipelineGitRepo(repoRoot)
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-committer-remote-denied',
      sessionId: 'session-committer-remote-denied',
      node: 'committer',
      kind: 'submission_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    let remoteCalls = 0
    const service = createPipelineService({
      createRemoteSubmission: () => {
        remoteCalls += 1
        throw new Error('未确认时不应执行远端写')
      },
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('未确认时不应恢复 graph')
        },
        getState: async () => ({
          sessionId: 'session-committer-remote-denied',
          version: 2,
          currentNode: 'committer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('committer 远端确认阻断测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'committer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-committer-remote-denied',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'remote_pr',
        allowRemoteWrites: true,
        status: 'committing',
      })
      const commitRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-remote-denied',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'commit_doc',
        createdByNode: 'committer',
        content: '# Commit 准备\n',
      })
      const prRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-remote-denied',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'pr_doc',
        createdByNode: 'committer',
        content: '# PR 草稿\n',
      })
      const commitHash = runGit(repoRoot, ['rev-parse', 'HEAD'])
      appendPipelineNodeCompleteRecords(session.id, {
        type: 'node_complete',
        node: 'committer',
        output: '{}',
        summary: '本地 commit 已创建',
        approved: true,
        issues: [],
        artifact: {
          node: 'committer',
          summary: '本地 commit 已创建',
          commitMessage: 'feat(pipeline): add remote gate',
          prTitle: 'Add remote gate',
          prBody: '## Summary\n- Add remote gate',
          submissionStatus: 'local_commit_created',
          blockers: [],
          risks: [],
          commitDocRef: commitRef,
          prDocRef: prRef,
          localCommit: {
            attempted: true,
            status: 'created',
            operationId: 'op-local-before-remote',
            commitHash,
            workingBranch: 'feature/remote-gate',
            baseBranch: 'main',
          },
          remoteSubmission: {
            attempted: false,
            status: 'not_requested',
          },
          content: '{}',
        },
        createdAt: Date.now(),
      })

      await expect(service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'remote_write_confirmation',
        action: 'approve',
        submissionMode: 'remote_pr',
        remoteSubmissionOperationId: 'op-remote-denied',
        remoteWriteConfirmed: false,
        createdAt: Date.now(),
      })).rejects.toThrow('用户未确认远端写')

      expect(remoteCalls).toBe(0)
      expect(getContributionTaskEvents('task-committer-remote-denied')
        .filter((event) => event.type === 'remote_submission_created')).toHaveLength(0)
      expect(getPipelineRecords(session.id).find((record) => record.type === 'gate_decision')).toBeUndefined()
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('committer remote_pr 会回填远端结果并通过 operation id 保持幂等', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-remote-repo-'))
    setupPipelineGitRepo(repoRoot)
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-committer-remote',
      sessionId: 'session-committer-remote',
      node: 'committer',
      kind: 'submission_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    let remoteCalls = 0
    const service = createPipelineService({
      createRemoteSubmission: (input) => {
        remoteCalls += 1
        return {
          attempted: true,
          operationId: input.operationId,
          status: 'created',
          type: 'pull_request',
          commitHash: input.commitHash,
          remoteName: input.remoteName ?? 'origin',
          sanitizedRemoteUrl: 'https://github.com/example/repo.git',
          headBranch: input.headBranch ?? 'feature/remote-gate',
          baseBranch: input.baseBranch ?? 'main',
          prTitle: input.prTitle,
          prBody: input.prBody,
          prUrl: 'https://github.com/example/repo/pull/42',
          draft: input.draft ?? true,
          createdAt: 123456,
        }
      },
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async (input: { sessionId: string }) => ({
          state: {
            sessionId: input.sessionId,
            version: 2,
            currentNode: 'committer',
            status: 'completed',
            reviewIteration: 0,
            lastApprovedNode: 'committer',
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-committer-remote',
          version: 2,
          currentNode: 'committer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('committer 远端提交测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'committer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-committer-remote',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'remote_pr',
        allowRemoteWrites: false,
        status: 'committing',
      })
      const commitRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-remote',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'commit_doc',
        createdByNode: 'committer',
        content: '# Commit 准备\n',
      })
      const prRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-remote',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'pr_doc',
        createdByNode: 'committer',
        content: '# PR 草稿\n',
      })
      const commitHash = runGit(repoRoot, ['rev-parse', 'HEAD'])
      appendPipelineNodeCompleteRecords(session.id, {
        type: 'node_complete',
        node: 'committer',
        output: '{}',
        summary: '本地 commit 已创建',
        approved: true,
        issues: [],
        artifact: {
          node: 'committer',
          summary: '本地 commit 已创建',
          commitMessage: 'feat(pipeline): add remote gate',
          prTitle: 'Add remote gate',
          prBody: '## Summary\n- Add remote gate',
          submissionStatus: 'local_commit_created',
          blockers: [],
          risks: [],
          commitDocRef: commitRef,
          prDocRef: prRef,
          localCommit: {
            attempted: true,
            status: 'created',
            operationId: 'op-local-before-remote',
            commitHash,
            workingBranch: 'feature/remote-gate',
            baseBranch: 'main',
          },
          remoteSubmission: {
            attempted: false,
            status: 'not_requested',
          },
          content: '{}',
        },
        createdAt: Date.now(),
      })
      const response: PipelineGateResponse = {
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'remote_write_confirmation',
        action: 'approve',
        submissionMode: 'remote_pr',
        remoteSubmissionOperationId: 'op-remote-created',
        remoteWriteConfirmed: true,
        createdAt: Date.now(),
      }

      await service.respondGate(response)

      expect(remoteCalls).toBe(1)
      expect(getContributionTask('task-committer-remote')).toMatchObject({
        status: 'completed',
        contributionMode: 'remote_pr',
        allowRemoteWrites: true,
      })
      expect(getContributionTaskEvents('task-committer-remote')
        .filter((event) => event.type === 'remote_submission_created')).toHaveLength(1)
      await expect(service.getSessionState(session.id)).resolves.toMatchObject({
        stageOutputs: {
          committer: {
            submissionStatus: 'remote_pr_created',
            remoteSubmission: {
              attempted: true,
              status: 'created',
              operationId: 'op-remote-created',
              prUrl: 'https://github.com/example/repo/pull/42',
            },
          },
        },
      })
      expect(getPipelineRecords(session.id).find((record) => record.type === 'gate_decision')).toMatchObject({
        type: 'gate_decision',
        kind: 'remote_write_confirmation',
        submissionMode: 'remote_pr',
        remoteSubmissionOperationId: 'op-remote-created',
      })

      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'committer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      await service.respondGate(response)
      expect(remoteCalls).toBe(1)
      expect(getContributionTaskEvents('task-committer-remote')
        .filter((event) => event.type === 'remote_submission_created')).toHaveLength(1)
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('committer remote_pr 必须使用 remote_write_confirmation gate kind', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-remote-kind-repo-'))
    setupPipelineGitRepo(repoRoot)
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-committer-remote-kind',
      sessionId: 'session-committer-remote-kind',
      node: 'committer',
      kind: 'submission_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    let remoteCalls = 0
    const service = createPipelineService({
      createRemoteSubmission: () => {
        remoteCalls += 1
        throw new Error('gate kind 错误时不应执行远端写')
      },
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('gate kind 错误时不应恢复 graph')
        },
        getState: async () => ({
          sessionId: 'session-committer-remote-kind',
          version: 2,
          currentNode: 'committer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('committer 远端 gate kind 测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'committer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-committer-remote-kind',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'remote_pr',
        allowRemoteWrites: false,
        status: 'committing',
      })
      const commitRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-remote-kind',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'commit_doc',
        createdByNode: 'committer',
        content: '# Commit 准备\n',
      })
      const prRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-remote-kind',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'pr_doc',
        createdByNode: 'committer',
        content: '# PR 草稿\n',
      })
      const commitHash = runGit(repoRoot, ['rev-parse', 'HEAD'])
      appendPipelineNodeCompleteRecords(session.id, {
        type: 'node_complete',
        node: 'committer',
        output: '{}',
        summary: '本地 commit 已创建',
        approved: true,
        issues: [],
        artifact: {
          node: 'committer',
          summary: '本地 commit 已创建',
          commitMessage: 'feat(pipeline): add remote gate',
          prTitle: 'Add remote gate',
          prBody: '## Summary\n- Add remote gate',
          submissionStatus: 'local_commit_created',
          blockers: [],
          risks: [],
          commitDocRef: commitRef,
          prDocRef: prRef,
          localCommit: {
            attempted: true,
            status: 'created',
            operationId: 'op-local-before-remote',
            commitHash,
            workingBranch: 'feature/remote-gate',
            baseBranch: 'main',
          },
          remoteSubmission: {
            attempted: false,
            status: 'not_requested',
          },
          content: '{}',
        },
        createdAt: Date.now(),
      })

      await expect(service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'submission_review',
        action: 'approve',
        submissionMode: 'remote_pr',
        remoteSubmissionOperationId: 'op-remote-kind',
        remoteWriteConfirmed: true,
        createdAt: Date.now(),
      })).rejects.toThrow('远端写必须使用独立高风险确认')

      expect(remoteCalls).toBe(0)
      expect(getPipelineRecords(session.id).find((record) => record.type === 'gate_decision')).toBeUndefined()
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('committer remote_pr 在 push 成功但 PR 失败后可用同一 operation id 恢复且不重复 push', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-remote-retry-repo-'))
    setupPipelineGitRepo(repoRoot)
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-committer-remote-retry',
      sessionId: 'session-committer-remote-retry',
      node: 'committer',
      kind: 'submission_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    const remoteSkipPushFlags: boolean[] = []
    const service = createPipelineService({
      createRemoteSubmission: (input) => {
        remoteSkipPushFlags.push(input.skipPush === true)
        if (input.skipPush) {
          return {
            attempted: true,
            operationId: input.operationId,
            status: 'created',
            type: 'pull_request',
            commitHash: input.commitHash,
            remoteName: input.remoteName ?? 'origin',
            sanitizedRemoteUrl: 'https://github.com/example/repo.git',
            headBranch: input.headBranch ?? 'feature/remote-gate',
            baseBranch: input.baseBranch ?? 'main',
            pushedRef: 'refs/heads/feature/remote-gate',
            prTitle: input.prTitle,
            prBody: input.prBody,
            prUrl: 'https://github.com/example/repo/pull/42',
            draft: input.draft ?? true,
            createdAt: 123457,
          }
        }

        throw new PipelineRemoteSubmissionError(
          'gh pr create failed for https://user:secret@github.com/example/repo.git GH_TOKEN=ghp_secretsecretsecret',
          {
            attempted: true,
            operationId: input.operationId,
            status: 'pushed',
            type: 'pull_request',
            commitHash: input.commitHash,
            remoteName: input.remoteName ?? 'origin',
            sanitizedRemoteUrl: 'https://github.com/example/repo.git',
            headBranch: input.headBranch ?? 'feature/remote-gate',
            baseBranch: input.baseBranch ?? 'main',
            pushedRef: 'refs/heads/feature/remote-gate',
            prTitle: input.prTitle,
            prBody: input.prBody,
            draft: input.draft ?? true,
            error: 'gh pr create failed for https://user:secret@github.com/example/repo.git GH_TOKEN=ghp_secretsecretsecret',
            createdAt: 123456,
          },
        )
      },
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async (input: { sessionId: string }) => ({
          state: {
            sessionId: input.sessionId,
            version: 2,
            currentNode: 'committer',
            status: 'completed',
            reviewIteration: 0,
            lastApprovedNode: 'committer',
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-committer-remote-retry',
          version: 2,
          currentNode: 'committer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('committer 远端恢复测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'committer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-committer-remote-retry',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'remote_pr',
        allowRemoteWrites: false,
        status: 'committing',
      })
      const commitRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-remote-retry',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'commit_doc',
        createdByNode: 'committer',
        content: '# Commit 准备\n',
      })
      const prRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-remote-retry',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'pr_doc',
        createdByNode: 'committer',
        content: '# PR 草稿\n',
      })
      const commitHash = runGit(repoRoot, ['rev-parse', 'HEAD'])
      appendPipelineNodeCompleteRecords(session.id, {
        type: 'node_complete',
        node: 'committer',
        output: '{}',
        summary: '本地 commit 已创建',
        approved: true,
        issues: [],
        artifact: {
          node: 'committer',
          summary: '本地 commit 已创建',
          commitMessage: 'feat(pipeline): add remote gate',
          prTitle: 'Add remote gate',
          prBody: '## Summary\n- Add remote gate',
          submissionStatus: 'local_commit_created',
          blockers: [],
          risks: [],
          commitDocRef: commitRef,
          prDocRef: prRef,
          localCommit: {
            attempted: true,
            status: 'created',
            operationId: 'op-local-before-remote',
            commitHash,
            workingBranch: 'feature/remote-gate',
            baseBranch: 'main',
          },
          remoteSubmission: {
            attempted: false,
            status: 'not_requested',
          },
          content: '{}',
        },
        createdAt: Date.now(),
      })
      const response: PipelineGateResponse = {
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'remote_write_confirmation',
        action: 'approve',
        submissionMode: 'remote_pr',
        remoteSubmissionOperationId: 'op-remote-retry',
        remoteWriteConfirmed: true,
        createdAt: Date.now(),
      }

      await expect(service.respondGate(response)).rejects.toThrow('[REDACTED]')
      expect(remoteSkipPushFlags).toEqual([false])
      const failedEvents = getContributionTaskEvents('task-committer-remote-retry')
        .filter((event) => event.type === 'remote_submission_failed')
      expect(failedEvents).toHaveLength(1)
      expect(JSON.stringify(failedEvents[0]?.payload)).not.toContain('secret')
      await expect(service.getSessionState(session.id)).resolves.toMatchObject({
        stageOutputs: {
          committer: {
            submissionStatus: 'remote_pr_failed',
            remoteSubmission: {
              status: 'pushed',
              operationId: 'op-remote-retry',
            },
          },
        },
      })

      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'committer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      await service.respondGate(response)

      expect(remoteSkipPushFlags).toEqual([false, true])
      expect(getContributionTaskEvents('task-committer-remote-retry')
        .filter((event) => event.type === 'remote_submission_created')).toHaveLength(1)
      await expect(service.getSessionState(session.id)).resolves.toMatchObject({
        stageOutputs: {
          committer: {
            submissionStatus: 'remote_pr_created',
            remoteSubmission: {
              status: 'created',
              operationId: 'op-remote-retry',
              prUrl: 'https://github.com/example/repo/pull/42',
            },
          },
        },
      })
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('committer submission_review local_commit 会先校验提交材料再执行本地提交', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-committer-docs-repo-'))
    setupPipelineGitRepo(repoRoot)
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-committer-docs',
      sessionId: 'session-committer-docs',
      node: 'committer',
      kind: 'submission_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('提交材料校验失败时不应恢复 graph')
        },
        getState: async () => ({
          sessionId: 'session-committer-docs',
          version: 2,
          currentNode: 'committer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('committer 提交材料校验测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'committer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-committer-docs',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_commit',
        allowRemoteWrites: false,
        status: 'committing',
      })
      writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 3\n', 'utf-8')
      const commitRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-docs',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'commit_doc',
        createdByNode: 'committer',
        content: '# Commit 准备\n',
      })
      const prRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-docs',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'pr_doc',
        createdByNode: 'committer',
        content: '# PR 草稿\n',
      })
      appendPipelineNodeCompleteRecords(session.id, {
        type: 'node_complete',
        node: 'committer',
        output: '{}',
        summary: '提交材料已生成',
        approved: true,
        issues: [],
        artifact: {
          node: 'committer',
          summary: '提交材料已生成',
          commitMessage: 'feat(pipeline): validate submission docs',
          prTitle: 'Validate submission docs',
          prBody: '## Summary\n- Validate submission docs',
          submissionStatus: 'draft_only',
          blockers: [],
          risks: [],
          commitDocRef: commitRef,
          prDocRef: prRef,
          localCommit: {
            attempted: false,
            status: 'not_requested',
          },
          remoteSubmission: {
            attempted: false,
            status: 'not_requested',
          },
          content: '{}',
        },
        createdAt: Date.now(),
      })
      writeFileSync(join(repoRoot, 'patch-work', 'commit.md'), '# Commit 准备\n\n被外部修改\n', 'utf-8')
      const commitCountBefore = Number(runGit(repoRoot, ['rev-list', '--count', 'HEAD']))

      await expect(service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'submission_review',
        action: 'approve',
        submissionMode: 'local_commit',
        localCommitOperationId: 'op-service-local-commit-docs',
        createdAt: Date.now(),
      })).rejects.toThrow('checksum 已变化')

      expect(Number(runGit(repoRoot, ['rev-list', '--count', 'HEAD']))).toBe(commitCountBefore)
      expect(getContributionTask('task-committer-docs')).toMatchObject({
        status: 'committing',
      })
      expect(getContributionTaskEvents('task-committer-docs')
        .filter((event) => event.type === 'local_commit_failed')).toHaveLength(1)
      expect(getPipelineRecords(session.id).find((record) => record.type === 'gate_decision')).toBeUndefined()
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('committer submission_review approve 会在后端拒绝非 draft-only 产物状态', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-committer-blocked-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-committer-blocked',
      sessionId: 'session-committer-blocked',
      node: 'committer',
      kind: 'submission_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('blocked committer 不应恢复 graph')
        },
        getState: async () => ({
          sessionId: 'session-committer-blocked',
          version: 2,
          currentNode: 'committer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('committer 阻塞审核测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'committer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-committer-blocked',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'committing',
      })
      const commitRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-blocked',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'commit_doc',
        createdByNode: 'committer',
        content: '# Commit 准备\n',
      })
      const prRef = writePatchWorkFile({
        contributionTaskId: 'task-committer-blocked',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'pr_doc',
        createdByNode: 'committer',
        content: '# PR 草稿\n',
      })
      appendPipelineNodeCompleteRecords(session.id, {
        type: 'node_complete',
        node: 'committer',
        output: '{}',
        summary: '提交材料被阻塞',
        approved: false,
        issues: ['缺少提交规范'],
        artifact: {
          node: 'committer',
          summary: '提交材料被阻塞',
          commitMessage: 'feat(pipeline): add draft submission',
          prTitle: 'Add draft submission materials',
          prBody: '## Summary\n- Add draft submission',
          submissionStatus: 'blocked',
          blockers: ['缺少提交规范'],
          risks: [],
          commitDocRef: commitRef,
          prDocRef: prRef,
          content: '{}',
        },
        createdAt: Date.now(),
      })

      await expect(service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'submission_review',
        action: 'approve',
        submissionMode: 'local_patch',
        createdAt: Date.now(),
      })).rejects.toThrow('committer 提交材料不是 draft-only 状态')

      appendPipelineNodeCompleteRecords(session.id, {
        type: 'node_complete',
        node: 'committer',
        output: '{}',
        summary: '模型声称已创建本地提交',
        approved: false,
        issues: [],
        artifact: {
          node: 'committer',
          summary: '模型声称已创建本地提交',
          commitMessage: 'feat(pipeline): add draft submission',
          prTitle: 'Add draft submission materials',
          prBody: '## Summary\n- Add draft submission',
          submissionStatus: 'local_commit_created',
          blockers: [],
          risks: [],
          commitDocRef: commitRef,
          prDocRef: prRef,
          localCommit: {
            attempted: true,
            status: 'created',
            commitHash: 'abc123',
          },
          content: '{}',
        },
        createdAt: Date.now() + 1,
      })

      await expect(service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'submission_review',
        action: 'approve',
        submissionMode: 'local_patch',
        createdAt: Date.now(),
      })).rejects.toThrow('committer 提交材料不是 draft-only 状态')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('tester document_review approve 会在后端拒绝包含 patch-work 的 patch-set', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-unsafe-patch-set-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-tester-unsafe-patch',
      sessionId: 'session-tester-unsafe-patch',
      node: 'tester',
      kind: 'document_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('unsafe patch-set 不应恢复 graph')
        },
        getState: async () => ({
          sessionId: 'session-tester-unsafe-patch',
          version: 2,
          currentNode: 'tester',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('unsafe patch-set 审核测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'tester',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-tester-unsafe-patch',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'testing',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-unsafe-patch',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'test_result',
        createdByNode: 'tester',
        content: '# 测试报告\n\n通过。\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-unsafe-patch',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'patch',
        createdByNode: 'tester',
        content: 'diff --git a/patch-work/result.md b/patch-work/result.md\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-unsafe-patch',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'changed_files',
        createdByNode: 'tester',
        content: '[{"path":"patch-work/result.md"}]\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-unsafe-patch',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'diff_summary',
        createdByNode: 'tester',
        content: '# Diff 摘要\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-unsafe-patch',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'test_evidence',
        createdByNode: 'tester',
        content: '[{"command":"bun test","status":"passed","summary":"通过"}]\n',
      })

      await expect(service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'document_review',
        action: 'approve',
        createdAt: Date.now(),
      })).rejects.toThrow('patch-set 包含 patch-work/**')
      expect(getContributionTask('task-tester-unsafe-patch')).toMatchObject({
        status: 'testing',
      })
      const patchEntry = readPatchWorkManifest(repoRoot).files.find((file) =>
        file.relativePath === 'patch-set/changes.patch')
      expect(patchEntry?.acceptedRevision).toBeUndefined()
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('tester document_review approve 会在后端拒绝未通过的测试证据', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-failed-evidence-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-tester-failed-evidence',
      sessionId: 'session-tester-failed-evidence',
      node: 'tester',
      kind: 'document_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('失败测试证据不应恢复 graph')
        },
        getState: async () => ({
          sessionId: 'session-tester-failed-evidence',
          version: 2,
          currentNode: 'tester',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('tester 失败证据审核测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'tester',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-tester-failed-evidence',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'testing',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-failed-evidence',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'test_result',
        createdByNode: 'tester',
        content: '# 测试报告\n\n存在失败。\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-failed-evidence',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'patch',
        createdByNode: 'tester',
        content: 'diff --git a/src/index.ts b/src/index.ts\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-failed-evidence',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'changed_files',
        createdByNode: 'tester',
        content: '[{"path":"src/index.ts"}]\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-failed-evidence',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'diff_summary',
        createdByNode: 'tester',
        content: '# Diff 摘要\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-failed-evidence',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'test_evidence',
        createdByNode: 'tester',
        content: '[{"command":"bun test","status":"failed","summary":"失败"}]\n',
      })

      await expect(service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'document_review',
        action: 'approve',
        createdAt: Date.now(),
      })).rejects.toThrow('tester 测试证据未全部通过')
      expect(getContributionTask('task-tester-failed-evidence')).toMatchObject({
        status: 'testing',
      })
      const evidenceEntry = readPatchWorkManifest(repoRoot).files.find((file) =>
        file.relativePath === 'patch-set/test-evidence.json')
      expect(evidenceEntry?.acceptedRevision).toBeUndefined()
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('tester test_blocked approve 会作为风险接受进入 committing', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-blocked-approve-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-tester-blocked-approve',
      sessionId: 'session-tester-blocked-approve',
      node: 'tester',
      kind: 'test_blocked',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => ({
          state: {
            sessionId: 'session-tester-blocked-approve',
            version: 2,
            currentNode: 'committer',
            status: 'running',
            reviewIteration: 0,
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-tester-blocked-approve',
          version: 2,
          currentNode: 'tester',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('tester 阻塞风险接受测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'tester',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-tester-blocked-approve',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'testing',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-blocked-approve',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'test_result',
        createdByNode: 'tester',
        content: '# 测试报告\n\n测试阻塞，人工接受风险。\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-blocked-approve',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'patch',
        createdByNode: 'tester',
        content: 'diff --git a/src/index.ts b/src/index.ts\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-blocked-approve',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'changed_files',
        createdByNode: 'tester',
        content: '[{"path":"src/index.ts"}]\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-blocked-approve',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'diff_summary',
        createdByNode: 'tester',
        content: '# Diff 摘要\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-tester-blocked-approve',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'test_evidence',
        createdByNode: 'tester',
        content: '[{"command":"bun test","status":"skipped","summary":"环境缺失"}]\n',
      })

      await service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'test_blocked',
        action: 'approve',
        createdAt: Date.now(),
      })

      expect(getContributionTask('task-tester-blocked-approve')).toMatchObject({
        status: 'committing',
      })
      const evidenceEntry = readPatchWorkManifest(repoRoot).files.find((file) =>
        file.relativePath === 'patch-set/test-evidence.json')
      expect(evidenceEntry?.acceptedByGateId).toBe(gateRequest.gateId)
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('tester test_blocked reject_with_feedback 会把 ContributionTask 退回 developing', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-tester-reject-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-tester-reject',
      sessionId: 'session-tester-reject',
      node: 'tester',
      kind: 'test_blocked',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => ({
          state: {
            sessionId: 'session-tester-reject',
            version: 2,
            currentNode: 'developer',
            status: 'running',
            reviewIteration: 0,
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-tester-reject',
          version: 2,
          currentNode: 'tester',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('tester 退回开发测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'tester',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-tester-reject',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'testing',
      })

      await service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'test_blocked',
        action: 'reject_with_feedback',
        feedback: '请回到 developer 修复失败用例',
        createdAt: Date.now(),
      })

      expect(getContributionTask('task-tester-reject')).toMatchObject({
        status: 'developing',
        currentGateId: gateRequest.gateId,
      })
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('patch-work 文件读取只允许 manifest 登记文件', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-read-repo-'))
    const service = createPipelineService()

    try {
      const session = service.createSession('patch-work 读取范围测试', 'channel-1', 'workspace-1')
      createContributionTask({
        id: 'task-read-range',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'plan_review',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-read-range',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'implementation_plan',
        createdByNode: 'planner',
        content: '# 开发方案\n',
      })
      writeFileSync(join(repoRoot, 'patch-work', 'untracked.md'), '# 未登记文件\n', 'utf-8')

      expect(service.readPatchWorkFile({
        sessionId: session.id,
        relativePath: 'plan.md',
      })).toContain('开发方案')
      expect(() => service.readPatchWorkFile({
        sessionId: session.id,
        relativePath: 'untracked.md',
      })).toThrow('未登记')
      expect(() => service.readPatchWorkFile({
        sessionId: session.id,
        relativePath: 'manifest.json',
      })).toThrow('未登记')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('patch-work 目录打开入口只按 sessionId 解析仓库内固定目录', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-open-patch-work-'))
    const repoWithoutPatchWork = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-missing-patch-work-'))
    const outsideRoot = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-service-outside-patch-work-'))
    const service = createPipelineService()

    try {
      const session = service.createSession('patch-work 打开目录测试', 'channel-1', 'workspace-1')
      const missingPatchWorkSession = service.createSession('patch-work 缺失测试', 'channel-1', 'workspace-1')
      const expectedPatchWorkDir = join(repoRoot, 'patch-work')
      mkdirSync(expectedPatchWorkDir, { recursive: true })
      createContributionTask({
        id: 'task-open-patch-work',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(outsideRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'testing',
      })
      createContributionTask({
        id: 'task-missing-patch-work',
        pipelineSessionId: missingPatchWorkSession.id,
        repositoryRoot: repoWithoutPatchWork,
        patchWorkDir: join(repoWithoutPatchWork, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'testing',
      })

      expect(service.getPatchWorkDir(session.id)).toBe(expectedPatchWorkDir)
      expect(service.getPatchWorkDir(session.id)).not.toContain(outsideRoot)
      expect(() => service.getPatchWorkDir(missingPatchWorkSession.id)).toThrow('patch-work 目录不存在')
      expect(() => service.getPatchWorkDir('missing-session')).toThrow('未找到 Pipeline 会话')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(repoWithoutPatchWork, { recursive: true, force: true })
      rmSync(outsideRoot, { recursive: true, force: true })
    }
  })

  test('内存 gate 已消费但 resume 未结束时，重复响应不应写入重复 gate decision', async () => {
    let sessionId = ''
    let gateRequest: PipelineGateRequest = {
      gateId: 'gate-race',
      sessionId,
      node: 'reviewer',
      iteration: 0,
      createdAt: Date.now(),
    }
    let markResumeStarted: () => void = () => undefined
    let finishResume: () => void = () => undefined
    const resumeStarted = new Promise<void>((resolve) => {
      markResumeStarted = resolve
    })
    const graphCalls: string[] = []
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          graphCalls.push('invoke')
          return {
            state: {
              sessionId,
              currentNode: 'reviewer',
              status: 'waiting_human',
              reviewIteration: 0,
              pendingGate: gateRequest,
              updatedAt: Date.now(),
            },
            interrupted: gateRequest,
          }
        },
        resume: async () => {
          graphCalls.push('resume')
          markResumeStarted()
          return new Promise<{ state: PipelineStateSnapshot }>((resolve) => {
            finishResume = () => resolve({
              state: {
                sessionId,
                currentNode: 'tester',
                status: 'completed',
                reviewIteration: 0,
                lastApprovedNode: 'tester',
                pendingGate: null,
                updatedAt: Date.now(),
              },
            })
          })
        },
        getState: async () => ({
          sessionId,
          currentNode: 'reviewer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('gate 竞态测试', 'channel-1', 'workspace-1')
    sessionId = session.id
    gateRequest = {
      ...gateRequest,
      sessionId,
    }
    const response: PipelineGateResponse = {
      gateId: gateRequest.gateId,
      sessionId,
      action: 'approve',
      createdAt: Date.now(),
    }
    const startPromise = service.start({
      sessionId,
      userInput: '触发人工审核',
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    await service.respondGate(response)
    await resumeStarted

    expect(getPipelineRecords(sessionId).filter((record) => record.type === 'gate_decision')).toHaveLength(1)
    await service.respondGate({
      ...response,
      createdAt: Date.now(),
    })
    expect(getPipelineRecords(sessionId).filter((record) => record.type === 'gate_decision')).toHaveLength(1)

    finishResume()
    await startPromise
    expect(graphCalls).toEqual(['invoke', 'resume'])
  })

  test('等待人工审核时 stop 不应继续 resume graph，并应落为 terminated', async () => {
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-stop',
      sessionId: 'session-stop',
      node: 'planner',
      iteration: 0,
      createdAt: Date.now(),
    }

    const runningState: PipelineStateSnapshot = {
      sessionId: 'session-stop',
      currentNode: 'planner',
      status: 'waiting_human',
      reviewIteration: 0,
      pendingGate: gateRequest,
      updatedAt: Date.now(),
    }

    const graphCalls: string[] = []
    const events: PipelineStreamPayload[] = []

    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          graphCalls.push('invoke')
          return { state: runningState, interrupted: gateRequest }
        },
        resume: async () => {
          graphCalls.push('resume')
          return { state: runningState }
        },
        getState: async () => runningState,
      }),
    })

    const session = service.createSession('停止测试', 'channel-1', 'workspace-1')
    const startPromise = service.start(
      {
        sessionId: session.id,
        userInput: '请在 gate 等待时停止',
      },
      {
        onEvent: (payload) => events.push(payload),
      },
    )

    await new Promise((resolve) => setTimeout(resolve, 0))
    const stoppedState = service.stop(session.id)
    await startPromise

    expect(stoppedState).toMatchObject({
      sessionId: session.id,
      status: 'terminated',
      pendingGate: null,
    })
    expect(graphCalls).toEqual(['invoke'])
    expect((await service.listSessions()).find((item) => item.id === session.id)?.status).toBe('terminated')
    expect(events.some((payload) =>
      payload.event.type === 'status_change' && payload.event.status === 'terminated')).toBe(true)
  })

  test('resume 路径失败时也应写回 node_failed 状态', async () => {
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-resume-error',
      sessionId: 'session-resume-error',
      node: 'reviewer',
      iteration: 0,
      createdAt: Date.now(),
    }

    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('resume exploded')
        },
        getState: async () => ({
          sessionId: 'session-resume-error',
          currentNode: 'reviewer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('恢复失败测试', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      currentNode: 'reviewer',
      status: 'waiting_human',
      pendingGate: {
        ...gateRequest,
        sessionId: session.id,
      },
    })

    await expect(service.respondGate({
      gateId: gateRequest.gateId,
      sessionId: session.id,
      action: 'approve',
      createdAt: Date.now(),
    })).rejects.toThrow('resume exploded')

    expect((await service.listSessions()).find((item) => item.id === session.id)?.status).toBe('node_failed')
  })

  test('陈旧 gate 响应不应恢复 graph 或写入 gate decision', async () => {
    const pendingGate: PipelineGateRequest = {
      gateId: 'gate-current',
      sessionId: 'session-stale-gate',
      node: 'planner',
      iteration: 0,
      createdAt: Date.now(),
    }
    const graphCalls: string[] = []
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          graphCalls.push('invoke')
          return {
            state: {
              sessionId: 'session-stale-gate',
              currentNode: 'planner',
              status: 'waiting_human',
              reviewIteration: 0,
              pendingGate,
              updatedAt: Date.now(),
            },
            interrupted: pendingGate,
          }
        },
        resume: async () => {
          graphCalls.push('resume')
          return {
            state: {
              sessionId: 'session-stale-gate',
              currentNode: 'tester',
              status: 'completed',
              reviewIteration: 0,
              pendingGate: null,
              updatedAt: Date.now(),
            },
          }
        },
        getState: async () => ({
          sessionId: 'session-stale-gate',
          currentNode: 'planner',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('陈旧 gate 测试', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      currentNode: 'planner',
      status: 'waiting_human',
      pendingGate: {
        ...pendingGate,
        sessionId: session.id,
      },
    })

    await expect(service.respondGate({
      gateId: 'gate-stale',
      sessionId: session.id,
      action: 'approve',
      createdAt: Date.now(),
    })).rejects.toThrow('Pipeline gate 已过期')

    expect(graphCalls).toEqual([])
    expect(getPipelineRecords(session.id).filter((record) => record.type === 'gate_decision')).toHaveLength(0)
    expect((await service.listSessions()).find((item) => item.id === session.id)?.status).toBe('waiting_human')
  })

  test('没有 pending gate 的重复响应应安全忽略，不应恢复 graph', async () => {
    const graphCalls: string[] = []
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          graphCalls.push('invoke')
          return {
            state: {
              sessionId: 'session-duplicate-gate',
              currentNode: 'tester',
              status: 'completed',
              reviewIteration: 0,
              pendingGate: null,
              updatedAt: Date.now(),
            },
          }
        },
        resume: async () => {
          graphCalls.push('resume')
          return {
            state: {
              sessionId: 'session-duplicate-gate',
              currentNode: 'tester',
              status: 'completed',
              reviewIteration: 0,
              pendingGate: null,
              updatedAt: Date.now(),
            },
          }
        },
        getState: async () => ({
          sessionId: 'session-duplicate-gate',
          currentNode: 'tester',
          status: 'completed',
          reviewIteration: 0,
          pendingGate: null,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('重复 gate 响应测试', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      currentNode: 'tester',
      status: 'completed',
      pendingGate: null,
    })

    await service.respondGate({
      gateId: 'gate-already-done',
      sessionId: session.id,
      action: 'approve',
      createdAt: Date.now(),
    })

    expect(graphCalls).toEqual([])
    expect(getPipelineRecords(session.id).filter((record) => record.type === 'gate_decision')).toHaveLength(0)
  })

  test('运行中的 Pipeline 会话不能直接删除', async () => {
    const invokeController: {
      resolve?: (value: { state: PipelineStateSnapshot }) => void
    } = {}
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => new Promise<{ state: PipelineStateSnapshot }>((resolve) => {
          invokeController.resolve = resolve
        }),
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async () => ({
          sessionId: 'session-active-delete',
          currentNode: 'developer',
          status: 'running',
          reviewIteration: 0,
          pendingGate: null,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('运行中删除保护测试', 'channel-1', 'workspace-1')
    const startPromise = service.start({
      sessionId: session.id,
      userInput: '保持运行',
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(() => service.deleteSession(session.id)).toThrow('Pipeline 会话正在运行中')
    expect((await service.listSessions()).some((item) => item.id === session.id)).toBe(true)

    invokeController.resolve?.({
      state: {
        sessionId: session.id,
        currentNode: 'tester',
        status: 'completed',
        reviewIteration: 0,
        pendingGate: null,
        updatedAt: Date.now(),
      },
    })
    await startPromise
  })

  test('置顶已归档 Pipeline 会话时自动取消归档', () => {
    const service = createPipelineService()
    const session = service.createSession('置顶归档互斥测试', 'channel-1', 'workspace-1')

    const archived = service.toggleArchive(session.id)
    expect(archived.archived).toBe(true)

    const pinned = service.togglePin(session.id)
    expect(pinned.pinned).toBe(true)
    expect(pinned.archived).toBe(false)
  })

  test('归档已置顶 Pipeline 会话时自动取消置顶', () => {
    const service = createPipelineService()
    const session = service.createSession('归档置顶互斥测试', 'channel-1', 'workspace-1')

    const pinned = service.togglePin(session.id)
    expect(pinned.pinned).toBe(true)

    const archived = service.toggleArchive(session.id)
    expect(archived.archived).toBe(true)
    expect(archived.pinned).toBe(false)
  })

  test('删除 Pipeline 会话前会校验真实 session，避免产物目录越界删除', () => {
    const service = createPipelineService()
    const outsideDir = join(tempConfigDir, 'outside')
    mkdirSync(outsideDir, { recursive: true })
    writeFileSync(join(outsideDir, 'keep.txt'), '不能被删除', 'utf-8')

    expect(() => service.deleteSession('../outside')).toThrow('未找到 Pipeline 会话')
    expect(existsSync(join(outsideDir, 'keep.txt'))).toBe(true)
  })

  test('删除真实 Pipeline 会话时会清理对应产物目录', () => {
    const service = createPipelineService()
    const session = service.createSession('删除产物测试', 'channel-1', 'workspace-1')
    const artifactsDir = resolvePipelineSessionArtifactsDir(session.id)
    writeFileSync(join(artifactsDir, 'artifact.md'), '# 产物', 'utf-8')

    service.deleteSession(session.id)

    expect(existsSync(artifactsDir)).toBe(false)
  })

  test('阶段产物落盘失败不应阻断 node_complete 记录追加', async () => {
    const service = createPipelineService()
    const session = service.createSession('落盘失败降级测试', 'channel-1', 'workspace-1')
    const originalWarn = console.warn
    console.warn = () => undefined

    try {
      appendPipelineNodeCompleteRecords(
        session.id,
        {
          type: 'node_complete',
          node: 'planner',
          output: '计划完成',
          summary: '按两步实现',
          artifact: {
            node: 'planner',
            summary: '按两步实现',
            steps: ['补测试', '改实现'],
            risks: [],
            verification: ['bun test'],
            content: '计划完成',
          },
          createdAt: 300,
        },
        () => {
          throw new Error('disk full')
        },
      )
    } finally {
      console.warn = originalWarn
    }

    const records = getPipelineRecords(session.id)
    const stageRecord = records[1]
    expect(records.map((record) => record.type)).toEqual(['node_output', 'stage_artifact'])
    expect(stageRecord).toMatchObject({
      type: 'stage_artifact',
      node: 'planner',
    })
    if (stageRecord?.type !== 'stage_artifact') {
      throw new Error('未找到阶段产物记录')
    }
    expect(stageRecord.artifactFiles).toBeUndefined()
    expect((await service.listSessions()).find((item) => item.id === session.id)?.status).not.toBe('node_failed')
  })

  test('listSessions 会将无 active runner 的遗留 running 会话降级为 recovery_failed', async () => {
    const service = createPipelineService()
    const session = service.createSession('遗留运行会话', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      status: 'running',
      currentNode: 'developer',
      pendingGate: null,
    })

    const sessions = await service.listSessions()
    const reconciled = sessions.find((item) => item.id === session.id)
    const statusRecords = getPipelineRecords(session.id).filter((record) => record.type === 'status_change')

    expect(reconciled).toMatchObject({
      status: 'recovery_failed',
      pendingGate: null,
    })
    expect(statusRecords.at(-1)).toMatchObject({
      type: 'status_change',
      status: 'recovery_failed',
    })
  })

  test('listSessions 会从 checkpoint 快照回填 waiting_human 的 pending gate', async () => {
    const pendingGate: PipelineGateRequest = {
      gateId: 'gate-recovered',
      sessionId: 'session-from-checkpoint',
      node: 'planner',
      iteration: 2,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async (sessionId: string) => ({
          sessionId,
          currentNode: 'planner',
          status: 'waiting_human',
          reviewIteration: 2,
          pendingGate: {
            ...pendingGate,
            sessionId,
          },
          updatedAt: Date.now(),
        }),
      }),
    })
    const session = service.createSession('恢复审核会话', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      status: 'waiting_human',
      currentNode: 'planner',
      reviewIteration: 0,
      pendingGate: null,
    })

    const sessions = await service.listSessions()
    const reconciled = sessions.find((item) => item.id === session.id)

    expect(reconciled).toMatchObject({
      status: 'waiting_human',
      currentNode: 'planner',
      reviewIteration: 2,
    })
    expect(reconciled?.pendingGate).toMatchObject({
      gateId: 'gate-recovered',
      sessionId: session.id,
      node: 'planner',
    })
    expect(service.getPendingGates()).toContainEqual(expect.objectContaining({
      gateId: 'gate-recovered',
      sessionId: session.id,
    }))
  })

  test('listSessions 不应使用旧 meta pendingGate 覆盖已完成 checkpoint', async () => {
    const service = createPipelineService({
      createGraph: (meta) => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async () => ({
          sessionId: meta.id,
          currentNode: 'tester',
          status: 'completed',
          reviewIteration: 0,
          lastApprovedNode: 'tester',
          pendingGate: null,
          updatedAt: Date.now(),
        }),
      }),
    })
    const session = service.createSession('旧 gate 不应复活', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      status: 'waiting_human',
      currentNode: 'reviewer',
      pendingGate: {
        gateId: 'gate-stale-meta',
        sessionId: session.id,
        node: 'reviewer',
        iteration: 0,
        createdAt: Date.now(),
      },
    })

    const sessions = await service.listSessions()
    const reconciled = sessions.find((item) => item.id === session.id)

    expect(reconciled).toMatchObject({
      status: 'completed',
      currentNode: 'tester',
      pendingGate: null,
      lastApprovedNode: 'tester',
    })
    expect(service.getPendingGates()).not.toContainEqual(expect.objectContaining({
      gateId: 'gate-stale-meta',
    }))
  })

  test('listSessions 读取 checkpoint 失败时不应信任 meta pendingGate', async () => {
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async () => {
          throw new Error('checkpoint missing')
        },
      }),
    })
    const session = service.createSession('旧 gate 但 checkpoint 丢失', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      status: 'waiting_human',
      currentNode: 'planner',
      pendingGate: {
        gateId: 'gate-stale-without-checkpoint',
        sessionId: session.id,
        node: 'planner',
        iteration: 0,
        createdAt: Date.now(),
      },
    })

    const sessions = await service.listSessions()

    expect(sessions.find((item) => item.id === session.id)).toMatchObject({
      status: 'recovery_failed',
      pendingGate: null,
    })
    expect(service.getPendingGates()).not.toContainEqual(expect.objectContaining({
      gateId: 'gate-stale-without-checkpoint',
    }))
  })

  test('listSessions 遇到不可恢复 checkpoint 时只降级对应会话', async () => {
    const service = createPipelineService({
      createGraph: (meta) => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async () => {
          if (meta.title === '损坏 checkpoint') {
            throw new Error('checkpoint corrupted')
          }
          return {
            sessionId: meta.id,
            currentNode: 'reviewer',
            status: 'waiting_human',
            reviewIteration: 1,
            pendingGate: {
              gateId: 'gate-ok',
              sessionId: meta.id,
              node: 'reviewer',
              iteration: 1,
              createdAt: Date.now(),
            },
            updatedAt: Date.now(),
          }
        },
      }),
    })
    const corrupted = service.createSession('损坏 checkpoint', 'channel-1', 'workspace-1')
    const healthy = service.createSession('健康 checkpoint', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(corrupted.id, {
      status: 'waiting_human',
      currentNode: 'developer',
      pendingGate: null,
    })
    updatePipelineSessionMeta(healthy.id, {
      status: 'waiting_human',
      currentNode: 'reviewer',
      pendingGate: null,
    })

    const sessions = await service.listSessions()

    expect(sessions.find((item) => item.id === corrupted.id)).toMatchObject({
      status: 'recovery_failed',
      pendingGate: null,
    })
    expect(sessions.find((item) => item.id === healthy.id)).toMatchObject({
      status: 'waiting_human',
      pendingGate: expect.objectContaining({ gateId: 'gate-ok' }),
    })
  })

  test('listSessions 遇到损坏 checkpoint 文件时降级为 recovery_failed', async () => {
    const setupService = createPipelineService()
    const session = setupService.createSession('损坏文件 checkpoint', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      status: 'waiting_human',
      currentNode: 'reviewer',
      pendingGate: {
        gateId: 'gate-corrupted-file',
        sessionId: session.id,
        node: 'reviewer',
        iteration: 0,
        createdAt: Date.now(),
      },
    })
    const checkpointDir = getPipelineSessionCheckpointDir(session.id)
    mkdirSync(checkpointDir, { recursive: true })
    writeFileSync(join(checkpointDir, 'memory-saver.json'), '{broken', 'utf-8')

    const originalWarn = console.warn
    console.warn = () => undefined
    try {
      const service = createPipelineService()
      const sessions = await service.listSessions()
      expect(sessions.find((item) => item.id === session.id)).toMatchObject({
        status: 'recovery_failed',
        pendingGate: null,
      })
    } finally {
      console.warn = originalWarn
    }
  })
})

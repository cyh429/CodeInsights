import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  PipelineCommitterStageOutput,
  PipelineTesterStageOutput,
} from '@codeinsights/shared'
import { appendPipelineRecord, createPipelineSession } from './pipeline-session-manager'
import {
  appendContributionTaskEvent,
  createContributionTask,
} from './contribution-task-service'
import {
  getContributionTaskSummary,
  getPipelineSubmissionPlan,
} from './pipeline-read-model-service'
import {
  initializePatchWork,
  writePatchWorkFile,
} from './pipeline-patch-work-service'

function runGit(repoRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function setupGitRepo(repoRoot: string): void {
  runGit(repoRoot, ['init'])
  runGit(repoRoot, ['config', 'user.name', 'CodeInsights Test'])
  runGit(repoRoot, ['config', 'user.email', 'codeinsights-test@example.com'])
  mkdirSync(join(repoRoot, 'src'), { recursive: true })
  writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 1\n', 'utf-8')
  runGit(repoRoot, ['add', 'src/index.ts'])
  runGit(repoRoot, ['commit', '-m', 'initial'])
  runGit(repoRoot, ['checkout', '-b', 'feature/pipeline-phase-4'])
}

function makeTesterOutput(): PipelineTesterStageOutput {
  return {
    node: 'tester',
    summary: '测试通过',
    commands: ['bun test'],
    results: ['通过'],
    blockers: [],
    passed: true,
    patchSet: {
      files: [
        {
          path: 'src/index.ts',
          changeType: 'modified',
          summary: '更新实现',
          additions: 2,
          deletions: 1,
        },
      ],
      additions: 2,
      deletions: 1,
      baseBranch: 'main',
      workingBranch: 'feature/pipeline-phase-4',
      headCommit: 'a'.repeat(40),
      testEvidence: [
        {
          command: 'bun test',
          status: 'passed',
          summary: '通过',
        },
      ],
      excludesPatchWork: true,
    },
    content: '{}',
  }
}

function makeCommitterOutput(patch: Partial<PipelineCommitterStageOutput> = {}): PipelineCommitterStageOutput {
  return {
    node: 'committer',
    summary: '提交材料已生成',
    commitMessage: 'feat(pipeline): expose contribution dashboard',
    prTitle: 'Expose contribution dashboard',
    prBody: '## Summary\n- Add dashboard\n\n## Tests\n- bun test',
    submissionStatus: 'draft_only',
    blockers: [],
    risks: [],
    localCommit: {
      attempted: false,
      status: 'not_requested',
    },
    remoteSubmission: {
      attempted: false,
      status: 'not_requested',
      remoteName: 'origin',
      baseBranch: 'main',
      headBranch: 'feature/pipeline-phase-4',
      draft: true,
    },
    content: '{}',
    ...patch,
  }
}

describe('pipeline-read-model-service', () => {
  const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
  let tempConfigDir = ''
  let tempRepos: string[] = []

  beforeEach(() => {
    tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-read-model-'))
    tempRepos = []
    process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
  })

  afterEach(() => {
    if (originalConfigDir == null) {
      delete process.env.CODEINSIGHTS_CONFIG_DIR
    } else {
      process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
    }
    rmSync(tempConfigDir, { recursive: true, force: true })
    for (const repo of tempRepos) {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('summary 缺少 ContributionTask 时返回可解释空态', () => {
    const summary = getContributionTaskSummary({ sessionId: 'missing-session' })

    expect(summary.sessionId).toBe('missing-session')
    expect(summary.task).toBeNull()
    expect(summary.recentEvents).toEqual([])
    expect(summary.error).toContain('未找到贡献任务')
  })

  test('summary 读取缺失 patch-work 时不创建本地目录', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-read-model-missing-patch-work-'))
    tempRepos.push(repoRoot)
    const patchWorkDir = join(repoRoot, 'patch-work')
    createContributionTask({
      id: 'task-readonly-summary',
      pipelineSessionId: 'session-readonly-summary',
      repositoryRoot: repoRoot,
      patchWorkDir,
      repositoryUrl: 'https://user:ghp_secretvalue@github.com/example/repo.git?token=secret#frag',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'created',
    })

    const summary = getContributionTaskSummary({ sessionId: 'session-readonly-summary' })

    expect(summary.patchWork?.manifestFound).toBe(false)
    expect(summary.repository?.url).not.toContain('ghp_secretvalue')
    expect(summary.repository?.url).toContain('token=***')
    expect(existsSync(patchWorkDir)).toBe(false)
  })

  test('summary 从 ContributionTask events 汇总本地 commit 和远端提交结果', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-read-model-summary-repo-'))
    tempRepos.push(repoRoot)
    initializePatchWork({
      contributionTaskId: 'task-summary',
      pipelineSessionId: 'session-summary',
      repositoryRoot: repoRoot,
    })
    createContributionTask({
      id: 'task-summary',
      pipelineSessionId: 'session-summary',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      selectedReportId: 'report-1',
      selectedTaskTitle: '修复 Pipeline Dashboard',
      baseBranch: 'main',
      workingBranch: 'feature/pipeline-phase-4',
      status: 'committing',
    })
    appendContributionTaskEvent('task-summary', {
      id: 'event-local',
      pipelineSessionId: 'session-summary',
      type: 'local_commit_created',
      payload: {
        operationId: 'op-local',
        localCommit: {
          attempted: true,
          operationId: 'op-local',
          status: 'created',
          commitHash: 'abc123',
          commitMessage: 'feat: dashboard',
          files: [{ path: 'src/index.ts', changeType: 'modified', summary: '更新' }],
          excludedFiles: ['patch-work/commit.md'],
        },
      },
      createdAt: 10,
    })
    appendContributionTaskEvent('task-summary', {
      id: 'event-remote',
      pipelineSessionId: 'session-summary',
      type: 'remote_submission_failed',
      payload: {
        operationId: 'op-remote',
        remoteSubmission: {
          attempted: true,
          operationId: 'op-remote',
          status: 'pushed',
          type: 'pull_request',
          commitHash: 'abc123',
          prTitle: 'Dashboard',
          prBody: '## Summary',
          prUrl: undefined,
          error: 'gh pr create failed',
        },
      },
      createdAt: 20,
    })

    const summary = getContributionTaskSummary({ sessionId: 'session-summary' })

    expect(summary.task?.id).toBe('task-summary')
    expect(summary.task?.selectedTaskTitle).toBe('修复 Pipeline Dashboard')
    expect(summary.repository?.root).toBe(repoRoot)
    expect(summary.patchWork?.manifestFound).toBe(true)
    expect(summary.localCommit?.commitHash).toBe('abc123')
    expect(summary.remoteSubmission?.status).toBe('pushed')
    expect(summary.recentEvents.map((event) => event.type)).toEqual([
      'remote_submission_failed',
      'local_commit_created',
    ])
  })

  test('submission plan 使用当前 Git 读模型并排除 patch-work/**', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-read-model-plan-repo-'))
    tempRepos.push(repoRoot)
    setupGitRepo(repoRoot)
    writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 2\n', 'utf-8')
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    writeFileSync(join(repoRoot, 'patch-work', 'commit.md'), '# Commit\n', 'utf-8')
    const session = createPipelineSession('提交计划测试', 'channel-1', 'workspace-1', 2)
    createContributionTask({
      id: 'task-plan',
      pipelineSessionId: session.id,
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      baseBranch: 'main',
      workingBranch: 'feature/pipeline-phase-4',
      status: 'committing',
    })
    appendPipelineRecord(session.id, {
      id: 'tester-artifact',
      sessionId: session.id,
      type: 'stage_artifact',
      node: 'tester',
      artifact: makeTesterOutput(),
      createdAt: 1,
    })
    appendPipelineRecord(session.id, {
      id: 'committer-artifact',
      sessionId: session.id,
      type: 'stage_artifact',
      node: 'committer',
      artifact: makeCommitterOutput(),
      createdAt: 2,
    })

    const plan = getPipelineSubmissionPlan({ sessionId: session.id })

    expect(plan.commitMessage).toBe('feat(pipeline): expose contribution dashboard')
    expect(plan.prTitle).toBe('Expose contribution dashboard')
    expect(plan.candidateFiles).toEqual(['src/index.ts'])
    expect(plan.excludedFiles).toContain('patch-work/commit.md')
    expect(plan.excludedFiles).toContain('patch-work/**')
    expect(plan.blockers).toEqual([])
    expect(plan.baseBranch).toBe('main')
    expect(plan.headBranch).toBe('feature/pipeline-phase-4')
  })

  test('submission plan 缺少 committer output 时返回 blocker 而不是空白计划', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-read-model-missing-committer-repo-'))
    tempRepos.push(repoRoot)
    setupGitRepo(repoRoot)
    const session = createPipelineSession('缺少提交材料测试', 'channel-1', 'workspace-1', 2)
    createContributionTask({
      id: 'task-missing-committer',
      pipelineSessionId: session.id,
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'testing',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-missing-committer',
      pipelineSessionId: session.id,
      repositoryRoot: repoRoot,
      kind: 'test_result',
      createdByNode: 'tester',
      content: '# 测试报告\n',
    })

    const plan = getPipelineSubmissionPlan({ sessionId: session.id })

    expect(plan.blockers).toContain('Committer 尚未生成提交材料')
    expect(plan.commitMessage).toBe('')
    expect(plan.candidateFiles).toEqual([])
    expect(plan.excludedFiles).toContain('patch-work/**')
  })
})

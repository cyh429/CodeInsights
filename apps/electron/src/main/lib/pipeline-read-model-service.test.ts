import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
  exportPipelineReport,
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

  test('export report 汇总 draft-only 会话且不伪造 commit 或 PR', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-report-draft-only-repo-'))
    tempRepos.push(repoRoot)
    setupGitRepo(repoRoot)
    writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 2\n', 'utf-8')
    initializePatchWork({
      contributionTaskId: 'task-report-draft',
      pipelineSessionId: 'session-report-draft',
      repositoryRoot: repoRoot,
    })
    const session = createPipelineSession('报告导出 draft-only', 'channel-1', 'workspace-1', 2)
    createContributionTask({
      id: 'task-report-draft',
      pipelineSessionId: session.id,
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      repositoryUrl: 'https://user:ghp_should_not_leak@github.com/example/repo.git?token=secret#frag',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      selectedTaskTitle: '修复报告导出',
      baseBranch: 'main',
      workingBranch: 'feature/report-export',
      status: 'completed',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-report-draft',
      pipelineSessionId: session.id,
      repositoryRoot: repoRoot,
      kind: 'test_result',
      createdByNode: 'tester',
      content: '# 测试报告\n\nbun test 通过。',
    })
    appendPipelineRecord(session.id, {
      id: 'user-input-report',
      sessionId: session.id,
      type: 'user_input',
      content: '请导出 Pipeline 贡献报告',
      createdAt: 1,
    })
    appendPipelineRecord(session.id, {
      id: 'tester-artifact-report',
      sessionId: session.id,
      type: 'stage_artifact',
      node: 'tester',
      artifact: makeTesterOutput(),
      createdAt: 2,
    })
    appendPipelineRecord(session.id, {
      id: 'committer-artifact-report',
      sessionId: session.id,
      type: 'stage_artifact',
      node: 'committer',
      artifact: makeCommitterOutput(),
      createdAt: 3,
    })

    const report = exportPipelineReport({ sessionId: session.id })

    expect(report.sessionId).toBe(session.id)
    expect(report.fileName.endsWith('.md')).toBe(true)
    expect(report.htmlFileName.endsWith('.html')).toBe(true)
    expect(report.pdfFileName.endsWith('.pdf')).toBe(true)
    expect(report.markdown).toContain('# Pipeline 贡献报告')
    expect(report.html).toContain('<!doctype html>')
    expect(report.html).toContain('<main')
    expect(report.html).toContain('Pipeline 贡献报告')
    expect(report.markdown).toContain('修复报告导出')
    expect(report.html).toContain('修复报告导出')
    expect(report.markdown).toContain('本地 patch')
    expect(report.markdown).toContain('draft-only')
    expect(report.markdown).toContain('不会创建本地 commit 或真实 PR')
    expect(report.markdown).toContain('src/index.ts')
    expect(report.html).toContain('src/index.ts')
    expect(report.markdown).toContain('patch-work/**')
    expect(report.html).toContain('patch-work/**')
    expect(report.markdown).toContain('bun test')
    expect(report.html).toContain('bun test')
    expect(report.markdown).not.toContain('ghp_should_not_leak')
    expect(report.markdown).not.toContain('token=secret')
    expect(report.html).not.toContain('ghp_should_not_leak')
    expect(report.html).not.toContain('token=secret')
  })

  test('export report 不调用 Git 读模型，只使用已持久化的 records 和 events', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-report-no-live-git-repo-'))
    const binDir = mkdtempSync(join(tmpdir(), 'codeinsights-report-no-live-git-bin-'))
    tempRepos.push(repoRoot, binDir)
    setupGitRepo(repoRoot)
    writeFileSync(join(repoRoot, 'src', 'unrelated.ts'), 'export const unrelated = true\n', 'utf-8')
    const session = createPipelineSession('报告导出 no live git', 'channel-1', 'workspace-1', 2)
    createContributionTask({
      id: 'task-report-no-live-git',
      pipelineSessionId: session.id,
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      selectedTaskTitle: '导出报告不刷新 Git 状态',
      baseBranch: 'main',
      workingBranch: 'feature/report-export',
      status: 'completed',
    })
    appendPipelineRecord(session.id, {
      id: 'tester-artifact-no-live-git',
      sessionId: session.id,
      type: 'stage_artifact',
      node: 'tester',
      artifact: makeTesterOutput(),
      createdAt: 2,
    })
    appendPipelineRecord(session.id, {
      id: 'committer-artifact-no-live-git',
      sessionId: session.id,
      type: 'stage_artifact',
      node: 'committer',
      artifact: makeCommitterOutput(),
      createdAt: 3,
    })
    const gitMarker = join(binDir, 'git-called.txt')
    const fakeGit = join(binDir, 'git')
    writeFileSync(fakeGit, '#!/bin/sh\nprintf called >> "$CODEINSIGHTS_TEST_GIT_MARKER"\nexit 1\n', 'utf-8')
    chmodSync(fakeGit, 0o755)
    const originalPath = process.env.PATH
    process.env.PATH = binDir
    process.env.CODEINSIGHTS_TEST_GIT_MARKER = gitMarker

    try {
      const report = exportPipelineReport({ sessionId: session.id })

      expect(report.markdown).toContain('src/index.ts')
      expect(report.html).toContain('src/index.ts')
      expect(report.markdown).not.toContain('src/unrelated.ts')
      expect(report.html).not.toContain('src/unrelated.ts')
      expect(existsSync(gitMarker)).toBe(false)
    } finally {
      if (originalPath == null) {
        delete process.env.PATH
      } else {
        process.env.PATH = originalPath
      }
      delete process.env.CODEINSIGHTS_TEST_GIT_MARKER
    }
  })

  test('export report 缺少 patch-work 目录时保持只读，不创建目录', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-report-missing-patch-work-repo-'))
    tempRepos.push(repoRoot)
    setupGitRepo(repoRoot)
    const patchWorkDir = join(repoRoot, 'patch-work')
    const session = createPipelineSession('报告导出 missing patch-work', 'channel-1', 'workspace-1', 2)
    createContributionTask({
      id: 'task-report-missing-patch-work',
      pipelineSessionId: session.id,
      repositoryRoot: repoRoot,
      patchWorkDir,
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      selectedTaskTitle: '导出报告不创建 patch-work',
      baseBranch: 'main',
      workingBranch: 'feature/report-export',
      status: 'completed',
    })
    appendPipelineRecord(session.id, {
      id: 'tester-artifact-missing-patch-work',
      sessionId: session.id,
      type: 'stage_artifact',
      node: 'tester',
      artifact: makeTesterOutput(),
      createdAt: 2,
    })

    const report = exportPipelineReport({ sessionId: session.id })

    expect(report.markdown).toContain('patch-work：读取失败')
    expect(report.html).toContain('patch-work：读取失败')
    expect(existsSync(patchWorkDir)).toBe(false)
  })

  test('export report 汇总 local commit 并标明 patch-work 排除项', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-report-local-commit-repo-'))
    tempRepos.push(repoRoot)
    setupGitRepo(repoRoot)
    const session = createPipelineSession('报告导出 local commit', 'channel-1', 'workspace-1', 2)
    createContributionTask({
      id: 'task-report-local',
      pipelineSessionId: session.id,
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_commit',
      allowRemoteWrites: false,
      selectedTaskTitle: '提交报告导出实现',
      baseBranch: 'main',
      workingBranch: 'feature/report-export',
      status: 'completed',
    })
    appendContributionTaskEvent('task-report-local', {
      id: 'event-report-local',
      pipelineSessionId: session.id,
      type: 'local_commit_created',
      payload: {
        localCommit: {
          attempted: true,
          operationId: 'op-local-report',
          status: 'created',
          commitHash: 'abc123def456',
          commitMessage: 'feat(pipeline): export report',
          files: [{ path: 'src/index.ts', changeType: 'modified', summary: '新增报告导出' }],
          excludedFiles: ['patch-work/**', 'patch-work/commit.md'],
        },
      },
      createdAt: 4,
    })
    appendPipelineRecord(session.id, {
      id: 'committer-artifact-local',
      sessionId: session.id,
      type: 'stage_artifact',
      node: 'committer',
      artifact: makeCommitterOutput({
        submissionStatus: 'local_commit_created',
        localCommit: {
          attempted: true,
          operationId: 'op-local-report',
          status: 'created',
          commitHash: 'abc123def456',
          commitMessage: 'feat(pipeline): export report',
          files: [{ path: 'src/index.ts', changeType: 'modified', summary: '新增报告导出' }],
          excludedFiles: ['patch-work/**', 'patch-work/commit.md'],
        },
      }),
      createdAt: 5,
    })

    const report = exportPipelineReport({ sessionId: session.id })

    expect(report.markdown).toContain('本地 commit')
    expect(report.markdown).toContain('abc123def456')
    expect(report.markdown).toContain('src/index.ts')
    expect(report.markdown).toContain('patch-work/**')
    expect(report.markdown).toContain('op-local-report')
  })

  test('export report 汇总远端写确认审计且脱敏凭证', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-report-remote-repo-'))
    tempRepos.push(repoRoot)
    setupGitRepo(repoRoot)
    const session = createPipelineSession('报告导出 remote', 'channel-1', 'workspace-1', 2)
    createContributionTask({
      id: 'task-report-remote',
      pipelineSessionId: session.id,
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      repositoryUrl: 'https://github.com/example/repo.git',
      contributionMode: 'remote_pr',
      allowRemoteWrites: true,
      selectedTaskTitle: '创建远端报告',
      baseBranch: 'main',
      workingBranch: 'feature/report-export',
      status: 'completed',
    })
    appendContributionTaskEvent('task-report-remote', {
      id: 'event-remote-confirmed',
      pipelineSessionId: session.id,
      type: 'remote_write_confirmed',
      payload: {
        operationId: 'op-remote-report',
        remoteName: 'origin',
        baseBranch: 'main',
        headBranch: 'feature/report-export',
        commitHash: 'abc123def456',
        sanitizedRemoteUrl: 'https://x-access-token:ghp_should_not_leak@github.com/example/repo.git',
      },
      createdAt: 6,
    })
    appendContributionTaskEvent('task-report-remote', {
      id: 'event-remote-created',
      pipelineSessionId: session.id,
      type: 'remote_submission_created',
      payload: {
        remoteSubmission: {
          attempted: true,
          operationId: 'op-remote-report',
          status: 'created',
          type: 'pull_request',
          provider: 'github_api',
          remoteName: 'origin',
          sanitizedRemoteUrl: 'https://x-access-token:ghp_should_not_leak@github.com/example/repo.git',
          baseBranch: 'main',
          headBranch: 'feature/report-export',
          commitHash: 'abc123def456',
          prTitle: 'Export report',
          prUrl: 'https://github.com/example/repo/pull/7',
          prNumber: 7,
          draft: true,
        },
      },
      createdAt: 7,
    })
    appendPipelineRecord(session.id, {
      id: 'error-token-record',
      sessionId: session.id,
      type: 'error',
      error: 'Authorization: Bearer ghp_should_not_leak',
      createdAt: 8,
    })

    const report = exportPipelineReport({ sessionId: session.id })

    expect(report.markdown).toContain('远端写已确认')
    expect(report.markdown).toContain('op-remote-report')
    expect(report.markdown).toContain('origin')
    expect(report.markdown).toContain('main -> feature/report-export')
    expect(report.markdown).toContain('https://github.com/example/repo/pull/7')
    expect(report.markdown).not.toContain('ghp_should_not_leak')
    expect(report.markdown).not.toContain('Bearer')
  })

  test('export report 顶层 title 和 fileName 也会脱敏会话标题', () => {
    const session = createPipelineSession(
      'Authorization: Bearer ghp_should_not_leak Bearer secret Bearer eyJhbGciOiJIUzI1Ni.secret https://user:ghp_url_secret@github.com/example/repo.git?token=secret',
      'channel-1',
      'workspace-1',
      2,
    )
    appendPipelineRecord(session.id, {
      id: 'error-generic-bearer-record',
      sessionId: session.id,
      type: 'error',
      error: 'generic bearer leaked: Bearer standalone-secret-token-12345 and Bearer tiny',
      createdAt: 1,
    })

    const report = exportPipelineReport({ sessionId: session.id })

    for (const value of [report.title, report.fileName, report.htmlFileName, report.pdfFileName, report.markdown, report.html]) {
      expect(value).not.toContain('ghp_should_not_leak')
      expect(value).not.toContain('ghp_url_secret')
      expect(value).not.toContain('eyJhbGciOiJIUzI1Ni.secret')
      expect(value).not.toContain('standalone-secret-token-12345')
      expect(value).not.toContain('secret')
      expect(value).not.toContain('tiny')
      expect(value).not.toContain('token=secret')
      expect(value).not.toContain('Bearer')
    }
  })

  test('export report HTML 转义用户和模型内容，避免脚本注入', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-report-html-escape-repo-'))
    tempRepos.push(repoRoot)
    setupGitRepo(repoRoot)
    const session = createPipelineSession('报告 <script>alert(1)</script>', 'channel-1', 'workspace-1', 2)
    createContributionTask({
      id: 'task-report-html-escape',
      pipelineSessionId: session.id,
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      selectedTaskTitle: '修复 <img src=x onerror=alert(1)>',
      status: 'completed',
    })
    appendPipelineRecord(session.id, {
      id: 'committer-artifact-html-escape',
      sessionId: session.id,
      type: 'stage_artifact',
      node: 'committer',
      artifact: makeCommitterOutput({
        commitMessage: 'feat: <script>alert(1)</script>',
        prBody: '## Summary\n- <img src=x onerror=alert(1)>',
      }),
      createdAt: 3,
    })

    const report = exportPipelineReport({ sessionId: session.id })

    expect(report.markdown).toContain('<script>alert(1)</script>')
    expect(report.html).not.toContain('<script>')
    expect(report.html).not.toContain('onerror=')
    expect(report.html).not.toContain('<img')
    expect(report.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(report.html).toContain('&lt;img src=x')
  })

  test('export report 缺少 ContributionTask 时返回可解释报告', () => {
    const session = createPipelineSession('缺少任务报告', 'channel-1', 'workspace-1', 2)

    const report = exportPipelineReport({ sessionId: session.id })

    expect(report.markdown).toContain('未找到贡献任务')
    expect(report.markdown).toContain(session.id)
    expect(report.markdown).toContain('暂无提交候选文件')
  })
})

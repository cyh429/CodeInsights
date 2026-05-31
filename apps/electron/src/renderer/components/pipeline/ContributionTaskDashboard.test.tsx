import { describe, expect, test } from 'bun:test'
import type { ContributionTaskSummary } from '@codeinsights/shared'
import { buildContributionTaskDashboardViewModel } from './ContributionTaskDashboard'

function makeSummary(patch: Partial<ContributionTaskSummary> = {}): ContributionTaskSummary {
  return {
    sessionId: 'session-dashboard',
    task: {
      id: 'task-dashboard',
      pipelineSessionId: 'session-dashboard',
      repositoryRoot: '/repo/codeinsights',
      repositoryUrl: 'https://github.com/example/codeinsights.git',
      issueUrl: 'https://github.com/example/codeinsights/issues/1',
      baseBranch: 'main',
      workingBranch: 'feature/pipeline-phase-4',
      selectedReportId: 'report-1',
      selectedTaskTitle: '实现 Contribution Dashboard',
      patchWorkDir: '/repo/codeinsights/patch-work',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'committing',
      currentGateId: 'gate-committer',
      createdAt: 1,
      updatedAt: 2,
    },
    repository: {
      root: '/repo/codeinsights',
      url: 'https://github.com/example/codeinsights.git',
      issueUrl: 'https://github.com/example/codeinsights/issues/1',
      baseBranch: 'main',
      workingBranch: 'feature/pipeline-phase-4',
    },
    mode: 'local_patch',
    allowRemoteWrites: false,
    patchWork: {
      dir: '/repo/codeinsights/patch-work',
      manifestFound: true,
      fileCount: 7,
      acceptedFileCount: 4,
      updatedAt: 2,
    },
    localCommit: {
      attempted: true,
      operationId: 'op-local',
      status: 'created',
      commitHash: 'abc123def456',
      commitMessage: 'feat: dashboard',
    },
    remoteSubmission: {
      attempted: true,
      operationId: 'op-remote',
      status: 'pushed',
      type: 'pull_request',
      commitHash: 'abc123def456',
      prTitle: 'Dashboard',
      prBody: '## Summary',
      error: 'gh pr create failed',
    },
    recentEvents: [
      {
        id: 'event-remote',
        type: 'remote_submission_failed',
        title: '远端提交失败',
        detail: 'gh pr create failed',
        createdAt: 20,
      },
      {
        id: 'event-local',
        type: 'local_commit_created',
        title: '本地 commit 已创建',
        detail: 'abc123def456',
        createdAt: 10,
      },
    ],
    updatedAt: 2,
    ...patch,
  }
}

describe('ContributionTaskDashboard', () => {
  test('构建正常态 summary，展示任务、仓库、分支、patch-work、commit、PR 和最近事件', () => {
    const viewModel = buildContributionTaskDashboardViewModel({
      summary: makeSummary(),
      loading: false,
      error: null,
    })

    expect(viewModel.statusLabel).toBe('提交材料')
    expect(viewModel.taskTitle).toBe('实现 Contribution Dashboard')
    expect(viewModel.repositoryRoot).toBe('/repo/codeinsights')
    expect(viewModel.branchSummary).toBe('main -> feature/pipeline-phase-4')
    expect(viewModel.modeLabel).toBe('本地 patch')
    expect(viewModel.patchWorkSummary).toBe('7 个文件，4 个已接受')
    expect(viewModel.localCommitSummary).toContain('abc123def456')
    expect(viewModel.remoteSubmissionSummary).toContain('PR 创建失败')
    expect(viewModel.recentEvents.map((event) => event.title)).toEqual([
      '远端提交失败',
      '本地 commit 已创建',
    ])
  })

  test('缺少 ContributionTask 时展示空态，不伪造仓库状态', () => {
    const viewModel = buildContributionTaskDashboardViewModel({
      summary: makeSummary({
        task: null,
        repository: undefined,
        mode: undefined,
        allowRemoteWrites: undefined,
        patchWork: undefined,
        localCommit: undefined,
        remoteSubmission: undefined,
        recentEvents: [],
        error: '未找到贡献任务: session-empty',
      }),
      loading: false,
      error: null,
    })

    expect(viewModel.statusLabel).toBe('等待贡献任务')
    expect(viewModel.taskTitle).toContain('尚未创建')
    expect(viewModel.repositoryRoot).toBe('尚未绑定仓库')
    expect(viewModel.patchWorkSummary).toBe('尚未初始化')
    expect(viewModel.recentEvents).toEqual([])
  })

  test('read model 错误态可见且不依赖 records', () => {
    const viewModel = buildContributionTaskDashboardViewModel({
      summary: null,
      loading: false,
      error: '读取 ContributionTask 失败',
    })

    expect(viewModel.statusLabel).toBe('读取失败')
    expect(viewModel.error).toBe('读取 ContributionTask 失败')
    expect(viewModel.taskTitle).toBe('贡献任务状态暂不可用')
  })
})

import { describe, expect, test } from 'bun:test'
import type {
  PipelineCommitterStageOutput,
  PipelineSubmissionPlan,
} from '@codeinsights/shared'
import { buildRemoteWriteConfirmationViewModel } from './RemoteWriteConfirmationPanel'

function makeCommitterOutput(patch: Partial<PipelineCommitterStageOutput> = {}): PipelineCommitterStageOutput {
  return {
    node: 'committer',
    summary: '本地 commit 已创建',
    commitMessage: 'feat(pipeline): add remote confirmation',
    prTitle: 'Add remote confirmation',
    prBody: '## Summary\n- Add remote confirmation',
    submissionStatus: 'local_commit_created',
    blockers: [],
    risks: ['远端写需要人工确认'],
    localCommit: {
      attempted: true,
      status: 'created',
      operationId: 'op-local',
      commitHash: 'abc123def456',
      workingBranch: 'feature/remote-confirm',
      baseBranch: 'main',
    },
    remoteSubmission: {
      attempted: false,
      status: 'not_requested',
      operationId: 'op-remote',
      remoteName: 'origin',
      sanitizedRemoteUrl: 'https://github.com/example/repo.git',
      headBranch: 'feature/remote-confirm',
      baseBranch: 'main',
      prTitle: 'Add remote confirmation',
      prBody: '## Summary\n- Add remote confirmation',
      draft: true,
    },
    content: '{}',
    ...patch,
  }
}

function makeSubmissionPlan(patch: Partial<PipelineSubmissionPlan> = {}): PipelineSubmissionPlan {
  return {
    sessionId: 'session-remote-confirm',
    mode: 'remote_pr',
    commitMessage: 'feat(pipeline): add remote confirmation',
    prTitle: 'Add remote confirmation',
    prBody: '## Summary\n- Add remote confirmation',
    baseBranch: 'main',
    headBranch: 'feature/remote-confirm',
    remoteName: 'origin',
    sanitizedRemoteUrl: 'https://github.com/example/repo.git',
    candidateFiles: ['src/index.ts'],
    excludedFiles: ['patch-work/**'],
    blockers: [],
    warnings: ['将创建 Draft PR'],
    updatedAt: 1,
    ...patch,
  }
}

describe('RemoteWriteConfirmationPanel', () => {
  test('构建独立远端确认视图并要求显式勾选风险', () => {
    const viewModel = buildRemoteWriteConfirmationViewModel({
      output: makeCommitterOutput(),
      submissionPlan: makeSubmissionPlan(),
      operationId: 'op-remote',
      confirmed: false,
      submitting: false,
    })

    expect(viewModel.title).toBe('确认远端写')
    expect(viewModel.operationId).toBe('op-remote')
    expect(viewModel.remoteSummary).toContain('origin')
    expect(viewModel.remoteSummary).toContain('main -> feature/remote-confirm')
    expect(viewModel.commitHash).toBe('abc123def456')
    expect(viewModel.prTitle).toBe('Add remote confirmation')
    expect(viewModel.confirmDisabled).toBe(true)
    expect(viewModel.warningItems).toContain('将创建 Draft PR')
    expect(viewModel.warningItems.join('\n')).toContain('执行 git push')
  })

  test('push 已成功但 PR 失败时展示只重试 PR 创建语义', () => {
    const viewModel = buildRemoteWriteConfirmationViewModel({
      output: makeCommitterOutput({
        submissionStatus: 'remote_pr_failed',
        remoteSubmission: {
          attempted: true,
          status: 'pushed',
          operationId: 'op-remote',
          type: 'pull_request',
          commitHash: 'abc123def456',
          remoteName: 'origin',
          sanitizedRemoteUrl: 'https://github.com/example/repo.git',
          headBranch: 'feature/remote-confirm',
          baseBranch: 'main',
          pushedRef: 'refs/heads/feature/remote-confirm',
          prTitle: 'Add remote confirmation',
          prBody: '## Summary\n- Add remote confirmation',
          draft: true,
          error: 'gh pr create failed',
        },
      }),
      submissionPlan: makeSubmissionPlan(),
      operationId: 'op-remote',
      confirmed: true,
      submitting: false,
    })

    expect(viewModel.confirmLabel).toBe('重试创建 Draft PR')
    expect(viewModel.confirmDisabled).toBe(false)
    expect(viewModel.recoveryMessage).toContain('已推送远端分支')
    expect(viewModel.recoveryMessage).toContain('gh pr create failed')
  })
})

import { describe, expect, test } from 'bun:test'
import type {
  PipelineCommitterStageOutput,
  PipelinePatchWorkDocumentRef,
  PipelineSubmissionPlan,
  PipelineTesterStageOutput,
} from '@codeinsights/shared'
import {
  buildCommitterPanelViewModel,
  collectCommitterPatchWorkRefs,
} from './CommitterPanel'

function makeDocument(
  patch: Partial<PipelinePatchWorkDocumentRef> & { displayName: string; relativePath: string },
): PipelinePatchWorkDocumentRef {
  return {
    displayName: patch.displayName,
    relativePath: patch.relativePath,
    checksum: patch.checksum ?? 'c'.repeat(64),
    revision: patch.revision ?? 1,
  }
}

function makeCommitterOutput(patch: Partial<PipelineCommitterStageOutput> = {}): PipelineCommitterStageOutput {
  return {
    node: 'committer',
    summary: '提交材料已生成',
    commitMessage: 'feat(pipeline): add draft submission',
    prTitle: 'Add draft submission materials',
    prBody: '## Summary\n- Add draft submission\n\n## Tests\n- bun test',
    submissionStatus: 'draft_only',
    blockers: [],
    risks: ['未执行真实 commit'],
    commitDocRef: makeDocument({
      displayName: 'Commit 准备.md',
      relativePath: 'commit.md',
      checksum: '1'.repeat(64),
      revision: 2,
    }),
    prDocRef: makeDocument({
      displayName: 'PR 草稿.md',
      relativePath: 'pr.md',
      checksum: '2'.repeat(64),
      revision: 2,
    }),
    localCommit: {
      attempted: false,
      status: 'not_requested',
    },
    remoteSubmission: {
      attempted: false,
      status: 'not_requested',
    },
    content: '{}',
    ...patch,
  }
}

function makeTesterOutput(): PipelineTesterStageOutput {
  return {
    node: 'tester',
    summary: '测试通过',
    commands: ['bun test'],
    results: ['通过'],
    blockers: [],
    passed: true,
    testEvidence: [
      {
        command: 'bun test',
        status: 'passed',
        summary: '通过',
      },
    ],
    patchSet: {
      files: [
        {
          path: 'src/index.ts',
          changeType: 'modified',
          summary: '更新实现',
          additions: 4,
          deletions: 1,
        },
      ],
      additions: 4,
      deletions: 1,
      baseBranch: 'main',
      workingBranch: 'feature/pipeline-v2',
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

function makeSubmissionPlan(patch: Partial<PipelineSubmissionPlan> = {}): PipelineSubmissionPlan {
  return {
    sessionId: 'session-committer-ui',
    mode: 'local_patch',
    commitMessage: 'feat(pipeline): read model plan',
    prTitle: 'Expose read model plan',
    prBody: '## Summary\n- Use read model',
    baseBranch: 'main',
    headBranch: 'feature/read-model-plan',
    remoteName: 'origin',
    sanitizedRemoteUrl: 'https://github.com/example/repo.git',
    candidateFiles: ['src/from-read-model.ts'],
    excludedFiles: ['patch-work/**', 'patch-work/commit.md'],
    blockers: [],
    warnings: ['当前计划来自只读 read model'],
    localCommit: {
      attempted: false,
      status: 'not_requested',
    },
    remoteSubmission: {
      attempted: false,
      status: 'not_requested',
      type: 'pull_request',
      remoteName: 'origin',
      baseBranch: 'main',
      headBranch: 'feature/read-model-plan',
      prTitle: 'Expose read model plan',
      prBody: '## Summary\n- Use read model',
      draft: true,
    },
    updatedAt: 1,
    ...patch,
  }
}

describe('CommitterPanel', () => {
  test('从 committer stage output 收集 commit.md 和 pr.md 文件引用', () => {
    const refs = collectCommitterPatchWorkRefs(makeCommitterOutput())

    expect(refs.map((ref) => ref.relativePath)).toEqual([
      'commit.md',
      'pr.md',
    ])
  })

  test('构建 draft-only 提交材料视图并展示测试证据', () => {
    const viewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput(),
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备\n\n## 建议 Commit Message\nfeat(pipeline): add draft submission'],
        ['pr.md', '# PR 草稿\n\n## Title\nAdd draft submission materials'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.statusLabel).toBe('草稿待确认')
    expect(viewModel.approveLabel).toBe('仅保存提交材料并完成')
    expect(viewModel.approveDisabled).toBe(false)
    expect(viewModel.commitMessage).toBe('feat(pipeline): add draft submission')
    expect(viewModel.prTitle).toBe('Add draft submission materials')
    expect(viewModel.patchSetSummary).toBe('1 个文件，+4 / -1')
    expect(viewModel.branchSummary).toBe('main -> feature/pipeline-v2')
    expect(viewModel.commitCandidateItems).toEqual(['src/index.ts'])
    expect(viewModel.excludedItems).toContain('patch-work/**')
    expect(viewModel.localCommitLabel).toBe('创建本地 commit')
    expect(viewModel.localCommitDisabled).toBe(false)
    expect(viewModel.evidenceItems).toEqual([
      expect.objectContaining({
        command: 'bun test',
        statusLabel: '通过',
      }),
    ])
    expect(viewModel.documents.map((document) => document.relativePath)).toEqual(['commit.md', 'pr.md'])
  })

  test('三段式提交计划优先使用 SubmissionPlan read model', () => {
    const viewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput(),
      testerOutput: makeTesterOutput(),
      submissionPlan: makeSubmissionPlan(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
        ['pr.md', '# PR 草稿'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.sections.map((section) => section.title)).toEqual([
      '保存提交材料',
      '本地 commit',
      'Draft PR',
    ])
    expect(viewModel.commitMessage).toBe('feat(pipeline): read model plan')
    expect(viewModel.prTitle).toBe('Expose read model plan')
    expect(viewModel.branchSummary).toBe('main -> feature/read-model-plan')
    expect(viewModel.commitCandidateItems).toEqual(['src/from-read-model.ts'])
    expect(viewModel.excludedItems).toEqual(['patch-work/**', 'patch-work/commit.md'])
    expect(viewModel.remoteTargetSummary).toContain('origin')
    expect(viewModel.remoteTargetSummary).toContain('feature/read-model-plan')
    expect(viewModel.planWarnings).toContain('当前计划来自只读 read model')
  })

  test('缺少提交材料正文时禁止完成 submission review', () => {
    const viewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput(),
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.approveDisabled).toBe(true)
    expect(viewModel.warning).toContain('提交材料')

    const missingRefsViewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput({
        commitDocRef: undefined,
        prDocRef: undefined,
      }),
      testerOutput: makeTesterOutput(),
      contents: new Map(),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(missingRefsViewModel.approveDisabled).toBe(true)
    expect(missingRefsViewModel.warning).toContain('commit.md')
  })

  test('存在 blocker 时展示阻塞并禁止完成', () => {
    const viewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput({
        submissionStatus: 'blocked',
        blockers: ['缺少上游 CONTRIBUTING'],
      }),
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
        ['pr.md', '# PR 草稿'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.statusLabel).toBe('提交材料阻塞')
    expect(viewModel.approveDisabled).toBe(true)
    expect(viewModel.blockers).toEqual(['缺少上游 CONTRIBUTING'])
  })

  test('构建本地 commit 已创建状态并展示 commit hash', () => {
    const viewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput({
        submissionStatus: 'local_commit_created',
        localCommit: {
          attempted: true,
          status: 'created',
          operationId: 'op-local-commit-ui',
          commitHash: 'abc123def456',
          files: [
            {
              path: 'src/index.ts',
              changeType: 'modified',
              summary: '更新实现',
            },
          ],
          excludedFiles: ['patch-work/commit.md'],
        },
      }),
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
        ['pr.md', '# PR 草稿'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.statusLabel).toBe('本地 commit 已创建')
    expect(viewModel.localCommitDisabled).toBe(true)
    expect(viewModel.localCommitResult).toContain('abc123def456')
    expect(viewModel.commitCandidateItems).toEqual(['src/index.ts'])
    expect(viewModel.excludedItems).toContain('patch-work/commit.md')
  })

  test('远端 PR 状态仍禁止完成', () => {
    const viewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput({
        submissionStatus: 'remote_pr_created',
        remoteSubmission: {
          attempted: true,
          operationId: 'op-remote-created-ui',
          status: 'created',
          type: 'pull_request',
          commitHash: 'abc123def456',
          remoteName: 'origin',
          sanitizedRemoteUrl: 'https://github.com/example/repo.git',
          headBranch: 'feature/pipeline-v2',
          baseBranch: 'main',
          prTitle: 'Add draft submission materials',
          prBody: '## Summary\n- Add draft submission',
          prUrl: 'https://github.com/example/repo/pull/42',
          draft: true,
        },
      }),
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
        ['pr.md', '# PR 草稿'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
      remoteConfirmed: true,
    })

    expect(viewModel.statusLabel).toBe('远端 PR 已创建')
    expect(viewModel.approveDisabled).toBe(true)
    expect(viewModel.remoteSubmitDisabled).toBe(true)
    expect(viewModel.remoteSubmitResult).toContain('https://github.com/example/repo/pull/42')
  })

  test('远端提交必须单独二次确认且依赖已创建的本地 commit', () => {
    const baseOutput = makeCommitterOutput({
      submissionStatus: 'local_commit_created',
      localCommit: {
        attempted: true,
        status: 'created',
        operationId: 'op-local-created-ui',
        commitHash: 'abc123def456',
        workingBranch: 'feature/pipeline-v2',
        baseBranch: 'main',
      },
      remoteSubmission: {
        attempted: false,
        status: 'not_requested',
        operationId: 'op-remote-ready-ui',
        type: 'pull_request',
        remoteName: 'origin',
        sanitizedRemoteUrl: 'https://github.com/example/repo.git',
        baseBranch: 'main',
        prTitle: 'Add draft submission materials',
        prBody: '## Summary\n- Add draft submission',
        draft: true,
      },
    })
    const unconfirmed = buildCommitterPanelViewModel({
      output: baseOutput,
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
        ['pr.md', '# PR 草稿'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
      remoteConfirmed: false,
    })

    expect(unconfirmed.remoteSubmitDisabled).toBe(true)
    expect(unconfirmed.remoteSubmitWarning).toContain('二次确认')
    expect(unconfirmed.remoteTargetSummary).toContain('origin')
    expect(unconfirmed.remoteTargetSummary).toContain('feature/pipeline-v2')
    expect(unconfirmed.remoteTargetSummary).toContain('abc123def456')

    const confirmed = buildCommitterPanelViewModel({
      output: baseOutput,
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
        ['pr.md', '# PR 草稿'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
      remoteConfirmed: true,
    })

    expect(confirmed.remoteSubmitDisabled).toBe(false)
    expect(confirmed.remoteSubmitLabel).toBe('推送并创建 Draft PR')
  })

  test('push 已成功但 PR 失败时展示可恢复远端状态', () => {
    const viewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput({
        submissionStatus: 'remote_pr_failed',
        localCommit: {
          attempted: true,
          status: 'created',
          operationId: 'op-local-created-ui',
          commitHash: 'abc123def456',
          workingBranch: 'feature/pipeline-v2',
          baseBranch: 'main',
        },
        remoteSubmission: {
          attempted: true,
          operationId: 'op-remote-pushed-ui',
          status: 'pushed',
          type: 'pull_request',
          commitHash: 'abc123def456',
          remoteName: 'origin',
          sanitizedRemoteUrl: 'https://github.com/example/repo.git',
          headBranch: 'feature/pipeline-v2',
          baseBranch: 'main',
          pushedRef: 'refs/heads/feature/pipeline-v2',
          prTitle: 'Add draft submission materials',
          prBody: '## Summary\n- Add draft submission',
          draft: true,
          error: 'gh pr create failed',
        },
      }),
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
        ['pr.md', '# PR 草稿'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
      remoteConfirmed: true,
    })

    expect(viewModel.statusLabel).toBe('远端提交失败')
    expect(viewModel.remoteSubmitDisabled).toBe(false)
    expect(viewModel.remoteSubmitResult).toContain('已推送远端分支')
    expect(viewModel.remoteSubmitResult).toContain('gh pr create failed')
  })
})

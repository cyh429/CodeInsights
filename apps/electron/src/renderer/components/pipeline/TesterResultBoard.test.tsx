import { describe, expect, test } from 'bun:test'
import type { PipelinePatchWorkDocumentRef, PipelineTesterStageOutput } from '@codeinsights/shared'
import {
  buildTesterResultBoardViewModel,
  collectTesterPatchWorkRefs,
} from './TesterResultBoard'

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

function makeTesterOutput(patch: Partial<PipelineTesterStageOutput> = {}): PipelineTesterStageOutput {
  return {
    node: 'tester',
    summary: '测试通过',
    commands: ['bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts'],
    results: ['Phase 5 测试通过'],
    blockers: [],
    passed: true,
    testResultRef: makeDocument({
      displayName: '测试报告.md',
      relativePath: 'result.md',
      checksum: '1'.repeat(64),
      revision: 2,
    }),
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
      testEvidence: [
        {
          command: 'bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts',
          status: 'passed',
          summary: '通过',
          durationMs: 120,
        },
      ],
      patchRef: makeDocument({
        displayName: '代码补丁.patch',
        relativePath: 'patch-set/changes.patch',
      }),
      changedFilesRef: makeDocument({
        displayName: '变更文件.json',
        relativePath: 'patch-set/changed-files.json',
      }),
      diffSummaryRef: makeDocument({
        displayName: 'Diff 摘要.md',
        relativePath: 'patch-set/diff-summary.md',
      }),
      testEvidenceRef: makeDocument({
        displayName: '测试证据.json',
        relativePath: 'patch-set/test-evidence.json',
      }),
      excludesPatchWork: true,
    },
    content: '{}',
    ...patch,
  }
}

describe('TesterResultBoard', () => {
  test('从 tester stage output 收集 result.md 和 patch-set 文件引用', () => {
    const refs = collectTesterPatchWorkRefs(makeTesterOutput())

    expect(refs.map((ref) => ref.relativePath)).toEqual([
      'result.md',
      'patch-set/changes.patch',
      'patch-set/changed-files.json',
      'patch-set/diff-summary.md',
      'patch-set/test-evidence.json',
    ])
  })

  test('构建测试通过的结果视图并展示 patch-set 统计', () => {
    const viewModel = buildTesterResultBoardViewModel({
      output: makeTesterOutput(),
      contents: new Map([
        ['result.md', '# 测试报告\n\n## 测试结论\n通过。'],
        ['patch-set/changes.patch', 'diff --git a/src/index.ts b/src/index.ts'],
        ['patch-set/changed-files.json', '[{"path":"src/index.ts"}]'],
        ['patch-set/diff-summary.md', '# Diff 摘要'],
        ['patch-set/test-evidence.json', '[{"command":"bun test","status":"passed"}]'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      gateKind: 'document_review',
      submitting: false,
    })

    expect(viewModel.statusLabel).toBe('测试通过')
    expect(viewModel.approveLabel).toBe('接受测试结果并生成提交草稿')
    expect(viewModel.approveDisabled).toBe(false)
    expect(viewModel.patchSetSummary).toBe('1 个文件，+4 / -1')
    expect(viewModel.documents.map((document) => document.relativePath)).toContain('result.md')
    expect(viewModel.evidenceItems[0]).toMatchObject({
      command: 'bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts',
      statusLabel: '通过',
    })
  })

  test('patch-set 未排除 patch-work 时禁止进入 committer', () => {
    const output = makeTesterOutput({
      patchSet: {
        ...makeTesterOutput().patchSet!,
        excludesPatchWork: false,
      },
    })

    const viewModel = buildTesterResultBoardViewModel({
      output,
      contents: new Map([
        ['result.md', '# 测试报告'],
        ['patch-set/changes.patch', 'diff --git a/patch-work/result.md b/patch-work/result.md'],
        ['patch-set/changed-files.json', '[{"path":"patch-work/result.md"}]'],
        ['patch-set/diff-summary.md', '# Diff 摘要'],
        ['patch-set/test-evidence.json', '[]'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      gateKind: 'document_review',
      submitting: false,
    })

    expect(viewModel.approveDisabled).toBe(true)
    expect(viewModel.warning).toContain('patch-work/**')
  })

  test('存在失败测试证据时禁止进入 committer', () => {
    const output = makeTesterOutput({
      patchSet: {
        ...makeTesterOutput().patchSet!,
        testEvidence: [
          {
            command: 'bun test',
            status: 'failed',
            summary: '失败',
          },
        ],
      },
    })

    const viewModel = buildTesterResultBoardViewModel({
      output,
      contents: new Map([
        ['result.md', '# 测试报告'],
        ['patch-set/changes.patch', 'diff --git a/src/index.ts b/src/index.ts'],
        ['patch-set/changed-files.json', '[{"path":"src/index.ts"}]'],
        ['patch-set/diff-summary.md', '# Diff 摘要'],
        ['patch-set/test-evidence.json', '[{"command":"bun test","status":"failed"}]'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      gateKind: 'document_review',
      submitting: false,
    })

    expect(viewModel.approveDisabled).toBe(true)
    expect(viewModel.warning).toContain('失败或跳过的测试证据')
  })

  test('test_blocked gate 使用接受风险文案并展示阻塞项', () => {
    const viewModel = buildTesterResultBoardViewModel({
      output: makeTesterOutput({
        summary: '测试环境阻塞',
        passed: false,
        blockers: ['缺少 Bun'],
        commands: ['bun test'],
        results: [],
        patchSet: {
          ...makeTesterOutput().patchSet!,
          testEvidence: [
            {
              command: 'bun test',
              status: 'skipped',
              summary: '缺少 Bun',
            },
          ],
        },
      }),
      contents: new Map([
        ['result.md', '# 测试报告\n\n## 剩余阻塞\n缺少 Bun'],
        ['patch-set/changes.patch', 'diff --git a/src/index.ts b/src/index.ts'],
        ['patch-set/changed-files.json', '[{"path":"src/index.ts"}]'],
        ['patch-set/diff-summary.md', '# Diff 摘要'],
        ['patch-set/test-evidence.json', '[]'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      gateKind: 'test_blocked',
      submitting: false,
    })

    expect(viewModel.statusLabel).toBe('测试阻塞')
    expect(viewModel.approveLabel).toBe('接受风险并生成提交草稿')
    expect(viewModel.approveDisabled).toBe(false)
    expect(viewModel.warning).toContain('人工风险接受')
    expect(viewModel.blockers).toEqual(['缺少 Bun'])
  })
})

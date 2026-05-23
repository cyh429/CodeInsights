import { describe, expect, test } from 'bun:test'
import type {
  PipelineDeveloperStageOutput,
  PipelinePatchWorkDocumentRef,
  PipelinePlannerStageOutput,
} from '@codeinsights/shared'
import {
  buildReviewDocumentBoardViewModel,
  collectDeveloperDocumentRefs,
  collectPlannerDocumentRefs,
} from './ReviewDocumentBoard'

function makeDocument(patch: Partial<PipelinePatchWorkDocumentRef> & { displayName: string; relativePath: string }): PipelinePatchWorkDocumentRef {
  return {
    displayName: patch.displayName,
    relativePath: patch.relativePath,
    checksum: patch.checksum ?? 'b'.repeat(64),
    revision: patch.revision ?? 1,
  }
}

describe('ReviewDocumentBoard', () => {
  test('从 planner stage output 收集 plan.md 和 test-plan.md', () => {
    const output: PipelinePlannerStageOutput = {
      node: 'planner',
      summary: '按两步实现',
      steps: ['补 IPC', '补 UI'],
      risks: [],
      verification: ['bun test'],
      planRef: makeDocument({
        displayName: '开发方案.md',
        relativePath: 'plan.md',
      }),
      testPlanRef: makeDocument({
        displayName: '测试方案.md',
        relativePath: 'test-plan.md',
      }),
      content: '{}',
    }

    expect(collectPlannerDocumentRefs(output).map((document) => document.relativePath)).toEqual([
      'plan.md',
      'test-plan.md',
    ])
  })

  test('从 developer stage output 收集 dev.md', () => {
    const output: PipelineDeveloperStageOutput = {
      node: 'developer',
      summary: '完成实现',
      changes: ['新增 developer gate'],
      tests: ['bun test'],
      risks: [],
      devDoc: makeDocument({
        displayName: '开发文档.md',
        relativePath: 'dev.md',
      }),
      content: '{}',
    }

    expect(collectDeveloperDocumentRefs(output).map((document) => document.relativePath)).toEqual([
      'dev.md',
    ])
  })

  test('构建文档审核模型，展示 checksum、revision 和正文加载状态', () => {
    const documents = [
      makeDocument({
        displayName: '开发方案.md',
        relativePath: 'plan.md',
        checksum: '1234567890abcdef'.padEnd(64, '0'),
        revision: 3,
      }),
      makeDocument({
        displayName: '测试方案.md',
        relativePath: 'test-plan.md',
      }),
    ]

    const viewModel = buildReviewDocumentBoardViewModel({
      documents,
      contents: new Map([['plan.md', '# 开发方案\n\n## 实施步骤']]),
      loadingPaths: new Set(['test-plan.md']),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.empty).toBe(false)
    expect(viewModel.approveDisabled).toBe(true)
    expect(viewModel.approveLabel).toBe('接受方案并开始开发')
    expect(viewModel.documents).toMatchObject([
      {
        relativePath: 'plan.md',
        checksumLabel: 'sha256:12345678',
        revisionLabel: '第 3 版',
        loading: false,
        content: '# 开发方案\n\n## 实施步骤',
      },
      {
        relativePath: 'test-plan.md',
        checksumLabel: 'sha256:bbbbbbbb',
        loading: true,
      },
    ])
  })

  test('developer 文档审核模型使用开发阶段文案', () => {
    const viewModel = buildReviewDocumentBoardViewModel({
      stage: 'developer',
      documents: [
        makeDocument({
          displayName: '开发文档.md',
          relativePath: 'dev.md',
        }),
      ],
      contents: new Map([['dev.md', '# 开发文档']]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.approveDisabled).toBe(false)
    expect(viewModel.approveLabel).toBe('接受开发文档并开始审查')
    expect(viewModel.title).toBe('审核 Developer 开发文档')
  })

  test('文档仍在加载或读取失败时不能通过审核', () => {
    const documents = [
      makeDocument({
        displayName: '开发方案.md',
        relativePath: 'plan.md',
      }),
      makeDocument({
        displayName: '测试方案.md',
        relativePath: 'test-plan.md',
      }),
    ]

    const loadingModel = buildReviewDocumentBoardViewModel({
      documents,
      contents: new Map([['plan.md', '# 开发方案']]),
      loadingPaths: new Set(['test-plan.md']),
      readErrors: new Map(),
      submitting: false,
    })
    expect(loadingModel.approveDisabled).toBe(true)
    expect(loadingModel.warning).toContain('仍在读取')

    const errorModel = buildReviewDocumentBoardViewModel({
      documents,
      contents: new Map([['plan.md', '# 开发方案']]),
      loadingPaths: new Set(),
      readErrors: new Map([['test-plan.md', '文件不存在']]),
      submitting: false,
    })
    expect(errorModel.approveDisabled).toBe(true)
    expect(errorModel.documents[1]?.error).toBe('文件不存在')
    expect(errorModel.warning).toContain('读取失败')
  })

  test('文档正文为空或只有空白时不能通过审核', () => {
    const documents = [
      makeDocument({
        displayName: '开发方案.md',
        relativePath: 'plan.md',
      }),
      makeDocument({
        displayName: '测试方案.md',
        relativePath: 'test-plan.md',
      }),
    ]

    const emptyModel = buildReviewDocumentBoardViewModel({
      documents,
      contents: new Map([
        ['plan.md', ''],
        ['test-plan.md', '# 测试方案'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })
    expect(emptyModel.approveDisabled).toBe(true)
    expect(emptyModel.warning).toContain('缺少正文')

    const blankModel = buildReviewDocumentBoardViewModel({
      documents,
      contents: new Map([
        ['plan.md', '   \n\t'],
        ['test-plan.md', '# 测试方案'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })
    expect(blankModel.approveDisabled).toBe(true)
    expect(blankModel.warning).toContain('缺少正文')
  })

  test('缺少 checksum 的文档不能通过审核', () => {
    const viewModel = buildReviewDocumentBoardViewModel({
      documents: [
        {
          displayName: '开发方案.md',
          relativePath: 'plan.md',
          revision: 1,
        },
      ],
      contents: new Map(),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.approveDisabled).toBe(true)
    expect(viewModel.warning).toContain('checksum')
  })
})

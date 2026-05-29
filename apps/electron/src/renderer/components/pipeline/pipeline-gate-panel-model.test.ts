import { describe, expect, test } from 'bun:test'
import type {
  PipelineCommitterStageOutput,
  PipelineDeveloperStageOutput,
  PipelineGateRequest,
  PipelinePatchWorkDocumentRef,
  PipelinePlannerStageOutput,
  PipelineReviewerStageOutput,
  PipelineStateSnapshot,
  PipelineTesterStageOutput,
} from '@codeinsights/shared'
import { buildPipelineGatePanelModel } from './pipeline-gate-panel-model'

function documentRef(relativePath: string, checksum = 'abc123'): PipelinePatchWorkDocumentRef {
  return {
    displayName: relativePath,
    relativePath,
    checksum,
    revision: 1,
  }
}

function gate(
  node: PipelineGateRequest['node'],
  kind: PipelineGateRequest['kind'],
): PipelineGateRequest {
  return {
    gateId: `${node}-gate`,
    sessionId: 'session-1',
    node,
    kind,
    iteration: 1,
    createdAt: 1,
  }
}

function state(stageOutputs: PipelineStateSnapshot['stageOutputs']): PipelineStateSnapshot {
  return {
    sessionId: 'session-1',
    version: 2,
    currentNode: 'planner',
    status: 'waiting_human',
    reviewIteration: 1,
    pendingGate: null,
    stageOutputs,
    updatedAt: 1,
  }
}

describe('pipeline gate panel model', () => {
  test('planner 文档审核会收集 plan / test-plan 并启用 patch-work 读取', () => {
    const planner: PipelinePlannerStageOutput = {
      node: 'planner',
      summary: '方案',
      steps: [],
      risks: [],
      verification: [],
      planRef: documentRef('patch-work/plan.md'),
      testPlanRef: documentRef('patch-work/test-plan.md'),
      content: '',
    }

    const model = buildPipelineGatePanelModel({
      sessionId: 'session-1',
      pendingGate: gate('planner', 'document_review'),
      state: state({ planner }),
      documentContents: new Map(),
    })

    expect(model.panelKind).toBe('planner_document')
    expect(model.reviewDocuments.map((document) => document.relativePath)).toEqual([
      'patch-work/plan.md',
      'patch-work/test-plan.md',
    ])
    expect(model.showPatchWorkDocumentRead).toBe(true)
    expect(model.fallbackGate).toBeNull()
  })

  test('reviewer 迭代限制面板会对 review doc 去重并透传正文', () => {
    const reviewDoc = documentRef('patch-work/review.md')
    const reviewer: PipelineReviewerStageOutput = {
      node: 'reviewer',
      summary: '审查',
      approved: false,
      issues: ['需要修复'],
      reviewDocRef: reviewDoc,
      reviewDoc: { ...reviewDoc, displayName: '重复 review.md' },
      content: '',
    }

    const model = buildPipelineGatePanelModel({
      sessionId: 'session-1',
      pendingGate: gate('reviewer', 'review_iteration_limit'),
      state: state({ reviewer }),
      documentContents: new Map([['patch-work/review.md', '# Review']]),
    })

    expect(model.panelKind).toBe('reviewer_issue')
    expect(model.reviewDocuments.map((document) => document.relativePath)).toEqual(['patch-work/review.md'])
    expect(model.reviewerReviewContent).toBe('# Review')
  })

  test('committer 面板会构造稳定 operation id 并收集提交文档', () => {
    const tester: PipelineTesterStageOutput = {
      node: 'tester',
      summary: '测试',
      commands: [],
      results: [],
      blockers: [],
      passed: true,
      content: '',
    }
    const committer: PipelineCommitterStageOutput = {
      node: 'committer',
      summary: '提交',
      commitMessage: 'feat: test',
      prTitle: 'Test PR',
      prBody: 'Body',
      submissionStatus: 'local_commit_ready',
      blockers: [],
      risks: [],
      commitDocRef: documentRef('patch-work/commit.md'),
      prDocRef: documentRef('patch-work/pr.md'),
      content: '',
    }

    const model = buildPipelineGatePanelModel({
      sessionId: 'session-1',
      pendingGate: gate('committer', 'submission_review'),
      state: state({ tester, committer }),
      documentContents: new Map(),
    })

    expect(model.panelKind).toBe('committer')
    expect(model.committerOperationIds).toEqual({
      localCommitOperationId: 'session-1:committer-gate:local_commit',
      remoteSubmissionOperationId: 'session-1:committer-gate:remote_pr',
    })
    expect(model.reviewDocuments.map((document) => document.relativePath)).toEqual([
      'patch-work/commit.md',
      'patch-work/pr.md',
    ])
    expect(model.stageOutputs.tester).toBe(tester)
    expect(model.stageOutputs.committer).toBe(committer)
  })

  test('非专用 gate 保持 fallback card 行为', () => {
    const developer: PipelineDeveloperStageOutput = {
      node: 'developer',
      summary: '开发',
      changes: [],
      tests: [],
      risks: [],
      devDocRef: documentRef('patch-work/dev.md'),
      content: '',
    }
    const pendingGate = gate('developer', undefined)

    const model = buildPipelineGatePanelModel({
      sessionId: 'session-1',
      pendingGate,
      state: state({ developer }),
      documentContents: new Map(),
    })

    expect(model.panelKind).toBe('generic_gate')
    expect(model.reviewDocuments).toEqual([])
    expect(model.showPatchWorkDocumentRead).toBe(false)
    expect(model.fallbackGate).toBe(pendingGate)
  })
})

import type {
  PipelineCommitterStageOutput,
  PipelineDeveloperStageOutput,
  PipelineExplorerStageOutput,
  PipelineGateRequest,
  PipelinePatchWorkDocumentRef,
  PipelinePlannerStageOutput,
  PipelineReviewerStageOutput,
  PipelineStateSnapshot,
  PipelineTesterStageOutput,
} from '@codeinsights/shared'
import {
  collectDeveloperDocumentRefs,
  collectPlannerDocumentRefs,
} from './ReviewDocumentBoard'
import { collectTesterPatchWorkRefs } from './TesterResultBoard'
import { collectCommitterPatchWorkRefs } from './CommitterPanel'

export type PipelineGatePanelKind =
  | 'none'
  | 'explorer_task'
  | 'planner_document'
  | 'developer_document'
  | 'reviewer_issue'
  | 'tester_result'
  | 'committer'
  | 'generic_gate'

export interface PipelineGatePanelStageOutputs {
  explorer: PipelineExplorerStageOutput | null
  planner: PipelinePlannerStageOutput | null
  developer: PipelineDeveloperStageOutput | null
  reviewer: PipelineReviewerStageOutput | null
  tester: PipelineTesterStageOutput | null
  committer: PipelineCommitterStageOutput | null
}

export interface PipelineCommitterOperationIds {
  localCommitOperationId: string
  remoteSubmissionOperationId: string
}

export interface PipelineGatePanelModel {
  panelKind: PipelineGatePanelKind
  stageOutputs: PipelineGatePanelStageOutputs
  reviewDocuments: PipelinePatchWorkDocumentRef[]
  showPatchWorkDocumentRead: boolean
  reviewerReviewContent?: string
  fallbackGate: PipelineGateRequest | null
  committerOperationIds: PipelineCommitterOperationIds
}

export interface PipelineGatePanelModelInput {
  sessionId: string
  pendingGate: PipelineGateRequest | null | undefined
  state: PipelineStateSnapshot | null | undefined
  documentContents: Map<string, string>
}

function dedupeDocumentRefs(documents: PipelinePatchWorkDocumentRef[]): PipelinePatchWorkDocumentRef[] {
  return documents.filter((document, index, items) =>
    items.findIndex((item) => item.relativePath === document.relativePath) === index)
}

function getStageOutputs(state: PipelineStateSnapshot | null | undefined): PipelineGatePanelStageOutputs {
  const explorer = state?.stageOutputs?.explorer?.node === 'explorer'
    ? state.stageOutputs.explorer
    : null
  const planner = state?.stageOutputs?.planner?.node === 'planner'
    ? state.stageOutputs.planner
    : null
  const developer = state?.stageOutputs?.developer?.node === 'developer'
    ? state.stageOutputs.developer
    : null
  const reviewer = state?.stageOutputs?.reviewer?.node === 'reviewer'
    ? state.stageOutputs.reviewer
    : null
  const tester = state?.stageOutputs?.tester?.node === 'tester'
    ? state.stageOutputs.tester
    : null
  const committer = state?.stageOutputs?.committer?.node === 'committer'
    ? state.stageOutputs.committer
    : null

  return {
    explorer,
    planner,
    developer,
    reviewer,
    tester,
    committer,
  }
}

function getPanelKind(pendingGate: PipelineGateRequest | null | undefined): PipelineGatePanelKind {
  if (!pendingGate) return 'none'
  if (pendingGate.kind === 'task_selection' && pendingGate.node === 'explorer') return 'explorer_task'
  if (pendingGate.kind === 'document_review' && pendingGate.node === 'planner') return 'planner_document'
  if (pendingGate.kind === 'document_review' && pendingGate.node === 'developer') return 'developer_document'
  if (pendingGate.kind === 'review_iteration_limit' && pendingGate.node === 'reviewer') return 'reviewer_issue'
  if (
    (pendingGate.kind === 'document_review' || pendingGate.kind === 'test_blocked')
    && pendingGate.node === 'tester'
  ) {
    return 'tester_result'
  }
  if (pendingGate.kind === 'submission_review' && pendingGate.node === 'committer') return 'committer'
  return 'generic_gate'
}

function collectReviewDocuments(
  panelKind: PipelineGatePanelKind,
  stageOutputs: PipelineGatePanelStageOutputs,
): PipelinePatchWorkDocumentRef[] {
  if (panelKind === 'planner_document') return collectPlannerDocumentRefs(stageOutputs.planner)
  if (panelKind === 'developer_document') return collectDeveloperDocumentRefs(stageOutputs.developer)
  if (panelKind === 'reviewer_issue') {
    return dedupeDocumentRefs([
      stageOutputs.reviewer?.reviewDocRef,
      stageOutputs.reviewer?.reviewDoc,
    ].filter((document): document is PipelinePatchWorkDocumentRef => Boolean(document)))
  }
  if (panelKind === 'tester_result') return collectTesterPatchWorkRefs(stageOutputs.tester)
  if (panelKind === 'committer') return collectCommitterPatchWorkRefs(stageOutputs.committer)
  return []
}

export function buildPipelineGatePanelModel({
  sessionId,
  pendingGate,
  state,
  documentContents,
}: PipelineGatePanelModelInput): PipelineGatePanelModel {
  const panelKind = getPanelKind(pendingGate)
  const stageOutputs = getStageOutputs(state)
  const reviewDocuments = collectReviewDocuments(panelKind, stageOutputs)
  const reviewDoc = stageOutputs.reviewer?.reviewDocRef ?? stageOutputs.reviewer?.reviewDoc
  const gateId = pendingGate?.gateId ?? 'submission'

  return {
    panelKind,
    stageOutputs,
    reviewDocuments,
    showPatchWorkDocumentRead: reviewDocuments.length > 0,
    reviewerReviewContent: reviewDoc ? documentContents.get(reviewDoc.relativePath) : undefined,
    fallbackGate: panelKind === 'generic_gate' ? pendingGate ?? null : null,
    committerOperationIds: {
      localCommitOperationId: `${sessionId}:${gateId}:local_commit`,
      remoteSubmissionOperationId: `${sessionId}:${gateId}:remote_pr`,
    },
  }
}

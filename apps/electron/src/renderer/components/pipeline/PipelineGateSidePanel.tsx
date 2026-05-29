import * as React from 'react'
import type {
  PipelineExplorerReportRef,
  PipelineGateRequest,
  PipelineSessionMeta,
  PipelineStateSnapshot,
} from '@codeinsights/shared'
import { PipelineComposer } from './PipelineComposer'
import { PipelineGateCard } from './PipelineGateCard'
import { ExplorerTaskBoard } from './ExplorerTaskBoard'
import { ReviewDocumentBoard } from './ReviewDocumentBoard'
import { ReviewerIssueBoard } from './ReviewerIssueBoard'
import { TesterResultBoard } from './TesterResultBoard'
import { CommitterPanel } from './CommitterPanel'
import type { PipelineGatePanelModel } from './pipeline-gate-panel-model'
import type { PipelineGateRespondHandler } from './usePipelineGateActions'

interface PipelineGateSidePanelProps {
  sessionId: string
  session: PipelineSessionMeta | null
  state: PipelineStateSnapshot | null
  pendingGate: PipelineGateRequest | null
  gatePanel: PipelineGatePanelModel
  explorerReports: PipelineExplorerReportRef[]
  documentContents: Map<string, string>
  documentLoadingPaths: Set<string>
  documentReadErrors: Map<string, string>
  running: boolean
  startDisabled: boolean
  currentTask?: string
  onRespond: PipelineGateRespondHandler
  onSelectTask: (selectedReportId: string) => Promise<void>
  onOpenPatchWorkDir: () => Promise<void>
  onStart: (userInput: string) => Promise<{ started: boolean }>
  onStop: () => Promise<void>
}

export function PipelineGateSidePanel({
  sessionId,
  session,
  state,
  pendingGate,
  gatePanel,
  explorerReports,
  documentContents,
  documentLoadingPaths,
  documentReadErrors,
  running,
  startDisabled,
  currentTask,
  onRespond,
  onSelectTask,
  onOpenPatchWorkDir,
  onStart,
  onStop,
}: PipelineGateSidePanelProps): React.ReactElement {
  return (
    <aside className="order-first space-y-4 xl:order-none xl:sticky xl:top-4 xl:self-start">
      {gatePanel.panelKind === 'reviewer_issue' ? (
        <ReviewerIssueBoard
          output={gatePanel.stageOutputs.reviewer}
          iteration={pendingGate?.iteration ?? state?.reviewIteration ?? 0}
          maxIterations={3}
          reviewContent={gatePanel.reviewerReviewContent}
        />
      ) : null}
      {gatePanel.panelKind === 'committer' ? (
        <CommitterPanel
          sessionId={sessionId}
          output={gatePanel.stageOutputs.committer}
          testerOutput={gatePanel.stageOutputs.tester}
          contents={documentContents}
          loadingPaths={documentLoadingPaths}
          readErrors={documentReadErrors}
          onApprove={() => onRespond('approve', undefined, { submissionMode: 'local_patch' })}
          onLocalCommit={() => onRespond('approve', undefined, {
            submissionMode: 'local_commit',
            localCommitOperationId: gatePanel.committerOperationIds.localCommitOperationId,
          })}
          onRemoteSubmit={() => onRespond('approve', undefined, {
            kind: 'remote_write_confirmation',
            submissionMode: 'remote_pr',
            remoteSubmissionOperationId: gatePanel.committerOperationIds.remoteSubmissionOperationId,
            remoteWriteConfirmed: true,
          })}
          onReject={(feedback) => onRespond('reject_with_feedback', feedback)}
          onRerun={() => onRespond('rerun_node')}
          onOpenPatchWorkDir={onOpenPatchWorkDir}
        />
      ) : null}
      {gatePanel.panelKind === 'tester_result' ? (
        <TesterResultBoard
          sessionId={sessionId}
          output={gatePanel.stageOutputs.tester}
          contents={documentContents}
          loadingPaths={documentLoadingPaths}
          readErrors={documentReadErrors}
          gateKind={pendingGate?.kind}
          onApprove={() => onRespond('approve')}
          onReject={(feedback) => onRespond('reject_with_feedback', feedback)}
          onRerun={() => onRespond('rerun_node')}
          onOpenPatchWorkDir={onOpenPatchWorkDir}
        />
      ) : gatePanel.panelKind === 'explorer_task' ? (
        <ExplorerTaskBoard
          reports={explorerReports}
          initialSelectedReportId={state?.stageOutputs?.explorer?.selectedReportId}
          onSelectTask={onSelectTask}
          onRerun={() => onRespond('rerun_node')}
        />
      ) : gatePanel.panelKind === 'planner_document' || gatePanel.panelKind === 'developer_document' ? (
        <ReviewDocumentBoard
          sessionId={sessionId}
          stage={gatePanel.panelKind === 'developer_document' ? 'developer' : 'planner'}
          documents={gatePanel.reviewDocuments}
          contents={documentContents}
          loadingPaths={documentLoadingPaths}
          readErrors={documentReadErrors}
          onApprove={() => onRespond('approve')}
          onReject={(feedback) => onRespond('reject_with_feedback', feedback)}
          onRerun={() => onRespond('rerun_node')}
          onOpenPatchWorkDir={onOpenPatchWorkDir}
        />
      ) : gatePanel.fallbackGate ? (
        <PipelineGateCard
          request={gatePanel.fallbackGate}
          version={session?.version ?? state?.version}
          onRespond={onRespond}
        />
      ) : null}

      <PipelineComposer
        disabled={running}
        startDisabled={startDisabled}
        currentTask={currentTask}
        status={state?.status ?? session?.status}
        onSubmit={onStart}
        onStop={onStop}
      />
    </aside>
  )
}

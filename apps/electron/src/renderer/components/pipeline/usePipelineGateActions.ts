import * as React from 'react'
import type {
  ContributionMode,
  PipelineGateKind,
  PipelineGateRequest,
} from '@codeinsights/shared'

export interface PipelineGateRespondOptions {
  kind?: PipelineGateKind
  submissionMode?: ContributionMode
  localCommitOperationId?: string
  remoteSubmissionOperationId?: string
  remoteWriteConfirmed?: boolean
}

export type PipelineGateRespondHandler = (
  action: 'approve' | 'reject_with_feedback' | 'rerun_node',
  feedback?: string,
  options?: PipelineGateRespondOptions,
) => Promise<void>

export interface UsePipelineGateActionsResult {
  handleRespond: PipelineGateRespondHandler
  handleSelectTask: (selectedReportId: string) => Promise<void>
}

export function usePipelineGateActions({
  sessionId,
  pendingGate,
}: {
  sessionId: string
  pendingGate: PipelineGateRequest | null | undefined
}): UsePipelineGateActionsResult {
  const handleRespond = React.useCallback<PipelineGateRespondHandler>(async (
    action,
    feedback,
    options,
  ): Promise<void> => {
    if (!pendingGate) return
    await window.electronAPI.respondPipelineGate({
      gateId: pendingGate.gateId,
      sessionId,
      kind: options?.kind,
      action,
      feedback,
      submissionMode: options?.submissionMode,
      localCommitOperationId: options?.localCommitOperationId,
      remoteSubmissionOperationId: options?.remoteSubmissionOperationId,
      remoteWriteConfirmed: options?.remoteWriteConfirmed,
      createdAt: Date.now(),
    })
  }, [pendingGate, sessionId])

  const handleSelectTask = React.useCallback(async (selectedReportId: string): Promise<void> => {
    if (!pendingGate) return
    await window.electronAPI.selectPipelineTask({
      sessionId,
      gateId: pendingGate.gateId,
      selectedReportId,
    })
  }, [pendingGate, sessionId])

  return {
    handleRespond,
    handleSelectTask,
  }
}

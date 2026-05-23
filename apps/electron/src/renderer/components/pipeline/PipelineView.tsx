import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { agentChannelIdAtom, agentWorkspacesAtom, currentAgentWorkspaceIdAtom } from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/chat-atoms'
import type {
  ContributionMode,
  PipelineCommitterStageOutput,
  PipelineDeveloperStageOutput,
  PipelineExplorerReportRef,
  PipelineGateKind,
  PipelineGateRequest,
  PipelineNodeKind,
  PipelinePatchWorkDocumentRef,
  PipelinePlannerStageOutput,
  PipelineRecord,
  PipelineReviewerStageOutput,
  PipelineSessionMeta,
  PipelineStateSnapshot,
  PipelineTesterStageOutput,
} from '@codeinsights/shared'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import {
  clearPipelineLiveOutputForSession,
  pipelinePendingGatesAtom,
  pipelineCodexChannelIdAtom,
  getPipelineLiveOutput,
  hasPipelineLiveOutputNode,
  pipelineLiveOutputAtom,
  pipelineRecordRefreshAtom,
  pipelineSessionStateMapAtom,
  pipelineSessionsAtom,
  pipelineStreamErrorsAtom,
} from '@/atoms/pipeline-atoms'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import { resolvePipelineRunConfig, type PipelinePreflightError } from './pipeline-preflight'
import { ExplorerTaskBoard } from './ExplorerTaskBoard'
import { PipelineComposer } from './PipelineComposer'
import { PipelineFailureCard } from './PipelineFailureCard'
import { PipelineGateCard } from './PipelineGateCard'
import { PipelineHeader } from './PipelineHeader'
import { PipelineRecords } from './PipelineRecords'
import type { PipelineRecordsFocusRequest } from './PipelineRecords'
import { PipelineStageRail } from './PipelineStageRail'
import { buildPipelineFailureViewModel } from './pipeline-display-model'
import {
  mergePipelineRecordsTail,
  shouldApplyPipelineRecordsTailLoad,
} from './pipeline-record-tail-model'
import {
  ReviewDocumentBoard,
  collectDeveloperDocumentRefs,
  collectPlannerDocumentRefs,
} from './ReviewDocumentBoard'
import { ReviewerIssueBoard } from './ReviewerIssueBoard'
import {
  TesterResultBoard,
  collectTesterPatchWorkRefs,
} from './TesterResultBoard'
import {
  CommitterPanel,
  collectCommitterPatchWorkRefs,
} from './CommitterPanel'

export function PipelineView({
  sessionId,
}: {
  sessionId: string
}): React.ReactElement {
  const sessions = useAtomValue(pipelineSessionsAtom)
  const stateMap = useAtomValue(pipelineSessionStateMapAtom)
  const pendingGates = useAtomValue(pipelinePendingGatesAtom)
  const refreshMap = useAtomValue(pipelineRecordRefreshAtom)
  const errorMap = useAtomValue(pipelineStreamErrorsAtom)
  const liveOutputMap = useAtomValue(pipelineLiveOutputAtom)
  const channels = useAtomValue(channelsAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const fallbackChannelId = useAtomValue(agentChannelIdAtom)
  const fallbackWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const pipelineCodexChannelId = useAtomValue(pipelineCodexChannelIdAtom)
  const setDraftSessionIds = useSetAtom(draftSessionIdsAtom)
  const setSessions = useSetAtom(pipelineSessionsAtom)
  const setStateMap = useSetAtom(pipelineSessionStateMapAtom)
  const setPendingGates = useSetAtom(pipelinePendingGatesAtom)
  const setErrors = useSetAtom(pipelineStreamErrorsAtom)
  const setRecordRefresh = useSetAtom(pipelineRecordRefreshAtom)
  const setLiveOutput = useSetAtom(pipelineLiveOutputAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const [records, setRecords] = React.useState<PipelineRecord[]>([])
  const [preflightError, setPreflightError] = React.useState<PipelinePreflightError | null>(null)
  const [recordsFocusRequest, setRecordsFocusRequest] = React.useState<PipelineRecordsFocusRequest | null>(null)
  const [explorerReports, setExplorerReports] = React.useState<PipelineExplorerReportRef[]>([])
  const [documentContents, setDocumentContents] = React.useState<Map<string, string>>(new Map())
  const [documentLoadingPaths, setDocumentLoadingPaths] = React.useState<Set<string>>(new Set())
  const [documentReadErrors, setDocumentReadErrors] = React.useState<Map<string, string>>(new Map())
  const recordsCursorRef = React.useRef(0)
  const recordsLoadSeqRef = React.useRef(0)
  const recordsFocusSeqRef = React.useRef(0)

  const session = React.useMemo<PipelineSessionMeta | null>(
    () => sessions.find((item) => item.id === sessionId) ?? null,
    [sessions, sessionId],
  )
  const state = stateMap.get(sessionId) ?? (session ? {
    sessionId: session.id,
    currentNode: session.currentNode,
    status: session.status,
    reviewIteration: session.reviewIteration,
    lastApprovedNode: session.lastApprovedNode,
    pendingGate: session.pendingGate,
    updatedAt: session.updatedAt,
  } : null)
  const pendingGate = pendingGates.get(sessionId) ?? session?.pendingGate ?? null
  const refreshVersion = refreshMap.get(sessionId) ?? 0
  const error = errorMap.get(sessionId)
  const running = state?.status === 'running' || state?.status === 'waiting_human'
  const currentTask = React.useMemo(() => {
    return [...records].reverse().find((record) => record.type === 'user_input')?.content
  }, [records])
  const latestErrorRecord = React.useMemo(() => {
    return [...records]
      .reverse()
      .find((record): record is Extract<PipelineRecord, { type: 'error' }> => record.type === 'error')
  }, [records])
  const latestRecordError = latestErrorRecord?.error
  const liveOutput = state
    ? getPipelineLiveOutput(liveOutputMap, sessionId, state.currentNode)
    : ''
  const showLiveOutput = state?.status === 'running'
    && hasPipelineLiveOutputNode(liveOutputMap, sessionId, state.currentNode)
  const failureViewModel = React.useMemo(() => buildPipelineFailureViewModel({
    state,
    error: error ?? latestRecordError,
    partialOutput: liveOutput,
  }), [error, latestRecordError, liveOutput, state])
  const explorerStageOutput = state?.stageOutputs?.explorer
  const plannerStageOutput = state?.stageOutputs?.planner?.node === 'planner'
    ? state.stageOutputs.planner as PipelinePlannerStageOutput
    : null
  const developerStageOutput = state?.stageOutputs?.developer?.node === 'developer'
    ? state.stageOutputs.developer as PipelineDeveloperStageOutput
    : null
  const reviewerStageOutput = state?.stageOutputs?.reviewer?.node === 'reviewer'
    ? state.stageOutputs.reviewer as PipelineReviewerStageOutput
    : null
  const testerStageOutput = state?.stageOutputs?.tester?.node === 'tester'
    ? state.stageOutputs.tester as PipelineTesterStageOutput
    : null
  const committerStageOutput = state?.stageOutputs?.committer?.node === 'committer'
    ? state.stageOutputs.committer as PipelineCommitterStageOutput
    : null
  const showExplorerTaskBoard = pendingGate?.kind === 'task_selection' && pendingGate.node === 'explorer'
  const showPlannerDocumentBoard = pendingGate?.kind === 'document_review' && pendingGate.node === 'planner'
  const showDeveloperDocumentBoard = pendingGate?.kind === 'document_review' && pendingGate.node === 'developer'
  const showReviewerIssueBoard = pendingGate?.kind === 'review_iteration_limit' && pendingGate.node === 'reviewer'
  const showTesterResultBoard = (
    (pendingGate?.kind === 'document_review' || pendingGate?.kind === 'test_blocked')
    && pendingGate.node === 'tester'
  )
  const showCommitterPanel = pendingGate?.kind === 'submission_review' && pendingGate.node === 'committer'
  const reviewDocuments = React.useMemo<PipelinePatchWorkDocumentRef[]>(() => {
    if (showPlannerDocumentBoard) return collectPlannerDocumentRefs(plannerStageOutput)
    if (showDeveloperDocumentBoard) return collectDeveloperDocumentRefs(developerStageOutput)
    if (showReviewerIssueBoard) {
      return [reviewerStageOutput?.reviewDocRef, reviewerStageOutput?.reviewDoc]
        .filter((document): document is PipelinePatchWorkDocumentRef => Boolean(document))
        .filter((document, index, documents) =>
          documents.findIndex((item) => item.relativePath === document.relativePath) === index)
    }
    if (showTesterResultBoard) return collectTesterPatchWorkRefs(testerStageOutput)
    if (showCommitterPanel) return collectCommitterPatchWorkRefs(committerStageOutput)
    return []
  }, [committerStageOutput, developerStageOutput, plannerStageOutput, reviewerStageOutput, showCommitterPanel, showDeveloperDocumentBoard, showPlannerDocumentBoard, showReviewerIssueBoard, showTesterResultBoard, testerStageOutput])
  const reviewDocumentKey = React.useMemo(
    () => reviewDocuments.map((document) => `${document.relativePath}:${document.checksum ?? ''}`).join('|'),
    [reviewDocuments],
  )
  const showPatchWorkDocumentRead = showPlannerDocumentBoard
    || showDeveloperDocumentBoard
    || showReviewerIssueBoard
    || showTesterResultBoard
    || showCommitterPanel
  const reviewerReviewContent = React.useMemo(() => {
    const reviewDoc = reviewerStageOutput?.reviewDocRef ?? reviewerStageOutput?.reviewDoc
    return reviewDoc ? documentContents.get(reviewDoc.relativePath) : undefined
  }, [documentContents, reviewerStageOutput])

  React.useEffect(() => {
    recordsCursorRef.current = 0
    recordsLoadSeqRef.current += 1
    setRecords([])
  }, [sessionId])

  React.useEffect(() => {
    let cancelled = false

    async function loadRecordsTail(): Promise<void> {
      const loadId = recordsLoadSeqRef.current + 1
      recordsLoadSeqRef.current = loadId
      const afterIndex = recordsCursorRef.current
      let result = await window.electronAPI.getPipelineRecordsTail({
        sessionId,
        afterIndex,
        limit: 300,
      })
      const recordsBatch = [...result.records]

      while (result.hasMore) {
        result = await window.electronAPI.getPipelineRecordsTail({
          sessionId,
          afterIndex: result.nextIndex,
          limit: 300,
        })
        recordsBatch.push(...result.records)
      }

      if (cancelled) return
      if (!shouldApplyPipelineRecordsTailLoad({
        loadId,
        latestLoadId: recordsLoadSeqRef.current,
        afterIndex,
        currentCursor: recordsCursorRef.current,
      })) {
        return
      }

      recordsCursorRef.current = result.nextIndex
      setRecords((prev) => mergePipelineRecordsTail(prev, recordsBatch, afterIndex))
    }

    loadRecordsTail().catch(console.error)
    return () => {
      cancelled = true
    }
  }, [sessionId, refreshVersion])

  React.useEffect(() => {
    window.electronAPI.getPipelineSessionState(sessionId)
      .then((snapshot) => {
        setStateMap((prev) => {
          const next = new Map(prev)
          next.set(sessionId, snapshot)
          return next
        })
        if (snapshot.pendingGate) {
          setPendingGates((prev) => {
            const next = new Map(prev)
            next.set(sessionId, snapshot.pendingGate!)
            return next
          })
        }
        setSessions((prev) => prev.map((item) =>
          item.id === sessionId
            ? {
                ...item,
                currentNode: snapshot.currentNode,
                status: snapshot.status,
                reviewIteration: snapshot.reviewIteration,
                lastApprovedNode: snapshot.lastApprovedNode,
                pendingGate: snapshot.pendingGate,
                updatedAt: snapshot.updatedAt,
              }
            : item,
        ))
      })
      .catch(() => {
        // 还没有 checkpoint 时允许静默失败
      })
  }, [sessionId, setPendingGates, setSessions, setStateMap])

  React.useEffect(() => {
    if (!showExplorerTaskBoard) {
      setExplorerReports([])
      return
    }

    let cancelled = false
    setExplorerReports(explorerStageOutput?.reports ?? [])
    window.electronAPI.listPipelineExplorerReports({ sessionId })
      .then((reports) => {
        if (!cancelled) {
          setExplorerReports(reports)
        }
      })
      .catch((loadError) => {
        console.error('[PipelineView] 读取 explorer reports 失败:', loadError)
      })

    return () => {
      cancelled = true
    }
  }, [explorerStageOutput, sessionId, showExplorerTaskBoard])

  React.useEffect(() => {
    if (!showPatchWorkDocumentRead || reviewDocuments.length === 0) {
      setDocumentContents(new Map())
      setDocumentLoadingPaths(new Set())
      setDocumentReadErrors(new Map())
      return
    }

    let cancelled = false
    setDocumentContents(new Map())
    setDocumentLoadingPaths(new Set(reviewDocuments.map((document) => document.relativePath)))
    setDocumentReadErrors(new Map())

    for (const document of reviewDocuments) {
      window.electronAPI.readPipelinePatchWorkFile({
        sessionId,
        relativePath: document.relativePath,
      })
        .then((content) => {
          if (cancelled) return
          setDocumentContents((prev) => {
            const next = new Map(prev)
            next.set(document.relativePath, content)
            return next
          })
        })
        .catch((loadError) => {
          console.error('[PipelineView] 读取 patch-work 文档失败:', loadError)
          if (cancelled) return
          const message = loadError instanceof Error ? loadError.message : '读取失败'
          setDocumentReadErrors((prev) => {
            const next = new Map(prev)
            next.set(document.relativePath, message)
            return next
          })
        })
        .finally(() => {
          if (cancelled) return
          setDocumentLoadingPaths((prev) => {
            const next = new Set(prev)
            next.delete(document.relativePath)
            return next
          })
        })
    }

    return () => {
      cancelled = true
    }
  }, [reviewDocumentKey, reviewDocuments, sessionId, showPatchWorkDocumentRead])

  const handleStart = React.useCallback(async (userInput: string): Promise<void> => {
    const resolved = resolvePipelineRunConfig({
      sessionChannelId: session?.channelId,
      sessionWorkspaceId: session?.workspaceId,
      fallbackChannelId: fallbackChannelId ?? undefined,
      fallbackWorkspaceId: fallbackWorkspaceId ?? undefined,
      pipelineCodexChannelId: pipelineCodexChannelId ?? undefined,
      channels,
      workspaces,
    })
    if (!resolved.ok) {
      setPreflightError(resolved.error)
      return
    }

    const pipelineVersion = session?.version ?? state?.version
    const optimisticState: PipelineStateSnapshot = {
      sessionId,
      ...(pipelineVersion ? { version: pipelineVersion } : {}),
      currentNode: 'explorer',
      status: 'running',
      reviewIteration: state?.reviewIteration ?? session?.reviewIteration ?? 0,
      lastApprovedNode: state?.lastApprovedNode ?? session?.lastApprovedNode,
      pendingGate: null,
      updatedAt: Date.now(),
    }

    setPreflightError(null)
    setErrors((prev) => {
      if (!prev.has(sessionId)) return prev
      const next = new Map(prev)
      next.delete(sessionId)
      return next
    })
    setDraftSessionIds((prev) => {
      if (!prev.has(sessionId)) return prev
      const next = new Set(prev)
      next.delete(sessionId)
      return next
    })
    setStateMap((prev) => {
      const next = new Map(prev)
      next.set(sessionId, optimisticState)
      return next
    })
    setSessions((prev) => prev.map((item) => (
      item.id === sessionId
        ? {
            ...item,
            version: pipelineVersion ?? item.version,
            channelId: resolved.config.channelId,
            workspaceId: resolved.config.workspaceId,
            currentNode: optimisticState.currentNode,
            status: optimisticState.status,
            pendingGate: null,
            updatedAt: optimisticState.updatedAt,
          }
        : item
    )))
    void window.electronAPI.startPipeline({
      sessionId,
      userInput,
      channelId: resolved.config.channelId,
      workspaceId: resolved.config.workspaceId,
      threadId: session?.threadId,
    }).catch((error) => {
      console.error('[PipelineView] 启动失败:', error)
      const message = error instanceof Error ? error.message : '启动 Pipeline 失败'
      const failedAt = Date.now()
      const failedState: PipelineStateSnapshot = {
        ...optimisticState,
        status: 'node_failed',
        pendingGate: null,
        updatedAt: failedAt,
      }
      setErrors((prev) => {
        const next = new Map(prev)
        next.set(sessionId, message)
        return next
      })
      setPendingGates((prev) => {
        if (!prev.has(sessionId)) return prev
        const next = new Map(prev)
        next.delete(sessionId)
        return next
      })
      setStateMap((prev) => {
        const next = new Map(prev)
        next.set(sessionId, failedState)
        return next
      })
      setSessions((prev) => prev.map((item) => (
        item.id === sessionId
          ? {
              ...item,
              status: failedState.status,
              pendingGate: null,
              updatedAt: failedAt,
            }
          : item
      )))
    })
  }, [channels, fallbackChannelId, fallbackWorkspaceId, pipelineCodexChannelId, session, sessionId, setDraftSessionIds, setErrors, setPendingGates, setSessions, setStateMap, state, workspaces])

  const applyStoppedState = React.useCallback((stoppedState: PipelineStateSnapshot): void => {
    setPendingGates((prev) => {
      if (!prev.has(sessionId)) return prev
      const next = new Map(prev)
      next.delete(sessionId)
      return next
    })
    setErrors((prev) => {
      if (!prev.has(sessionId)) return prev
      const next = new Map(prev)
      next.delete(sessionId)
      return next
    })
    setLiveOutput((prev) => clearPipelineLiveOutputForSession(prev, sessionId))
    setStateMap((prev) => {
      const next = new Map(prev)
      next.set(sessionId, stoppedState)
      return next
    })
    setSessions((prev) => prev.map((item) => (
      item.id === sessionId
        ? {
            ...item,
            version: stoppedState.version ?? item.version,
            currentNode: stoppedState.currentNode,
            status: stoppedState.status,
            reviewIteration: stoppedState.reviewIteration,
            lastApprovedNode: stoppedState.lastApprovedNode,
            pendingGate: null,
            updatedAt: stoppedState.updatedAt,
          }
        : item
    )))
    setRecordRefresh((prev) => {
      const next = new Map(prev)
      next.set(sessionId, (prev.get(sessionId) ?? 0) + 1)
      return next
    })
  }, [sessionId, setErrors, setLiveOutput, setPendingGates, setRecordRefresh, setSessions, setStateMap])

  const handleStop = React.useCallback(async (): Promise<void> => {
    const previousState = state
    const previousSession = session
    const previousPendingGate = pendingGates.get(sessionId) ?? null
    const previousError = errorMap.get(sessionId) ?? null
    const stoppedAt = Date.now()
    const optimisticState: PipelineStateSnapshot = {
      sessionId,
      version: state?.version ?? session?.version,
      currentNode: state?.currentNode ?? session?.currentNode ?? 'explorer',
      status: 'terminated',
      reviewIteration: state?.reviewIteration ?? session?.reviewIteration ?? 0,
      lastApprovedNode: state?.lastApprovedNode ?? session?.lastApprovedNode,
      pendingGate: null,
      stageOutputs: state?.stageOutputs,
      updatedAt: stoppedAt,
    }

    applyStoppedState(optimisticState)

    try {
      const stoppedState = await window.electronAPI.stopPipeline(sessionId)
      applyStoppedState(stoppedState)
    } catch (error) {
      if (previousState) {
        setStateMap((prev) => {
          const next = new Map(prev)
          next.set(sessionId, previousState)
          return next
        })
      }
      if (previousSession) {
        setSessions((prev) => prev.map((item) => (
          item.id === sessionId ? previousSession : item
        )))
      }
      setPendingGates((prev) => {
        const next = new Map(prev)
        if (previousPendingGate) {
          next.set(sessionId, previousPendingGate)
        } else {
          next.delete(sessionId)
        }
        return next
      })
      setErrors((prev) => {
        const next = new Map(prev)
        if (previousError) {
          next.set(sessionId, previousError)
        } else {
          next.delete(sessionId)
        }
        return next
      })
      throw error
    }
  }, [applyStoppedState, errorMap, pendingGates, session, sessionId, setErrors, setPendingGates, setSessions, setStateMap, state])

  const handleRespond = React.useCallback(async (
    action: 'approve' | 'reject_with_feedback' | 'rerun_node',
    feedback?: string,
    options?: {
      kind?: PipelineGateKind
      submissionMode?: ContributionMode
      localCommitOperationId?: string
      remoteSubmissionOperationId?: string
      remoteWriteConfirmed?: boolean
    },
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

  const handleRestart = React.useCallback((): void => {
    if (!currentTask || running) return
    void handleStart(currentTask)
  }, [currentTask, handleStart, running])

  const requestStageFocus = React.useCallback((node: PipelineNodeKind): void => {
    recordsFocusSeqRef.current += 1
    setRecordsFocusRequest({
      nonce: recordsFocusSeqRef.current,
      type: 'stage',
      node,
    })
  }, [])

  const requestErrorFocus = React.useCallback((): void => {
    if (!latestErrorRecord) return
    recordsFocusSeqRef.current += 1
    setRecordsFocusRequest({
      nonce: recordsFocusSeqRef.current,
      type: 'record',
      recordId: latestErrorRecord.id,
    })
  }, [latestErrorRecord])

  const handleOpenArtifactsDir = React.useCallback(async (): Promise<void> => {
    const opened = await window.electronAPI.openPipelineArtifactsDir(sessionId)
    if (!opened) {
      throw new Error('系统未能打开 Pipeline 产物目录')
    }
  }, [sessionId])

  const handleOpenAgentSettings = React.useCallback((): void => {
    setSettingsTab('agent')
    setSettingsOpen(true)
  }, [setSettingsOpen, setSettingsTab])

  return (
    <div className="pipeline-workbench-shell relative flex h-full flex-col overflow-hidden bg-surface-panel/95">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-status-running/25 to-transparent" aria-hidden="true" />
      <div className="pipeline-workbench-bg relative z-10 flex-1 overflow-auto bg-transparent p-4">
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-4">
          <PipelineHeader session={session} state={state} />
          <PipelineStageRail
            state={state}
            version={session?.version ?? state?.version}
            onSelectStage={requestStageFocus}
          />

          {failureViewModel ? (
            <PipelineFailureCard
              viewModel={failureViewModel}
              canLocateError={Boolean(latestErrorRecord)}
              canRestart={Boolean(currentTask) && !running}
              onLocateError={requestErrorFocus}
              onOpenArtifactsDir={handleOpenArtifactsDir}
              onRestart={handleRestart}
              onOpenSettings={handleOpenAgentSettings}
            />
          ) : error ? (
            <div className="rounded-panel border border-status-danger-border bg-status-danger-bg px-4 py-3 text-sm leading-6 text-status-danger-fg shadow-card">
              {error}
            </div>
          ) : null}

          {preflightError ? (
            <div className="flex items-center justify-between gap-3 rounded-panel border border-status-waiting-border bg-status-waiting-bg px-4 py-3 text-sm text-text-primary shadow-card">
              <div>{preflightError.message}</div>
              <button
                onClick={() => {
                  setSettingsTab(preflightError.settingsTab)
                  setSettingsOpen(true)
                }}
                className="rounded-control bg-background px-3 py-2 text-sm font-medium text-text-primary shadow-sm transition-colors hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                前往设置
              </button>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <PipelineRecords
                focusRequest={recordsFocusRequest}
                records={records}
                liveNode={state?.currentNode}
                liveOutput={liveOutput}
                sessionId={sessionId}
                sessionTitle={session?.title}
                showLiveOutput={showLiveOutput}
              />
            </div>
            <aside className="order-first space-y-4 xl:order-none xl:sticky xl:top-4 xl:self-start">
              {showReviewerIssueBoard ? (
                <ReviewerIssueBoard
                  output={reviewerStageOutput}
                  iteration={pendingGate?.iteration ?? state?.reviewIteration ?? 0}
                  maxIterations={3}
                  reviewContent={reviewerReviewContent}
                />
              ) : null}
              {showCommitterPanel ? (
                <CommitterPanel
                  output={committerStageOutput}
                  testerOutput={testerStageOutput}
                  contents={documentContents}
                  loadingPaths={documentLoadingPaths}
                  readErrors={documentReadErrors}
                  onApprove={() => handleRespond('approve', undefined, { submissionMode: 'local_patch' })}
                  onLocalCommit={() => handleRespond('approve', undefined, {
                    submissionMode: 'local_commit',
                    localCommitOperationId: `${sessionId}:${pendingGate?.gateId ?? 'submission'}:local_commit`,
                  })}
                  onRemoteSubmit={() => handleRespond('approve', undefined, {
                    kind: 'remote_write_confirmation',
                    submissionMode: 'remote_pr',
                    remoteSubmissionOperationId: `${sessionId}:${pendingGate?.gateId ?? 'submission'}:remote_pr`,
                    remoteWriteConfirmed: true,
                  })}
                  onReject={(feedback) => handleRespond('reject_with_feedback', feedback)}
                  onRerun={() => handleRespond('rerun_node')}
                />
              ) : null}
              {showTesterResultBoard ? (
                <TesterResultBoard
                  output={testerStageOutput}
                  contents={documentContents}
                  loadingPaths={documentLoadingPaths}
                  readErrors={documentReadErrors}
                  gateKind={pendingGate?.kind}
                  onApprove={() => handleRespond('approve')}
                  onReject={(feedback) => handleRespond('reject_with_feedback', feedback)}
                  onRerun={() => handleRespond('rerun_node')}
                />
              ) : showExplorerTaskBoard ? (
                <ExplorerTaskBoard
                  reports={explorerReports}
                  initialSelectedReportId={state?.stageOutputs?.explorer?.selectedReportId}
                  onSelectTask={handleSelectTask}
                  onRerun={() => handleRespond('rerun_node')}
                />
              ) : showPlannerDocumentBoard || showDeveloperDocumentBoard ? (
                <ReviewDocumentBoard
                  stage={showDeveloperDocumentBoard ? 'developer' : 'planner'}
                  documents={reviewDocuments}
                  contents={documentContents}
                  loadingPaths={documentLoadingPaths}
                  readErrors={documentReadErrors}
                  onApprove={() => handleRespond('approve')}
                  onReject={(feedback) => handleRespond('reject_with_feedback', feedback)}
                  onRerun={() => handleRespond('rerun_node')}
                />
              ) : pendingGate && !showCommitterPanel ? (
                <PipelineGateCard
                  request={pendingGate as PipelineGateRequest}
                  version={session?.version ?? state?.version}
                  onRespond={handleRespond}
                />
              ) : null}
              <PipelineComposer
                disabled={running}
                currentTask={currentTask}
                status={state?.status ?? session?.status}
                onSubmit={handleStart}
                onStop={handleStop}
              />
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

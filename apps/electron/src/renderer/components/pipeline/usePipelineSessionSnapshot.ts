import * as React from 'react'
import type {
  PipelineGateRequest,
  PipelineSessionMeta,
  PipelineStateSnapshot,
} from '@codeinsights/shared'

interface UsePipelineSessionSnapshotInput {
  sessionId: string
  setStateMap: (update: (prev: Map<string, PipelineStateSnapshot>) => Map<string, PipelineStateSnapshot>) => void
  setPendingGates: (update: (prev: Map<string, PipelineGateRequest>) => Map<string, PipelineGateRequest>) => void
  setSessions: (update: (prev: PipelineSessionMeta[]) => PipelineSessionMeta[]) => void
}

export function usePipelineSessionSnapshot({
  sessionId,
  setStateMap,
  setPendingGates,
  setSessions,
}: UsePipelineSessionSnapshotInput): void {
  React.useEffect(() => {
    let cancelled = false

    window.electronAPI.getPipelineSessionState(sessionId)
      .then((snapshot) => {
        if (cancelled) return
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
        // 还没有 checkpoint 时允许静默失败。
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, setPendingGates, setSessions, setStateMap])
}

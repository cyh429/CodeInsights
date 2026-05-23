import { useEffect } from 'react'
import { useStore } from 'jotai'
import {
  applyPipelineStreamErrorState,
  applyPipelineStreamState,
  applyPipelineLiveOutput,
  clearPipelineLiveOutputForSession,
  pipelineLiveOutputAtom,
  pipelinePendingGatesAtom,
  pipelineRecordRefreshAtom,
  pipelineSessionStateMapAtom,
  pipelineSessionsAtom,
  pipelineStreamErrorsAtom,
  upsertPipelineSession,
} from '@/atoms/pipeline-atoms'

export function useGlobalPipelineListeners(): void {
  const store = useStore()

  useEffect(() => {
    void window.electronAPI.subscribePipelineStream().catch((error: unknown) => {
      console.error('[Pipeline] 订阅 stream 广播失败:', error)
    })

    const offEvent = window.electronAPI.onPipelineStreamEvent((payload) => {
      const event = payload.event
      store.set(pipelineSessionStateMapAtom, (prev) => {
        const next = new Map(prev)
        const current = next.get(payload.sessionId)
        const updated = applyPipelineStreamState(current, payload)
        if (updated) {
          next.set(payload.sessionId, updated)
        }
        return next
      })

      store.set(pipelineLiveOutputAtom, (prev) => applyPipelineLiveOutput(prev, payload))

      store.set(pipelineSessionsAtom, (prev) => {
        const existing = prev.find((session) => session.id === payload.sessionId)
        if (!existing) return prev

        if (event.type === 'gate_waiting') {
          return upsertPipelineSession(prev, {
            ...existing,
            currentNode: event.request.node,
            status: 'waiting_human',
            pendingGate: event.request,
            updatedAt: event.createdAt,
          })
        }

        if (event.type === 'gate_resolved') {
          return upsertPipelineSession(prev, {
            ...existing,
            status: 'running',
            pendingGate: null,
            updatedAt: event.createdAt,
          })
        }

        if (event.type === 'status_change') {
          return upsertPipelineSession(prev, {
            ...existing,
            currentNode: event.currentNode,
            status: event.status,
            pendingGate: event.status === 'waiting_human' ? existing.pendingGate : null,
            updatedAt: event.createdAt,
          })
        }

        if (event.type === 'node_start') {
          return upsertPipelineSession(prev, {
            ...existing,
            currentNode: event.node,
            status: 'running',
            updatedAt: event.createdAt,
          })
        }

        if (event.type === 'error') {
          return upsertPipelineSession(prev, {
            ...existing,
            status: 'node_failed',
            updatedAt: event.createdAt,
          })
        }

        return prev
      })

      if (event.type === 'gate_waiting') {
        const request = event.request
        store.set(pipelinePendingGatesAtom, (prev) => {
          const next = new Map(prev)
          next.set(payload.sessionId, request)
          return next
        })
      }

      if (event.type === 'gate_resolved') {
        store.set(pipelinePendingGatesAtom, (prev) => {
          const next = new Map(prev)
          next.delete(payload.sessionId)
          return next
        })
      }

      if (
        event.type === 'status_change'
        && (
          event.status === 'terminated'
          || event.status === 'node_failed'
          || event.status === 'completed'
          || event.status === 'recovery_failed'
        )
      ) {
        store.set(pipelinePendingGatesAtom, (prev) => {
          const next = new Map(prev)
          next.delete(payload.sessionId)
          return next
        })
      }

      if (
        event.type === 'node_start'
        || event.type === 'status_change'
        || event.type === 'node_complete'
        || event.type === 'gate_waiting'
        || event.type === 'gate_resolved'
        || event.type === 'error'
      ) {
        store.set(pipelineRecordRefreshAtom, (prev) => {
          const next = new Map(prev)
          next.set(payload.sessionId, (prev.get(payload.sessionId) ?? 0) + 1)
          return next
        })
      }
    })

    const offComplete = window.electronAPI.onPipelineStreamComplete((payload) => {
      store.set(pipelineSessionStateMapAtom, (prev) => {
        const next = new Map(prev)
        next.set(payload.sessionId, payload.state)
        return next
      })
      store.set(pipelinePendingGatesAtom, (prev) => {
        const next = new Map(prev)
        next.delete(payload.sessionId)
        return next
      })
      store.set(pipelineSessionsAtom, (prev) => {
        const existing = prev.find((session) => session.id === payload.sessionId)
        if (!existing) return prev
        return upsertPipelineSession(prev, {
          ...existing,
          currentNode: payload.state.currentNode,
          status: payload.state.status,
          reviewIteration: payload.state.reviewIteration,
          lastApprovedNode: payload.state.lastApprovedNode,
          pendingGate: payload.state.pendingGate,
          updatedAt: payload.state.updatedAt,
        })
      })
      store.set(pipelineRecordRefreshAtom, (prev) => {
        const next = new Map(prev)
        next.set(payload.sessionId, (prev.get(payload.sessionId) ?? 0) + 1)
        return next
      })
      store.set(pipelineLiveOutputAtom, (prev) => clearPipelineLiveOutputForSession(prev, payload.sessionId))
    })

    const offError = window.electronAPI.onPipelineStreamError((payload) => {
      const createdAt = Date.now()
      store.set(pipelineStreamErrorsAtom, (prev) => {
        const next = new Map(prev)
        next.set(payload.sessionId, payload.error)
        return next
      })
      store.set(pipelineSessionStateMapAtom, (prev) => {
        const next = new Map(prev)
        const updated = applyPipelineStreamErrorState(next.get(payload.sessionId), payload, createdAt)
        if (updated) {
          next.set(payload.sessionId, updated)
        }
        return next
      })
      store.set(pipelineSessionsAtom, (prev) => {
        const existing = prev.find((session) => session.id === payload.sessionId)
        if (!existing) return prev

        return upsertPipelineSession(prev, {
          ...existing,
          status: 'node_failed',
          pendingGate: null,
          updatedAt: createdAt,
        })
      })
      store.set(pipelinePendingGatesAtom, (prev) => {
        const next = new Map(prev)
        next.delete(payload.sessionId)
        return next
      })
      store.set(pipelineRecordRefreshAtom, (prev) => {
        const next = new Map(prev)
        next.set(payload.sessionId, (prev.get(payload.sessionId) ?? 0) + 1)
        return next
      })
    })

    return () => {
      offEvent()
      offComplete()
      offError()
      void window.electronAPI.unsubscribePipelineStream().catch((error: unknown) => {
        console.error('[Pipeline] 取消订阅 stream 广播失败:', error)
      })
    }
  }, [store])
}

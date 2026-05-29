import * as React from 'react'
import type { PipelineSubmissionPlan } from '@codeinsights/shared'

interface PipelineSubmissionPlanState {
  submissionPlan: PipelineSubmissionPlan | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function usePipelineSubmissionPlan({
  sessionId,
  enabled,
  refreshVersion,
}: {
  sessionId: string
  enabled: boolean
  refreshVersion: number
}): PipelineSubmissionPlanState {
  const [submissionPlan, setSubmissionPlan] = React.useState<PipelineSubmissionPlan | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const requestSeqRef = React.useRef(0)

  const load = React.useCallback(async (): Promise<void> => {
    const requestSeq = requestSeqRef.current + 1
    requestSeqRef.current = requestSeq

    if (!enabled) {
      setSubmissionPlan(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const nextPlan = await window.electronAPI.getPipelineSubmissionPlan({ sessionId })
      if (requestSeqRef.current === requestSeq) {
        setSubmissionPlan(nextPlan)
      }
    } catch (loadError) {
      if (requestSeqRef.current === requestSeq) {
        setError(loadError instanceof Error ? loadError.message : '读取提交计划失败')
      }
    } finally {
      if (requestSeqRef.current === requestSeq) {
        setLoading(false)
      }
    }
  }, [enabled, sessionId])

  React.useEffect(() => {
    void load()
  }, [load, refreshVersion])

  return {
    submissionPlan,
    loading,
    error,
    refresh: load,
  }
}

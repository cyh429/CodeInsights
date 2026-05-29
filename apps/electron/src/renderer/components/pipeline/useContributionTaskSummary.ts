import * as React from 'react'
import type { ContributionTaskSummary } from '@codeinsights/shared'

interface ContributionTaskSummaryState {
  summary: ContributionTaskSummary | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useContributionTaskSummary({
  sessionId,
  enabled,
  refreshVersion,
}: {
  sessionId: string
  enabled: boolean
  refreshVersion: number
}): ContributionTaskSummaryState {
  const [summary, setSummary] = React.useState<ContributionTaskSummary | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const requestSeqRef = React.useRef(0)

  const load = React.useCallback(async (): Promise<void> => {
    const requestSeq = requestSeqRef.current + 1
    requestSeqRef.current = requestSeq

    if (!enabled) {
      setSummary(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const nextSummary = await window.electronAPI.getContributionTaskSummary({ sessionId })
      if (requestSeqRef.current === requestSeq) {
        setSummary(nextSummary)
      }
    } catch (loadError) {
      if (requestSeqRef.current === requestSeq) {
        setError(loadError instanceof Error ? loadError.message : '读取贡献任务状态失败')
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
    summary,
    loading,
    error,
    refresh: load,
  }
}

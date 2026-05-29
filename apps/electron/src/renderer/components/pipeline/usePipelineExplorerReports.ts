import * as React from 'react'
import type { PipelineExplorerReportRef } from '@codeinsights/shared'

interface UsePipelineExplorerReportsInput {
  sessionId: string
  enabled: boolean
  initialReports?: PipelineExplorerReportRef[]
}

export function usePipelineExplorerReports({
  sessionId,
  enabled,
  initialReports,
}: UsePipelineExplorerReportsInput): PipelineExplorerReportRef[] {
  const [explorerReports, setExplorerReports] = React.useState<PipelineExplorerReportRef[]>([])

  React.useEffect(() => {
    if (!enabled) {
      setExplorerReports([])
      return
    }

    let cancelled = false
    setExplorerReports(initialReports ?? [])
    window.electronAPI.listPipelineExplorerReports({ sessionId })
      .then((reports) => {
        if (!cancelled) {
          setExplorerReports(reports)
        }
      })
      .catch((error) => {
        console.error('[PipelineExplorerReports] 读取 explorer reports 失败:', error)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, initialReports, sessionId])

  return explorerReports
}

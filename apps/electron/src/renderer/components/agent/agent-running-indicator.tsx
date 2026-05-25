import * as React from 'react'
import { Spinner } from '@/components/ui/spinner'

interface AgentRunningIndicatorProps {
  startedAt?: number
  label?: string
}

export function AgentRunningIndicator({ startedAt, label = 'Agent 同步中' }: AgentRunningIndicatorProps): React.ReactElement {
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    const start = startedAt ?? Date.now()
    const update = (): void => setElapsed((Date.now() - start) / 1000)
    update()
    const timer = setInterval(update, 100)
    return () => clearInterval(timer)
  }, [startedAt])

  return (
    <div className="agent-tool-rail inline-flex min-h-[32px] items-center gap-2 rounded-full px-3">
      <Spinner size="sm" className="text-status-running-fg" />
      <span className="text-[12px] font-medium text-status-running-fg tabular-nums">{label} {formatElapsedTime(elapsed)}</span>
    </div>
  )
}

function formatElapsedTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  return `${minutes}m ${restSeconds.toFixed(1)}s`
}

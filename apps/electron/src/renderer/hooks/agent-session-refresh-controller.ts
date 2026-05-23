export interface AgentSessionRefreshOptions {
  delayMs?: number
  syncStoppedByUser?: boolean
  syncTitles?: boolean
}

interface PendingAgentSessionRefresh {
  delayMs: number
  syncStoppedByUser: boolean
  syncTitles: boolean
}

interface CreateAgentSessionRefreshControllerOptions {
  run: (options: Omit<PendingAgentSessionRefresh, 'delayMs'>) => Promise<void> | void
}

export interface AgentSessionRefreshController {
  schedule: (options?: AgentSessionRefreshOptions) => void
  dispose: () => void
}

function mergePendingRefresh(
  current: PendingAgentSessionRefresh | null,
  next?: AgentSessionRefreshOptions,
): PendingAgentSessionRefresh {
  return {
    delayMs: Math.min(current?.delayMs ?? Number.POSITIVE_INFINITY, next?.delayMs ?? 0),
    syncStoppedByUser: current?.syncStoppedByUser === true || next?.syncStoppedByUser === true,
    syncTitles: current?.syncTitles === true || next?.syncTitles === true,
  }
}

export function createAgentSessionRefreshController(
  options: CreateAgentSessionRefreshControllerOptions,
): AgentSessionRefreshController {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingRefresh: PendingAgentSessionRefresh | null = null
  let running = false
  let disposed = false

  const scheduleTimer = (delayMs: number): void => {
    if (disposed) return
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, delayMs)
  }

  const schedulePendingRefresh = (): void => {
    if (disposed || pendingRefresh == null) {
      return
    }
    scheduleTimer(pendingRefresh.delayMs)
  }

  const flush = async (): Promise<void> => {
    if (disposed || running || !pendingRefresh) {
      return
    }

    const current = pendingRefresh
    pendingRefresh = null
    running = true

    try {
      await options.run({
        syncStoppedByUser: current.syncStoppedByUser,
        syncTitles: current.syncTitles,
      })
    } finally {
      running = false
      schedulePendingRefresh()
    }
  }

  return {
    schedule(nextOptions) {
      pendingRefresh = mergePendingRefresh(pendingRefresh, nextOptions)

      if (running) {
        return
      }

      scheduleTimer(pendingRefresh.delayMs)
    },

    dispose() {
      disposed = true
      pendingRefresh = null
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}

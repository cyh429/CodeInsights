import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  scanSessionsAtom,
  scanFindingsMapAtom,
  currentScanSessionIdAtom,
  currentScanSessionAtom,
  selectedFindingIdAtom,
  filteredFindingsAtom,
} from '@/atoms/scan-atoms'
import { ScanFindingList } from './ScanFindingList'
import { ScanFindingDetail } from './ScanFindingDetail'
import { ScanHeader } from './ScanHeader'
import type { ScanSessionMeta, ScanFinding } from '@codeinsights/shared'

export interface ScanViewProps {
  sessionId: string
}

export function ScanView({ sessionId }: ScanViewProps): React.ReactElement {
  const sessions = useAtomValue(scanSessionsAtom)
  const findingsMap = useAtomValue(scanFindingsMapAtom)
  const setFindingsMap = useSetAtom(scanFindingsMapAtom)
  const currentSession = useAtomValue(currentScanSessionAtom)
  const setCurrentSessionId = useSetAtom(currentScanSessionIdAtom)
  const setSelectedFindingId = useSetAtom(selectedFindingIdAtom)
  const filteredFindings = useAtomValue(filteredFindingsAtom)

  const session = React.useMemo<ScanSessionMeta | null>(
    () => sessions.find((item) => item.id === sessionId) ?? null,
    [sessions, sessionId],
  )

  const findings = React.useMemo<ScanFinding[]>(
    () => findingsMap.get(sessionId) ?? [],
    [findingsMap, sessionId],
  )

  // 当组件挂载时，设置当前会话ID
  React.useEffect(() => {
    setCurrentSessionId(sessionId)
    return () => {
      setCurrentSessionId(null)
      setSelectedFindingId(null)
    }
  }, [sessionId, setCurrentSessionId, setSelectedFindingId])

  // 加载发现项
  React.useEffect(() => {
    if (sessionId && !findingsMap.has(sessionId)) {
      window.electronAPI.listScanFindings(sessionId).then((loadedFindings) => {
        setFindingsMap((prev) => {
          const next = new Map(prev)
          next.set(sessionId, loadedFindings)
          return next
        })
      }).catch((err) => {
        console.error('加载扫描发现项失败:', err)
      })
    }
  }, [sessionId, findingsMap, setFindingsMap])

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="text-text-secondary mb-2">扫描会话不存在</div>
          <div className="text-xs text-text-tertiary">sessionId: {sessionId}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-app">
      {/* 头部 */}
      <ScanHeader session={session} findingsCount={findings.length} />

      {/* 主内容区：左右分栏 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：发现项列表 */}
        <div className="w-80 flex-shrink-0 overflow-hidden border-r border-border-subtle/60">
          <ScanFindingList findings={filteredFindings} />
        </div>

        {/* 右侧：详情面板 */}
        <div className="flex-1 overflow-hidden">
          <ScanFindingDetail />
        </div>
      </div>
    </div>
  )
}

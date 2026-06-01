import { atom } from 'jotai'
import type {
  ScanFinding,
  ScanSessionMeta,
  ScanStatistics,
} from '@codeinsights/shared'

// ===== 会话列表状态 =====

export const scanSessionsAtom = atom<ScanSessionMeta[]>([])
export const currentScanSessionIdAtom = atom<string | null>(null)

export type ScanSidebarViewMode = 'active' | 'archived'
export const scanSidebarViewModeAtom = atom<ScanSidebarViewMode>('active')

export const currentScanSessionAtom = atom<ScanSessionMeta | null>((get) => {
  const currentId = get(currentScanSessionIdAtom)
  if (!currentId) return null
  return get(scanSessionsAtom).find((session) => session.id === currentId) ?? null
})

// ===== 发现项状态 =====

/** 每个扫描会话的发现项 Map: scanId -> ScanFinding[] */
export const scanFindingsMapAtom = atom<Map<string, ScanFinding[]>>(new Map())

/** 当前扫描会话的发现项 */
export const currentScanFindingsAtom = atom<ScanFinding[]>((get) => {
  const currentId = get(currentScanSessionIdAtom)
  if (!currentId) return []
  return get(scanFindingsMapAtom).get(currentId) ?? []
})

// ===== 筛选和排序状态 =====

export interface ScanFilterState {
  severity?: string[]
  status?: string[]
  category?: string
  searchQuery?: string
}

export const scanFilterStateAtom = atom<ScanFilterState>({})

export type ScanSortField = 'severity' | 'status' | 'filePath'
export type ScanSortDirection = 'asc' | 'desc'

export interface ScanSortState {
  field: ScanSortField
  direction: ScanSortDirection
}

export const scanSortStateAtom = atom<ScanSortState>({
  field: 'severity',
  direction: 'desc',
})

// ===== 筛选后的发现项 =====

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

export const filteredFindingsAtom = atom<ScanFinding[]>((get) => {
  const findings = get(currentScanFindingsAtom)
  const filter = get(scanFilterStateAtom)
  const sort = get(scanSortStateAtom)

  let result = [...findings]

  // 按严重程度筛选
  if (filter.severity && filter.severity.length > 0) {
    result = result.filter((f) => filter.severity!.includes(f.severity))
  }

  // 按状态筛选
  if (filter.status && filter.status.length > 0) {
    result = result.filter((f) => filter.status!.includes(f.status))
  }

  // 按类别筛选
  if (filter.category) {
    result = result.filter((f) => f.category === filter.category)
  }

  // 搜索查询
  if (filter.searchQuery) {
    const query = filter.searchQuery.toLowerCase()
    result = result.filter(
      (f) =>
        f.title.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query) ||
        f.location.filePath.toLowerCase().includes(query),
    )
  }

  // 排序
  result.sort((a, b) => {
    let comparison = 0
    switch (sort.field) {
      case 'severity':
        comparison = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
        break
      case 'status':
        comparison = a.status.localeCompare(b.status)
        break
      case 'filePath':
        comparison = a.location.filePath.localeCompare(b.location.filePath)
        break
    }
    return sort.direction === 'desc' ? -comparison : comparison
  })

  return result
})

// ===== 当前选中的发现项 =====

export const selectedFindingIdAtom = atom<string | null>(null)

export const selectedFindingAtom = atom<ScanFinding | null>((get) => {
  const findingId = get(selectedFindingIdAtom)
  if (!findingId) return null
  const findings = get(currentScanFindingsAtom)
  return findings.find((f) => f.id === findingId) ?? null
})

// ===== 统计信息 =====

export const scanStatisticsAtom = atom<ScanStatistics | null>(null)

// ===== 辅助函数 =====

export function upsertScanSession(
  sessions: ScanSessionMeta[],
  next: ScanSessionMeta,
): ScanSessionMeta[] {
  const existing = sessions.find((session) => session.id === next.id)
  if (!existing) {
    return [next, ...sessions]
  }
  return sessions.map((session) => (session.id === next.id ? next : session))
}

export function removeScanSession(
  sessions: ScanSessionMeta[],
  id: string,
): ScanSessionMeta[] {
  return sessions.filter((session) => session.id !== id)
}

/** 按严重程度分组统计 */
export function getFindingsBySeverity(findings: ScanFinding[]): Record<string, number> {
  return findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
}

/** 按状态分组统计 */
export function getFindingsByStatus(findings: ScanFinding[]): Record<string, number> {
  return findings.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
}

/** 获取所有可用类别 */
export function getUniqueCategories(findings: ScanFinding[]): string[] {
  return [...new Set(findings.map((f) => f.category))].filter(Boolean).sort()
}

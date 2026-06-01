/**
 * 扫描会话管理器
 *
 * 负责扫描会话的 CRUD 操作和发现项持久化。
 */

import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type {
  CreateScanRequest,
  FindingStatus,
  ScanFinding,
  ScanSessionDetail,
  ScanSessionMeta,
  ScanStatistics,
  UpdateFindingStatusRequest,
} from '@codeinsights/shared'
import {
  getScanSessionFindingsPath,
  getScanSessionsIndexPath,
} from './config-paths'
import { readJsonFileSafe, writeJsonFileAtomic } from './safe-file'

interface ScanSessionsIndex {
  version: number
  sessions: ScanSessionMeta[]
}

const INDEX_VERSION = 1

function readIndex(): ScanSessionsIndex {
  return readJsonFileSafe<ScanSessionsIndex>(getScanSessionsIndexPath())
    ?? { version: INDEX_VERSION, sessions: [] }
}

function writeIndex(index: ScanSessionsIndex): void {
  writeJsonFileAtomic(getScanSessionsIndexPath(), index)
}

export function getScanMeta(id: string): ScanSessionMeta | undefined {
  return readIndex().sessions.find((s) => s.id === id)
}

export function listScanSessions(): ScanSessionMeta[] {
  return readIndex().sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function createScanSession(
  title: string,
  description?: string,
  target?: string,
  targetPath?: string,
  scanner?: string,
): ScanSessionMeta {
  const index = readIndex()
  const now = Date.now()
  const session: ScanSessionMeta = {
    id: randomUUID(),
    title,
    description,
    target: target || '未指定项目',
    scanner: scanner || 'manual',
    status: 'idle',
    totalFindings: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
    createdAt: now,
    updatedAt: now,
  }
  index.sessions.push(session)
  writeIndex(index)
  return session
}

export function updateScanSessionMeta(
  id: string,
  patch: Partial<Omit<ScanSessionMeta, 'id' | 'createdAt'>>,
): ScanSessionMeta {
  const index = readIndex()
  const target = index.sessions.find((s) => s.id === id)
  if (!target) {
    throw new Error(`未找到扫描会话: ${id}`)
  }
  Object.assign(target, patch, { updatedAt: Date.now() })
  writeIndex(index)
  return target
}

export function deleteScanSession(id: string): void {
  const index = readIndex()
  index.sessions = index.sessions.filter((s) => s.id !== id)
  writeIndex(index)
  const findingsPath = getScanSessionFindingsPath(id)
  if (existsSync(findingsPath)) {
    unlinkSync(findingsPath)
  }
}

export function getScanSessionFindings(scanId: string): ScanFinding[] {
  const filePath = getScanSessionFindingsPath(scanId)
  if (!existsSync(filePath)) return []
  const raw = readFileSync(filePath, 'utf-8')
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ScanFinding)
}

export function appendScanFinding(
  sessionId: string,
  finding: ScanFinding,
): void {
  appendFileSync(
    getScanSessionFindingsPath(sessionId),
    JSON.stringify(finding) + '\n',
    'utf-8',
  )
  const current = getScanMeta(sessionId)
  if (!current) return
  updateScanFindingCount(sessionId, finding.severity, 1)
}

function updateScanFindingCount(
  scanId: string,
  severity: ScanFinding['severity'],
  delta: number,
): void {
  const meta = getScanMeta(scanId)
  if (!meta) return
  const update: Partial<ScanSessionMeta> = {
    totalFindings: (meta.totalFindings || 0) + delta,
    criticalCount: (meta.criticalCount || 0) + (severity === 'critical' ? delta : 0),
    highCount: (meta.highCount || 0) + (severity === 'high' ? delta : 0),
    mediumCount: (meta.mediumCount || 0) + (severity === 'medium' ? delta : 0),
    lowCount: (meta.lowCount || 0) + (severity === 'low' ? delta : 0),
    infoCount: (meta.infoCount || 0) + (severity === 'info' ? delta : 0),
  }
  updateScanSessionMeta(scanId, update)
}

export function getScanStatistics(): ScanStatistics {
  const sessions = listScanSessions()
  const stats: ScanStatistics = {
    totalScans: sessions.length,
    totalFindings: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
    openCount: 0,
    fixedCount: 0,
  }
  for (const session of sessions) {
    stats.totalFindings += session.totalFindings || 0
    stats.criticalCount += session.criticalCount || 0
    stats.highCount += session.highCount || 0
    stats.mediumCount += session.mediumCount || 0
    stats.lowCount += session.lowCount || 0
    stats.infoCount += session.infoCount || 0
  }
  // 统计 open/fixed 状态需要遍历所有发现项
  for (const session of sessions) {
    const findings = getScanSessionFindings(session.id)
    for (const finding of findings) {
      if (finding.status === 'open') stats.openCount++
      if (finding.status === 'fixed') stats.fixedCount++
    }
  }
  return stats
}

export function updateFindingStatus(
  scanId: string,
  findingId: string,
  status: FindingStatus,
): ScanFinding | null {
  const findingsPath = getScanSessionFindingsPath(scanId)
  const existing = getScanSessionFindings(scanId)
  const index = existing.findIndex((f) => f.id === findingId)
  if (index === -1) return null

  const oldFinding = existing[index]
  if (!oldFinding) return null

  existing[index] = {
    ...oldFinding,
    status,
    updatedAt: Date.now(),
    // triagedAt 仅在从未设置过且当前状态不是 open/fixed 时设置
    triagedAt: oldFinding.triagedAt ?? (status !== 'open' && status !== 'fixed' ? Date.now() : undefined),
    // fixedAt 仅在从未设置过且当前状态是 fixed 时设置
    fixedAt: oldFinding.fixedAt ?? (status === 'fixed' ? Date.now() : undefined),
  }

  // 重写整个文件
  writeFileSync(
    findingsPath,
    existing.map((f) => JSON.stringify(f)).join('\n') + '\n',
    'utf-8',
  )

  return existing[index] ?? null
}

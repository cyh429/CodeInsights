import { ipcMain, shell } from 'electron'
import { SCAN_IPC_CHANNELS } from '@codeinsights/shared'
import type {
  CreateScanRequest,
  ScanFinding,
  ScanSessionMeta,
  ScanStatistics,
  UpdateFindingStatusRequest,
} from '@codeinsights/shared'
import {
  appendScanFinding,
  createScanSession,
  deleteScanSession,
  getScanMeta,
  getScanSessionFindings,
  getScanStatistics,
  listScanSessions,
  updateFindingStatus,
  updateScanSessionMeta,
} from '../lib/scan-session-manager'
import { getScanSessionFindingsPath } from '../lib/config-paths'

export function registerScanIpcHandlers(): void {
  ipcMain.handle(
    SCAN_IPC_CHANNELS.LIST_SCANS,
    async (): Promise<ScanSessionMeta[]> => {
      return listScanSessions()
    }
  )

  ipcMain.handle(
    SCAN_IPC_CHANNELS.GET_SCAN,
    async (_event, id: string): Promise<ScanSessionMeta | undefined> => {
      return getScanMeta(id)
    }
  )

  ipcMain.handle(
    SCAN_IPC_CHANNELS.CREATE_SCAN,
    async (_event, request: CreateScanRequest): Promise<ScanSessionMeta> => {
      return createScanSession(
        request.title,
        request.description,
        request.target,
        request.targetPath,
        request.scanner,
      )
    }
  )

  ipcMain.handle(
    SCAN_IPC_CHANNELS.UPDATE_SCAN,
    async (_event, id: string, patch: Partial<Omit<ScanSessionMeta, 'id' | 'createdAt'>>): Promise<ScanSessionMeta> => {
      return updateScanSessionMeta(id, patch)
    }
  )

  ipcMain.handle(
    SCAN_IPC_CHANNELS.DELETE_SCAN,
    async (_event, id: string): Promise<void> => {
      deleteScanSession(id)
    }
  )

  ipcMain.handle(
    SCAN_IPC_CHANNELS.LIST_FINDINGS,
    async (_event, scanId: string): Promise<ScanFinding[]> => {
      return getScanSessionFindings(scanId)
    }
  )

  ipcMain.handle(
    SCAN_IPC_CHANNELS.GET_FINDING,
    async (_event, scanId: string, findingId: string): Promise<ScanFinding | undefined> => {
      const findings = getScanSessionFindings(scanId)
      return findings.find((f) => f.id === findingId)
    }
  )

  ipcMain.handle(
    SCAN_IPC_CHANNELS.UPDATE_FINDING_STATUS,
    async (_event, request: UpdateFindingStatusRequest): Promise<ScanFinding | null> => {
      return updateFindingStatus(request.scanId, request.findingId, request.status)
    }
  )

  ipcMain.handle(
    SCAN_IPC_CHANNELS.GET_STATISTICS,
    async (): Promise<ScanStatistics> => {
      return getScanStatistics()
    }
  )

  ipcMain.handle(
    SCAN_IPC_CHANNELS.EXPORT_SCAN,
    async (_event, scanId: string): Promise<boolean> => {
      const errorMessage = await shell.openPath(getScanSessionFindingsPath(scanId))
      return errorMessage.length === 0
    }
  )
}

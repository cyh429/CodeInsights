import { writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { BrowserWindow as ElectronBrowserWindow, dialog as electronDialog } from 'electron'
import type {
  PipelineReportExport,
  PipelineReportPdfSaveResult,
} from '@codeinsights/shared'

export type PipelineReportPdfSaver = (
  report: PipelineReportExport,
) => Promise<PipelineReportPdfSaveResult>

interface ElectronMainModule {
  BrowserWindow: typeof ElectronBrowserWindow
  dialog: typeof electronDialog
}

interface ElectronMainImport extends Partial<ElectronMainModule> {
  default?: ElectronMainModule
}

async function loadElectronMain(): Promise<ElectronMainModule> {
  const electronModule = await import('electron') as ElectronMainImport
  const candidate = electronModule.default ?? electronModule
  if (!candidate.BrowserWindow || !candidate.dialog) {
    throw new Error('Electron PDF 导出环境不可用')
  }
  return {
    BrowserWindow: candidate.BrowserWindow,
    dialog: candidate.dialog,
  }
}

async function renderReportHtmlToPdf(
  html: string,
  BrowserWindow: typeof ElectronBrowserWindow,
): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      javascript: false,
      webviewTag: false,
      partition: `pipeline-report-pdf-${randomUUID()}`,
    },
  })

  try {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (event) => {
      event.preventDefault()
    })
    win.webContents.session.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*', 'file://*/*', 'ftp://*/*', 'ws://*/*', 'wss://*/*'] },
      (_details, callback) => callback({ cancel: true }),
    )

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        marginType: 'default',
      },
    })
  } finally {
    if (!win.isDestroyed()) {
      win.destroy()
    }
  }
}

export async function savePipelineReportPdfFile(
  report: PipelineReportExport,
): Promise<PipelineReportPdfSaveResult> {
  const { BrowserWindow, dialog } = await loadElectronMain()
  const focusedWindow = BrowserWindow.getFocusedWindow()
  const saveOptions = {
    defaultPath: report.pdfFileName,
    filters: [
      { name: 'PDF 报告', extensions: ['pdf'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  }
  const result = focusedWindow
    ? await dialog.showSaveDialog(focusedWindow, saveOptions)
    : await dialog.showSaveDialog(saveOptions)

  if (result.canceled || !result.filePath) {
    return {
      canceled: true,
      fileName: report.pdfFileName,
    }
  }

  const pdf = await renderReportHtmlToPdf(report.html, BrowserWindow)
  writeFileSync(result.filePath, pdf)

  return {
    canceled: false,
    filePath: result.filePath,
    fileName: basename(result.filePath),
  }
}

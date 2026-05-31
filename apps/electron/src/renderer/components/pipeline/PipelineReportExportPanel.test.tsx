import { describe, expect, test } from 'bun:test'
import type { PipelineReportExport } from '@codeinsights/shared'
import { buildPipelineReportExportPanelViewModel } from './PipelineReportExportPanel'

const TEXT = {
  report: '\u8d21\u732e\u62a5\u544a',
  notGenerated: '\u5c1a\u672a\u751f\u6210',
  generated: '\u5df2\u751f\u6210',
  generating: '\u751f\u6210\u4e2d',
  failed: '\u751f\u6210\u5931\u8d25',
  clickGenerate: '\u70b9\u51fb\u751f\u6210\u62a5\u544a',
  taskHeading: '## \u4efb\u52a1',
  copy: '\u590d\u5236 Markdown',
  copyFailed: '\u590d\u5236\u5931\u8d25',
  save: '\u4fdd\u5b58 .md',
  saveHtml: '\u4fdd\u5b58 .html',
  savePdf: '\u4fdd\u5b58 PDF',
  saveFailed: '\u4fdd\u5b58\u5931\u8d25',
  canceled: '\u5df2\u53d6\u6d88',
  exportFailed: '\u5bfc\u51fa\u5931\u8d25',
}

function makeReport(patch: Partial<PipelineReportExport> = {}): PipelineReportExport {
  return {
    sessionId: 'session-report-ui',
    title: 'Pipeline Report',
    markdown: [
      '# Pipeline Report',
      '',
      TEXT.taskHeading,
      '',
      '- Task: export contribution report',
      '',
      '## Commit / PR',
      '',
      '- Local commit: not created',
    ].join('\n'),
    html: '<!doctype html><html><body><main><h1>Pipeline Report</h1></main></body></html>',
    fileName: 'pipeline-report-session-report-ui.md',
    htmlFileName: 'pipeline-report-session-report-ui.html',
    pdfFileName: 'pipeline-report-session-report-ui.pdf',
    generatedAt: 1,
    ...patch,
  }
}

describe('PipelineReportExportPanel', () => {
  test('empty state disables copy and save', () => {
    const viewModel = buildPipelineReportExportPanelViewModel({
      report: null,
      loading: false,
      error: null,
      copyStatus: 'idle',
      saveStatus: 'idle',
      htmlSaveStatus: 'idle',
      pdfSaveStatus: 'idle',
    })

    expect(viewModel.title).toBe(TEXT.report)
    expect(viewModel.statusLabel).toBe(TEXT.notGenerated)
    expect(viewModel.preview).toContain(TEXT.clickGenerate)
    expect(viewModel.copyDisabled).toBe(true)
    expect(viewModel.saveDisabled).toBe(true)
    expect(viewModel.saveHtmlDisabled).toBe(true)
    expect(viewModel.savePdfDisabled).toBe(true)
  })

  test('generated report exposes filenames and format actions', () => {
    const viewModel = buildPipelineReportExportPanelViewModel({
      report: makeReport(),
      loading: false,
      error: null,
      copyStatus: 'idle',
      saveStatus: 'idle',
      htmlSaveStatus: 'idle',
      pdfSaveStatus: 'idle',
    })

    expect(viewModel.statusLabel).toBe(TEXT.generated)
    expect(viewModel.fileName).toBe('pipeline-report-session-report-ui.md')
    expect(viewModel.htmlFileName).toBe('pipeline-report-session-report-ui.html')
    expect(viewModel.pdfFileName).toBe('pipeline-report-session-report-ui.pdf')
    expect(viewModel.preview).toContain(TEXT.taskHeading)
    expect(viewModel.copyDisabled).toBe(false)
    expect(viewModel.saveDisabled).toBe(false)
    expect(viewModel.saveHtmlDisabled).toBe(false)
    expect(viewModel.savePdfDisabled).toBe(false)
    expect(viewModel.copyLabel).toBe(TEXT.copy)
    expect(viewModel.saveLabel).toBe(TEXT.save)
    expect(viewModel.saveHtmlLabel).toBe(TEXT.saveHtml)
    expect(viewModel.savePdfLabel).toBe(TEXT.savePdf)
  })

  test('loading and error states expose stable button labels', () => {
    const loading = buildPipelineReportExportPanelViewModel({
      report: makeReport(),
      loading: true,
      error: null,
      copyStatus: 'idle',
      saveStatus: 'idle',
      htmlSaveStatus: 'idle',
      pdfSaveStatus: 'idle',
    })
    expect(loading.statusLabel).toBe(TEXT.generating)
    expect(loading.generateDisabled).toBe(true)
    expect(loading.copyDisabled).toBe(true)

    const failed = buildPipelineReportExportPanelViewModel({
      report: null,
      loading: false,
      error: TEXT.exportFailed,
      copyStatus: 'failed',
      saveStatus: 'failed',
      htmlSaveStatus: 'failed',
      pdfSaveStatus: 'canceled',
    })
    expect(failed.statusLabel).toBe(TEXT.failed)
    expect(failed.error).toBe(TEXT.exportFailed)
    expect(failed.copyLabel).toBe(TEXT.copyFailed)
    expect(failed.saveLabel).toBe(TEXT.saveFailed)
    expect(failed.saveHtmlLabel).toBe(TEXT.saveFailed)
    expect(failed.savePdfLabel).toBe(TEXT.canceled)
  })
})

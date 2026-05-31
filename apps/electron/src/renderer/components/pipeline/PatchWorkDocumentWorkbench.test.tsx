import { describe, expect, test } from 'bun:test'
import type {
  PatchWorkDocumentRevision,
  PipelinePatchWorkDocumentRef,
} from '@codeinsights/shared'
import {
  buildPatchWorkDiffLines,
  buildPatchWorkDocumentWorkbenchViewModel,
  formatPatchWorkJsonContent,
  inferPatchWorkDocumentRenderKind,
} from './PatchWorkDocumentWorkbench'

function makeDocument(
  patch: Partial<PipelinePatchWorkDocumentRef> & { displayName: string; relativePath: string },
): PipelinePatchWorkDocumentRef {
  return {
    displayName: patch.displayName,
    relativePath: patch.relativePath,
    checksum: patch.checksum ?? 'a'.repeat(64),
    revision: patch.revision ?? 1,
  }
}

function makeRevision(patch: Partial<PatchWorkDocumentRevision> & {
  relativePath: string
  revision: number
  content: string
}): PatchWorkDocumentRevision {
  return {
    displayName: patch.displayName ?? patch.relativePath,
    relativePath: patch.relativePath,
    revision: patch.revision,
    checksum: patch.checksum ?? 'b'.repeat(64),
    actualChecksum: patch.actualChecksum ?? patch.checksum ?? 'b'.repeat(64),
    content: patch.content,
    createdByNode: patch.createdByNode ?? 'developer',
    updatedAt: patch.updatedAt ?? 1_000,
    accepted: patch.accepted ?? false,
    current: patch.current ?? false,
    checksumMatches: patch.checksumMatches ?? true,
  }
}

describe('PatchWorkDocumentWorkbench', () => {
  test('按文件扩展名推断 markdown / diff / json / text 渲染分支', () => {
    expect(inferPatchWorkDocumentRenderKind('plan.md')).toBe('markdown')
    expect(inferPatchWorkDocumentRenderKind('patch-set/changes.patch')).toBe('diff')
    expect(inferPatchWorkDocumentRenderKind('patch-set/changed-files.json')).toBe('json')
    expect(inferPatchWorkDocumentRenderKind('notes.txt')).toBe('text')
  })

  test('格式化合法 JSON，非法 JSON 返回原文和解析错误', () => {
    const formatted = formatPatchWorkJsonContent('{"ok":true,"items":[1,2]}')
    expect(formatted.error).toBeUndefined()
    expect(formatted.content).toContain('"ok": true')
    expect(formatted.content).toContain('"items"')

    const invalid = formatPatchWorkJsonContent('{"ok":')
    expect(invalid.error).toContain('JSON 解析失败')
    expect(invalid.content).toBe('{"ok":')
  })

  test('diff view model 标记文件头、hunk、增加行和删除行', () => {
    const lines = buildPatchWorkDiffLines([
      'diff --git a/src/a.ts b/src/a.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      ' context',
    ].join('\n'))

    expect(lines.map((line) => line.kind)).toEqual([
      'file',
      'hunk',
      'delete',
      'add',
      'context',
    ])
  })

  test('构建 revision selector、current / accepted badge 和 compare view model', () => {
    const documents = [
      makeDocument({
        displayName: '开发文档.md',
        relativePath: 'dev.md',
        revision: 2,
      }),
    ]
    const accepted = makeRevision({
      relativePath: 'dev.md',
      revision: 1,
      content: '# 开发文档\n\n第一版',
      accepted: true,
      current: false,
      checksumMatches: true,
    })
    const current = makeRevision({
      relativePath: 'dev.md',
      revision: 2,
      content: '# 开发文档\n\n第二版',
      accepted: false,
      current: true,
      checksum: 'c'.repeat(64),
      actualChecksum: 'd'.repeat(64),
      checksumMatches: false,
    })

    const viewModel = buildPatchWorkDocumentWorkbenchViewModel({
      documents,
      revisionsByPath: new Map([['dev.md', [accepted, current]]]),
      revisionLoadingPaths: new Set(),
      revisionReadErrors: new Map(),
      selectedRelativePath: 'dev.md',
      selectedRevision: 2,
      compareWithAccepted: true,
    })

    expect(viewModel.selected?.relativePath).toBe('dev.md')
    expect(viewModel.selected?.renderKind).toBe('markdown')
    expect(viewModel.selected?.revisionOptions).toEqual([
      expect.objectContaining({ revision: 1, label: '第 1 版', accepted: true, current: false }),
      expect.objectContaining({ revision: 2, label: '第 2 版', accepted: false, current: true }),
    ])
    expect(viewModel.selected?.badges).toContain('current')
    expect(viewModel.selected?.badges).toContain('checksum mismatch')
    expect(viewModel.selected?.compare).toMatchObject({
      acceptedRevision: 1,
      currentRevision: 2,
      acceptedContent: '# 开发文档\n\n第一版',
      currentContent: '# 开发文档\n\n第二版',
    })
  })

  test('revision 读取失败时给出明确错误并阻止误展示内容', () => {
    const viewModel = buildPatchWorkDocumentWorkbenchViewModel({
      documents: [
        makeDocument({
          displayName: 'PR 草稿.md',
          relativePath: 'pr.md',
        }),
      ],
      revisionsByPath: new Map(),
      revisionLoadingPaths: new Set(),
      revisionReadErrors: new Map([['pr.md', 'patch-work 文件不存在: pr.md']]),
      selectedRelativePath: 'pr.md',
      selectedRevision: undefined,
      compareWithAccepted: false,
    })

    expect(viewModel.selected?.readError).toBe('patch-work 文件不存在: pr.md')
    expect(viewModel.selected?.content).toBe('')
    expect(viewModel.selected?.badges).toContain('read error')
  })
})

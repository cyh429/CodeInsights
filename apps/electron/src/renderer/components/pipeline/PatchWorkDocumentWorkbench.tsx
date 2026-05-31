import * as React from 'react'
import { ExternalLink, FileText, FolderOpen } from 'lucide-react'
import type {
  PatchWorkDocumentRevision,
  PipelinePatchWorkDocumentRef,
} from '@codeinsights/shared'
import { MessageResponse } from '../ai-elements/message'

export type PatchWorkDocumentRenderKind = 'markdown' | 'diff' | 'json' | 'text'
export type PatchWorkDiffLineKind = 'file' | 'hunk' | 'add' | 'delete' | 'context'
export type PatchWorkWorkbenchBadge = 'current' | 'accepted' | 'checksum mismatch' | 'read error'

export interface PatchWorkDiffLine {
  kind: PatchWorkDiffLineKind
  text: string
}

export interface PatchWorkJsonViewModel {
  content: string
  error?: string
}

export interface PatchWorkRevisionOptionViewModel {
  revision: number
  label: string
  current: boolean
  accepted: boolean
  checksumMismatch: boolean
}

export interface PatchWorkWorkbenchFileViewModel {
  displayName: string
  relativePath: string
  selected: boolean
}

export interface PatchWorkWorkbenchCompareViewModel {
  acceptedRevision: number
  currentRevision: number
  acceptedContent: string
  currentContent: string
}

export interface PatchWorkWorkbenchSelectedViewModel {
  displayName: string
  relativePath: string
  renderKind: PatchWorkDocumentRenderKind
  content: string
  activeRevision?: number
  checksumLabel?: string
  actualChecksumLabel?: string
  readError?: string
  loading: boolean
  badges: PatchWorkWorkbenchBadge[]
  revisionOptions: PatchWorkRevisionOptionViewModel[]
  compare?: PatchWorkWorkbenchCompareViewModel
}

export interface PatchWorkDocumentWorkbenchViewModel {
  empty: boolean
  files: PatchWorkWorkbenchFileViewModel[]
  selected?: PatchWorkWorkbenchSelectedViewModel
}

export function inferPatchWorkDocumentRenderKind(relativePath: string): PatchWorkDocumentRenderKind {
  const normalized = relativePath.toLowerCase()
  if (normalized.endsWith('.md') || normalized.endsWith('.markdown')) return 'markdown'
  if (normalized.endsWith('.patch') || normalized.endsWith('.diff')) return 'diff'
  if (normalized.endsWith('.json')) return 'json'
  return 'text'
}

export function formatPatchWorkJsonContent(content: string): PatchWorkJsonViewModel {
  try {
    return {
      content: JSON.stringify(JSON.parse(content), null, 2),
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知错误'
    return {
      content,
      error: `JSON 解析失败：${detail}`,
    }
  }
}

export function buildPatchWorkDiffLines(content: string): PatchWorkDiffLine[] {
  return content.split('\n').map((line) => {
    if (
      line.startsWith('diff --git')
      || line.startsWith('index ')
      || line.startsWith('--- ')
      || line.startsWith('+++ ')
    ) {
      return { kind: 'file', text: line }
    }
    if (line.startsWith('@@')) return { kind: 'hunk', text: line }
    if (line.startsWith('+')) return { kind: 'add', text: line }
    if (line.startsWith('-')) return { kind: 'delete', text: line }
    return { kind: 'context', text: line }
  })
}

function checksumLabel(checksum?: string): string | undefined {
  return checksum ? `sha256:${checksum.slice(0, 8)}` : undefined
}

function sortRevisions(revisions: PatchWorkDocumentRevision[]): PatchWorkDocumentRevision[] {
  return [...revisions].sort((left, right) => left.revision - right.revision)
}

function pickSelectedDocument(
  documents: PipelinePatchWorkDocumentRef[],
  selectedRelativePath?: string,
): PipelinePatchWorkDocumentRef | undefined {
  if (selectedRelativePath) {
    const selected = documents.find((document) => document.relativePath === selectedRelativePath)
    if (selected) return selected
  }
  return documents[0]
}

function pickActiveRevision(
  revisions: PatchWorkDocumentRevision[],
  selectedRevision?: number,
): PatchWorkDocumentRevision | undefined {
  if (selectedRevision != null) {
    const selected = revisions.find((revision) => revision.revision === selectedRevision)
    if (selected) return selected
  }
  return revisions.find((revision) => revision.current) ?? revisions[revisions.length - 1]
}

export function buildPatchWorkDocumentWorkbenchViewModel({
  documents,
  revisionsByPath,
  revisionLoadingPaths,
  revisionReadErrors,
  selectedRelativePath,
  selectedRevision,
  compareWithAccepted,
}: {
  documents: PipelinePatchWorkDocumentRef[]
  revisionsByPath: Map<string, PatchWorkDocumentRevision[]>
  revisionLoadingPaths: Set<string>
  revisionReadErrors: Map<string, string>
  selectedRelativePath?: string
  selectedRevision?: number
  compareWithAccepted: boolean
}): PatchWorkDocumentWorkbenchViewModel {
  const selectedDocument = pickSelectedDocument(documents, selectedRelativePath)
  const selectedPath = selectedDocument?.relativePath

  const files = documents.map((document) => ({
    displayName: document.displayName,
    relativePath: document.relativePath,
    selected: document.relativePath === selectedPath,
  }))

  if (!selectedDocument) {
    return {
      empty: true,
      files,
    }
  }

  const revisions = sortRevisions(revisionsByPath.get(selectedDocument.relativePath) ?? [])
  const activeRevision = pickActiveRevision(revisions, selectedRevision)
  const acceptedRevision = revisions.find((revision) => revision.accepted)
  const currentRevision = revisions.find((revision) => revision.current)
  const readError = revisionReadErrors.get(selectedDocument.relativePath)
  const loading = revisionLoadingPaths.has(selectedDocument.relativePath)
  const badges: PatchWorkWorkbenchBadge[] = []

  if (activeRevision?.current) badges.push('current')
  if (activeRevision?.accepted) badges.push('accepted')
  if (activeRevision && !activeRevision.checksumMatches) badges.push('checksum mismatch')
  if (readError) badges.push('read error')

  return {
    empty: false,
    files,
    selected: {
      displayName: selectedDocument.displayName,
      relativePath: selectedDocument.relativePath,
      renderKind: inferPatchWorkDocumentRenderKind(selectedDocument.relativePath),
      content: activeRevision?.content ?? '',
      activeRevision: activeRevision?.revision,
      checksumLabel: checksumLabel(activeRevision?.checksum),
      actualChecksumLabel: checksumLabel(activeRevision?.actualChecksum),
      readError,
      loading,
      badges,
      revisionOptions: revisions.map((revision) => ({
        revision: revision.revision,
        label: `第 ${revision.revision} 版`,
        current: revision.current,
        accepted: revision.accepted,
        checksumMismatch: !revision.checksumMatches,
      })),
      compare: compareWithAccepted && acceptedRevision && currentRevision && acceptedRevision.revision !== currentRevision.revision
        ? {
            acceptedRevision: acceptedRevision.revision,
            currentRevision: currentRevision.revision,
            acceptedContent: acceptedRevision.content,
            currentContent: currentRevision.content,
          }
        : undefined,
    },
  }
}

function diffLineClass(kind: PatchWorkDiffLineKind): string {
  if (kind === 'file') return 'bg-surface-muted text-text-primary'
  if (kind === 'hunk') return 'bg-status-running-bg text-status-running-fg'
  if (kind === 'add') return 'bg-status-success-bg text-status-success-fg'
  if (kind === 'delete') return 'bg-status-danger-bg text-status-danger-fg'
  return 'text-text-secondary'
}

function badgeClass(badge: PatchWorkWorkbenchBadge): string {
  if (badge === 'accepted') return 'border-status-success-border bg-status-success-bg text-status-success-fg'
  if (badge === 'current') return 'border-status-running-border bg-status-running-bg text-status-running-fg'
  if (badge === 'checksum mismatch') return 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
  return 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg'
}

function badgeLabel(badge: PatchWorkWorkbenchBadge): string {
  if (badge === 'current') return '当前'
  if (badge === 'accepted') return '已接受'
  if (badge === 'checksum mismatch') return 'checksum mismatch'
  return '读取失败'
}

function renderDocumentContent(renderKind: PatchWorkDocumentRenderKind, content: string): React.ReactElement {
  if (renderKind === 'markdown') {
    return (
      <MessageResponse className="text-sm">
        {content || '文档内容暂不可用。'}
      </MessageResponse>
    )
  }
  if (renderKind === 'diff') {
    const lines = buildPatchWorkDiffLines(content)
    return (
      <pre className="max-h-96 overflow-auto rounded-card bg-background font-mono text-[11px] leading-5">
        {lines.map((line, index) => (
          <div
            // diff 内容可能重复，用行号稳定定位即可
            key={`${index}-${line.kind}`}
            className={`px-3 ${diffLineClass(line.kind)}`}
          >
            {line.text || ' '}
          </div>
        ))}
      </pre>
    )
  }
  if (renderKind === 'json') {
    const formatted = formatPatchWorkJsonContent(content)
    return (
      <div>
        {formatted.error ? (
          <div className="mb-2 rounded-card border border-status-waiting-border bg-status-waiting-bg px-3 py-2 text-xs text-status-waiting-fg">
            {formatted.error}
          </div>
        ) : null}
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-card bg-surface-muted/70 px-3 py-3 font-mono text-xs leading-5 text-text-primary">
          {formatted.content || 'JSON 内容暂不可用。'}
        </pre>
      </div>
    )
  }
  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-card bg-surface-muted/70 px-3 py-3 font-mono text-xs leading-5 text-text-primary">
      {content || '文档内容暂不可用。'}
    </pre>
  )
}

function renderComparePane(title: string, renderKind: PatchWorkDocumentRenderKind, content: string): React.ReactElement {
  return (
    <div className="min-w-0 rounded-card bg-background px-3 py-3 shadow-sm">
      <div className="mb-2 text-xs font-semibold text-text-secondary">{title}</div>
      {renderDocumentContent(renderKind, content)}
    </div>
  )
}

export function PatchWorkDocumentWorkbench({
  sessionId,
  documents,
  contents: _contents,
  loadingPaths: _loadingPaths,
  readErrors: _readErrors,
  onOpenPatchWorkDir,
}: {
  sessionId: string
  documents: PipelinePatchWorkDocumentRef[]
  contents: Map<string, string>
  loadingPaths: Set<string>
  readErrors: Map<string, string>
  onOpenPatchWorkDir?: () => Promise<void>
}): React.ReactElement {
  const [selectedRelativePath, setSelectedRelativePath] = React.useState<string | undefined>(documents[0]?.relativePath)
  const [selectedRevision, setSelectedRevision] = React.useState<number | undefined>()
  const [compareWithAccepted, setCompareWithAccepted] = React.useState(false)
  const [revisionsByPath, setRevisionsByPath] = React.useState<Map<string, PatchWorkDocumentRevision[]>>(new Map())
  const [revisionLoadingPaths, setRevisionLoadingPaths] = React.useState<Set<string>>(new Set())
  const [revisionReadErrors, setRevisionReadErrors] = React.useState<Map<string, string>>(new Map())
  const [openError, setOpenError] = React.useState<string | null>(null)
  const documentKey = React.useMemo(
    () => documents.map((document) => `${document.relativePath}:${document.checksum ?? ''}:${document.revision ?? ''}`).join('|'),
    [documents],
  )

  React.useEffect(() => {
    const paths = new Set(documents.map((document) => document.relativePath))
    if (!selectedRelativePath || !paths.has(selectedRelativePath)) {
      setSelectedRelativePath(documents[0]?.relativePath)
      setSelectedRevision(undefined)
    }
  }, [documents, selectedRelativePath])

  React.useEffect(() => {
    if (documents.length === 0) {
      setRevisionsByPath(new Map())
      setRevisionLoadingPaths(new Set())
      setRevisionReadErrors(new Map())
      return
    }

    let cancelled = false
    const paths = documents.map((document) => document.relativePath)
    setRevisionLoadingPaths(new Set(paths))
    setRevisionReadErrors(new Map())
    setRevisionsByPath((prev) => new Map([...prev.entries()].filter(([path]) => paths.includes(path))))

    for (const document of documents) {
      window.electronAPI.listPipelinePatchWorkRevisions({
        sessionId,
        relativePath: document.relativePath,
      })
        .then((revisions) => {
          if (cancelled) return
          setRevisionsByPath((prev) => {
            const next = new Map(prev)
            next.set(document.relativePath, revisions)
            return next
          })
        })
        .catch((error) => {
          console.error('[PatchWorkDocumentWorkbench] 读取 patch-work revisions 失败:', error)
          if (cancelled) return
          const message = error instanceof Error ? error.message : '读取失败'
          setRevisionReadErrors((prev) => {
            const next = new Map(prev)
            next.set(document.relativePath, message)
            return next
          })
        })
        .finally(() => {
          if (cancelled) return
          setRevisionLoadingPaths((prev) => {
            const next = new Set(prev)
            next.delete(document.relativePath)
            return next
          })
        })
    }

    return () => {
      cancelled = true
    }
  }, [documentKey, documents, sessionId])

  const viewModel = React.useMemo(() => buildPatchWorkDocumentWorkbenchViewModel({
    documents,
    revisionsByPath,
    revisionLoadingPaths,
    revisionReadErrors,
    selectedRelativePath,
    selectedRevision,
    compareWithAccepted,
  }), [
    compareWithAccepted,
    documents,
    revisionLoadingPaths,
    revisionReadErrors,
    revisionsByPath,
    selectedRelativePath,
    selectedRevision,
  ])

  const selected = viewModel.selected
  const handleOpenFile = async (): Promise<void> => {
    if (!selected) return
    setOpenError(null)
    try {
      await window.electronAPI.openPipelinePatchWorkFile({
        sessionId,
        relativePath: selected.relativePath,
      })
    } catch (error) {
      console.error('[PatchWorkDocumentWorkbench] 打开 patch-work 文件失败:', error)
      setOpenError(error instanceof Error ? error.message : '打开 patch-work 文件失败，请稍后重试。')
    }
  }

  const handleOpenDir = async (): Promise<void> => {
    if (!onOpenPatchWorkDir) return
    setOpenError(null)
    try {
      await onOpenPatchWorkDir()
    } catch (error) {
      console.error('[PatchWorkDocumentWorkbench] 打开 patch-work 目录失败:', error)
      setOpenError(error instanceof Error ? error.message : '打开 patch-work 目录失败，请稍后重试。')
    }
  }

  if (viewModel.empty) {
    return (
      <div className="rounded-card bg-background/80 px-3 py-3 text-sm text-text-secondary">
        暂无 patch-work 文档。
      </div>
    )
  }

  return (
    <section className="rounded-card bg-background/80 px-3 py-3 text-text-primary shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <FileText size={15} aria-hidden="true" />
            <span>Patch-work Workbench</span>
          </div>
          {selected ? (
            <div className="mt-1 truncate font-mono text-[11px] text-text-tertiary">
              {selected.relativePath}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleOpenDir()}
            className="inline-flex items-center justify-center gap-1.5 rounded-control bg-background px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-sm transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <FolderOpen size={14} aria-hidden="true" />
            打开目录
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => void handleOpenFile()}
            className="inline-flex items-center justify-center gap-1.5 rounded-control bg-background px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ExternalLink size={14} aria-hidden="true" />
            打开文件
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(120px,0.8fr)_minmax(0,2fr)]">
        <div className="space-y-1">
          {viewModel.files.map((file) => (
            <button
              key={file.relativePath}
              type="button"
              onClick={() => {
                setSelectedRelativePath(file.relativePath)
                setSelectedRevision(undefined)
                setCompareWithAccepted(false)
              }}
              className={`w-full rounded-control px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                file.selected
                  ? 'bg-status-running-bg font-semibold text-status-running-fg'
                  : 'bg-background text-text-secondary hover:bg-surface-muted hover:text-text-primary'
              }`}
            >
              <div className="truncate">{file.displayName}</div>
              <div className="mt-0.5 truncate font-mono text-[10px] opacity-70">{file.relativePath}</div>
            </button>
          ))}
        </div>

        <div className="min-w-0">
          {selected ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{selected.displayName}</span>
                  {selected.badges.map((badge) => (
                    <span
                      key={badge}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass(badge)}`}
                    >
                      {badgeLabel(badge)}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <select
                    value={selected.activeRevision ?? ''}
                    onChange={(event) => setSelectedRevision(Number(event.target.value))}
                    className="rounded-control border border-border-subtle bg-background px-2 py-1 text-xs text-text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    {selected.revisionOptions.length > 0 ? selected.revisionOptions.map((option) => (
                      <option key={option.revision} value={option.revision}>
                        {option.label}
                        {option.current ? ' · 当前' : ''}
                        {option.accepted ? ' · 已接受' : ''}
                      </option>
                    )) : (
                      <option value="">无 revision</option>
                    )}
                  </select>
                  <label className="inline-flex items-center gap-1 rounded-control bg-background px-2 py-1 shadow-sm">
                    <input
                      type="checkbox"
                      checked={compareWithAccepted}
                      onChange={(event) => setCompareWithAccepted(event.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    <span>对比 accepted</span>
                  </label>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-tertiary">
                {selected.checksumLabel ? <span>{selected.checksumLabel}</span> : null}
                {selected.actualChecksumLabel && selected.actualChecksumLabel !== selected.checksumLabel
                  ? <span>当前 {selected.actualChecksumLabel}</span>
                  : null}
              </div>

              {openError ? <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">{openError}</div> : null}
              {selected.readError ? (
                <div className="mt-2 rounded-card border border-status-waiting-border bg-status-waiting-bg px-3 py-2 text-xs text-status-waiting-fg">
                  读取失败：{selected.readError}
                </div>
              ) : null}
              {selected.loading ? (
                <div className="mt-3 rounded-card bg-surface-muted/70 px-3 py-3 text-sm text-text-secondary">
                  正在读取 revision...
                </div>
              ) : selected.compare ? (
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {renderComparePane(`已接受 · 第 ${selected.compare.acceptedRevision} 版`, selected.renderKind, selected.compare.acceptedContent)}
                  {renderComparePane(`当前 · 第 ${selected.compare.currentRevision} 版`, selected.renderKind, selected.compare.currentContent)}
                </div>
              ) : (
                <div className="mt-3">
                  {renderDocumentContent(selected.renderKind, selected.content)}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}

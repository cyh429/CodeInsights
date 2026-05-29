import * as React from 'react'
import type { PipelinePatchWorkDocumentRef } from '@codeinsights/shared'

export interface UsePipelinePatchWorkDocumentsInput {
  sessionId: string
  enabled: boolean
  documents: PipelinePatchWorkDocumentRef[]
}

export interface UsePipelinePatchWorkDocumentsResult {
  documentContents: Map<string, string>
  documentLoadingPaths: Set<string>
  documentReadErrors: Map<string, string>
}

function documentSignature(document: PipelinePatchWorkDocumentRef): string {
  return `${document.relativePath}:${document.checksum ?? ''}:${document.revision ?? ''}`
}

export function usePipelinePatchWorkDocuments({
  sessionId,
  enabled,
  documents,
}: UsePipelinePatchWorkDocumentsInput): UsePipelinePatchWorkDocumentsResult {
  const [documentContents, setDocumentContents] = React.useState<Map<string, string>>(new Map())
  const [documentLoadingPaths, setDocumentLoadingPaths] = React.useState<Set<string>>(new Set())
  const [documentReadErrors, setDocumentReadErrors] = React.useState<Map<string, string>>(new Map())
  const documentSignaturesRef = React.useRef<Map<string, string>>(new Map())
  const lastSessionIdRef = React.useRef(sessionId)
  const documentKey = React.useMemo(
    () => documents.map((document) => documentSignature(document)).join('|'),
    [documents],
  )
  const documentsForEffect = React.useMemo(() => documents, [documentKey])

  React.useEffect(() => {
    if (!enabled || documentsForEffect.length === 0) {
      lastSessionIdRef.current = sessionId
      documentSignaturesRef.current = new Map()
      setDocumentContents(new Map())
      setDocumentLoadingPaths(new Set())
      setDocumentReadErrors(new Map())
      return
    }

    let cancelled = false
    const sessionChanged = lastSessionIdRef.current !== sessionId
    lastSessionIdRef.current = sessionId
    if (sessionChanged) {
      documentSignaturesRef.current = new Map()
      setDocumentContents(new Map())
      setDocumentLoadingPaths(new Set())
      setDocumentReadErrors(new Map())
    }

    const documentsByPath = new Map<string, PipelinePatchWorkDocumentRef>()
    for (const document of documentsForEffect) {
      if (!documentsByPath.has(document.relativePath)) {
        documentsByPath.set(document.relativePath, document)
      }
    }
    const requiredPaths = new Set(documentsByPath.keys())

    setDocumentContents((prev) => new Map(
      [...prev.entries()].filter(([path]) => requiredPaths.has(path)),
    ))
    setDocumentLoadingPaths((prev) => new Set(
      [...prev.values()].filter((path) => requiredPaths.has(path)),
    ))
    setDocumentReadErrors((prev) => new Map(
      [...prev.entries()].filter(([path]) => requiredPaths.has(path)),
    ))
    documentSignaturesRef.current = new Map(
      [...documentSignaturesRef.current.entries()].filter(([path]) => requiredPaths.has(path)),
    )

    const documentsToLoad = [...documentsByPath.values()].filter((document) =>
      documentSignaturesRef.current.get(document.relativePath) !== documentSignature(document))

    if (documentsToLoad.length === 0) {
      return () => {
        cancelled = true
      }
    }

    setDocumentLoadingPaths((prev) => {
      const next = new Set(prev)
      for (const document of documentsToLoad) {
        next.add(document.relativePath)
      }
      return next
    })
    setDocumentReadErrors((prev) => {
      const next = new Map(prev)
      for (const document of documentsToLoad) {
        next.delete(document.relativePath)
      }
      return next
    })

    for (const document of documentsToLoad) {
      const signature = documentSignature(document)
      window.electronAPI.readPipelinePatchWorkFile({
        sessionId,
        relativePath: document.relativePath,
      })
        .then((content) => {
          if (cancelled) return
          documentSignaturesRef.current.set(document.relativePath, signature)
          setDocumentContents((prev) => {
            const next = new Map(prev)
            next.set(document.relativePath, content)
            return next
          })
        })
        .catch((error) => {
          console.error('[PipelinePatchWorkDocuments] 读取 patch-work 文档失败:', error)
          if (cancelled) return
          const message = error instanceof Error ? error.message : '读取失败'
          setDocumentReadErrors((prev) => {
            const next = new Map(prev)
            next.set(document.relativePath, message)
            return next
          })
        })
        .finally(() => {
          if (cancelled) return
          setDocumentLoadingPaths((prev) => {
            const next = new Set(prev)
            next.delete(document.relativePath)
            return next
          })
        })
    }

    return () => {
      cancelled = true
    }
  }, [documentKey, documentsForEffect, enabled, sessionId])

  return {
    documentContents,
    documentLoadingPaths,
    documentReadErrors,
  }
}

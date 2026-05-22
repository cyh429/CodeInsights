import type {
  PipelineNodeOutputRecord,
  PipelineRecord,
  PipelineReviewResultRecord,
  PipelineStageArtifactRecord,
  PipelineStreamEvent,
} from '@codeinsights/shared'

function buildNodeOutputRecord(
  sessionId: string,
  event: Extract<PipelineStreamEvent, { type: 'node_complete' }>,
): PipelineNodeOutputRecord {
  return {
    id: `${sessionId}-${event.node}-${event.createdAt}-output`,
    sessionId,
    type: 'node_output',
    node: event.node,
    content: event.output,
    summary: event.summary,
    createdAt: event.createdAt,
  }
}

function buildReviewResultRecord(
  sessionId: string,
  event: Extract<PipelineStreamEvent, { type: 'node_complete' }>,
): PipelineReviewResultRecord | null {
  if (event.node !== 'reviewer') return null
  if (typeof event.approved !== 'boolean') return null

  return {
    id: `${sessionId}-${event.node}-${event.createdAt}-review`,
    sessionId,
    type: 'review_result',
    node: 'reviewer',
    approved: event.approved,
    summary: event.summary ?? event.output,
    issues: event.issues,
    createdAt: event.createdAt,
  }
}

function buildStageArtifactRecord(
  sessionId: string,
  event: Extract<PipelineStreamEvent, { type: 'node_complete' }>,
): PipelineStageArtifactRecord | null {
  if (!event.artifact) return null

  return {
    id: `${sessionId}-${event.node}-${event.createdAt}-artifact`,
    sessionId,
    type: 'stage_artifact',
    node: event.node,
    artifact: event.artifact,
    createdAt: event.createdAt,
  }
}

export function buildPipelineRecordsFromNodeComplete(
  sessionId: string,
  event: Extract<PipelineStreamEvent, { type: 'node_complete' }>,
): PipelineRecord[] {
  const records: PipelineRecord[] = [
    buildNodeOutputRecord(sessionId, event),
  ]

  const artifactRecord = buildStageArtifactRecord(sessionId, event)
  if (artifactRecord) {
    records.push(artifactRecord)
  }

  if (event.node === 'reviewer') {
    const reviewRecord = buildReviewResultRecord(sessionId, event)
    if (reviewRecord) {
      records.push(reviewRecord)
    }
  }

  return records
}

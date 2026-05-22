/**
 * Shared utility functions for codeinsights
 */

// Placeholder - will be expanded as needed
export function noop(): void {
  // no-op
}

export { diffCapabilities } from './capabilities-diff'
export type { CapabilityChange } from './capabilities-diff'
export {
  applyPipelineRecord,
  buildPipelineSessionStatePatch,
  createInitialPipelineState,
  createPipelineStateFromSessionMeta,
  isPipelineTerminalStatus,
  replayPipelineRecords,
  serializePipelineState,
} from './pipeline-state'
export type { PipelineSessionStatePatch } from './pipeline-state'

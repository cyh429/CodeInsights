import type {
  PipelineNodeKind,
  PipelineVersion,
  PipelineStreamEvent,
} from '@codeinsights/shared'
import {
  CodexCliPipelineNodeRunner,
  CodexSdkPipelineNodeRunner,
  type CodexPipelineBackend,
} from './codex-pipeline-node-runner'
import {
  ClaudePipelineNodeRunner,
  type PipelineNodeExecutionContext,
  type PipelineNodeExecutionResult,
  type PipelineNodeRunner,
} from './pipeline-node-runner'

export type PipelineNodeRuntimeStrategy = 'claude' | 'codex'

const V1_RUNTIME_STRATEGY: Record<PipelineNodeKind, PipelineNodeRuntimeStrategy> = {
  explorer: 'claude',
  planner: 'claude',
  developer: 'codex',
  reviewer: 'codex',
  tester: 'claude',
  committer: 'codex',
}

const V2_RUNTIME_STRATEGY: Record<PipelineNodeKind, PipelineNodeRuntimeStrategy> = {
  explorer: 'claude',
  planner: 'claude',
  developer: 'codex',
  reviewer: 'codex',
  tester: 'codex',
  committer: 'codex',
}

export function getPipelineNodeRuntimeStrategy(
  node: PipelineNodeKind,
  version: PipelineVersion = 1,
): PipelineNodeRuntimeStrategy {
  return version === 2
    ? V2_RUNTIME_STRATEGY[node]
    : V1_RUNTIME_STRATEGY[node]
}

export interface RoutedPipelineNodeRunnerOptions {
  version?: PipelineVersion
  channelId?: string
  claudeChannelId?: string
  codexChannelId?: string
  workspaceId?: string
  onEvent?: (event: PipelineStreamEvent) => void
  codexBackend?: CodexPipelineBackend
  claudeRunner?: PipelineNodeRunner
  codexRunner?: PipelineNodeRunner
}

export class RoutedPipelineNodeRunner implements PipelineNodeRunner {
  private readonly claudeRunner: PipelineNodeRunner
  private readonly codexRunner: PipelineNodeRunner
  private readonly version: PipelineVersion

  constructor(options: RoutedPipelineNodeRunnerOptions) {
    this.version = options.version ?? 1
    const claudeChannelId = options.claudeChannelId ?? options.channelId
    this.claudeRunner = options.claudeRunner ?? new ClaudePipelineNodeRunner({
      channelId: claudeChannelId,
      workspaceId: options.workspaceId,
      onEvent: options.onEvent,
    })
    this.codexRunner = options.codexRunner ?? (
      options.codexBackend === 'cli'
        ? new CodexCliPipelineNodeRunner({
          channelId: options.codexChannelId,
          workspaceId: options.workspaceId,
          onEvent: options.onEvent,
        })
        : new CodexSdkPipelineNodeRunner({
          channelId: options.codexChannelId,
          workspaceId: options.workspaceId,
          onEvent: options.onEvent,
        })
    )
  }

  abort(sessionId: string): void {
    this.claudeRunner.abort?.(sessionId)
    this.codexRunner.abort?.(sessionId)
  }

  runNode(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult> {
    if (getPipelineNodeRuntimeStrategy(node, this.version) === 'codex') {
      return this.codexRunner.runNode(node, context)
    }

    return this.claudeRunner.runNode(node, context)
  }
}

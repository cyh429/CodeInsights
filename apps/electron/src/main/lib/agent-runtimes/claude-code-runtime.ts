import type {
  AgentProviderAdapter,
  AgentQueueMessageInput,
  CodeInsightsPermissionMode,
} from '@codeinsights/shared'
import type {
  CodingAgentRuntime,
  CodingAgentRuntimeCapabilities,
  CodingAgentRuntimeRunInput,
  UnsupportedRuntimeCapabilityResult,
} from './coding-agent-runtime-types'

const CLAUDE_CODE_RUNTIME_CAPABILITIES: CodingAgentRuntimeCapabilities = {
  runtimeKind: 'claude-code',
  supportsStreamEvents: true,
  supportsResumeThread: true,
  supportsAbort: true,
  supportsQueueMessage: true,
  supportsSetPermissionMode: true,
  supportsPerToolPermission: true,
}

/**
 * Claude Code runtime 的 registry adapter。
 *
 * Phase 5 仍保留既有 Orchestrator + ClaudeAgentAdapter 主路径，
 * 这里仅提供统一 runtime registry 的能力描述与 abort/dispose 入口。
 */
export class ClaudeCodeRuntime implements CodingAgentRuntime {
  readonly kind = 'claude-code' as const

  constructor(private readonly adapter: AgentProviderAdapter) {}

  getCapabilities(): CodingAgentRuntimeCapabilities {
    return CLAUDE_CODE_RUNTIME_CAPABILITIES
  }

  async *run(_input: CodingAgentRuntimeRunInput): AsyncIterable<never> {
    throw new Error('Claude Code Runtime 仍由 AgentOrchestrator 既有路径执行')
  }

  abort(sessionId: string): void {
    this.adapter.abort(sessionId)
  }

  async queueMessage(_input: AgentQueueMessageInput): Promise<UnsupportedRuntimeCapabilityResult> {
    return unsupportedClaudeCapability('queueMessage')
  }

  async setPermissionMode(
    _sessionId: string,
    _mode: CodeInsightsPermissionMode,
  ): Promise<UnsupportedRuntimeCapabilityResult> {
    return unsupportedClaudeCapability('setPermissionMode')
  }

  dispose(): void {
    this.adapter.dispose()
  }
}

function unsupportedClaudeCapability(
  capability: 'queueMessage' | 'setPermissionMode',
): UnsupportedRuntimeCapabilityResult {
  return {
    ok: false,
    code: 'runtime_capability_unsupported',
    runtimeKind: 'claude-code',
    capability,
    message: `Claude Code Runtime 的 ${capability} 仍由既有 Orchestrator 路径处理。`,
  }
}

import type { CodeInsightsPermissionMode } from '@codeinsights/shared'
import type { WebSearchMode } from '@openai/codex-sdk'
import type { ResolvedCodexPermissionPolicy } from './coding-agent-runtime-types'

export interface ResolveCodexPermissionPolicyOptions {
  networkAccessEnabled?: boolean
  webSearchMode?: WebSearchMode
  allowDangerFullAccess?: boolean
}

export function resolveCodexPermissionPolicy(
  permissionMode: CodeInsightsPermissionMode,
  options: ResolveCodexPermissionPolicyOptions = {},
): ResolvedCodexPermissionPolicy {
  if (permissionMode === 'plan') {
    return {
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      webSearchMode: 'disabled',
      commandGuardPolicy: {
        blockGitBinary: true,
      },
    }
  }

  if (permissionMode === 'bypassPermissions') {
    const dangerFullAccessEnabled = options.allowDangerFullAccess === true
    return {
      sandboxMode: dangerFullAccessEnabled ? 'danger-full-access' : 'workspace-write',
      approvalPolicy: 'never',
      networkAccessEnabled: options.networkAccessEnabled === true,
      webSearchMode: options.webSearchMode ?? 'disabled',
      commandGuardPolicy: {
        blockGitBinary: true,
      },
      ...(dangerFullAccessEnabled
        ? { warning: 'Codex danger-full-access 已启用，仅应在用户显式授权后使用。' }
        : {}),
    }
  }

  return {
    sandboxMode: 'workspace-write',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: options.webSearchMode ?? 'disabled',
    commandGuardPolicy: {
      blockGitBinary: true,
    },
  }
}

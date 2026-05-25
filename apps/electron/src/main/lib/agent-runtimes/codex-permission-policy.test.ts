import { describe, expect, test } from 'bun:test'
import { resolveCodexPermissionPolicy } from './codex-permission-policy'

describe('resolveCodexPermissionPolicy', () => {
  test('plan 模式使用只读 sandbox 并关闭网络与 web search', () => {
    expect(resolveCodexPermissionPolicy('plan', {
      networkAccessEnabled: true,
      webSearchMode: 'live',
      allowDangerFullAccess: true,
    })).toMatchObject({
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      webSearchMode: 'disabled',
      commandGuardPolicy: {
        blockGitBinary: true,
      },
    })
  })

  test('auto 模式允许工作区写入但不启用 Codex approval 或网络', () => {
    expect(resolveCodexPermissionPolicy('auto', {
      networkAccessEnabled: true,
      webSearchMode: 'cached',
    })).toEqual({
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      webSearchMode: 'cached',
      commandGuardPolicy: {
        blockGitBinary: true,
      },
    })
  })

  test('bypassPermissions 默认仍不升级到 danger-full-access', () => {
    expect(resolveCodexPermissionPolicy('bypassPermissions', {
      networkAccessEnabled: true,
      webSearchMode: 'live',
    })).toEqual({
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
      networkAccessEnabled: true,
      webSearchMode: 'live',
      commandGuardPolicy: {
        blockGitBinary: true,
      },
    })
  })

  test('bypassPermissions 只有显式高级开关才允许 danger-full-access', () => {
    expect(resolveCodexPermissionPolicy('bypassPermissions', {
      allowDangerFullAccess: true,
      networkAccessEnabled: true,
    })).toEqual({
      sandboxMode: 'danger-full-access',
      approvalPolicy: 'never',
      networkAccessEnabled: true,
      webSearchMode: 'disabled',
      commandGuardPolicy: {
        blockGitBinary: true,
      },
      warning: 'Codex danger-full-access 已启用，仅应在用户显式授权后使用。',
    })
  })
})

import { describe, expect, test } from 'bun:test'
import {
  buildAgentComposerState,
  buildAgentRunnerModeControl,
  buildAgentHeaderMeta,
  formatPermissionMode,
  formatRuntimeKind,
  getActiveAgentBanner,
  getBannerToneForPermission,
  getToolActivityTone,
  hasPendingAgentInteraction,
} from './agent-ui-model'

describe('agent-ui-model', () => {
  test('header meta exposes workspace, model, permission and active state', () => {
    const meta = buildAgentHeaderMeta({
      workspaceName: 'codeinsights',
      modelName: 'Claude Sonnet',
      permissionMode: 'plan',
      streaming: true,
      planMode: true,
    })

    expect(meta).toEqual([
      { key: 'runtime', label: 'Runtime', value: 'Claude Code', tone: 'neutral' },
      { key: 'workspace', label: '工作区', value: 'codeinsights', tone: 'neutral' },
      { key: 'model', label: '模型', value: 'Claude Sonnet', tone: 'neutral' },
      { key: 'permission', label: '权限', value: 'Plan', tone: 'waiting' },
      { key: 'state', label: '状态', value: '规划中', tone: 'waiting' },
    ])
  })

  test('missing workspace or model becomes a waiting state', () => {
    const meta = buildAgentHeaderMeta({
      workspaceName: null,
      modelName: null,
      permissionMode: 'default',
    })

    expect(meta[1]).toEqual({ key: 'workspace', label: '工作区', value: '未选择工作区', tone: 'waiting' })
    expect(meta[2]).toEqual({ key: 'model', label: '模型', value: '未选择模型', tone: 'waiting' })
  })

  test('runtime labels distinguish Claude Code, Codex and opencode sessions', () => {
    expect(formatRuntimeKind('claude-code')).toBe('Claude Code')
    expect(formatRuntimeKind('codex')).toBe('Codex')
    expect(formatRuntimeKind('opencode')).toBe('opencode')

    expect(buildAgentHeaderMeta({
      runtimeKind: 'codex',
      workspaceName: 'codeinsights',
      modelName: 'gpt-5.1-codex',
      permissionMode: 'auto',
    })[0]).toEqual({ key: 'runtime', label: 'Runtime', value: 'Codex', tone: 'running' })

    expect(buildAgentHeaderMeta({
      runtimeKind: 'opencode',
      workspaceName: 'codeinsights',
      modelName: 'anthropic/claude-sonnet-4-5',
      agentName: 'plan',
      permissionMode: 'auto',
    })[0]).toEqual({ key: 'runtime', label: 'Runtime', value: 'opencode', tone: 'running' })
    expect(buildAgentHeaderMeta({
      runtimeKind: 'opencode',
      workspaceName: 'codeinsights',
      modelName: 'anthropic/claude-sonnet-4-5',
      agentName: 'plan',
      permissionMode: 'auto',
    })[3]).toEqual({ key: 'agent', label: 'Agent', value: 'plan', tone: 'neutral' })
  })

  test('permission and tool tones use shared status semantics', () => {
    expect(formatPermissionMode('bypassPermissions')).toBe('Allow all')
    expect(getBannerToneForPermission('dangerous')).toBe('danger')
    expect(getBannerToneForPermission('normal')).toBe('waiting')
    expect(getToolActivityTone('running')).toBe('running')
    expect(getToolActivityTone('backgrounded')).toBe('waiting')
    expect(getToolActivityTone('completed')).toBe('success')
    expect(getToolActivityTone('error')).toBe('danger')
  })

  test('runner mode control exposes current mode and next toggle target', () => {
    expect(buildAgentRunnerModeControl('runner-v2', false)).toEqual({
      label: 'Runner v2',
      description: '重构链路',
      nextMode: 'legacy',
      disabled: false,
    })

    expect(buildAgentRunnerModeControl('legacy', true)).toEqual({
      label: 'Legacy',
      description: '旧主循环',
      nextMode: 'runner-v2',
      disabled: true,
    })
  })

  test('composer keeps a stable disabled reason while interaction banners are active', () => {
    expect(buildAgentComposerState({
      hasChannel: true,
      hasAvailableModel: true,
      interactionLocked: true,
      streaming: false,
      hasTextInput: false,
    })).toEqual({
      disabled: true,
      canSend: false,
      notice: '请先处理上方交互请求',
    })
  })

  test('permission, AskUser and ExitPlan requests all lock agent interactions', () => {
    expect(hasPendingAgentInteraction({
      pendingPermissionCount: 1,
      pendingAskUserCount: 0,
      pendingExitPlanCount: 0,
    })).toBe(true)

    expect(hasPendingAgentInteraction({
      pendingPermissionCount: 0,
      pendingAskUserCount: 1,
      pendingExitPlanCount: 0,
    })).toBe(true)

    expect(hasPendingAgentInteraction({
      pendingPermissionCount: 0,
      pendingAskUserCount: 0,
      pendingExitPlanCount: 1,
    })).toBe(true)

    expect(hasPendingAgentInteraction({
      pendingPermissionCount: 0,
      pendingAskUserCount: 0,
      pendingExitPlanCount: 0,
    })).toBe(false)
  })

  test('active banner priority keeps global keyboard handlers single-owner', () => {
    expect(getActiveAgentBanner({
      pendingPermissionCount: 1,
      pendingAskUserCount: 1,
      pendingExitPlanCount: 1,
    })).toBe('permission')

    expect(getActiveAgentBanner({
      pendingPermissionCount: 0,
      pendingAskUserCount: 1,
      pendingExitPlanCount: 1,
    })).toBe('ask-user')

    expect(getActiveAgentBanner({
      pendingPermissionCount: 0,
      pendingAskUserCount: 0,
      pendingExitPlanCount: 1,
    })).toBe('exit-plan')

    expect(getActiveAgentBanner({
      pendingPermissionCount: 0,
      pendingAskUserCount: 0,
      pendingExitPlanCount: 0,
    })).toBeNull()
  })

  test('composer permits interrupt text while streaming but blocks empty send', () => {
    expect(buildAgentComposerState({
      hasChannel: true,
      hasAvailableModel: true,
      interactionLocked: false,
      streaming: true,
      hasTextInput: false,
    }).canSend).toBe(false)

    expect(buildAgentComposerState({
      hasChannel: true,
      hasAvailableModel: true,
      interactionLocked: false,
      streaming: true,
      hasTextInput: true,
    }).canSend).toBe(true)
  })

  test('composer blocks Codex runtime queue message while streaming', () => {
    expect(buildAgentComposerState({
      hasChannel: true,
      hasAvailableModel: true,
      interactionLocked: false,
      streaming: true,
      hasTextInput: true,
      queueUnsupported: true,
      queueUnsupportedLabel: 'Codex Runtime',
    })).toEqual({
      disabled: true,
      canSend: false,
      notice: 'Codex Runtime 暂不支持运行中追加消息，请先停止或等待完成',
    })
  })

  test('composer uses runtime label when opencode cannot queue while streaming', () => {
    expect(buildAgentComposerState({
      hasChannel: true,
      hasAvailableModel: true,
      interactionLocked: false,
      streaming: true,
      hasTextInput: true,
      queueUnsupported: true,
      queueUnsupportedLabel: 'opencode Runtime',
    }).notice).toBe('opencode Runtime 暂不支持运行中追加消息，请先停止或等待完成')
  })
})

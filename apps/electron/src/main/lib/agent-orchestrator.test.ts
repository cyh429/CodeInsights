import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentProviderAdapter, AgentRuntimeAuthSource, AgentSessionMeta, AgentStreamEnvelope, CodeInsightsPermissionMode, SDKMessage } from '@codeinsights/shared'
import { createAgentStreamEnvelope } from '@codeinsights/shared'
import {
  CodingAgentRuntimeRegistry,
  resolveAgentRuntimeSelection,
} from './agent-runtimes/coding-agent-runtime-registry'
import type {
  CodingAgentRuntime,
  CodingAgentRuntimeCapabilities,
  CodingAgentRuntimeRunInput,
  OpencodeCodingAgentRuntimeRunInput,
  UnsupportedRuntimeCapabilityResult,
} from './agent-runtimes/coding-agent-runtime-types'

mock.module('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '',
  },
  BrowserWindow: {
    getFocusedWindow: () => null,
    getAllWindows: () => [],
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
const originalCodexRuntimeFlag = process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME
const originalOpencodeRuntimeFlag = process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME
let tempConfigDir = ''

beforeEach(() => {
  tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-agent-orchestrator-'))
  process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
  delete process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME
  delete process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME
})

afterEach(() => {
  if (originalConfigDir === undefined) {
    delete process.env.CODEINSIGHTS_CONFIG_DIR
  } else {
    process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
  }
  if (originalCodexRuntimeFlag === undefined) {
    delete process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME
  } else {
    process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME = originalCodexRuntimeFlag
  }
  if (originalOpencodeRuntimeFlag === undefined) {
    delete process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME
  } else {
    process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME = originalOpencodeRuntimeFlag
  }
  if (tempConfigDir) {
    rmSync(tempConfigDir, { recursive: true, force: true })
    tempConfigDir = ''
  }
})

describe('AgentOrchestrator runtime routing selection', () => {
  test('Claude Code remains the default runtime', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: session({ runtimeKind: 'claude-code' }),
      settings: {},
    })).toEqual({
      kind: 'claude-code',
      source: 'default',
    })
  })

  test('new unbound session follows Codex settings despite legacy default runtimeKind', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: session({ runtimeKind: 'claude-code' }),
      settings: {
        agentRuntimeKind: 'codex',
        agentCodexChannelId: 'codex-channel',
        agentCodexModelId: 'gpt-5.1-codex',
      },
    })).toEqual({
      kind: 'codex',
      source: 'settings',
      channelId: 'codex-channel',
      model: 'gpt-5.1-codex',
    })
  })

  test('legacy sdkSessionId keeps existing Claude session on Claude runtime', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: session({ sdkSessionId: 'claude-sdk-session' }),
      settings: { agentRuntimeKind: 'codex' },
    })).toEqual({
      kind: 'claude-code',
      source: 'legacy-sdk-session',
      externalSessionId: 'claude-sdk-session',
    })
  })

  test('bound Codex runtime session keeps its thread even when settings changes', () => {
    expect(resolveAgentRuntimeSelection({
      sessionMeta: session({
        runtimeKind: 'codex',
        runtimeSession: {
          kind: 'codex',
          externalSessionId: 'codex-thread-1',
          createdAt: 100,
          updatedAt: 200,
        },
      }),
      settings: { agentRuntimeKind: 'claude-code' },
    })).toEqual({
      kind: 'codex',
      source: 'session',
      externalSessionId: 'codex-thread-1',
    })
  })
})

describe('AgentOrchestrator Codex runtime routing', () => {
  test('Codex feature flag 关闭时主进程阻止继续执行既有 Codex 会话', async () => {
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const {
      createAgentSession,
      getAgentSessionRuntimeEvents,
      getAgentSessionSDKMessages,
      updateAgentSessionMeta,
    } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({ agentRuntimeKind: 'claude-code' })
    const session = createAgentSession('Codex 已关闭会话')
    updateAgentSessionMeta(session.id, {
      runtimeKind: 'codex',
      runtimeSession: {
        kind: 'codex',
        externalSessionId: 'codex-thread-disabled',
        createdAt: 100,
        updatedAt: 100,
      },
    })
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus())
    const errors: string[] = []
    const completions: unknown[] = []

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: (error) => errors.push(error),
      onComplete: (_messages, opts) => completions.push(opts ?? {}),
      onTitleUpdated: () => {},
    })

    expect(errors[0]).toContain('Codex Runtime 已关闭')
    expect(completions).toHaveLength(1)
    expect(getAgentSessionRuntimeEvents(session.id)).toEqual([])
    const sdkMessages = getAgentSessionSDKMessages(session.id)
    expect(sdkMessages).toHaveLength(1)
    expect((sdkMessages[0] as unknown as { _errorCode?: string })._errorCode).toBe('codex_runtime_disabled')
  })

  test('settings 选择 Codex 时持久化 runtimeSession 并写 runtime event log', async () => {
    process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession, getAgentSessionMeta, getAgentSessionRuntimeEvents } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({
      agentRuntimeKind: 'codex',
      agentCodexChannelId: 'codex-channel-1',
      agentCodexModelId: 'codex-mock-model',
    })
    const session = createAgentSession('Codex 测试会话')
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createFakeCodexRuntime([
      { type: 'run_started' },
      { type: 'sdk_session', id: 'codex-thread-1' },
      { type: 'assistant_message' },
      { type: 'run_completed' },
    ]))
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })
    const completions: Array<{ stoppedByUser?: boolean; resultSubtype?: string }> = []

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: () => {},
      onComplete: (_messages, opts) => completions.push(opts ?? {}),
      onTitleUpdated: () => {},
    })

    const meta = getAgentSessionMeta(session.id)
    expect(meta?.runtimeKind).toBe('codex')
    expect(meta?.runtimeSession?.externalSessionId).toBe('codex-thread-1')
    expect(meta?.runtimeSession?.channelId).toBe('codex-channel-1')
    expect(meta?.runtimeSession?.model).toBe('codex-mock-model')
    expect(meta?.sdkSessionId).toBeUndefined()
    expect(completions[0]?.resultSubtype).toBe('success')
    expect(getAgentSessionRuntimeEvents(session.id).map((event) => event.event.type)).toEqual([
      'run_started',
      'sdk_session',
      'assistant_message',
      'run_completed',
    ])
  })

  test('Codex runtime 会接收工作区 MCP 的原生 config 注入', async () => {
    process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession } = await import('./agent-session-manager')
    const { createAgentWorkspace, saveWorkspaceMcpConfig } = await import('./agent-workspace-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({ agentRuntimeKind: 'codex' })
    const workspace = createAgentWorkspace('Codex MCP Workspace')
    saveWorkspaceMcpConfig(workspace.slug, {
      servers: {
        docs: {
          type: 'stdio',
          command: 'node',
          args: ['server.mjs'],
          env: { DOCS_TOKEN: 'secret' },
          timeout: 15,
          enabled: true,
        },
      },
    })
    const session = createAgentSession('Codex MCP 会话')
    let capturedConfig: unknown
    let capturedConfigEnv: unknown
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createFakeCodexRuntime([
      { type: 'run_started' },
      { type: 'sdk_session', id: 'codex-thread-mcp' },
      { type: 'run_completed' },
    ], undefined, (input) => {
      capturedConfig = (input as { codexConfig?: unknown }).codexConfig
      capturedConfigEnv = (input as { codexConfigEnv?: unknown }).codexConfigEnv
    }))
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })

    await orchestrator.sendMessage({
      ...createSendInput(session.id),
      workspaceId: workspace.id,
    }, {
      onError: () => {},
      onComplete: () => {},
      onTitleUpdated: () => {},
    })

    expect(capturedConfig).toMatchObject({
      mcp_servers: {
        docs: {
          command: 'node',
          args: ['server.mjs'],
          env_vars: ['PATH', 'DOCS_TOKEN'],
          enabled: true,
          required: false,
          startup_timeout_sec: 15,
        },
      },
    })
    expect(capturedConfigEnv).toEqual({ DOCS_TOKEN: 'secret' })
    expect(JSON.stringify(capturedConfig)).not.toContain('secret')
  })

  test('已绑定 Codex session resume 不回退当前设置模型', async () => {
    process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession, getAgentSessionMeta, updateAgentSessionMeta } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({
      agentRuntimeKind: 'codex',
      agentCodexModelId: 'new-settings-model',
    })
    const session = createAgentSession('Codex 已绑定会话')
    updateAgentSessionMeta(session.id, {
      runtimeKind: 'codex',
      runtimeSession: {
        kind: 'codex',
        externalSessionId: 'codex-thread-existing',
        createdAt: 100,
        updatedAt: 100,
      },
    })
    const runModels: Array<string | undefined> = []
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createFakeCodexRuntime([
      { type: 'run_started', model: 'Codex default' },
      { type: 'sdk_session', id: 'codex-thread-existing' },
      { type: 'run_completed' },
    ], undefined, (input) => runModels.push(input.model)))
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: () => {},
      onComplete: () => {},
      onTitleUpdated: () => {},
    })

    expect(runModels).toEqual([undefined])
    expect(getAgentSessionMeta(session.id)?.runtimeSession?.model).toBeUndefined()
  })

  test('stop 后 Codex runtime 的 late run_completed 不会落入 event log', async () => {
    process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession, getAgentSessionRuntimeEvents } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({ agentRuntimeKind: 'codex' })
    const session = createAgentSession('Codex 停止会话')
    const registry = new CodingAgentRuntimeRegistry()
    let orchestrator: InstanceType<typeof AgentOrchestrator>
    registry.register(createFakeCodexRuntime([
      { type: 'run_started' },
      { type: 'sdk_session', id: 'codex-thread-stop' },
      { type: 'late_run_completed_after_stop' },
    ], () => orchestrator.stop(session.id)))
    orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })
    const completions: Array<{ stoppedByUser?: boolean }> = []

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: () => {},
      onComplete: (_messages, opts) => completions.push(opts ?? {}),
      onTitleUpdated: () => {},
    })

    const terminalEvents = getAgentSessionRuntimeEvents(session.id)
      .map((event) => event.event.type)
      .filter((type) => type === 'run_completed' || type === 'run_stopped')
    expect(terminalEvents).toEqual(['run_stopped'])
    expect(completions[0]?.stoppedByUser).toBe(true)
  })
})

describe('AgentOrchestrator opencode runtime routing', () => {
  test('opencode feature flag 关闭时主进程阻止继续执行既有 opencode 会话', async () => {
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const {
      createAgentSession,
      getAgentSessionRuntimeEvents,
      getAgentSessionSDKMessages,
      updateAgentSessionMeta,
    } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({ agentRuntimeKind: 'claude-code' })
    const session = createAgentSession('opencode 已关闭会话')
    updateAgentSessionMeta(session.id, {
      runtimeKind: 'opencode',
      runtimeSession: {
        kind: 'opencode',
        externalSessionId: 'ses_opencode_disabled',
        createdAt: 100,
        updatedAt: 100,
      },
    })
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus())
    const errors: string[] = []
    const completions: unknown[] = []

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: (error) => errors.push(error),
      onComplete: (_messages, opts) => completions.push(opts ?? {}),
      onTitleUpdated: () => {},
    })

    expect(errors[0]).toContain('opencode Runtime 已关闭')
    expect(completions).toHaveLength(1)
    expect(getAgentSessionRuntimeEvents(session.id)).toEqual([])
    const sdkMessages = getAgentSessionSDKMessages(session.id)
    expect(sdkMessages).toHaveLength(1)
    expect((sdkMessages[0] as unknown as { _errorCode?: string })._errorCode).toBe('opencode_runtime_disabled')
  })

  test('settings 选择 opencode 时持久化 runtimeSession 并写 runtime event log', async () => {
    process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession, getAgentSessionMeta, getAgentSessionRuntimeEvents, getAgentSessionSDKMessages } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({
      agentRuntimeKind: 'opencode',
      agentOpencodeChannelId: null,
      agentOpencodeModelId: 'provider/opencode-model',
      agentOpencodeAgentName: 'build',
    })
    const session = createAgentSession('opencode 测试会话')
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createFakeOpencodeRuntime([
      { type: 'run_started' },
      { type: 'sdk_session', id: 'ses_opencode_1' },
      { type: 'assistant_message' },
      { type: 'run_completed' },
    ]))
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })
    const completions: Array<{ stoppedByUser?: boolean; resultSubtype?: string }> = []

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: () => {},
      onComplete: (_messages, opts) => completions.push(opts ?? {}),
      onTitleUpdated: () => {},
    })

    const meta = getAgentSessionMeta(session.id)
    expect(meta?.runtimeKind).toBe('opencode')
    expect(meta?.runtimeSession).toMatchObject({
      kind: 'opencode',
      externalSessionId: 'ses_opencode_1',
      channelId: null,
      model: 'provider/opencode-model',
      agent: 'build',
      authSource: 'native',
    })
    expect(meta?.sdkSessionId).toBeUndefined()
    expect(completions[0]?.resultSubtype).toBe('success')
    expect(getAgentSessionRuntimeEvents(session.id).map((event) => event.event.type)).toEqual([
      'run_started',
      'sdk_session',
      'assistant_message',
      'run_completed',
    ])
    expect(getAgentSessionSDKMessages(session.id).map((message) => message.type)).toEqual([
      'user',
      'assistant',
      'result',
    ])
  })

  test('opencode runtime 会接收工作区 MCP 的 secretless config 注入', async () => {
    process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession } = await import('./agent-session-manager')
    const { createAgentWorkspace, saveWorkspaceMcpConfig } = await import('./agent-workspace-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({
      agentRuntimeKind: 'opencode',
      agentOpencodeChannelId: null,
      agentOpencodeUseNativeAuth: true,
      agentOpencodeModelId: 'anthropic/claude-sonnet-4-5',
    })
    const workspace = createAgentWorkspace('opencode MCP Workspace')
    saveWorkspaceMcpConfig(workspace.slug, {
      servers: {
        docs: {
          type: 'stdio',
          command: 'node',
          args: ['server.mjs'],
          env: { DOCS_TOKEN: 'secret-token' },
          timeout: 15,
          enabled: true,
        },
      },
    })
    const session = createAgentSession('opencode MCP 会话')
    let capturedMcp: OpencodeCodingAgentRuntimeRunInput['opencodeMcp']
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createFakeOpencodeRuntime([
      { type: 'run_started' },
      { type: 'sdk_session', id: 'ses_opencode_mcp' },
      { type: 'run_completed' },
    ], undefined, (input) => {
      capturedMcp = input.opencodeMcp
    }))
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })

    await orchestrator.sendMessage({
      ...createSendInput(session.id),
      workspaceId: workspace.id,
    }, {
      onError: () => {},
      onComplete: () => {},
      onTitleUpdated: () => {},
    })

    expect(capturedMcp?.serverCount).toBe(1)
    expect(capturedMcp?.config.mcp.docs).toMatchObject({
      type: 'local',
      command: ['node', 'server.mjs'],
      enabled: true,
      timeout: 15000,
    })
    expect(Object.values(capturedMcp?.env ?? {})).toEqual(['secret-token'])
    expect(JSON.stringify(capturedMcp?.config)).not.toContain('secret-token')
  })

  test('已绑定 opencode session resume 不回退当前 settings 模型、agent 或 authSource', async () => {
    process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession, getAgentSessionMeta, updateAgentSessionMeta } = await import('./agent-session-manager')
    const { createAgentWorkspace } = await import('./agent-workspace-manager')
    const { materializeAgentRuntimeForNewSession } = await import('./agent-runtime-materializer')
    const { updateSettings } = await import('./settings-service')
    updateSettings({
      agentRuntimeKind: 'opencode',
      agentOpencodeChannelId: null,
      agentOpencodeModelId: 'new-settings-model',
      agentOpencodeAgentName: 'new-agent',
    })
    const workspace = createAgentWorkspace('opencode resume workspace')
    const session = createAgentSession('opencode 已绑定会话')
    const manifest = materializeAgentRuntimeForNewSession({ workspace, sessionId: session.id })
    updateAgentSessionMeta(session.id, {
      workspaceId: workspace.id,
      runtimeKind: 'opencode',
      runtimeSession: {
        kind: 'opencode',
        externalSessionId: 'ses_opencode_existing',
        channelId: 'bound-channel',
        model: 'provider/bound-model',
        agent: 'review',
        authSource: 'channel',
        workingDirectory: manifest.sessionCwd,
        runtimeConfigHash: 'runtime-hash',
        authSourceHash: 'auth-hash',
        permissionPolicyHash: 'permission-hash',
        createdAt: 100,
        updatedAt: 100,
      },
    })
    const runInputs: Array<CodingAgentRuntimeRunInput & { agent?: string; authSource?: string; runtimeConfigHash?: string; authSourceHash?: string; permissionPolicyHash?: string }> = []
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createFakeOpencodeRuntime([
      { type: 'run_started', model: 'provider/bound-model' },
      { type: 'sdk_session', id: 'ses_opencode_existing' },
      { type: 'run_completed' },
    ], undefined, (input) => runInputs.push(input)))
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: () => {},
      onComplete: () => {},
      onTitleUpdated: () => {},
    })

    expect(runInputs[0]).toMatchObject({
      externalSessionId: 'ses_opencode_existing',
      channelId: 'bound-channel',
      model: 'provider/bound-model',
      agent: 'review',
      authSource: 'channel',
      workingDirectory: manifest.sessionCwd,
      runtimeConfigHash: 'runtime-hash',
      authSourceHash: 'auth-hash',
      permissionPolicyHash: 'permission-hash',
    })
    expect(getAgentSessionMeta(session.id)?.runtimeSession).toMatchObject({
      externalSessionId: 'ses_opencode_existing',
      model: 'provider/bound-model',
      agent: 'review',
      authSource: 'channel',
      workingDirectory: manifest.sessionCwd,
    })
  })

  test('已绑定 opencode session 缺少 workspace manifest 时阻断 resume', async () => {
    process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession, getAgentSessionRuntimeEvents, updateAgentSessionMeta } = await import('./agent-session-manager')
    const { createAgentWorkspace } = await import('./agent-workspace-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({ agentRuntimeKind: 'opencode' })
    const workspace = createAgentWorkspace('opencode missing manifest workspace')
    const session = createAgentSession('opencode 缺少 manifest 会话')
    updateAgentSessionMeta(session.id, {
      workspaceId: workspace.id,
      runtimeKind: 'opencode',
      runtimeSession: {
        kind: 'opencode',
        externalSessionId: 'ses_opencode_missing_manifest',
        model: 'provider/model',
        createdAt: 100,
        updatedAt: 100,
      },
    })
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createFakeOpencodeRuntime([{ type: 'run_completed' }], undefined, () => {
      throw new Error('opencode runtime should not run without manifest')
    }))
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })
    const errors: string[] = []

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: (error) => errors.push(error),
      onComplete: () => {},
      onTitleUpdated: () => {},
    })

    expect(errors[0]).toContain('opencode Runtime 绑定缺少 manifest')
    expect(getAgentSessionRuntimeEvents(session.id)).toEqual([])
  })

  test('已绑定 opencode session 的 workspace 不可解析时也阻断 resume', async () => {
    process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession, getAgentSessionRuntimeEvents, updateAgentSessionMeta } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({ agentRuntimeKind: 'opencode' })
    const session = createAgentSession('opencode workspace 丢失会话')
    updateAgentSessionMeta(session.id, {
      workspaceId: 'deleted-opencode-workspace',
      runtimeKind: 'opencode',
      runtimeSession: {
        kind: 'opencode',
        externalSessionId: 'ses_opencode_deleted_workspace',
        model: 'provider/model',
        workingDirectory: '/tmp/opencode-bound-cwd',
        createdAt: 100,
        updatedAt: 100,
      },
    })
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createFakeOpencodeRuntime([{ type: 'run_completed' }], undefined, () => {
      throw new Error('opencode runtime should not run when workspace cannot be resolved')
    }))
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })
    const errors: string[] = []

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: (error) => errors.push(error),
      onComplete: () => {},
      onTitleUpdated: () => {},
    })

    expect(errors[0]).toContain('opencode Runtime 绑定缺少 manifest')
    expect(getAgentSessionRuntimeEvents(session.id)).toEqual([])
  })

  test('stop 后 opencode runtime 的 late run_completed 不会落入 event log', async () => {
    process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession, getAgentSessionRuntimeEvents } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({ agentRuntimeKind: 'opencode' })
    const session = createAgentSession('opencode 停止会话')
    const registry = new CodingAgentRuntimeRegistry()
    let orchestrator: InstanceType<typeof AgentOrchestrator>
    registry.register(createFakeOpencodeRuntime([
      { type: 'run_started' },
      { type: 'sdk_session', id: 'ses_opencode_stop' },
      { type: 'late_run_completed_after_stop' },
    ], () => orchestrator.stop(session.id)))
    orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })
    const completions: Array<{ stoppedByUser?: boolean }> = []

    await orchestrator.sendMessage(createSendInput(session.id), {
      onError: () => {},
      onComplete: (_messages, opts) => completions.push(opts ?? {}),
      onTitleUpdated: () => {},
    })

    const terminalEvents = getAgentSessionRuntimeEvents(session.id)
      .map((event) => event.event.type)
      .filter((type) => type === 'run_completed' || type === 'run_stopped')
    expect(terminalEvents).toEqual(['run_stopped'])
    expect(completions[0]?.stoppedByUser).toBe(true)
  })

  test('opencode running session 不支持 queueMessage 或 setPermissionMode', async () => {
    process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME = '1'
    const { AgentEventBus } = await import('./agent-event-bus')
    const { AgentOrchestrator } = await import('./agent-orchestrator')
    const { createAgentSession } = await import('./agent-session-manager')
    const { updateSettings } = await import('./settings-service')
    updateSettings({ agentRuntimeKind: 'opencode' })
    const session = createAgentSession('opencode unsupported 会话')
    let resumeRun: (() => void) | undefined
    let resolveSdkSession: (() => void) | undefined
    const sdkSessionSeen = new Promise<void>((resolve) => {
      resolveSdkSession = resolve
    })
    const registry = new CodingAgentRuntimeRegistry()
    registry.register(createFakeOpencodeRuntime([
      { type: 'run_started' },
      { type: 'sdk_session', id: 'ses_opencode_unsupported' },
      { type: 'wait_until_released' },
      { type: 'run_completed' },
    ], () => resolveSdkSession?.(), undefined, (resume) => {
      resumeRun = resume
    }))
    const orchestrator = new AgentOrchestrator(createUnusedAdapter(), new AgentEventBus(), { runtimeRegistry: registry })
    const sendPromise = orchestrator.sendMessage(createSendInput(session.id), {
      onError: () => {},
      onComplete: () => {},
      onTitleUpdated: () => {},
    })
    await sdkSessionSeen
    await expect(orchestrator.queueMessage(session.id, '追加消息')).rejects.toThrow('opencode Runtime 暂不支持 queueMessage')
    await expect(orchestrator.updateSessionPermissionMode(session.id, 'plan')).rejects.toThrow('opencode Runtime 暂不支持 setPermissionMode')
    resumeRun?.()
    await sendPromise
  })
})

function session(overrides: Partial<AgentSessionMeta>): AgentSessionMeta {
  return {
    id: 'session-runtime-routing',
    title: 'Runtime Routing',
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  }
}

function createSendInput(sessionId: string) {
  return {
    sessionId,
    userMessage: '请运行 Codex mock',
    channelId: 'unused-claude-channel',
  }
}

function createUnusedAdapter(): AgentProviderAdapter {
  return {
    query: async function* (): AsyncIterable<SDKMessage> {
      throw new Error('Claude adapter should not be used in Codex routing tests')
    },
    abort: () => {},
    dispose: () => {},
  }
}

type FakeCodexStep =
  | { type: 'run_started'; model?: string }
  | { type: 'sdk_session'; id: string }
  | { type: 'assistant_message' }
  | { type: 'run_completed' }
  | { type: 'late_run_completed_after_stop' }

function createFakeCodexRuntime(
  steps: FakeCodexStep[],
  afterSdkSession?: () => void,
  onRun?: (input: CodingAgentRuntimeRunInput) => void,
): CodingAgentRuntime {
  return {
    kind: 'codex',
    getCapabilities: () => codexCapabilities(),
    run: async function* (input: CodingAgentRuntimeRunInput): AsyncIterable<AgentStreamEnvelope> {
      onRun?.(input)
      let sequence = 0
      const nextEnvelope = (event: AgentStreamEnvelope['event']): AgentStreamEnvelope => createAgentStreamEnvelope({
        sessionId: input.sessionId,
        runId: 'run-codex-test',
        sequence: sequence++,
        source: event.type === 'sdk_session' || event.type === 'assistant_message' ? 'codex_sdk' : 'runtime_service',
        createdAt: '2026-05-25T00:00:00.000Z',
        event,
      })

      for (const step of steps) {
        if (step.type === 'run_started') {
          yield nextEnvelope({
            type: 'run_started',
            model: step.model ?? input.model ?? 'codex-mock-model',
            cwd: input.workingDirectory,
            permissionMode: input.permissionMode,
            runtimeHash: 'codex-test',
            runnerMode: 'runner-v2',
            runtimeKind: 'codex',
          })
        } else if (step.type === 'sdk_session') {
          yield nextEnvelope({ type: 'sdk_session', sdkSessionId: step.id })
          afterSdkSession?.()
        } else if (step.type === 'assistant_message') {
          yield nextEnvelope({
            type: 'assistant_message',
            messageId: 'codex-message-1',
            contentBlocks: [{ type: 'text', text: 'Codex mock response' }],
            status: 'complete',
          })
        } else {
          yield nextEnvelope({
            type: 'run_completed',
            resultSubtype: 'success',
            terminalReason: 'completed',
            usage: {},
            sdkSessionId: 'codex-thread-1',
          })
        }
      }
    },
    abort: () => {},
    queueMessage: async () => unsupported('queueMessage'),
    setPermissionMode: async (_sessionId: string, _mode: CodeInsightsPermissionMode) => unsupported('setPermissionMode'),
    dispose: () => {},
  }
}

function codexCapabilities(): CodingAgentRuntimeCapabilities {
  return {
    runtimeKind: 'codex',
    supportsStreamEvents: true,
    supportsResumeThread: true,
    supportsAbort: true,
    supportsQueueMessage: false,
    supportsSetPermissionMode: false,
    supportsPerToolPermission: false,
  }
}

type FakeOpencodeStep =
  | { type: 'run_started'; model?: string }
  | { type: 'sdk_session'; id: string }
  | { type: 'assistant_message' }
  | { type: 'run_completed' }
  | { type: 'late_run_completed_after_stop' }
  | { type: 'wait_until_released' }

interface FakeOpencodeRunInput extends OpencodeCodingAgentRuntimeRunInput {
  agent?: string
  authSource?: AgentRuntimeAuthSource
  runtimeConfigHash?: string
  authSourceHash?: string
  permissionPolicyHash?: string
}

function createFakeOpencodeRuntime(
  steps: FakeOpencodeStep[],
  afterSdkSession?: () => void,
  onRun?: (input: FakeOpencodeRunInput) => void,
  onWait?: (resume: () => void) => void,
): CodingAgentRuntime {
  return {
    kind: 'opencode',
    getCapabilities: () => opencodeCapabilities(),
    run: async function* (input: CodingAgentRuntimeRunInput): AsyncIterable<AgentStreamEnvelope> {
      const opencodeInput = input as FakeOpencodeRunInput
      onRun?.(opencodeInput)
      let sequence = 0
      const nextEnvelope = (event: AgentStreamEnvelope['event']): AgentStreamEnvelope => createAgentStreamEnvelope({
        sessionId: input.sessionId,
        runId: 'run-opencode-test',
        sequence: sequence++,
        source: event.type === 'sdk_session' || event.type === 'assistant_message' ? 'opencode_server' : 'runtime_service',
        createdAt: '2026-05-27T00:00:00.000Z',
        event,
        metadata: event.type === 'sdk_session' || event.type === 'assistant_message'
          ? { runtimeKind: 'opencode' }
          : undefined,
      })

      for (const step of steps) {
        if (step.type === 'run_started') {
          yield nextEnvelope({
            type: 'run_started',
            model: step.model ?? input.model ?? 'opencode-mock-model',
            cwd: input.workingDirectory,
            permissionMode: input.permissionMode,
            runtimeHash: input.runtimeHash ?? 'opencode-test',
            runnerMode: 'runner-v2',
            runtimeKind: 'opencode',
          })
        } else if (step.type === 'sdk_session') {
          yield nextEnvelope({ type: 'sdk_session', sdkSessionId: step.id, resumeFrom: input.externalSessionId })
          afterSdkSession?.()
        } else if (step.type === 'assistant_message') {
          yield nextEnvelope({
            type: 'assistant_message',
            messageId: 'opencode-message-1',
            contentBlocks: [{ type: 'text', text: 'opencode mock response' }],
            status: 'complete',
          })
        } else if (step.type === 'wait_until_released') {
          await new Promise<void>((resolve) => {
            onWait?.(resolve)
          })
        } else {
          yield nextEnvelope({
            type: 'run_completed',
            resultSubtype: 'success',
            terminalReason: 'completed',
            usage: {},
            sdkSessionId: 'ses_opencode_1',
          })
        }
      }
    },
    abort: () => {},
    queueMessage: async () => unsupportedOpencode('queueMessage'),
    setPermissionMode: async (_sessionId: string, _mode: CodeInsightsPermissionMode) => unsupportedOpencode('setPermissionMode'),
    dispose: () => {},
  }
}

function opencodeCapabilities(): CodingAgentRuntimeCapabilities {
  return {
    runtimeKind: 'opencode',
    supportsStreamEvents: true,
    supportsResumeThread: true,
    supportsAbort: true,
    supportsQueueMessage: false,
    supportsSetPermissionMode: false,
    supportsPerToolPermission: true,
  }
}

function unsupported(capability: 'queueMessage' | 'setPermissionMode'): UnsupportedRuntimeCapabilityResult {
  return {
    ok: false,
    code: 'runtime_capability_unsupported',
    runtimeKind: 'codex',
    capability,
    message: 'unsupported',
  }
}

function unsupportedOpencode(capability: 'queueMessage' | 'setPermissionMode'): UnsupportedRuntimeCapabilityResult {
  return {
    ok: false,
    code: 'runtime_capability_unsupported',
    runtimeKind: 'opencode',
    capability,
    message: `opencode Runtime 暂不支持 ${capability}。`,
  }
}

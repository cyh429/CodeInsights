/**
 * Agent 服务层（IPC 薄层）
 *
 * 职责：
 * - 创建 AgentOrchestrator / EventBus / Adapter 实例
 * - 注册 EventBus IPC 转发中间件（webContents.send）
 * - 导出 IPC handler 调用的薄包装函数
 * - 文件操作（saveFilesToAgentSession）
 *
 * 所有业务逻辑已委托给 AgentOrchestrator。
 */

import { join, dirname } from 'node:path'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { BrowserWindow } from 'electron'
import type { WebContents } from 'electron'
import { AGENT_IPC_CHANNELS } from '@codeinsights/shared'
import type {
  AgentSendInput,
  AgentGenerateTitleInput,
  AgentSaveFilesInput,
  AgentSaveWorkspaceFilesInput,
  AgentSavedFile,
  AgentStreamEvent,
  AgentStreamPayload,
  AgentRuntimeCapabilitiesDiagnostic,
  AgentOpencodeMcpStatusSummary,
  AgentOpencodeModelRefreshResult,
  AgentOpencodeServerStatus,
  AgentQueueMessageInput,
  CodeInsightsPermissionMode,
  CodingAgentRuntimeKind,
} from '@codeinsights/shared'
import { ClaudeAgentAdapter, scanAndKillOrphanedClaudeSubprocesses } from './adapters/claude-agent-adapter'
import { AgentEventBus } from './agent-event-bus'
import { AgentOrchestrator } from './agent-orchestrator'
import { getAgentSessionWorkspacePath, getWorkspaceFilesDir } from './config-paths'
import { ElectronAgentChannel } from './agent-channel'
import { ClaudeCodeRuntime } from './agent-runtimes/claude-code-runtime'
import { CodexAgentRuntime } from './agent-runtimes/codex-runtime'
import { OpencodeAgentRuntime } from './agent-runtimes/opencode-runtime'
import { CodingAgentRuntimeRegistry } from './agent-runtimes/coding-agent-runtime-registry'
import type { CodingAgentRuntimeCapabilities } from './agent-runtimes/coding-agent-runtime-types'

// ===== 实例创建 =====

const eventBus = new AgentEventBus()
const adapter = new ClaudeAgentAdapter()
const runtimeRegistry = new CodingAgentRuntimeRegistry()
runtimeRegistry.register(new ClaudeCodeRuntime(adapter))
runtimeRegistry.register(new CodexAgentRuntime())
const opencodeRuntime = process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME === '1'
  ? new OpencodeAgentRuntime()
  : null
if (opencodeRuntime) {
  runtimeRegistry.register(opencodeRuntime)
}
const orchestrator = new AgentOrchestrator(adapter, eventBus, { runtimeRegistry })

/** 导出 EventBus 供飞书 Bridge 等外部服务订阅事件 */
export { eventBus as agentEventBus }

/**
 * 会话 → webContents 映射
 *
 * EventBus IPC 转发中间件通过此映射找到目标 webContents。
 * runAgent 开始时注册，结束时清理。
 */
const sessionWebContents = new Map<string, WebContents>()

// ===== EventBus IPC 转发中间件 =====

eventBus.use((sessionId, payload, next) => {
  const wc = sessionWebContents.get(sessionId)
  if (wc && !wc.isDestroyed()) {
    try {
      new ElectronAgentChannel({ webContents: wc }).consumePayload(sessionId, payload)
    } catch (err) {
      console.error(`[EventBus] wc.send 失败: sessionId=${sessionId}, payload.kind=${(payload as Record<string, unknown>)?.kind}`, err)
    }
  }
  next()
})

// ===== IPC 薄包装函数 =====

/**
 * 运行 Agent 并流式推送事件到渲染进程
 *
 * 注册 webContents 到 EventBus 映射，委托给 Orchestrator。
 */
export async function runAgent(
  input: AgentSendInput,
  webContents: WebContents,
): Promise<void> {
  // 更新 webContents 映射（允许覆盖 — 由 orchestrator.activeSessions 处理真正的并发保护）
  sessionWebContents.set(input.sessionId, webContents)
  try {
    await orchestrator.sendMessage(input, {
      onError: (error) => {
        if (!webContents.isDestroyed()) {
          webContents.send(AGENT_IPC_CHANNELS.STREAM_ERROR, {
            sessionId: input.sessionId,
            error,
          })
        }
      },
      onComplete: (messages, opts) => {
        if (!webContents.isDestroyed()) {
          webContents.send(AGENT_IPC_CHANNELS.STREAM_COMPLETE, {
            sessionId: input.sessionId,
            messages,
            stoppedByUser: opts?.stoppedByUser ?? false,
            startedAt: opts?.startedAt,
            resultSubtype: opts?.resultSubtype,
          })
        }
      },
      onTitleUpdated: (title) => {
        if (!webContents.isDestroyed()) {
          webContents.send(AGENT_IPC_CHANNELS.TITLE_UPDATED, {
            sessionId: input.sessionId,
            title,
          })
        }
      },
    })
  } catch (err) {
    console.error('[Agent 服务] runAgent 未处理异常:', err)
    const errorMessage = err instanceof Error ? err.message : '未知错误'
    if (!webContents.isDestroyed()) {
      webContents.send(AGENT_IPC_CHANNELS.STREAM_ERROR, {
        sessionId: input.sessionId,
        error: errorMessage,
      })
      webContents.send(AGENT_IPC_CHANNELS.STREAM_COMPLETE, {
        sessionId: input.sessionId,
        messages: [],
        stoppedByUser: false,
      })
    }
  } finally {
    // 仅在 orchestrator 已完成此会话时清理映射
    // 避免被拒绝的请求误删仍在运行的会话映射
    if (!orchestrator.isActive(input.sessionId)) {
      sessionWebContents.delete(input.sessionId)
    }
  }
}

/**
 * 无渲染进程的 Agent 运行（供飞书 Bridge 等外部调用方使用）
 *
 * 如果桌面窗口存在，同时注册 webContents 以便事件同步到桌面端 UI。
 * 事件同时通过 EventBus listeners 分发给飞书 Bridge。
 */
export async function runAgentHeadless(
  input: AgentSendInput,
  callbacks: {
    onError: (error: string) => void
    onComplete: () => void
    onTitleUpdated: (title: string) => void
  },
): Promise<void> {
  // 尝试注册主窗口 webContents，让流式事件同步推送到桌面端
  const win = BrowserWindow.getAllWindows()[0]
  const wc = win && !win.isDestroyed() ? win.webContents : null
  if (wc) {
    sessionWebContents.set(input.sessionId, wc)
  }

  try {
    await orchestrator.sendMessage(input, {
      onError: (error) => {
        callbacks.onError(error)
        // 同步到渲染进程
        if (wc && !wc.isDestroyed()) {
          wc.send(AGENT_IPC_CHANNELS.STREAM_ERROR, {
            sessionId: input.sessionId,
            error,
          })
        }
      },
      onComplete: (messages, opts) => {
        callbacks.onComplete()
        // 同步到渲染进程
        if (wc && !wc.isDestroyed()) {
          wc.send(AGENT_IPC_CHANNELS.STREAM_COMPLETE, {
            sessionId: input.sessionId,
            messages,
            stoppedByUser: opts?.stoppedByUser ?? false,
            startedAt: opts?.startedAt,
            resultSubtype: opts?.resultSubtype,
          })
        }
      },
      onTitleUpdated: (title) => {
        callbacks.onTitleUpdated(title)
        // 同步到渲染进程
        if (wc && !wc.isDestroyed()) {
          wc.send(AGENT_IPC_CHANNELS.TITLE_UPDATED, {
            sessionId: input.sessionId,
            title,
          })
        }
      },
    })
  } catch (err) {
    console.error('[Agent 服务] runAgentHeadless 未处理异常:', err)
    const errorMessage = err instanceof Error ? err.message : '未知错误'
    callbacks.onError(errorMessage)
    callbacks.onComplete()
    if (wc && !wc.isDestroyed()) {
      wc.send(AGENT_IPC_CHANNELS.STREAM_ERROR, { sessionId: input.sessionId, error: errorMessage })
      wc.send(AGENT_IPC_CHANNELS.STREAM_COMPLETE, { sessionId: input.sessionId, messages: [], stoppedByUser: false })
    }
  } finally {
    if (!orchestrator.isActive(input.sessionId)) {
      sessionWebContents.delete(input.sessionId)
    }
  }
}

/**
 * 生成 Agent 会话标题
 */
export async function generateAgentTitle(input: AgentGenerateTitleInput): Promise<string | null> {
  return orchestrator.generateTitle(input)
}

/**
 * 中止指定会话的 Agent 执行
 */
export function stopAgent(sessionId: string): void {
  orchestrator.stop(sessionId)
}

/**
 * 快照回退：回退到指定消息点，恢复文件 + 截断对话
 */
export async function rewindAgentSession(
  sessionId: string,
  assistantMessageUuid: string,
): Promise<import('@codeinsights/shared').RewindSessionResult> {
  return orchestrator.rewindSession(sessionId, assistantMessageUuid)
}

/**
 * 检查指定会话是否正在运行
 */
export function isAgentSessionActive(sessionId: string): boolean {
  return orchestrator.isActive(sessionId)
}

/** 中止所有活跃的 Agent 会话（应用退出时调用） */
export function stopAllAgents(): void {
  orchestrator.stopAll()
}

/**
 * 退出前最后兜底：扫描并强杀所有孤儿 claude-agent-sdk 子进程
 *
 * 必须在 stopAllAgents() 之后调用。针对 pidMap 未覆盖、dispose 漏杀等极端场景。
 * 同步执行，不 await，确保 before-quit 能在 Electron 超时前完成。
 */
export function killOrphanedClaudeSubprocesses(): void {
  scanAndKillOrphanedClaudeSubprocesses()
}

/**
 * 运行中动态切换会话的权限模式
 *
 * 同时更新 CodeInsights 侧（canUseTool 动态读取）和 SDK 侧（query.setPermissionMode）。
 */
export async function updateAgentPermissionMode(sessionId: string, mode: CodeInsightsPermissionMode): Promise<void> {
  await orchestrator.updateSessionPermissionMode(sessionId, mode)
}

export async function respondAgentRuntimePermission(input: {
  sessionId: string
  requestId: string
  behavior: 'allow' | 'deny'
  alwaysAllow: boolean
}): Promise<boolean> {
  return await orchestrator.respondRuntimePermission(input)
}

export function listAgentRuntimeCapabilitiesDiagnostics(): AgentRuntimeCapabilitiesDiagnostic[] {
  const capabilitiesByKind = new Map<CodingAgentRuntimeKind, CodingAgentRuntimeCapabilities>(
    runtimeRegistry.listCapabilities().map((capabilities) => [capabilities.runtimeKind, capabilities]),
  )
  const runtimeKinds: CodingAgentRuntimeKind[] = ['claude-code', 'codex', 'opencode']

  return runtimeKinds.map((runtimeKind) => {
    const capabilities = capabilitiesByKind.get(runtimeKind)
    const featureEnabled = isRuntimeFeatureEnabled(runtimeKind)
    const registered = capabilities != null
    return {
      runtimeKind,
      featureEnabled,
      registered,
      available: featureEnabled && registered,
      capabilities: capabilities ? runtimeCapabilityNames(capabilities) : [],
      message: buildRuntimeDiagnosticMessage(runtimeKind, featureEnabled, registered),
    }
  })
}

export function getAgentOpencodeServerStatusDiagnostic(): AgentOpencodeServerStatus {
  const featureEnabled = process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME === '1'
  const registered = runtimeRegistry.get('opencode') != null
  const status = opencodeRuntime?.getServerStatus()
  if (featureEnabled && registered && status) {
    return {
      runtimeKind: 'opencode',
      featureEnabled,
      state: status.state === 'idle' ? 'not_started' : status.state,
      version: status.version,
      endpoint: status.endpoint,
      ...(status.mcp ? { mcp: toAgentOpencodeMcpStatusSummary(status.mcp) } : {}),
      message: status.lastError
        ? `opencode server 最近错误: ${status.lastError}`
        : 'opencode server 状态来自当前 runtime manager；诊断不读取 resolved provider/config 原文。',
      updatedAt: new Date(status.updatedAt).toISOString(),
    }
  }

  return {
    runtimeKind: 'opencode',
    featureEnabled,
    state: featureEnabled ? (registered ? 'not_started' : 'not_configured') : 'disabled',
    message: featureEnabled
      ? registered
        ? '真实 opencode serve 已接入，server 会在 opencode 会话运行时按需启动；诊断不读取 resolved provider/config 原文。'
        : 'opencode runtime feature flag 已启用，但当前进程未注册 runtime。'
      : 'opencode runtime feature flag 未启用。',
    updatedAt: new Date().toISOString(),
  }
}

function toAgentOpencodeMcpStatusSummary(status: {
  configuredCount: number
  statusCount?: number
  connectedCount?: number
  skippedCount: number
  serverNames: string[]
  statuses?: Record<string, string>
  skipped?: Array<{ name: string; reason: string }>
}): AgentOpencodeMcpStatusSummary {
  return {
    configuredCount: status.configuredCount,
    ...(status.statusCount !== undefined ? { statusCount: status.statusCount } : {}),
    ...(status.connectedCount !== undefined ? { connectedCount: status.connectedCount } : {}),
    skippedCount: status.skippedCount,
    serverNames: status.serverNames,
    ...(status.statuses ? { statuses: normalizeOpencodeMcpStatuses(status.statuses) } : {}),
    ...(status.skipped ? { skipped: status.skipped } : {}),
  }
}

function normalizeOpencodeMcpStatuses(statuses: Record<string, string>): AgentOpencodeMcpStatusSummary['statuses'] {
  const next: NonNullable<AgentOpencodeMcpStatusSummary['statuses']> = {}
  for (const [name, status] of Object.entries(statuses)) {
    next[name] = status === 'connected'
      || status === 'disabled'
      || status === 'failed'
      || status === 'needs_auth'
      || status === 'needs_client_registration'
      ? status
      : 'unknown'
  }
  return next
}

export function refreshAgentOpencodeModelsDiagnostic(): AgentOpencodeModelRefreshResult {
  return {
    ok: false,
    models: [],
    error: 'Phase 6 暂不从 opencode /provider 或 /config/providers 刷新模型，避免读取 resolved secret；请在设置中手动填写 provider/model。',
    updatedAt: new Date().toISOString(),
  }
}

function isRuntimeFeatureEnabled(runtimeKind: CodingAgentRuntimeKind): boolean {
  if (runtimeKind === 'codex') return process.env.CODEINSIGHTS_AGENT_CODEX_RUNTIME === '1'
  if (runtimeKind === 'opencode') return process.env.CODEINSIGHTS_AGENT_OPENCODE_RUNTIME === '1'
  return true
}

function runtimeCapabilityNames(capabilities: CodingAgentRuntimeCapabilities): string[] {
  const names: string[] = []
  if (capabilities.supportsStreamEvents) names.push('streamEvents')
  if (capabilities.supportsResumeThread) names.push('resumeThread')
  if (capabilities.supportsAbort) names.push('abort')
  if (capabilities.supportsQueueMessage) names.push('queueMessage')
  if (capabilities.supportsSetPermissionMode) names.push('setPermissionMode')
  if (capabilities.supportsPerToolPermission) names.push('perToolPermission')
  if (capabilities.supportsServerStatus) names.push('serverStatus')
  if (capabilities.supportsModelRefresh) names.push('modelRefresh')
  return names
}

function buildRuntimeDiagnosticMessage(
  runtimeKind: CodingAgentRuntimeKind,
  featureEnabled: boolean,
  registered: boolean,
): string | undefined {
  if (runtimeKind === 'claude-code') return 'Claude Code legacy runtime 已注册。'
  if (!featureEnabled) return `${runtimeKind} runtime feature flag 未启用。`
  if (!registered) return `${runtimeKind} runtime 未在当前进程注册。`
  if (runtimeKind === 'opencode') {
    return 'opencode 真实 server runtime 已接入；支持按需启动 server、事件流、恢复、中止和工具级权限。'
  }
  return undefined
}

// ===== 流式追加消息 =====

/**
 * 在 Agent 流式中追加发送消息
 *
 * 使用 'now' 优先级立即注入 SDK 并持久化。
 */
export async function queueAgentMessage(
  input: AgentQueueMessageInput,
  _webContents: WebContents,
): Promise<string> {
  return orchestrator.queueMessage(
    input.sessionId,
    input.userMessage,
    undefined,
    input.uuid,
    { interrupt: input.interrupt },
  )
}

// ===== 文件操作 =====

/**
 * 保存文件到 Agent session 工作目录
 *
 * 将 base64 编码的文件写入 session 的 cwd，供 Agent 通过 Read 工具读取。
 */
export function saveFilesToAgentSession(input: AgentSaveFilesInput): AgentSavedFile[] {
  const sessionDir = getAgentSessionWorkspacePath(input.workspaceSlug, input.sessionId)
  const results: AgentSavedFile[] = []
  const usedPaths = new Set<string>()

  for (const file of input.files) {
    let targetPath = join(sessionDir, file.filename)

    // 防止同名文件覆盖
    if (usedPaths.has(targetPath) || existsSync(targetPath)) {
      const dotIdx = file.filename.lastIndexOf('.')
      const baseName = dotIdx > 0 ? file.filename.slice(0, dotIdx) : file.filename
      const ext = dotIdx > 0 ? file.filename.slice(dotIdx) : ''
      let counter = 1
      let candidate = join(sessionDir, `${baseName}-${counter}${ext}`)
      while (usedPaths.has(candidate) || existsSync(candidate)) {
        counter++
        candidate = join(sessionDir, `${baseName}-${counter}${ext}`)
      }
      targetPath = candidate
    }
    usedPaths.add(targetPath)

    mkdirSync(dirname(targetPath), { recursive: true })
    const buffer = Buffer.from(file.data, 'base64')
    writeFileSync(targetPath, buffer)

    const actualFilename = targetPath.slice(sessionDir.length + 1)
    results.push({ filename: actualFilename, targetPath })
    console.log(`[Agent 服务] 文件已保存: ${targetPath} (${buffer.length} bytes)`)
  }

  return results
}

/**
 * 保存文件到工作区文件目录
 *
 * 将 base64 编码的文件写入工作区 workspace-files/ 目录，所有会话均可访问。
 */
export function saveFilesToWorkspaceFiles(input: AgentSaveWorkspaceFilesInput): AgentSavedFile[] {
  const wsFilesDir = getWorkspaceFilesDir(input.workspaceSlug)
  const results: AgentSavedFile[] = []
  const usedPaths = new Set<string>()

  for (const file of input.files) {
    let targetPath = join(wsFilesDir, file.filename)

    // 防止同名文件覆盖
    if (usedPaths.has(targetPath) || existsSync(targetPath)) {
      const dotIdx = file.filename.lastIndexOf('.')
      const baseName = dotIdx > 0 ? file.filename.slice(0, dotIdx) : file.filename
      const ext = dotIdx > 0 ? file.filename.slice(dotIdx) : ''
      let counter = 1
      let candidate = join(wsFilesDir, `${baseName}-${counter}${ext}`)
      while (usedPaths.has(candidate) || existsSync(candidate)) {
        counter++
        candidate = join(wsFilesDir, `${baseName}-${counter}${ext}`)
      }
      targetPath = candidate
    }
    usedPaths.add(targetPath)

    mkdirSync(dirname(targetPath), { recursive: true })
    const buffer = Buffer.from(file.data, 'base64')
    writeFileSync(targetPath, buffer)

    const actualFilename = targetPath.slice(wsFilesDir.length + 1)
    results.push({ filename: actualFilename, targetPath })
    console.log(`[Agent 服务] 工作区文件已保存: ${targetPath} (${buffer.length} bytes)`)
  }

  return results
}

/**
 * 配置路径工具
 *
 * 管理 CodeInsights 应用的本地配置文件路径。
 * 所有用户配置存储在 ~/.codeinsights/ 目录下。
 */

import { join } from 'node:path'
import { mkdirSync, existsSync, cpSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const CONFIG_DIR_NAMES = {
  production: '.codeinsights',
  development: '.codeinsights-dev',
} as const

const LEGACY_CONFIG_DIR_NAMES = {
  production: '.rv-insights',
  development: '.rv-insights-dev',
} as const

const CONFIG_DIR_OVERRIDE_ENV = 'CODEINSIGHTS_CONFIG_DIR'
const LEGACY_CONFIG_DIR_OVERRIDE_ENV = 'RV_INSIGHTS_CONFIG_DIR'
const DEV_MODE_ENV = 'CODEINSIGHTS_DEV'
const LEGACY_DEV_MODE_ENV = 'PROMA_DEV'

/**
 * 获取配置目录名称
 *
 * 开发模式下返回 '.codeinsights-dev'，正式版本返回 '.codeinsights'。
 *
 * 检测优先级：
 * 1. CODEINSIGHTS_DEV=1 环境变量（显式覆盖）
 * 2. Electron app.isPackaged（未打包 = 开发模式）
 * 3. 兜底 '.codeinsights'
 */
let _configDirName: string | undefined

export function getConfigDirName(): string {
  if (_configDirName === undefined) {
    if (process.env[DEV_MODE_ENV] === '1' || process.env[LEGACY_DEV_MODE_ENV] === '1') {
      _configDirName = CONFIG_DIR_NAMES.development
    } else {
      try {
        const { app } = require('electron')
        _configDirName = app.isPackaged ? CONFIG_DIR_NAMES.production : CONFIG_DIR_NAMES.development
      } catch {
        _configDirName = CONFIG_DIR_NAMES.production
      }
    }
    const mode = _configDirName === CONFIG_DIR_NAMES.development ? '开发模式' : '正式版本'
    console.log(`[配置] 配置目录: ~/${_configDirName}/（${mode}）`)
  }
  return _configDirName
}

/**
 * 获取配置目录路径
 *
 * 开发模式返回 ~/.codeinsights-dev/，正式版本返回 ~/.codeinsights/。
 * 如果目录不存在则自动创建。
 */
export function getConfigDir(): string {
  const overrideDir = process.env[CONFIG_DIR_OVERRIDE_ENV]?.trim()
  if (overrideDir) {
    if (!existsSync(overrideDir)) {
      mkdirSync(overrideDir, { recursive: true })
      console.log(`[配置] 已创建覆盖配置目录: ${overrideDir}`)
    }
    return overrideDir
  }

  const legacyOverrideDir = process.env[LEGACY_CONFIG_DIR_OVERRIDE_ENV]?.trim()
  if (legacyOverrideDir) {
    console.warn(`[配置] ${LEGACY_CONFIG_DIR_OVERRIDE_ENV} 已重命名为 ${CONFIG_DIR_OVERRIDE_ENV}，本次继续兼容旧环境变量。`)
    if (!existsSync(legacyOverrideDir)) {
      mkdirSync(legacyOverrideDir, { recursive: true })
      console.log(`[配置] 已创建旧环境变量指定的配置目录: ${legacyOverrideDir}`)
    }
    return legacyOverrideDir
  }

  const configDir = join(homedir(), getConfigDirName())

  if (!existsSync(configDir)) {
    const legacyConfigDir = getLegacyConfigDir()
    if (legacyConfigDir && existsSync(legacyConfigDir)) {
      cpSync(legacyConfigDir, configDir, { recursive: true, errorOnExist: false })
      console.log(`[配置] 已从旧配置目录迁移到: ${configDir}`)
    } else {
      mkdirSync(configDir, { recursive: true })
      console.log(`[配置] 已创建配置目录: ${configDir}`)
    }
  }

  return configDir
}

function getLegacyConfigDir(): string | null {
  const currentName = getConfigDirName()
  if (currentName === CONFIG_DIR_NAMES.development) return join(homedir(), LEGACY_CONFIG_DIR_NAMES.development)
  if (currentName === CONFIG_DIR_NAMES.production) return join(homedir(), LEGACY_CONFIG_DIR_NAMES.production)
  return null
}

/**
 * 获取渠道配置文件路径
 *
 * @returns ~/.codeinsights/channels.json
 */
export function getChannelsPath(): string {
  return join(getConfigDir(), 'channels.json')
}

/**
 * 获取对话索引文件路径
 *
 * @returns ~/.codeinsights/conversations.json
 */
export function getConversationsIndexPath(): string {
  return join(getConfigDir(), 'conversations.json')
}

/**
 * 获取对话消息目录路径
 *
 * 如果目录不存在则自动创建。
 *
 * @returns ~/.codeinsights/conversations/
 */
export function getConversationsDir(): string {
  const dir = join(getConfigDir(), 'conversations')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[配置] 已创建对话目录: ${dir}`)
  }

  return dir
}

/**
 * 获取指定对话的消息文件路径
 *
 * @param id 对话 ID
 * @returns ~/.codeinsights/conversations/{id}.jsonl
 */
export function getConversationMessagesPath(id: string): string {
  return join(getConversationsDir(), `${id}.jsonl`)
}

/**
 * 获取附件存储根目录
 *
 * 如果目录不存在则自动创建。
 *
 * @returns ~/.codeinsights/attachments/
 */
export function getAttachmentsDir(): string {
  const dir = join(getConfigDir(), 'attachments')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[配置] 已创建附件目录: ${dir}`)
  }

  return dir
}

/**
 * 获取指定对话的附件目录
 *
 * 如果目录不存在则自动创建。
 *
 * @param conversationId 对话 ID
 * @returns ~/.codeinsights/attachments/{conversationId}/
 */
export function getConversationAttachmentsDir(conversationId: string): string {
  const dir = join(getAttachmentsDir(), conversationId)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  return dir
}

/**
 * 解析附件相对路径为完整路径
 *
 * @param localPath 相对路径 {conversationId}/{uuid}.ext
 * @returns 完整路径 ~/.codeinsights/attachments/{conversationId}/{uuid}.ext
 */
export function resolveAttachmentPath(localPath: string): string {
  return join(getAttachmentsDir(), localPath)
}

/**
 * 获取应用设置文件路径
 *
 * @returns ~/.codeinsights/settings.json
 */
export function getSettingsPath(): string {
  return join(getConfigDir(), 'settings.json')
}

/**
 * 获取用户档案文件路径
 *
 * @returns ~/.codeinsights/user-profile.json
 */
export function getUserProfilePath(): string {
  return join(getConfigDir(), 'user-profile.json')
}

/**
 * 获取代理配置文件路径
 *
 * @returns ~/.codeinsights/proxy-settings.json
 */
export function getProxySettingsPath(): string {
  return join(getConfigDir(), 'proxy-settings.json')
}

/**
 * 获取系统提示词配置文件路径
 *
 * @returns ~/.codeinsights/system-prompts.json
 */
export function getSystemPromptsPath(): string {
  return join(getConfigDir(), 'system-prompts.json')
}

/**
 * 获取记忆配置文件路径
 *
 * @returns ~/.codeinsights/memory.json
 */
export function getMemoryConfigPath(): string {
  return join(getConfigDir(), 'memory.json')
}

/**
 * 获取 Chat 工具配置文件路径
 *
 * @returns ~/.codeinsights/chat-tools.json
 */
export function getChatToolsConfigPath(): string {
  return join(getConfigDir(), 'chat-tools.json')
}

/**
 * 获取 Agent 会话索引文件路径
 *
 * @returns ~/.codeinsights/agent-sessions.json
 */
export function getAgentSessionsIndexPath(): string {
  return join(getConfigDir(), 'agent-sessions.json')
}

/**
 * 获取 Agent 会话消息目录路径
 *
 * 如果目录不存在则自动创建。
 *
 * @returns ~/.codeinsights/agent-sessions/
 */
export function getAgentSessionsDir(): string {
  const dir = join(getConfigDir(), 'agent-sessions')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[配置] 已创建 Agent 会话目录: ${dir}`)
  }

  return dir
}

/**
 * 获取指定 Agent 会话的消息文件路径
 *
 * @param id 会话 ID
 * @returns ~/.codeinsights/agent-sessions/{id}.jsonl
 */
export function getAgentSessionMessagesPath(id: string): string {
  return join(getAgentSessionsDir(), `${id}.jsonl`)
}

/**
 * 获取指定 Agent 会话的 runtime event log 文件路径
 *
 * @param id 会话 ID
 * @returns ~/.codeinsights/agent-sessions/{id}.events.jsonl
 */
export function getAgentSessionEventsPath(id: string): string {
  return join(getAgentSessionsDir(), `${id}.events.jsonl`)
}

/**
 * 获取 Pipeline 会话索引文件路径
 *
 * @returns ~/.codeinsights/pipeline-sessions.json
 */
export function getPipelineSessionsIndexPath(): string {
  return join(getConfigDir(), 'pipeline-sessions.json')
}

/**
 * 获取 Pipeline 会话记录目录
 *
 * @returns ~/.codeinsights/pipeline-sessions/
 */
export function getPipelineSessionsDir(): string {
  const dir = join(getConfigDir(), 'pipeline-sessions')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[配置] 已创建 Pipeline 会话目录: ${dir}`)
  }

  return dir
}

/**
 * 获取指定 Pipeline 会话的记录文件路径
 *
 * @param id 会话 ID
 * @returns ~/.codeinsights/pipeline-sessions/{id}.jsonl
 */
export function getPipelineSessionRecordsPath(id: string): string {
  return join(getPipelineSessionsDir(), `${id}.jsonl`)
}

/**
 * 获取 Pipeline checkpoint 根目录
 *
 * @returns ~/.codeinsights/pipeline-checkpoints/
 */
export function getPipelineCheckpointsDir(): string {
  const dir = join(getConfigDir(), 'pipeline-checkpoints')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[配置] 已创建 Pipeline Checkpoint 目录: ${dir}`)
  }

  return dir
}

/**
 * 获取指定 Pipeline 会话的 checkpoint 目录
 *
 * @param sessionId 会话 ID
 * @returns ~/.codeinsights/pipeline-checkpoints/{sessionId}/
 */
export function getPipelineSessionCheckpointDir(sessionId: string): string {
  const dir = join(getPipelineCheckpointsDir(), sessionId)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  return dir
}

/**
 * 获取 Pipeline artifacts 根目录
 *
 * @returns ~/.codeinsights/pipeline-artifacts/
 */
export function getPipelineArtifactsDir(): string {
  const dir = join(getConfigDir(), 'pipeline-artifacts')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[配置] 已创建 Pipeline 产物目录: ${dir}`)
  }

  return dir
}

/**
 * 获取指定 Pipeline 会话的 artifacts 目录
 *
 * @param sessionId 会话 ID
 * @returns ~/.codeinsights/pipeline-artifacts/{sessionId}/
 */
export function getPipelineSessionArtifactsDir(sessionId: string): string {
  const dir = join(getPipelineArtifactsDir(), sessionId)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  return dir
}

/**
 * 获取贡献任务索引文件路径
 *
 * @returns ~/.codeinsights/contribution-tasks.json
 */
export function getContributionTasksIndexPath(): string {
  return join(getConfigDir(), 'contribution-tasks.json')
}

/**
 * 获取贡献任务事件目录
 *
 * @returns ~/.codeinsights/contribution-tasks/
 */
export function getContributionTaskEventsDir(): string {
  const dir = join(getConfigDir(), 'contribution-tasks')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[配置] 已创建贡献任务事件目录: ${dir}`)
  }

  return dir
}

/**
 * 获取指定贡献任务的事件 JSONL 路径
 *
 * @param id 贡献任务 ID
 * @returns ~/.codeinsights/contribution-tasks/{id}.jsonl
 */
export function getContributionTaskEventsPath(id: string): string {
  return join(getContributionTaskEventsDir(), `${id}.jsonl`)
}

/**
 * 获取 Agent 工作区索引文件路径
 *
 * @returns ~/.codeinsights/agent-workspaces.json
 */
export function getAgentWorkspacesIndexPath(): string {
  return join(getConfigDir(), 'agent-workspaces.json')
}

/**
 * 获取 Agent 工作区根目录路径
 *
 * 如果目录不存在则自动创建。
 *
 * @returns ~/.codeinsights/agent-workspaces/
 */
export function getAgentWorkspacesDir(): string {
  const dir = join(getConfigDir(), 'agent-workspaces')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[配置] 已创建 Agent 工作区目录: ${dir}`)
  }

  return dir
}

/**
 * 获取指定 Agent 工作区的目录路径
 *
 * 如果目录不存在则自动创建。
 *
 * @param slug 工作区 slug
 * @returns ~/.codeinsights/agent-workspaces/{slug}/
 */
export function getAgentWorkspacePath(slug: string): string {
  const dir = join(getAgentWorkspacesDir(), slug)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[配置] 已创建 Agent 工作区: ${dir}`)
  }

  return dir
}

/**
 * 获取指定工作区的 MCP 配置文件路径
 *
 * @param slug 工作区 slug
 * @returns ~/.codeinsights/agent-workspaces/{slug}/mcp.json
 */
export function getWorkspaceMcpPath(slug: string): string {
  return join(getAgentWorkspacePath(slug), 'mcp.json')
}

/**
 * 获取指定工作区的 Skills 目录路径
 *
 * 如果目录不存在则自动创建。
 *
 * @param slug 工作区 slug
 * @returns ~/.codeinsights/agent-workspaces/{slug}/skills/
 */
export function getWorkspaceSkillsDir(slug: string): string {
  const dir = join(getAgentWorkspacePath(slug), 'skills')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  return dir
}

/**
 * 获取工作区文件目录路径
 *
 * 工作区内所有会话可访问的文件存放于此。
 * 如果目录不存在则自动创建。
 *
 * @param slug 工作区 slug
 * @returns ~/.codeinsights/agent-workspaces/{slug}/workspace-files/
 */
export function getWorkspaceFilesDir(slug: string): string {
  const dir = join(getAgentWorkspacePath(slug), 'workspace-files')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  return dir
}

/**
 * 获取工作区不活跃 Skills 目录路径
 *
 * 禁用的 Skill 会被移动到此目录，Agent SDK 不会扫描该目录。
 * 如果目录不存在则自动创建。
 *
 * @param slug 工作区 slug
 * @returns ~/.codeinsights/agent-workspaces/{slug}/skills-inactive/
 */
export function getInactiveSkillsDir(slug: string): string {
  const dir = join(getAgentWorkspacePath(slug), 'skills-inactive')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  return dir
}

/**
 * 获取默认 Skills 模板目录路径
 *
 * 新建工作区时自动复制此目录的内容到工作区 skills/ 下。
 *
 * @returns ~/.codeinsights/default-skills/
 */
export function getDefaultSkillsDir(): string {
  const dir = join(getConfigDir(), 'default-skills')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  return dir
}

/**
 * 从 SKILL.md 的 YAML frontmatter 中解析 version 字段
 *
 * 无 version 字段时返回 '0.0.0'（确保旧 Skill 会被更新）。
 */
export function parseSkillVersion(skillDir: string): string {
  const skillMdPath = join(skillDir, 'SKILL.md')
  if (!existsSync(skillMdPath)) return '0.0.0'

  try {
    const content = readFileSync(skillMdPath, 'utf-8')
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
    if (!fmMatch?.[1]) return '0.0.0'

    for (const line of fmMatch[1].split('\n')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
      if (key === 'version' && value) return value
    }
  } catch {
    // 解析失败视为最低版本
  }

  return '0.0.0'
}

/**
 * 比较两个 semver 版本字符串
 *
 * @returns 正数表示 a > b，0 表示相等，负数表示 a < b
 */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * 从 app bundle 同步默认 Skills 到 ~/.codeinsights/default-skills/
 *
 * 打包模式下从 process.resourcesPath/default-skills 复制。
 * 开发模式下从源码 default-skills/ 目录复制。
 *
 * - 缺失的 Skill：直接复制
 * - 已存在的 Skill：比较 version，bundled 版本更新时覆盖
 */
export function seedDefaultSkills(): void {
  const { app } = require('electron')
  const bundledDir = app.isPackaged
    ? join(process.resourcesPath, 'default-skills')
    : join(__dirname, '../default-skills')

  if (!existsSync(bundledDir)) {
    console.log('[配置] 未找到内置 default-skills 目录，跳过')
    return
  }

  const userDir = getDefaultSkillsDir()

  try {
    const entries = readdirSync(bundledDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const source = join(bundledDir, entry.name)
      const target = join(userDir, entry.name)

      if (!existsSync(target)) {
        // 缺失的 Skill：直接复制
        cpSync(source, target, { recursive: true })
        console.log(`[配置] 已同步默认 Skill: ${entry.name}`)
      } else {
        // 已存在：比较版本，bundled 更新时覆盖
        const bundledVer = parseSkillVersion(source)
        const existingVer = parseSkillVersion(target)

        if (compareSemver(bundledVer, existingVer) > 0) {
          cpSync(source, target, { recursive: true, force: true })
          console.log(`[配置] 已升级默认 Skill: ${entry.name} (${existingVer} → ${bundledVer})`)
        }
      }
    }
  } catch (err) {
    console.warn('[配置] 同步默认 Skills 失败:', err)
  }
}

/**
 * 获取微信配置文件路径
 *
 * @returns ~/.codeinsights/wechat.json
 */
export function getWeChatConfigPath(): string {
  return join(getConfigDir(), 'wechat.json')
}

/**
 * 获取微信长轮询同步游标路径
 *
 * @returns ~/.codeinsights/wechat-sync.json
 */
export function getWeChatSyncPath(): string {
  return join(getConfigDir(), 'wechat-sync.json')
}

/**
 * 获取钉钉配置文件路径
 *
 * @returns ~/.codeinsights/dingtalk.json
 */
export function getDingTalkConfigPath(): string {
  return join(getConfigDir(), 'dingtalk.json')
}

/**
 * 获取飞书配置文件路径
 *
 * @returns ~/.codeinsights/feishu.json
 */
export function getFeishuConfigPath(): string {
  return join(getConfigDir(), 'feishu.json')
}

/**
 * 获取飞书聊天绑定持久化路径
 *
 * @returns ~/.codeinsights/feishu-bindings.json
 */
export function getFeishuBindingsPath(): string {
  return join(getConfigDir(), 'feishu-bindings.json')
}

/**
 * 获取某个飞书 Bot 的聊天绑定持久化路径
 *
 * @returns ~/.codeinsights/feishu-bindings-{botId}.json
 */
export function getFeishuBotBindingsPath(botId: string): string {
  return join(getConfigDir(), `feishu-bindings-${botId}.json`)
}

/**
 * 获取外部 Agent Channel 绑定索引路径
 *
 * @returns ~/.codeinsights/agent-channel-bindings.json
 */
export function getAgentChannelBindingsPath(): string {
  return join(getConfigDir(), 'agent-channel-bindings.json')
}

/**
 * 获取外部 Agent Channel 绑定事件日志路径
 *
 * @returns ~/.codeinsights/agent-channel-bindings.events.jsonl
 */
export function getAgentChannelBindingEventsPath(): string {
  return join(getConfigDir(), 'agent-channel-bindings.events.jsonl')
}

/**
 * 获取指定 Agent 会话的工作路径
 *
 * 在工作区目录下创建以 sessionId 命名的子文件夹，
 * 作为该会话的独立 Agent cwd。如果目录不存在则自动创建。
 *
 * @param workspaceSlug 工作区 slug
 * @param sessionId 会话 ID
 * @returns ~/.codeinsights/agent-workspaces/{slug}/{sessionId}/
 */
export function getAgentSessionWorkspacePath(workspaceSlug: string, sessionId: string): string {
  const dir = join(getAgentWorkspacePath(workspaceSlug), sessionId)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[配置] 已创建 Agent 会话工作目录: ${dir}`)
  }

  return dir
}

/**
 * 获取新 session 的 runtime cwd 路径
 *
 * 新 session 默认使用 ~/.codeinsights/agent-workspaces/{slug}/sessions/{sessionId}/cwd/
 */
export function getAgentSessionRuntimeCwdPath(workspaceSlug: string, sessionId: string): string {
  return join(getAgentWorkspacePath(workspaceSlug), 'sessions', sessionId, 'cwd')
}

/**
 * 获取新 session 的 runtime manifest 路径
 */
export function getAgentSessionRuntimeManifestPath(workspaceSlug: string, sessionId: string): string {
  return join(getAgentWorkspacePath(workspaceSlug), 'sessions', sessionId, 'runtime-manifest.json')
}

/**
 * 获取 SDK 隔离配置目录路径
 *
 * 用于设置 CLAUDE_CONFIG_DIR 环境变量，让 SDK 读取独立的配置文件，
 * 而不是用户的 ~/.claude.json，实现 CodeInsights 与 Claude Code CLI 的配置隔离。
 *
 * 如果目录不存在则自动创建。
 *
 * @returns ~/.codeinsights/sdk-config/
 */
export function getSdkConfigDir(): string {
  const dir = join(getConfigDir(), 'sdk-config')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    console.log(`[配置] 已创建 SDK 配置目录: ${dir}`)
  }

  return dir
}

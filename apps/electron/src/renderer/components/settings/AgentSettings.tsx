/**
 * AgentSettings - Agent 设置页
 *
 * 包含两个区块：
 * 1. MCP 服务器 — 管理当前工作区的 MCP 服务器配置
 * 2. Skills — 只读展示当前工作区的 Skill 列表
 *
 * 视图模式：list / create / edit（复用 ChannelSettings 的模式）
 */

import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Plus, Plug, Pencil, Trash2, Sparkles, FolderOpen, MessageSquare, ShieldCheck, ChevronDown, ChevronRight, Brain, ImagePlus, Settings, RefreshCw, Search, KeyRound, Globe2, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
  agentChannelIdAtom,
  agentModelIdAtom,
  agentSessionsAtom,
  currentAgentSessionIdAtom,
  agentPendingPromptAtom,
  workspaceCapabilitiesVersionAtom,
  agentThinkingAtom,
  agentEffortAtom,
  agentMaxBudgetUsdAtom,
  agentMaxTurnsAtom,
  agentRuntimeKindAtom,
  agentCodexChannelIdAtom,
  agentCodexModelIdAtom,
  agentCodexReasoningEffortAtom,
  agentCodexNetworkAccessEnabledAtom,
  agentCodexWebSearchModeAtom,
  agentOpencodeChannelIdAtom,
  agentOpencodeModelIdAtom,
  agentOpencodeAgentNameAtom,
  agentOpencodeUseNativeAuthAtom,
  agentOpencodeAutoupdateAtom,
  agentOpencodeSnapshotEnabledAtom,
} from '@/atoms/agent-atoms'
import { settingsTabAtom, settingsOpenAtom } from '@/atoms/settings-tab'
import { appModeAtom } from '@/atoms/app-mode'
import { chatToolsAtom } from '@/atoms/chat-tool-atoms'
import { channelsAtom } from '@/atoms/chat-atoms'
import type { AgentOpencodeModelRefreshResult, AgentOpencodeServerStatus, AgentRuntimeCapabilitiesDiagnostic, Channel, CodingAgentRuntimeKind, McpServerEntry, SkillMeta, OtherWorkspaceSkillsGroup, WorkspaceMcpConfig, ThinkingConfig, AgentEffort } from '@codeinsights/shared'
import type { AgentCodexReasoningEffort, AgentCodexWebSearchMode } from '@/types/settings'
import { SettingsSection, SettingsCard, SettingsRow, SettingsSegmentedControl, SettingsInput } from './primitives'
import { McpServerForm } from './McpServerForm'
import { getSettingsDeleteDialogCopy } from './settings-ui-model'
import { CODEX_NATIVE_AUTH_SELECT_VALUE, OPENCODE_NATIVE_AUTH_SELECT_VALUE, getCodexCompatibleChannels, getOpencodeCompatibleChannels, isAgentCodexRuntimeFeatureEnabled, isAgentOpencodeRuntimeFeatureEnabled } from '@/lib/agent-runtime-ui'

/** 组件视图模式 */
type ViewMode = 'list' | 'create' | 'edit'

/** 编辑中的服务器信息 */
interface EditingServer {
  name: string
  entry: McpServerEntry
}

interface DeleteTarget {
  kind: 'mcp' | 'skill'
  id: string
  name: string
}

export function AgentSettings(): React.ReactElement {
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const agentChannelId = useAtomValue(agentChannelIdAtom)
  const agentModelId = useAtomValue(agentModelIdAtom)
  const setAgentSessions = useSetAtom(agentSessionsAtom)
  const setCurrentSessionId = useSetAtom(currentAgentSessionIdAtom)
  const setPendingPrompt = useSetAtom(agentPendingPromptAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setAppMode = useSetAtom(appModeAtom)
  const bumpCapabilitiesVersion = useSetAtom(workspaceCapabilitiesVersionAtom)

  // 派生当前工作区 slug
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId)
  const workspaceSlug = currentWorkspace?.slug ?? ''

  // 视图模式
  const [viewMode, setViewMode] = React.useState<ViewMode>('list')
  const [editingServer, setEditingServer] = React.useState<EditingServer | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  // MCP 配置
  const [mcpConfig, setMcpConfig] = React.useState<WorkspaceMcpConfig>({ servers: {} })
  const [skills, setSkills] = React.useState<SkillMeta[]>([])
  const [skillsDir, setSkillsDir] = React.useState('')
  const [otherWorkspaces, setOtherWorkspaces] = React.useState<OtherWorkspaceSkillsGroup[]>([])
  const [showImportDialog, setShowImportDialog] = React.useState(false)
  const [importingSkill, setImportingSkill] = React.useState<string | null>(null)
  const [updatingSkill, setUpdatingSkill] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  /** 加载 MCP 配置和 Skills */
  const loadData = React.useCallback(async () => {
    if (!workspaceSlug) {
      setLoading(false)
      return
    }

    try {
      const [config, skillList, dir] = await Promise.all([
        window.electronAPI.getWorkspaceMcpConfig(workspaceSlug),
        window.electronAPI.getWorkspaceSkills(workspaceSlug),
        window.electronAPI.getWorkspaceSkillsDir(workspaceSlug),
      ])
      setMcpConfig(config)
      setSkills(skillList)
      setSkillsDir(dir)
    } catch (error) {
      console.error('[Agent 设置] 加载工作区配置失败:', error)
    } finally {
      setLoading(false)
    }
  }, [workspaceSlug])

  /** 懒加载其他工作区 Skill（打开导入弹窗时触发） */
  const loadOtherWorkspaces = React.useCallback(async () => {
    if (!workspaceSlug) return
    try {
      const groups = await window.electronAPI.getOtherWorkspaceSkills(workspaceSlug)
      setOtherWorkspaces(groups)
    } catch (error) {
      console.error('[Agent 设置] 加载其他工作区 Skill 失败:', error)
    }
  }, [workspaceSlug])

  React.useEffect(() => {
    if (showImportDialog) {
      void loadOtherWorkspaces()
    }
  }, [showImportDialog, loadOtherWorkspaces])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // 无工作区时提示
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FolderOpen size={48} className="text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">
          请先在 Agent 模式下选择或创建一个工作区
        </p>
      </div>
    )
  }

  /** 配置目录名称：开发模式用 .codeinsights-dev，正式版用 .codeinsights */
  const configDirName = import.meta.env.DEV ? '.codeinsights-dev' : '.codeinsights'

  /** 构建 MCP 配置提示词 */
  const buildMcpPrompt = (): string => {
    const configPath = `~/${configDirName}/agent-workspaces/${workspaceSlug}/mcp.json`
    const currentConfig = JSON.stringify(mcpConfig, null, 2)

    return `请帮我配置当前工作区的 MCP 服务器，你要主动来帮我实现，你可以采用联网搜索深度研究来尝试，当前环境已经有 Claude Agent SDK 了，除非不确定的时候才来问我，否则默认将帮我完成安装，而不是指导我。

## 工作区信息
- 工作区: ${currentWorkspace.name}
- MCP 配置文件: ${configPath}

## 当前配置
\`\`\`json
${currentConfig}
\`\`\`

## 配置格式
mcp.json 格式如下：
\`\`\`json
{
  "servers": {
    "服务器名称": {
      "type": "stdio | http | sse",
      "command": "可执行命令",
      "args": ["参数1", "参数2"],
      "env": { "KEY": "VALUE" },
      "url": "http://...",
      "headers": { "Key": "Value" },
      "enabled": true
    }
  }
}
\`\`\`
其中 stdio 类型使用 command/args/env，http/sse 类型使用 url/headers。

请读取当前配置文件，根据我的需求添加或修改 MCP 服务器，然后写回文件。`
  }

  /** 构建 Skill 配置提示词 */
  const buildSkillPrompt = (): string => {
    const skillsDir = `~/${configDirName}/agent-workspaces/${workspaceSlug}/skills/`
    const skillList = skills.length > 0
      ? skills.map((s) => `- ${s.name}: ${s.description ?? '无描述'}`).join('\n')
      : '暂无 Skill'

    return `请帮我配置当前工作区的 Skills，你要主动来帮我实，现你可以采用联网搜索深度研究来尝试，当前环境已经有 Claude Agent SDK 了，除非不确定的时候才来问我，否则默认将帮我完成安装，而不是指导我。

## 工作区信息
- 工作区: ${currentWorkspace.name}
- Skills 目录: ${skillsDir}

## Skill 格式
每个 Skill 是 skills/ 目录下的一个子目录，目录名即 slug。
目录内包含 SKILL.md 文件，格式：

\`\`\`markdown
---
name: Skill 显示名称
description: 简要描述
---

Skill 的详细指令内容...
\`\`\`

## 当前 Skills
${skillList}

请查看 skills/ 目录了解现有配置，根据我的需求创建或编辑 Skill。`
  }

  /** 通过 Agent 对话完成配置 */
  const handleConfigViaChat = async (promptMessage: string): Promise<void> => {
    if (!agentChannelId) {
      alert('请先在渠道设置中选择 Agent 供应商')
      return
    }

    try {
      // 创建新会话
      const session = await window.electronAPI.createAgentSession(
        undefined,
        agentChannelId,
        currentWorkspaceId ?? undefined,
      )

      // 刷新会话列表
      const sessions = await window.electronAPI.listAgentSessions()
      setAgentSessions(sessions)

      // 设置当前会话
      setCurrentSessionId(session.id)

      // 设置 pending prompt
      setPendingPrompt({ sessionId: session.id, message: promptMessage })

      // 跳转到 Agent 对话视图
      setAppMode('agent')
      setSettingsOpen(false)
    } catch (error) {
      console.error('[Agent 设置] 创建配置会话失败:', error)
    }
  }

  /** 删除 MCP 服务器 */
  const requestDeleteMcp = (serverName: string): void => {
    // 内置 MCP 不可删除
    const entry = mcpConfig.servers[serverName]
    if (entry?.isBuiltin) return
    setDeleteError(null)
    setDeleteTarget({ kind: 'mcp', id: serverName, name: serverName })
  }

  const deleteMcpServer = async (serverName: string): Promise<void> => {
    try {
      const newServers = { ...mcpConfig.servers }
      delete newServers[serverName]
      const newConfig: WorkspaceMcpConfig = { servers: newServers }
      await window.electronAPI.saveWorkspaceMcpConfig(workspaceSlug, newConfig)
      setMcpConfig(newConfig)
      bumpCapabilitiesVersion((v) => v + 1)
    } catch (error) {
      console.error('[Agent 设置] 删除 MCP 服务器失败:', error)
      throw error
    }
  }

  /** 切换 MCP 服务器启用状态 */
  const handleToggle = async (serverName: string): Promise<void> => {
    try {
      const entry = mcpConfig.servers[serverName]
      if (!entry) return

      const newConfig: WorkspaceMcpConfig = {
        servers: {
          ...mcpConfig.servers,
          [serverName]: { ...entry, enabled: !entry.enabled },
        },
      }
      await window.electronAPI.saveWorkspaceMcpConfig(workspaceSlug, newConfig)
      setMcpConfig(newConfig)
      bumpCapabilitiesVersion((v) => v + 1)
    } catch (error) {
      console.error('[Agent 设置] 切换 MCP 服务器状态失败:', error)
    }
  }

  /** 删除 Skill */
  const requestDeleteSkill = (skillSlug: string, skillName: string): void => {
    setDeleteError(null)
    setDeleteTarget({ kind: 'skill', id: skillSlug, name: skillName })
  }

  const deleteSkill = async (skillSlug: string): Promise<void> => {
    try {
      await window.electronAPI.deleteWorkspaceSkill(workspaceSlug, skillSlug)
      setSkills((prev) => prev.filter((s) => s.slug !== skillSlug))
      bumpCapabilitiesVersion((v) => v + 1)
    } catch (error) {
      console.error('[Agent 设置] 删除 Skill 失败:', error)
      throw error
    }
  }

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      if (deleteTarget.kind === 'mcp') {
        await deleteMcpServer(deleteTarget.id)
      } else {
        await deleteSkill(deleteTarget.id)
      }
      setDeleteTarget(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '删除失败，请稍后重试')
    } finally {
      setDeleting(false)
    }
  }

  /** 切换 Skill 启用/禁用 */
  const handleToggleSkill = async (skillSlug: string, enabled: boolean): Promise<void> => {
    try {
      await window.electronAPI.toggleWorkspaceSkill(workspaceSlug, skillSlug, enabled)
      setSkills((prev) => prev.map((s) => s.slug === skillSlug ? { ...s, enabled } : s))
      bumpCapabilitiesVersion((v) => v + 1)
    } catch (error) {
      console.error('[Agent 设置] 切换 Skill 状态失败:', error)
    }
  }

  /** 从其他工作区导入 Skill */
  const handleImportSkill = async (sourceSlug: string, skillSlug: string): Promise<void> => {
    if (!workspaceSlug || importingSkill) return

    setImportingSkill(skillSlug)
    try {
      const imported = await window.electronAPI.importSkillFromWorkspace(workspaceSlug, sourceSlug, skillSlug)
      setSkills((prev) => prev.some((skill) => skill.slug === imported.slug) ? prev : [...prev, imported])
      bumpCapabilitiesVersion((v) => v + 1)
      setShowImportDialog(false)
      toast.success(`已导入 Skill: ${imported.name}`)
    } catch (error) {
      console.error('[Agent 设置] 导入 Skill 失败:', error)
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('导入 Skill 失败', { description: message })
    } finally {
      setImportingSkill(null)
    }
  }

  /** 从源工作区同步更新已导入的 Skill */
  const handleUpdateSkill = async (skillSlug: string): Promise<void> => {
    if (!workspaceSlug || updatingSkill) return

    setUpdatingSkill(skillSlug)
    try {
      const updated = await window.electronAPI.updateSkillFromSource(workspaceSlug, skillSlug)
      setSkills((prev) => prev.map((s) => s.slug === skillSlug ? updated : s))
      bumpCapabilitiesVersion((v) => v + 1)
      toast.success(`已同步更新 Skill: ${updated.name}`)
    } catch (error) {
      console.error('[Agent 设置] 更新 Skill 失败:', error)
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error('更新 Skill 失败', { description: message })
    } finally {
      setUpdatingSkill(null)
    }
  }

  /** 表单保存回调 */
  const handleFormSaved = (): void => {
    setViewMode('list')
    setEditingServer(null)
    loadData()
    bumpCapabilitiesVersion((v) => v + 1)
  }

  /** 取消表单 */
  const handleFormCancel = (): void => {
    setViewMode('list')
    setEditingServer(null)
  }

  // 表单视图
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <McpServerForm
        server={editingServer}
        workspaceSlug={workspaceSlug}
        onSaved={handleFormSaved}
        onCancel={handleFormCancel}
      />
    )
  }

  const serverEntries = Object.entries(mcpConfig.servers ?? {}).filter(
    ([name]) => name !== 'memos-cloud', // 记忆功能已迁移到独立配置，隐藏旧 MCP 条目
  )
  const deleteCopy = deleteTarget ? getSettingsDeleteDialogCopy(deleteTarget) : null

  // 列表视图
  return (
    <div className="space-y-8">
      {/* 区块：Agent Runtime */}
      <AgentRuntimeSettings />

      {/* 区块零：Agent 高级设置 */}
      <AgentAdvancedSettings />

      {/* 区块零点五：内置工具状态 */}
      <BuiltinAgentTools />

      {/* 区块一：MCP 服务器 */}
      <SettingsSection
        title="MCP 服务器"
        description={`当前工作区: ${currentWorkspace.name}`}
        action={
          <Button size="sm" onClick={() => setViewMode('create')}>
            <Plus size={16} />
            <span>添加服务器</span>
          </Button>
        }
      >
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">加载中...</div>
        ) : serverEntries.length === 0 ? (
          <SettingsCard divided={false}>
            <div className="text-sm text-muted-foreground py-12 text-center">
              还没有配置任何 MCP 服务器，点击上方"添加服务器"开始
            </div>
          </SettingsCard>
        ) : (
          <SettingsCard>
            {serverEntries.map(([name, entry]) => (
              <McpServerRow
                key={name}
                name={name}
                entry={entry}
                onEdit={() => {
                  setEditingServer({ name, entry })
                  setViewMode('edit')
                }}
                onDelete={() => requestDeleteMcp(name)}
                onToggle={() => handleToggle(name)}
              />
            ))}
          </SettingsCard>
        )}
      </SettingsSection>

      <Button
        size="sm"
        className="w-full"
        onClick={() => handleConfigViaChat(buildMcpPrompt())}
      >
        <MessageSquare size={14} />
        <span>跟 CodeInsights Agent 对话完成配置</span>
      </Button>

      {/* 区块二：Skills（只读） */}
      <SettingsSection
        title="Skills"
        description="将 SKILL.md 放入工作区 skills/ 目录即可被 Agent 自动发现"
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)}>
              <Plus size={16} />
              <span>从其他工作区导入</span>
            </Button>
            {skillsDir && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => window.electronAPI.openFile(skillsDir)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <FolderOpen size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>打开 Skills 目录</TooltipContent>
              </Tooltip>
            )}
          </div>
        }
      >
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">加载中...</div>
        ) : skills.length === 0 ? (
          <SettingsCard divided={false}>
            <div className="text-sm text-muted-foreground py-8 text-center">
              暂无 Skill
            </div>
          </SettingsCard>
        ) : (
          <SkillGroupedList
            skills={skills}
            skillsDir={skillsDir}
            onDelete={requestDeleteSkill}
            onToggle={handleToggleSkill}
            onUpdate={handleUpdateSkill}
          />
        )}

        <Button
          size="sm"
          className="w-full"
          onClick={() => handleConfigViaChat(buildSkillPrompt())}
        >
          <MessageSquare size={14} />
          <span>跟 CodeInsights Agent 对话完成配置</span>
        </Button>
      </SettingsSection>

      <ImportSkillFromWorkspaceDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        otherWorkspaces={otherWorkspaces}
        installedSkills={skills}
        importingSkill={importingSkill}
        onImport={handleImportSkill}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteCopy?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCopy?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg">
              {deleteError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} onClick={() => setDeleteTarget(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteConfirm()
              }}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===== MCP 服务器行子组件 =====

/** 传输类型显示标签 */
const TRANSPORT_LABELS: Record<string, string> = {
  stdio: 'stdio',
  http: 'HTTP',
  sse: 'SSE',
}

interface McpServerRowProps {
  name: string
  entry: McpServerEntry
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

function McpServerRow({ name, entry, onEdit, onDelete, onToggle }: McpServerRowProps): React.ReactElement {
  const isBuiltin = entry.isBuiltin === true

  return (
    <SettingsRow
      label={name}
      icon={<Plug size={18} className="text-blue-500" />}
      description={entry.type === 'stdio' ? entry.command : entry.url}
      className="group"
    >
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        {isBuiltin && (
          <span className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
            <ShieldCheck size={12} />
            内置
          </span>
        )}
        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
          {TRANSPORT_LABELS[entry.type] ?? entry.type}
        </span>
        <button
          onClick={onEdit}
          aria-label={`编辑 MCP 服务器 ${name}`}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          title="编辑"
        >
          <Pencil size={14} />
        </button>
        {!isBuiltin && (
          <button
            onClick={onDelete}
            aria-label={`删除 MCP 服务器 ${name}`}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        )}
        <Switch
          checked={entry.enabled}
          onCheckedChange={onToggle}
          aria-label={`${entry.enabled ? '禁用' : '启用'} MCP 服务器 ${name}`}
        />
      </div>
    </SettingsRow>
  )
}

// ===== Skills 分组列表子组件 =====

/** 分组结果 */
interface SkillGroup {
  prefix: string
  skills: SkillMeta[]
}

/** 按前缀对 Skills 分组 */
function groupSkillsByPrefix(skills: SkillMeta[]): SkillGroup[] {
  const prefixMap = new Map<string, SkillMeta[]>()

  for (const skill of skills) {
    const dashIdx = skill.slug.indexOf('-')
    const prefix = dashIdx > 0 ? skill.slug.slice(0, dashIdx) : ''
    const key = prefix || skill.slug
    const list = prefixMap.get(key) ?? []
    list.push(skill)
    prefixMap.set(key, list)
  }

  const groups: SkillGroup[] = []
  const standalone: SkillMeta[] = []

  for (const [prefix, list] of prefixMap) {
    if (list.length >= 2) {
      groups.push({ prefix, skills: list })
    } else {
      standalone.push(...list)
    }
  }

  // 独立 skill 合为一个无前缀组
  if (standalone.length > 0) {
    groups.push({ prefix: '', skills: standalone })
  }

  return groups
}

/** 从 slug 中移除前缀得到短名称 */
function shortName(slug: string, prefix: string): string {
  if (!prefix) return slug
  return slug.startsWith(prefix + '-') ? slug.slice(prefix.length + 1) : slug
}

interface SkillGroupedListProps {
  skills: SkillMeta[]
  skillsDir: string
  onDelete: (slug: string, name: string) => void
  onToggle: (slug: string, enabled: boolean) => void
  onUpdate: (slug: string) => void
}

function SkillGroupedList({ skills, skillsDir, onDelete, onToggle, onUpdate }: SkillGroupedListProps): React.ReactElement {
  const groups = React.useMemo(() => groupSkillsByPrefix(skills), [skills])
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set())
  const [expandedSkill, setExpandedSkill] = React.useState<string | null>(null)

  const toggleGroup = (prefix: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(prefix)) next.delete(prefix)
      else next.add(prefix)
      return next
    })
  }

  const openSkillFolder = (slug: string) => {
    if (skillsDir) {
      window.electronAPI.openFile(`${skillsDir}/${slug}`)
    }
  }

  return (
    <div className="space-y-2 min-w-0">
      {groups.map((group) =>
        group.prefix ? (
          <SkillGroupCard
            key={group.prefix}
            group={group}
            expanded={expandedGroups.has(group.prefix)}
            expandedSkill={expandedSkill}
            onToggle={() => toggleGroup(group.prefix)}
            onExpandSkill={(slug) => setExpandedSkill(expandedSkill === slug ? null : slug)}
            onDelete={onDelete}
            onToggleEnabled={onToggle}
            onOpenFolder={openSkillFolder}
            onUpdate={onUpdate}
          />
        ) : (
          /* 独立 skill 不分组，平铺展示 */
          <SettingsCard key="__standalone__">
            {group.skills.map((skill) => (
              <SkillItemRow
                key={skill.slug}
                skill={skill}
                displayName={skill.name}
                expanded={expandedSkill === skill.slug}
                onToggleExpand={() => setExpandedSkill(expandedSkill === skill.slug ? null : skill.slug)}
                onDelete={() => onDelete(skill.slug, skill.name)}
                onToggleEnabled={(enabled) => onToggle(skill.slug, enabled)}
                onOpenFolder={() => openSkillFolder(skill.slug)}
                onUpdate={skill.hasUpdate ? () => onUpdate(skill.slug) : undefined}
              />
            ))}
          </SettingsCard>
        )
      )}
    </div>
  )
}

interface SkillGroupCardProps {
  group: SkillGroup
  expanded: boolean
  expandedSkill: string | null
  onToggle: () => void
  onExpandSkill: (slug: string) => void
  onDelete: (slug: string, name: string) => void
  onToggleEnabled: (slug: string, enabled: boolean) => void
  onOpenFolder: (slug: string) => void
  onUpdate: (slug: string) => void
}

function SkillGroupCard({ group, expanded, expandedSkill, onToggle, onExpandSkill, onDelete, onToggleEnabled, onOpenFolder, onUpdate }: SkillGroupCardProps): React.ReactElement {
  return (
    <SettingsCard divided={false}>
      {/* 分组头部 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors min-w-0"
      >
        {expanded
          ? <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
          : <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
        }
        <Sparkles size={16} className="text-amber-500 flex-shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">{group.prefix}</span>
        <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium tabular-nums flex-shrink-0">
          {group.skills.length}
        </span>
      </button>

      {/* 展开的子项 */}
      {expanded && (
        <div className="overflow-hidden">
          {group.skills.map((skill) => (
            <SkillItemRow
              key={skill.slug}
              skill={skill}
              displayName={shortName(skill.slug, group.prefix)}
              expanded={expandedSkill === skill.slug}
              onToggleExpand={() => onExpandSkill(skill.slug)}
              onDelete={() => onDelete(skill.slug, skill.name)}
              onToggleEnabled={(enabled) => onToggleEnabled(skill.slug, enabled)}
              onOpenFolder={() => onOpenFolder(skill.slug)}
              onUpdate={skill.hasUpdate ? () => onUpdate(skill.slug) : undefined}
              indent
            />
          ))}
        </div>
      )}
    </SettingsCard>
  )
}

interface SkillItemRowProps {
  skill: SkillMeta
  displayName: string
  expanded: boolean
  onToggleExpand: () => void
  onDelete: () => void
  onToggleEnabled: (enabled: boolean) => void
  onOpenFolder: () => void
  onUpdate?: () => void
  indent?: boolean
}

function SkillItemRow({ skill, displayName, expanded, onToggleExpand, onDelete, onToggleEnabled, onOpenFolder, onUpdate, indent }: SkillItemRowProps): React.ReactElement {
  return (
    <div className={cn('group border-t border-border/50 overflow-hidden', !skill.enabled && 'opacity-50')}>
      <div className={cn('flex items-center gap-2 px-4 py-2', indent && 'pl-8')}>
        {indent && <Sparkles size={14} className="text-amber-400/60 flex-shrink-0" />}
        {!indent && <Sparkles size={16} className="text-amber-500 flex-shrink-0" />}

        {/* 名称 + 可展开描述 */}
        <button
          onClick={onToggleExpand}
          className="flex-1 min-w-0 text-left overflow-hidden"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{displayName}</span>
            {skill.hasUpdate && (
              <span className="shrink-0 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                可更新
              </span>
            )}
          </div>
          {expanded && skill.description && (
            <div className="text-xs text-muted-foreground mt-1 break-words">
              {skill.description}
            </div>
          )}
          {!expanded && skill.description && (
            <div className="text-xs text-muted-foreground truncate">{skill.description}</div>
          )}
        </button>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onUpdate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onUpdate}
                  aria-label={`同步更新 Skill ${skill.name}`}
                  className="p-1.5 rounded-md text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
                >
                  <RefreshCw size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>从源工作区同步更新</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
                <button
                  onClick={onOpenFolder}
                  aria-label={`打开 Skill 文件夹 ${skill.name}`}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                >
                <FolderOpen size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>打开文件夹</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
                <button
                  onClick={onDelete}
                  aria-label={`删除 Skill ${skill.name}`}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                >
                <Trash2 size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>删除</TooltipContent>
          </Tooltip>
          <Switch
            checked={skill.enabled}
            onCheckedChange={onToggleEnabled}
            aria-label={`${skill.enabled ? '禁用' : '启用'} Skill ${skill.name}`}
          />
        </div>
      </div>
    </div>
  )
}

interface ImportSkillFromWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  otherWorkspaces: OtherWorkspaceSkillsGroup[]
  installedSkills: SkillMeta[]
  importingSkill: string | null
  onImport: (sourceSlug: string, skillSlug: string) => Promise<void>
}

function ImportSkillFromWorkspaceDialog({
  open,
  onOpenChange,
  otherWorkspaces,
  installedSkills,
  importingSkill,
  onImport,
}: ImportSkillFromWorkspaceDialogProps): React.ReactElement {
  const installedSlugs = React.useMemo(
    () => new Set(installedSkills.map((skill) => skill.slug)),
    [installedSkills]
  )

  const availableWorkspaces = React.useMemo(
    () =>
      otherWorkspaces
        .map((workspace) => ({
          ...workspace,
          skills: workspace.skills.filter((skill) => !installedSlugs.has(skill.slug)),
        }))
        .filter((workspace) => workspace.skills.length > 0),
    [otherWorkspaces, installedSlugs]
  )
  const [selectedWorkspaceSlug, setSelectedWorkspaceSlug] = React.useState('')

  const selectedWorkspace = React.useMemo(
    () => availableWorkspaces.find((workspace) => workspace.workspaceSlug === selectedWorkspaceSlug) ?? null,
    [availableWorkspaces, selectedWorkspaceSlug]
  )

  React.useEffect(() => {
    if (!open || availableWorkspaces.length === 0) {
      setSelectedWorkspaceSlug('')
      return
    }

    setSelectedWorkspaceSlug((current) =>
      availableWorkspaces.some((workspace) => workspace.workspaceSlug === current)
        ? current
        : availableWorkspaces[0]?.workspaceSlug ?? ''
    )
  }, [availableWorkspaces, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle>从其他工作区导入 Skill</DialogTitle>
          <DialogDescription>
            从其他工作区中选择 Skill 导入到当前工作区。已安装的同名 Skill 会自动过滤。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 pb-6 max-h-[60vh]">
          {availableWorkspaces.length === 0 ? (
            <SettingsCard divided={false}>
              <div className="py-10 text-center text-sm text-muted-foreground">
                没有可导入的 Skill。其他工作区暂无 Skill，或者它们都已经安装到当前工作区了。
              </div>
            </SettingsCard>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">选择来源工作区</div>
                <Select value={selectedWorkspaceSlug} onValueChange={setSelectedWorkspaceSlug}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择来源工作区" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWorkspaces.map((workspace) => (
                      <SelectItem key={workspace.workspaceSlug} value={workspace.workspaceSlug}>
                        {workspace.workspaceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(selectedWorkspace ? [selectedWorkspace] : []).map((workspace) => (
                <div key={workspace.workspaceSlug}>
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span className="truncate">{workspace.workspaceName}</span>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium tabular-nums">
                      {workspace.skills.length} 个
                    </span>
                  </div>
                  <div className="pr-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                    {workspace.skills.map((skill) => (
                      <SettingsCard key={skill.slug} divided={false} className="overflow-hidden">
                        <div className="flex h-full flex-col gap-4 p-4">
                          <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-amber-500/12 p-2 text-amber-500 shadow-sm">
                              <Sparkles size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-medium text-foreground">{skill.name}</div>
                                {skill.version ? (
                                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    v{skill.version}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">{skill.slug}</div>
                            </div>
                          </div>

                          <div className="line-clamp-3 min-h-[40px] text-sm leading-6 text-muted-foreground">
                            {skill.description ?? '暂无描述'}
                          </div>

                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => void onImport(workspace.workspaceSlug, skill.slug)}
                            disabled={importingSkill !== null}
                          >
                            {importingSkill === skill.slug ? '导入中...' : '导入'}
                          </Button>
                        </div>
                      </SettingsCard>
                    ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ===== Agent 高级设置子组件 =====

/** 思考模式选项 */
const THINKING_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: 'adaptive', label: '自适应' },
  { value: 'disabled', label: '关闭' },
]

/** 推理深度选项 */
const EFFORT_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'max', label: '最大' },
]

const RUNTIME_OPTIONS = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'codex', label: 'Codex' },
  { value: 'opencode', label: 'opencode' },
]

const CODEX_REASONING_OPTIONS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'XHigh' },
]

const CODEX_WEB_SEARCH_OPTIONS = [
  { value: 'disabled', label: '关闭' },
  { value: 'cached', label: '缓存' },
  { value: 'live', label: '实时' },
]

const OPENCODE_AGENT_OPTIONS = [
  { value: 'build', label: 'Build' },
  { value: 'plan', label: 'Plan' },
  { value: 'custom', label: 'Custom' },
]

/** 从 ThinkingConfig 转为 UI 字符串 */
function thinkingToValue(config: ThinkingConfig | undefined): string {
  if (!config) return 'default'
  return config.type === 'adaptive' ? 'adaptive' : config.type === 'disabled' ? 'disabled' : 'default'
}

/** 从 UI 字符串转为 ThinkingConfig（'default' 返回 undefined） */
function valueToThinking(value: string): ThinkingConfig | undefined {
  if (value === 'adaptive') return { type: 'adaptive' }
  if (value === 'disabled') return { type: 'disabled' }
  return undefined
}

/** 从 AgentEffort 转为 UI 字符串 */
function effortToValue(effort: AgentEffort | undefined): string {
  return effort ?? 'default'
}

/** 从 UI 字符串转为 AgentEffort（'default' 返回 undefined） */
function valueToEffort(value: string): AgentEffort | undefined {
  if (value === 'default') return undefined
  return value as AgentEffort
}

function AgentRuntimeSettings(): React.ReactElement {
  const codexFeatureEnabled = isAgentCodexRuntimeFeatureEnabled()
  const opencodeFeatureEnabled = isAgentOpencodeRuntimeFeatureEnabled()
  const channels = useAtomValue(channelsAtom)
  const codexChannels = React.useMemo(() => getCodexCompatibleChannels(channels), [channels])
  const opencodeChannels = React.useMemo(() => getOpencodeCompatibleChannels(channels), [channels])
  const [runtimeKind, setRuntimeKind] = useAtom(agentRuntimeKindAtom)
  const [codexChannelId, setCodexChannelId] = useAtom(agentCodexChannelIdAtom)
  const [codexModelId, setCodexModelId] = useAtom(agentCodexModelIdAtom)
  const [reasoningEffort, setReasoningEffort] = useAtom(agentCodexReasoningEffortAtom)
  const [networkAccessEnabled, setNetworkAccessEnabled] = useAtom(agentCodexNetworkAccessEnabledAtom)
  const [webSearchMode, setWebSearchMode] = useAtom(agentCodexWebSearchModeAtom)
  const [opencodeChannelId, setOpencodeChannelId] = useAtom(agentOpencodeChannelIdAtom)
  const [opencodeModelId, setOpencodeModelId] = useAtom(agentOpencodeModelIdAtom)
  const [opencodeAgentName, setOpencodeAgentName] = useAtom(agentOpencodeAgentNameAtom)
  const [opencodeUseNativeAuth, setOpencodeUseNativeAuth] = useAtom(agentOpencodeUseNativeAuthAtom)
  const [opencodeAutoupdate, setOpencodeAutoupdate] = useAtom(agentOpencodeAutoupdateAtom)
  const [opencodeSnapshotEnabled, setOpencodeSnapshotEnabled] = useAtom(agentOpencodeSnapshotEnabledAtom)
  const [runtimeDiagnostics, setRuntimeDiagnostics] = React.useState<AgentRuntimeCapabilitiesDiagnostic[]>([])
  const [opencodeServerStatus, setOpencodeServerStatus] = React.useState<AgentOpencodeServerStatus | null>(null)
  const [opencodeModelRefresh, setOpencodeModelRefresh] = React.useState<AgentOpencodeModelRefreshResult | null>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = React.useState(false)

  const refreshRuntimeDiagnostics = React.useCallback(async () => {
    setDiagnosticsLoading(true)
    try {
      const [diagnostics, status] = await Promise.all([
        window.electronAPI.getAgentRuntimeCapabilities(),
        window.electronAPI.getAgentOpencodeServerStatus(),
      ])
      setRuntimeDiagnostics(diagnostics)
      setOpencodeServerStatus(status)
    } catch (error) {
      console.error('[Agent 设置] 加载 Runtime 诊断失败:', error)
    } finally {
      setDiagnosticsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refreshRuntimeDiagnostics()
  }, [refreshRuntimeDiagnostics])

  const selectedChannel = typeof codexChannelId === 'string'
    ? codexChannels.find((channel) => channel.id === codexChannelId) ?? null
    : null
  const selectedOpencodeChannel = typeof opencodeChannelId === 'string' && opencodeUseNativeAuth !== true
    ? opencodeChannels.find((channel) => channel.id === opencodeChannelId) ?? null
    : null
  const authSourceValue = selectedChannel ? selectedChannel.id : CODEX_NATIVE_AUTH_SELECT_VALUE
  const opencodeAuthSourceValue = selectedOpencodeChannel ? selectedOpencodeChannel.id : OPENCODE_NATIVE_AUTH_SELECT_VALUE
  const modelValue = codexModelId ?? ''
  const opencodeModelValue = opencodeModelId ?? ''
  const opencodeAgentMode = opencodeAgentName === 'plan' || opencodeAgentName === 'build'
    ? opencodeAgentName
    : opencodeAgentName ? 'custom' : 'build'
  const effectiveReasoningEffort = reasoningEffort ?? 'medium'
  const effectiveWebSearchMode = webSearchMode ?? 'disabled'
  const opencodeDiagnostic = runtimeDiagnostics.find((item) => item.runtimeKind === 'opencode')
  const opencodeSupportsModelRefresh = opencodeDiagnostic?.capabilities.includes('modelRefresh') ?? false

  const updateRuntimeKind = (value: string): void => {
    const next = value as CodingAgentRuntimeKind
    if (next === 'codex' && !codexFeatureEnabled) {
      toast.info('Codex Runtime 功能开关未启用')
      return
    }
    if (next === 'opencode' && !opencodeFeatureEnabled) {
      toast.info('opencode Runtime 实验功能未启用', {
        description: '启动应用前设置 CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 后可选择。',
      })
      return
    }
    setRuntimeKind(next)
    window.electronAPI.updateSettings({
      agentRuntimeKind: next,
      ...(next === 'codex' && codexChannelId === undefined ? { agentCodexChannelId: null } : {}),
      ...(next === 'opencode' && opencodeChannelId === undefined ? {
        agentOpencodeChannelId: null,
        agentOpencodeUseNativeAuth: true,
      } : {}),
    }).catch(console.error)
    if (next === 'codex' && codexChannelId === undefined) {
      setCodexChannelId(null)
    }
    if (next === 'opencode' && opencodeChannelId === undefined) {
      setOpencodeChannelId(null)
      setOpencodeUseNativeAuth(true)
    }
  }

  const updateCodexAuthSource = (value: string): void => {
    if (value === CODEX_NATIVE_AUTH_SELECT_VALUE) {
      setCodexChannelId(null)
      window.electronAPI.updateSettings({ agentCodexChannelId: null }).catch(console.error)
      return
    }

    const channel = codexChannels.find((candidate) => candidate.id === value)
    if (!channel) return
    setCodexChannelId(channel.id)
    const firstEnabledModel = channel.models.find((model) => model.enabled)
    const nextModelId = codexModelId || firstEnabledModel?.id
    if (nextModelId) setCodexModelId(nextModelId)
    window.electronAPI.updateSettings({
      agentCodexChannelId: channel.id,
      ...(nextModelId ? { agentCodexModelId: nextModelId } : {}),
    }).catch(console.error)
  }

  const updateCodexModel = (): void => {
    const trimmed = modelValue.trim()
    const next = trimmed || undefined
    setCodexModelId(next)
    window.electronAPI.updateSettings({ agentCodexModelId: next }).catch(console.error)
  }

  const updateReasoningEffort = (value: string): void => {
    const next = value as AgentCodexReasoningEffort
    setReasoningEffort(next)
    window.electronAPI.updateSettings({ agentCodexReasoningEffort: next }).catch(console.error)
  }

  const updateNetworkAccess = (checked: boolean): void => {
    setNetworkAccessEnabled(checked)
    window.electronAPI.updateSettings({ agentCodexNetworkAccessEnabled: checked }).catch(console.error)
  }

  const updateWebSearchMode = (value: string): void => {
    const next = value as AgentCodexWebSearchMode
    setWebSearchMode(next)
    window.electronAPI.updateSettings({ agentCodexWebSearchMode: next }).catch(console.error)
  }

  const updateOpencodeAuthSource = (value: string): void => {
    if (value === OPENCODE_NATIVE_AUTH_SELECT_VALUE) {
      setOpencodeChannelId(null)
      setOpencodeUseNativeAuth(true)
      window.electronAPI.updateSettings({
        agentOpencodeChannelId: null,
        agentOpencodeUseNativeAuth: true,
      }).catch(console.error)
      return
    }

    const channel = opencodeChannels.find((candidate) => candidate.id === value)
    if (!channel) return
    const firstEnabledModel = channel.models.find((model) => model.enabled)
    const nextModelId = opencodeModelId || firstEnabledModel?.id
    setOpencodeChannelId(channel.id)
    setOpencodeUseNativeAuth(false)
    if (nextModelId) setOpencodeModelId(nextModelId)
    window.electronAPI.updateSettings({
      agentOpencodeChannelId: channel.id,
      agentOpencodeUseNativeAuth: false,
      ...(nextModelId ? { agentOpencodeModelId: nextModelId } : {}),
    }).catch(console.error)
  }

  const updateOpencodeModel = (): void => {
    const trimmed = opencodeModelValue.trim()
    const next = trimmed || undefined
    setOpencodeModelId(next)
    window.electronAPI.updateSettings({ agentOpencodeModelId: next }).catch(console.error)
  }

  const updateOpencodeAgentMode = (value: string): void => {
    const next = value === 'plan' ? 'plan' : value === 'custom' ? (opencodeAgentName && opencodeAgentName !== 'build' && opencodeAgentName !== 'plan' ? opencodeAgentName : 'custom') : 'build'
    setOpencodeAgentName(next)
    window.electronAPI.updateSettings({ agentOpencodeAgentName: next }).catch(console.error)
  }

  const updateOpencodeCustomAgent = (): void => {
    if (opencodeAgentMode !== 'custom') return
    const trimmed = (opencodeAgentName ?? '').trim()
    const next = trimmed || 'build'
    setOpencodeAgentName(next)
    window.electronAPI.updateSettings({ agentOpencodeAgentName: next }).catch(console.error)
  }

  const updateOpencodeSnapshot = (checked: boolean): void => {
    setOpencodeSnapshotEnabled(checked)
    window.electronAPI.updateSettings({ agentOpencodeSnapshotEnabled: checked }).catch(console.error)
  }

  const refreshOpencodeModels = async (): Promise<void> => {
    if (!opencodeSupportsModelRefresh) {
      setOpencodeModelRefresh({
        ok: false,
        models: [],
        error: '当前 opencode Runtime 暂不支持从设置页刷新模型',
        updatedAt: new Date().toISOString(),
      })
      return
    }
    const result = await window.electronAPI.refreshAgentOpencodeModels()
    setOpencodeModelRefresh(result)
  }

  return (
    <SettingsSection
      title="Agent Runtime"
      description="选择 Agent 模式使用的 Coding Runtime，新会话首次运行时绑定"
    >
      <SettingsCard>
        <SettingsSegmentedControl
          label="Runtime"
          description="新会话首次发送时绑定 runtime；已绑定会话继续使用创建时的 runtime"
          value={runtimeKind}
          onValueChange={updateRuntimeKind}
          options={RUNTIME_OPTIONS.filter((option) => {
            if (option.value === 'codex') return codexFeatureEnabled || runtimeKind === 'codex'
            if (option.value === 'opencode') return opencodeFeatureEnabled || runtimeKind === 'opencode'
            return true
          })}
        />

        {!opencodeFeatureEnabled && (
          <SettingsRow
            label="opencode 实验功能"
            icon={<Activity size={18} className="text-muted-foreground" />}
            description="功能开关未启用，opencode 只展示为关闭态"
          >
            <span className="rounded-full border border-border-subtle bg-surface-muted px-2.5 py-1 text-xs text-text-secondary">
              未启用
            </span>
          </SettingsRow>
        )}

        {runtimeKind === 'codex' && (
          <>
            <SettingsRow
              label="Codex 认证来源"
              icon={<KeyRound size={18} className="text-emerald-500" />}
              description="本机 auth 使用 Codex 原生登录；渠道模式只列出已启用的 OpenAI / Custom 渠道"
            >
              <Select value={authSourceValue} onValueChange={updateCodexAuthSource}>
                <SelectTrigger className="w-full sm:w-[260px]">
                  <SelectValue placeholder="选择 Codex 认证来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CODEX_NATIVE_AUTH_SELECT_VALUE}>本机 Codex auth</SelectItem>
                  {codexChannels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {formatCodexChannelLabel(channel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsInput
              label="Codex 模型"
              description="独立于 Claude Agent 模型；留空时运行时使用 codex 默认模型"
              value={modelValue}
              onChange={setCodexModelId}
              onBlur={updateCodexModel}
              placeholder="例如: gpt-5.1-codex"
            />

            <SettingsSegmentedControl
              label="推理深度"
              description="控制 Codex runtime 的 reasoning effort"
              value={effectiveReasoningEffort}
              onValueChange={updateReasoningEffort}
              options={CODEX_REASONING_OPTIONS}
            />

            <SettingsRow
              label="网络访问"
              icon={<Globe2 size={18} className="text-blue-500" />}
              description="允许 Codex runtime 在任务中访问网络"
            >
              <Switch
                checked={networkAccessEnabled ?? false}
                onCheckedChange={updateNetworkAccess}
                aria-label="切换 Codex 网络访问"
              />
            </SettingsRow>

            <SettingsSegmentedControl
              label="Web Search"
              description="控制 Codex runtime 的 web search 策略"
              value={effectiveWebSearchMode}
              onValueChange={updateWebSearchMode}
              options={CODEX_WEB_SEARCH_OPTIONS}
            />
          </>
        )}

        {runtimeKind === 'opencode' && opencodeFeatureEnabled && (
          <>
            <SettingsRow
              label="opencode 认证来源"
              icon={<KeyRound size={18} className="text-emerald-500" />}
              description="本机认证复用 opencode auth；渠道模式只通过环境变量注入，不写入 opencode auth storage"
            >
              <Select value={opencodeAuthSourceValue} onValueChange={updateOpencodeAuthSource}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue placeholder="选择 opencode 认证来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPENCODE_NATIVE_AUTH_SELECT_VALUE}>本机 opencode auth</SelectItem>
                  {opencodeChannels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {formatOpencodeChannelLabel(channel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsInput
              label="opencode 模型"
              description="本机认证使用 provider/model；渠道认证留空时使用渠道第一个可用模型"
              value={opencodeModelValue}
              onChange={setOpencodeModelId}
              onBlur={updateOpencodeModel}
              placeholder="例如: anthropic/claude-sonnet-4-5"
            />

            <SettingsSegmentedControl
              label="opencode Agent"
              description="默认 build；plan 用于规划；custom 需要填写 opencode agent 名称"
              value={opencodeAgentMode}
              onValueChange={updateOpencodeAgentMode}
              options={OPENCODE_AGENT_OPTIONS}
            />

            {opencodeAgentMode === 'custom' && (
              <SettingsInput
                label="自定义 Agent 名称"
                value={opencodeAgentName ?? ''}
                onChange={setOpencodeAgentName}
                onBlur={updateOpencodeCustomAgent}
                placeholder="例如: reviewer"
              />
            )}

            <SettingsRow
              label="Snapshot"
              icon={<ShieldCheck size={18} className="text-blue-500" />}
              description="启用 workspace snapshot，避免会话恢复被后续设置污染"
            >
              <Switch
                checked={opencodeSnapshotEnabled ?? true}
                onCheckedChange={updateOpencodeSnapshot}
                aria-label="切换 opencode Snapshot"
              />
            </SettingsRow>

            <SettingsRow
              label="Autoupdate"
              icon={<RefreshCw size={18} className="text-muted-foreground" />}
              description="首版强制关闭 opencode 自更新，由 CodeInsights 控制 runtime 版本"
            >
              <Switch
                checked={opencodeAutoupdate ?? false}
                onCheckedChange={(checked) => {
                  setOpencodeAutoupdate(checked)
                  window.electronAPI.updateSettings({ agentOpencodeAutoupdate: checked }).catch(console.error)
                }}
                disabled
                aria-label="opencode 自更新"
              />
            </SettingsRow>

            <SettingsRow
              label="Runtime Capabilities"
              icon={<Activity size={18} className="text-primary" />}
              description={formatRuntimeDiagnostic(opencodeDiagnostic)}
              feedback={opencodeModelRefresh?.error ? (
                <div className="text-xs text-status-waiting-fg">{opencodeModelRefresh.error}</div>
              ) : null}
            >
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => void refreshRuntimeDiagnostics()} disabled={diagnosticsLoading}>
                  <RefreshCw size={14} className={cn(diagnosticsLoading && 'animate-spin')} />
                  <span>刷新状态</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => void refreshOpencodeModels()} disabled={!opencodeSupportsModelRefresh}>
                  <Search size={14} />
                  <span>刷新模型</span>
                </Button>
              </div>
            </SettingsRow>

            <SettingsRow
              label="Server 状态"
              icon={<Globe2 size={18} className="text-indigo-500" />}
              description={formatOpencodeServerStatus(opencodeServerStatus)}
            >
              <span className="rounded-full border border-border-subtle bg-surface-muted px-2.5 py-1 text-xs text-text-secondary">
                {formatOpencodeServerState(opencodeServerStatus?.state)}
              </span>
            </SettingsRow>

            <SettingsRow
              label="MCP 摘要"
              icon={<Plug size={18} className="text-muted-foreground" />}
              description={formatOpencodeMcpSummary(opencodeServerStatus)}
            >
              <span className="rounded-full border border-border-subtle bg-surface-muted px-2.5 py-1 text-xs text-text-secondary">
                {formatOpencodeMcpBadge(opencodeServerStatus)}
              </span>
            </SettingsRow>
          </>
        )}
      </SettingsCard>
    </SettingsSection>
  )
}

function formatCodexChannelLabel(channel: Channel): string {
  return `${channel.name} · ${channel.provider === 'openai' ? 'OpenAI' : 'Custom'}`
}

function formatOpencodeChannelLabel(channel: Channel): string {
  return `${channel.name} · ${channel.provider === 'openai' ? 'OpenAI' : 'Custom'}`
}

function formatRuntimeDiagnostic(diagnostic: AgentRuntimeCapabilitiesDiagnostic | undefined): string {
  if (!diagnostic) return 'opencode runtime 尚未注册'
  const unsupported: string[] = []
  if (!diagnostic.capabilities.includes('queueMessage')) unsupported.push('运行中追加消息')
  if (!diagnostic.capabilities.includes('setPermissionMode')) unsupported.push('运行中切换权限')
  const suffix = unsupported.length > 0 ? `；不支持 ${unsupported.join('、')}` : ''
  return `${diagnostic.available ? '可用' : '不可用'} · ${diagnostic.capabilities.join(', ')}${suffix}`
}

function formatOpencodeServerStatus(status: AgentOpencodeServerStatus | null): string {
  if (!status) return '尚未加载 server 状态'
  const version = status.version ? ` · v${status.version}` : ''
  const endpoint = status.endpoint ? ` · ${status.endpoint}` : ''
  return `${status.message ?? formatOpencodeServerState(status.state)}${version}${endpoint}`
}

function formatOpencodeServerState(state: AgentOpencodeServerStatus['state'] | undefined): string {
  if (state === 'healthy') return '运行中'
  if (state === 'starting') return '启动中'
  if (state === 'failed') return '失败'
  if (state === 'disabled') return '已关闭'
  if (state === 'stopping') return '停止中'
  if (state === 'stopped') return '已停止'
  if (state === 'degraded') return '降级'
  if (state === 'not_configured') return '未配置'
  return '未启动'
}

function formatOpencodeMcpSummary(status: AgentOpencodeServerStatus | null): string {
  const mcp = status?.mcp
  if (!mcp) return '尚无 opencode MCP 状态；server 会在会话运行时按需刷新摘要'
  const statusPart = mcp.statusCount !== undefined
    ? `，/mcp 返回 ${mcp.statusCount} 个状态`
    : ''
  const connectedPart = mcp.connectedCount !== undefined
    ? `，已连接 ${mcp.connectedCount} 个`
    : ''
  const skippedPart = mcp.skippedCount > 0 ? `，跳过 ${mcp.skippedCount} 个` : ''
  const names = mcp.serverNames.length > 0 ? `：${mcp.serverNames.join(', ')}` : ''
  return `已配置 ${mcp.configuredCount} 个${statusPart}${connectedPart}${skippedPart}${names}`
}

function formatOpencodeMcpBadge(status: AgentOpencodeServerStatus | null): string {
  const mcp = status?.mcp
  if (!mcp) return '未启动'
  if (mcp.connectedCount !== undefined) return `${mcp.connectedCount}/${mcp.statusCount ?? mcp.configuredCount}`
  return `${mcp.configuredCount} 个`
}

/** 内置 Agent 工具状态展示 */
function BuiltinAgentTools(): React.ReactElement {
  const tools = useAtomValue(chatToolsAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)

  const memoryTool = tools.find((t) => t.meta.id === 'memory')
  const nanoBananaTool = tools.find((t) => t.meta.id === 'nano-banana')
  const webSearchTool = tools.find((t) => t.meta.id === 'web-search')

  /** 跳转到工具设置页 */
  const goToToolSettings = (): void => {
    setSettingsTab('tools')
  }

  interface BuiltinToolItem {
    id: string
    name: string
    description: string
    icon: React.ReactElement
    enabled: boolean
    available: boolean
  }

  const builtinTools: BuiltinToolItem[] = [
    {
      id: 'memory',
      name: '记忆',
      description: '长期记忆存储与检索',
      icon: <Brain className="size-4" />,
      enabled: memoryTool?.enabled ?? false,
      available: memoryTool?.available ?? false,
    },
    {
      id: 'nano-banana',
      name: 'Nano Banana',
      description: 'AI 图片生成与编辑',
      icon: <ImagePlus className="size-4" />,
      enabled: nanoBananaTool?.enabled ?? false,
      available: nanoBananaTool?.available ?? false,
    },
    {
      id: 'web-search',
      name: '联网搜索',
      description: '实时搜索互联网获取最新信息',
      icon: <Search className="size-4" />,
      enabled: webSearchTool?.enabled ?? false,
      available: webSearchTool?.available ?? false,
    },
  ]

  return (
    <SettingsSection
      title="内置工具"
      description="启用后自动注入到 Agent 会话，在工具设置中配置"
      action={
        <Button size="sm" variant="outline" onClick={goToToolSettings}>
          <Settings size={14} />
          <span>配置</span>
        </Button>
      }
    >
      <SettingsCard divided>
        {builtinTools.map((tool) => {
          const isActive = tool.enabled && tool.available
          return (
            <div key={tool.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn('shrink-0', !isActive && 'opacity-40')}>
                  {tool.icon}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-medium', !isActive && 'text-muted-foreground')}>
                      {tool.name}
                    </span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full',
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground',
                    )}>
                      {isActive ? '已启用' : !tool.available ? '需配置' : '未启用'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                </div>
              </div>
            </div>
          )
        })}
      </SettingsCard>
    </SettingsSection>
  )
}

function AgentAdvancedSettings(): React.ReactElement {
  const [collapsed, setCollapsed] = React.useState(true)

  const thinking = useAtomValue(agentThinkingAtom)
  const setThinking = useSetAtom(agentThinkingAtom)
  const effort = useAtomValue(agentEffortAtom)
  const setEffort = useSetAtom(agentEffortAtom)
  const maxBudget = useAtomValue(agentMaxBudgetUsdAtom)
  const setMaxBudget = useSetAtom(agentMaxBudgetUsdAtom)
  const maxTurns = useAtomValue(agentMaxTurnsAtom)
  const setMaxTurns = useSetAtom(agentMaxTurnsAtom)

  // 数字输入使用字符串状态，失焦时持久化
  const [budgetStr, setBudgetStr] = React.useState(maxBudget != null ? String(maxBudget) : '')
  const [turnsStr, setTurnsStr] = React.useState(maxTurns != null ? String(maxTurns) : '')

  // 同步外部变化（如初始化加载）
  React.useEffect(() => {
    setBudgetStr(maxBudget != null ? String(maxBudget) : '')
  }, [maxBudget])
  React.useEffect(() => {
    setTurnsStr(maxTurns != null ? String(maxTurns) : '')
  }, [maxTurns])

  const handleThinkingChange = (value: string): void => {
    const config = valueToThinking(value)
    setThinking(config)
    window.electronAPI.updateSettings({ agentThinking: config })
  }

  const handleEffortChange = (value: string): void => {
    const effortValue = valueToEffort(value)
    setEffort(effortValue)
    window.electronAPI.updateSettings({ agentEffort: effortValue })
  }

  const handleBudgetBlur = (): void => {
    const num = parseFloat(budgetStr)
    const value = !isNaN(num) && num > 0 ? num : undefined
    setMaxBudget(value)
    window.electronAPI.updateSettings({ agentMaxBudgetUsd: value })
  }

  const handleTurnsBlur = (): void => {
    const num = parseInt(turnsStr, 10)
    const value = !isNaN(num) && num > 0 ? num : undefined
    setMaxTurns(value)
    window.electronAPI.updateSettings({ agentMaxTurns: value })
  }

  return (
    <SettingsSection
      title={
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 hover:text-foreground/80 transition-colors"
        >
          <span>Agent 高级设置</span>
          {collapsed
            ? <ChevronRight size={16} className="text-muted-foreground" />
            : <ChevronDown size={16} className="text-muted-foreground" />
          }
        </button>
      }
      description={collapsed ? undefined : '控制 Agent 的思考模式、推理深度和资源限制'}
    >
      {!collapsed && (
        <SettingsCard>
          <SettingsSegmentedControl
            label="思考模式"
            description="自适应模式下 Agent 会根据任务复杂度自动决定是否启用深度思考"
            value={thinkingToValue(thinking)}
            onValueChange={handleThinkingChange}
            options={THINKING_OPTIONS}
          />
          <SettingsSegmentedControl
            label="推理深度"
            description="控制 Agent 在每次回复中投入的推理计算量"
            value={effortToValue(effort)}
            onValueChange={handleEffortChange}
            options={EFFORT_OPTIONS}
          />
          <SettingsInput
            label="预算限制（美元/次）"
            description="单次 Agent 会话的最大花费，留空则不限制"
            value={budgetStr}
            onChange={setBudgetStr}
            onBlur={handleBudgetBlur}
            placeholder="例如: 1.0"
            type="number"
          />
          <SettingsInput
            label="最大轮次"
            description="单次 Agent 会话的最大交互轮次，留空则使用 SDK 默认值"
            value={turnsStr}
            onChange={setTurnsStr}
            onBlur={handleTurnsBlur}
            placeholder="例如: 30"
            type="number"
          />
        </SettingsCard>
      )}
    </SettingsSection>
  )
}

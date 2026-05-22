/**
 * ChannelSettings - 渠道配置页
 *
 * 分为两个区块：
 * 1. 渠道管理 — 所有渠道列表 + 添加/编辑/删除（渠道同时用于 Chat 和 Agent）
 * 2. Agent 供应商 — 从已启用的 Anthropic 兼容渠道（Anthropic / DeepSeek / Kimi）中
 *    通过 Switch 开关启用多个 Agent 供应商
 */

import * as React from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PROVIDER_LABELS, isAgentCompatibleProvider } from '@codeinsights/shared'
import type { Channel } from '@codeinsights/shared'
import { getChannelLogo, CodeInsightsLogo } from '@/lib/model-logo'
import { agentChannelIdAtom, agentModelIdAtom, agentChannelIdsAtom } from '@/atoms/agent-atoms'
import { pipelineCodexChannelIdAtom } from '@/atoms/pipeline-atoms'
import { channelsAtom } from '@/atoms/chat-atoms'
import { SettingsSection, SettingsCard, SettingsRow } from './primitives'
import {
  CODEX_LOCAL_AUTH_VALUE,
  isPipelineCodexCompatibleChannel,
  resolvePipelineCodexSelection,
  shouldClearPipelineCodexChannel,
} from './pipeline-codex-channel-settings'
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
import { ChannelForm } from './ChannelForm'
import { CredentialStorageWarning } from './CredentialStorageWarning'

/** 组件视图模式 */
type ViewMode = 'list' | 'create' | 'edit'

export function ChannelSettings(): React.ReactElement {
  const [channels, setChannels] = React.useState<Channel[]>([])
  const [viewMode, setViewMode] = React.useState<ViewMode>('list')
  const [editingChannel, setEditingChannel] = React.useState<Channel | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [agentChannelId, setAgentChannelId] = useAtom(agentChannelIdAtom)
  const [, setAgentModelId] = useAtom(agentModelIdAtom)
  const [agentChannelIds, setAgentChannelIds] = useAtom(agentChannelIdsAtom)
  const [pipelineCodexChannelId, setPipelineCodexChannelId] = useAtom(pipelineCodexChannelIdAtom)
  const setGlobalChannels = useSetAtom(channelsAtom)
  const [deleteTarget, setDeleteTarget] = React.useState<Channel | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [encryptionAvailable, setEncryptionAvailable] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    window.electronAPI.getRuntimeStatus()
      .then((status) => {
        if (cancelled) return
        setEncryptionAvailable(status?.credentialStorage.available ?? true)
      })
      .catch(() => {
        if (cancelled) return
        setEncryptionAvailable(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  /** 加载渠道列表 */
  const loadChannels = React.useCallback(async (): Promise<Channel[]> => {
    try {
      const list = await window.electronAPI.listChannels()
      setChannels(list)
      setGlobalChannels(list) // 同步到全局缓存
      if (shouldClearPipelineCodexChannel(pipelineCodexChannelId, list)) {
        setPipelineCodexChannelId(null)
        await window.electronAPI.updateSettings({ pipelineCodexChannelId: null })
      }
      return list
    } catch (error) {
      console.error('[渠道设置] 加载渠道列表失败:', error)
      return []
    } finally {
      setLoading(false)
    }
  }, [pipelineCodexChannelId, setPipelineCodexChannelId, setGlobalChannels])

  React.useEffect(() => {
    loadChannels()
  }, [loadChannels])

  /** 删除渠道（通过弹窗确认） */
  const handleDeleteRequest = (channel: Channel): void => {
    setDeleteError(null)
    setDeleteTarget(channel)
  }

  /** 确认删除 */
  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.electronAPI.deleteChannel(target.id)

      // 从 Agent 渠道列表中移除
      const newIds = agentChannelIds.filter((id) => id !== target.id)
      setAgentChannelIds(newIds)

      // 如果删除的是当前选中的 Agent 渠道，清空选择
      if (agentChannelId === target.id) {
        setAgentChannelId(null)
        setAgentModelId(null)
      }
      const shouldClearPipelineCodexChannel = pipelineCodexChannelId === target.id
      if (shouldClearPipelineCodexChannel) {
        setPipelineCodexChannelId(null)
      }

      await window.electronAPI.updateSettings({
        agentChannelIds: newIds,
        ...(agentChannelId === target.id && { agentChannelId: undefined, agentModelId: undefined }),
        ...(shouldClearPipelineCodexChannel && { pipelineCodexChannelId: null }),
      })

      await loadChannels()
      setDeleteTarget(null)
    } catch (error) {
      console.error('[渠道设置] 删除渠道失败:', error)
      setDeleteError(error instanceof Error ? error.message : '删除渠道失败，请稍后重试')
    } finally {
      setDeleting(false)
    }
  }

  /** 切换渠道启用状态 */
  const handleToggle = async (channel: Channel): Promise<void> => {
    try {
      await window.electronAPI.updateChannel(channel.id, { enabled: !channel.enabled })

      // 如果禁用渠道，同时从 Agent 列表中移除
      if (channel.enabled) {
        const newIds = agentChannelIds.filter((id) => id !== channel.id)
        setAgentChannelIds(newIds)
        await window.electronAPI.updateSettings({ agentChannelIds: newIds })

        // 如果禁用的是当前选中的 Agent 渠道，清空选择
        if (agentChannelId === channel.id) {
          setAgentChannelId(null)
          setAgentModelId(null)
          await window.electronAPI.updateSettings({ agentChannelId: undefined, agentModelId: undefined })
        }

        if (pipelineCodexChannelId === channel.id) {
          setPipelineCodexChannelId(null)
          await window.electronAPI.updateSettings({ pipelineCodexChannelId: null })
        }
      }

      await loadChannels()
    } catch (error) {
      console.error('[渠道设置] 切换渠道状态失败:', error)
    }
  }

  /** 切换 Agent 供应商开关 */
  const handleToggleAgentProvider = async (channelId: string, enabled: boolean): Promise<void> => {
    const newIds = enabled
      ? [...agentChannelIds, channelId]
      : agentChannelIds.filter((id) => id !== channelId)

    setAgentChannelIds(newIds)

    // 如果关闭的是当前选中的渠道，清空选择
    if (!enabled && agentChannelId === channelId) {
      setAgentChannelId(null)
      setAgentModelId(null)
      await window.electronAPI.updateSettings({
        agentChannelIds: newIds,
        agentChannelId: undefined,
        agentModelId: undefined,
      }).catch(console.error)
      return
    }

    await window.electronAPI.updateSettings({ agentChannelIds: newIds }).catch(console.error)
  }

  const handlePipelineCodexChannelChange = async (value: string): Promise<void> => {
    const channelId = value === CODEX_LOCAL_AUTH_VALUE ? null : value
    setPipelineCodexChannelId(channelId)
    await window.electronAPI.updateSettings({
      pipelineCodexChannelId: channelId,
    }).catch(console.error)
  }

  /** 表单保存回调 */
  const handleFormSaved = async (): Promise<void> => {
    setViewMode('list')
    setEditingChannel(null)
    await loadChannels()
  }

  /** 取消表单 */
  const handleFormCancel = (): void => {
    setViewMode('list')
    setEditingChannel(null)
  }

  // 表单视图
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <ChannelForm
        channel={editingChannel}
        onSaved={handleFormSaved}
        onCancel={handleFormCancel}
      />
    )
  }

  // Agent 兼容渠道（已启用）：Anthropic / DeepSeek / Kimi API / Kimi Coding Plan
  const agentCapableChannels = channels.filter(
    (c) => isAgentCompatibleProvider(c.provider) && c.enabled
  )
  const pipelineCodexCapableChannels = channels.filter(isPipelineCodexCompatibleChannel)
  const pipelineCodexSelection = resolvePipelineCodexSelection(
    pipelineCodexChannelId,
    pipelineCodexCapableChannels,
  )

  // 列表视图
  return (
    <div className="space-y-8">
      {/* 区块一：模型配置 */}
      <SettingsSection
        title="模型配置"
        description="管理 AI 供应商连接，配置 API Key 和可用模型。Anthropic 渠道同时可用于 Agent 模式"
        action={
          <Button size="sm" onClick={() => setViewMode('create')}>
            <Plus size={16} />
            <span>添加配置</span>
          </Button>
        }
      >
        <CredentialStorageWarning scopeLabel="模型配置与渠道凭证" />
        <SettingsCard>
          <CodeInsightsProviderCard />
        </SettingsCard>
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">加载中...</div>
        ) : channels.length === 0 ? (
          <SettingsCard divided={false}>
            <div className="text-sm text-muted-foreground py-12 text-center">
              还没有配置任何模型，点击上方"添加配置"开始
            </div>
          </SettingsCard>
        ) : (
          <SettingsCard>
            {channels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                encryptionAvailable={encryptionAvailable}
                onEdit={() => {
                  setEditingChannel(channel)
                  setViewMode('edit')
                }}
                onDelete={() => handleDeleteRequest(channel)}
                onToggle={() => handleToggle(channel)}
              />
            ))}
          </SettingsCard>
        )}
      </SettingsSection>

      {/* 区块二：Pipeline Codex 供应商 */}
      <SettingsSection
        title="Pipeline Codex 供应商"
        description="配置 developer / reviewer 节点使用的 Codex OpenAI 兼容渠道"
      >
        <SettingsCard>
          <SettingsRow
            label="Codex 认证来源"
            description={pipelineCodexSelection === CODEX_LOCAL_AUTH_VALUE
              ? '使用本机 Codex 登录状态或 CODEX_API_KEY'
              : '使用已保存的 OpenAI 兼容渠道凭证'
            }
          >
            <Select
              value={pipelineCodexSelection}
              onValueChange={(value) => { void handlePipelineCodexChannelChange(value) }}
            >
              <SelectTrigger className="w-[260px] max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CODEX_LOCAL_AUTH_VALUE}>
                  本机 Codex auth / CODEX_API_KEY
                </SelectItem>
                {pipelineCodexCapableChannels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.name} · {PROVIDER_LABELS[channel.provider]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {/* 区块三：Agent 供应商 */}
      <SettingsSection
        title="Agent 供应商"
        description="启用 Agent 模式可用的供应商，支持同时开启多个渠道，在 Agent 模式下可直接切换"
      >
        <SettingsCard>
          <CodeInsightsProviderCard />
        </SettingsCard>
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">加载中...</div>
        ) : agentCapableChannels.length === 0 ? (
          <SettingsCard divided={false}>
            <div className="text-sm text-muted-foreground py-8 text-center">
              暂无可用的 Anthropic 兼容渠道，请先在上方添加 Anthropic / DeepSeek / Kimi 渠道并启用
            </div>
          </SettingsCard>
        ) : (
          <SettingsCard>
            {agentCapableChannels.map((channel) => (
              <AgentProviderRow
                key={channel.id}
                channel={channel}
                enabled={agentChannelIds.includes(channel.id)}
                onToggle={(enabled) => handleToggleAgentProvider(channel.id, enabled)}
              />
            ))}
          </SettingsCard>
        )}
      </SettingsSection>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除渠道？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteTarget?.name}」及其 API Key 配置。不会删除本地会话记录，但依赖该渠道的 Agent / Pipeline 默认选择会被清空。
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

// ===== 渠道行子组件 =====

interface ChannelRowProps {
  channel: Channel
  encryptionAvailable: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

function ChannelRow({ channel, encryptionAvailable, onEdit, onDelete, onToggle }: ChannelRowProps): React.ReactElement {
  const enabledCount = channel.models.filter((m) => m.enabled).length
  const description = [
    PROVIDER_LABELS[channel.provider],
    enabledCount > 0 ? `${enabledCount} 个模型已启用` : undefined,
    isAgentCompatibleProvider(channel.provider) ? '可用于 Agent' : undefined,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <SettingsRow
      label={
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{channel.name}</span>
          {!encryptionAvailable && (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              未加密
            </Badge>
          )}
        </div>
      }
      icon={<img src={getChannelLogo(channel.baseUrl)} alt="" className="w-8 h-8 rounded" />}
      description={description}
      className="group"
    >
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        {/* 操作按钮 */}
        <button
          onClick={onEdit}
          aria-label={`编辑渠道 ${channel.name}`}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          title="编辑"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          aria-label={`删除渠道 ${channel.name}`}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          title="删除"
        >
          <Trash2 size={14} />
        </button>

        {/* 启用/关闭开关 */}
        <Switch
          checked={channel.enabled}
          onCheckedChange={onToggle}
          aria-label={`${channel.enabled ? '禁用' : '启用'}渠道 ${channel.name}`}
        />
      </div>
    </SettingsRow>
  )
}

// ===== Agent 供应商行子组件 =====

interface AgentProviderRowProps {
  channel: Channel
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

function AgentProviderRow({ channel, enabled, onToggle }: AgentProviderRowProps): React.ReactElement {
  const enabledCount = channel.models.filter((m) => m.enabled).length
  const description = [
    PROVIDER_LABELS[channel.provider],
    enabledCount > 0 ? `${enabledCount} 个模型可用` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <SettingsRow
      label={channel.name}
      icon={<img src={getChannelLogo(channel.baseUrl)} alt="" className="w-8 h-8 rounded" />}
      description={description}
    >
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        aria-label={`${enabled ? '禁用' : '启用'} Agent 供应商 ${channel.name}`}
      />
    </SettingsRow>
  )
}

// ===== CodeInsights 官方供应商推广卡片 =====

function CodeInsightsProviderCard(): React.ReactElement {
  const handleDownload = (): void => {
    window.open('https://codeinsights.cool/download', '_blank')
  }

  return (
    <SettingsRow
      label="CodeInsights"
      icon={<img src={CodeInsightsLogo} alt="CodeInsights" className="w-8 h-8 rounded" />}
      description="CodeInsights 官方供应｜稳定｜靠谱｜丝滑｜简单｜优惠套餐｜可用于 Agent"
    >
      <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownload}>
        <ExternalLink size={13} />
        <span>下载后启动</span>
      </Button>
    </SettingsRow>
  )
}

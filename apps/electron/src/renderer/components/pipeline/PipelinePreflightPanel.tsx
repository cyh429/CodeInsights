import * as React from 'react'
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import type {
  PipelinePackageManager,
  PipelinePreflightAcknowledgement,
  PipelinePreflightResult,
  PipelinePreflightRuntimeKind,
} from '@codeinsights/shared'
import { Button } from '@/components/ui/button'
import {
  isPipelinePreflightAcknowledged,
  shouldBlockPipelineStartForPreflight,
  type PipelinePreflightRefreshState,
} from './pipeline-preflight'

export interface PipelinePreflightRuntimeItem {
  label: string
  status: string
  available: boolean
}

export interface PipelinePreflightPanelViewModel {
  title: string
  subtitle: string
  tone: 'success' | 'warning' | 'danger' | 'neutral'
  repositorySummary: string
  packageManagerLabel: string
  blockers: string[]
  warnings: string[]
  runtimeItems: PipelinePreflightRuntimeItem[]
  showAcknowledgeButton: boolean
  showRefreshButton: boolean
  startBlocked: boolean
}

interface PipelinePreflightPanelInput {
  result: PipelinePreflightResult | null
  acknowledgement: PipelinePreflightAcknowledgement | null
  loading: boolean
  error: string | null
  refreshState?: PipelinePreflightRefreshState
}

const RUNTIME_LABELS: Record<PipelinePreflightRuntimeKind, string> = {
  git: 'Git',
  github: 'GitHub CLI',
  'claude-cli': 'Claude CLI',
  'codex-cli': 'Codex CLI',
}

const PACKAGE_MANAGER_LABELS: Record<PipelinePackageManager, string> = {
  bun: 'Bun',
  npm: 'npm',
  pnpm: 'pnpm',
  yarn: 'Yarn',
  unknown: '未识别',
}

function joinKnownParts(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' · ')
}

export function buildPipelinePreflightPanelViewModel({
  result,
  acknowledgement,
  loading,
  error,
  refreshState,
}: PipelinePreflightPanelInput): PipelinePreflightPanelViewModel {
  if (loading) {
    return {
      title: '正在执行启动前检查',
      subtitle: '检查仓库、Git、运行时和包管理器。',
      tone: 'neutral',
      repositorySummary: '等待检查结果',
      packageManagerLabel: '等待检查',
      blockers: [],
      warnings: [],
      runtimeItems: [],
      showAcknowledgeButton: false,
      showRefreshButton: false,
      startBlocked: true,
    }
  }

  if (error) {
    return {
      title: '启动前检查失败',
      subtitle: error,
      tone: 'danger',
      repositorySummary: '检查未完成',
      packageManagerLabel: '检查未完成',
      blockers: [error],
      warnings: [],
      runtimeItems: [],
      showAcknowledgeButton: false,
      showRefreshButton: true,
      startBlocked: true,
    }
  }

  if (!result) {
    return {
      title: '启动前检查',
      subtitle: '启动 Pipeline 时会检查仓库和运行时状态。',
      tone: 'neutral',
      repositorySummary: '尚未检查',
      packageManagerLabel: '尚未检查',
      blockers: [],
      warnings: [],
      runtimeItems: [],
      showAcknowledgeButton: false,
      showRefreshButton: false,
      startBlocked: false,
    }
  }

  if (refreshState?.refreshRequired) {
    const message = refreshState.message ?? '启动前检查需要重新执行。'
    return {
      title: '启动前检查需要刷新',
      subtitle: message,
      tone: 'warning',
      repositorySummary: joinKnownParts([
        result.repository.root,
        result.repository.currentBranch,
        result.repository.baseBranch,
        result.repository.remoteUrl,
      ]) || result.repository.root,
      packageManagerLabel: PACKAGE_MANAGER_LABELS[result.packageManager],
      blockers: [],
      warnings: [message],
      runtimeItems: result.runtimes.map((runtime) => ({
        label: RUNTIME_LABELS[runtime.kind],
        status: runtime.available
          ? runtime.version ?? '可用'
          : runtime.error ?? '不可用',
        available: runtime.available,
      })),
      showAcknowledgeButton: false,
      showRefreshButton: true,
      startBlocked: true,
    }
  }

  const acknowledged = isPipelinePreflightAcknowledged(result, acknowledgement)
  const hasBlockers = result.blockers.length > 0
  const hasWarnings = result.warnings.length > 0
  const tone: PipelinePreflightPanelViewModel['tone'] = hasBlockers
    ? 'danger'
    : hasWarnings && !acknowledged
      ? 'warning'
      : 'success'

  return {
    title: hasBlockers
      ? '启动前检查未通过'
      : hasWarnings && !acknowledged
        ? '启动前检查存在风险'
        : hasWarnings
          ? '启动前检查风险已记录'
          : '启动前检查通过',
    subtitle: hasBlockers
      ? '修复阻断项后再启动 Pipeline。'
      : hasWarnings && !acknowledged
        ? '需要明确记录风险后才能继续。'
        : '仓库和运行时状态可用于本次启动。',
    tone,
    repositorySummary: joinKnownParts([
      result.repository.root,
      result.repository.currentBranch,
      result.repository.baseBranch,
      result.repository.remoteUrl,
    ]) || result.repository.root,
    packageManagerLabel: PACKAGE_MANAGER_LABELS[result.packageManager],
    blockers: result.blockers.map((issue) => issue.message),
    warnings: result.warnings.map((issue) => issue.message),
    runtimeItems: result.runtimes.map((runtime) => ({
      label: RUNTIME_LABELS[runtime.kind],
      status: runtime.available
        ? runtime.version ?? '可用'
        : runtime.error ?? '不可用',
      available: runtime.available,
    })),
    showAcknowledgeButton: !hasBlockers && hasWarnings && !acknowledged,
    showRefreshButton: true,
    startBlocked: shouldBlockPipelineStartForPreflight(result, acknowledgement),
  }
}

function panelClass(tone: PipelinePreflightPanelViewModel['tone']): string {
  if (tone === 'danger') return 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
  if (tone === 'warning') return 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg'
  if (tone === 'success') return 'border-status-success-border bg-status-success-bg text-status-success-fg'
  return 'border-border-subtle bg-surface-card text-text-primary'
}

function iconForTone(tone: PipelinePreflightPanelViewModel['tone']): React.ReactElement {
  if (tone === 'danger') return <ShieldAlert size={18} aria-hidden="true" />
  if (tone === 'warning') return <AlertTriangle size={18} aria-hidden="true" />
  if (tone === 'success') return <CheckCircle2 size={18} aria-hidden="true" />
  return <Loader2 size={18} aria-hidden="true" className="animate-spin" />
}

export function PipelinePreflightPanel({
  result,
  acknowledgement,
  loading,
  error,
  refreshState,
  onAcknowledgeWarnings,
  onRefreshPreflight,
}: PipelinePreflightPanelInput & {
  onAcknowledgeWarnings: () => void
  onRefreshPreflight: () => void
}): React.ReactElement {
  const viewModel = buildPipelinePreflightPanelViewModel({
    result,
    acknowledgement,
    loading,
    error,
    refreshState,
  })

  return (
    <section className={`rounded-panel border px-4 py-3 text-sm shadow-card ${panelClass(viewModel.tone)}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-semibold">
            {iconForTone(viewModel.tone)}
            <span>{viewModel.title}</span>
          </div>
          <p className="mt-1 leading-6">{viewModel.subtitle}</p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="font-semibold">Repository</dt>
              <dd className="truncate font-mono" title={viewModel.repositorySummary}>{viewModel.repositorySummary}</dd>
            </div>
            <div>
              <dt className="font-semibold">Package Manager</dt>
              <dd>{viewModel.packageManagerLabel}</dd>
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {viewModel.showRefreshButton ? (
            <Button
              type="button"
              variant="outline"
              className="bg-background/70"
              onClick={onRefreshPreflight}
            >
              重新检查
            </Button>
          ) : null}
          {viewModel.showAcknowledgeButton ? (
            <Button
              type="button"
              variant="outline"
              className="bg-background/70"
              onClick={onAcknowledgeWarnings}
            >
              记录风险继续
            </Button>
          ) : null}
        </div>
      </div>
      {viewModel.blockers.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {viewModel.blockers.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {viewModel.warnings.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {viewModel.warnings.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {viewModel.runtimeItems.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {viewModel.runtimeItems.map((item) => (
            <span
              key={item.label}
              className="rounded-full border border-current/20 bg-background/45 px-2.5 py-1 text-xs"
              title={item.status}
            >
              {item.label}: {item.available ? '可用' : '不可用'}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}

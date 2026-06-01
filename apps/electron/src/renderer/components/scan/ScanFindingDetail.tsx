import * as React from 'react'
import { useAtomValue } from 'jotai'
import { selectedFindingAtom } from '@/atoms/scan-atoms'
import type { ScanFinding } from '@codeinsights/shared'
import { cn } from '@/lib/utils'
import { FileText, AlertCircle, ChevronRight } from 'lucide-react'

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-status-critical/15 text-status-critical border-status-critical/30',
  high: 'bg-status-error/15 text-status-error border-status-error/30',
  medium: 'bg-status-warning/15 text-status-warning border-status-warning/30',
  low: 'bg-status-success/15 text-status-success border-status-success/30',
  info: 'bg-status-info/15 text-status-info border-status-info/30',
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
  info: '信息',
}

const STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  triaged: '已分诊',
  confirmed: '已确认',
  fixed: '已修复',
  false_positive: '误报',
  suppressed: '已忽略',
}

export function ScanFindingDetail(): React.ReactElement {
  const finding = useAtomValue(selectedFindingAtom)

  if (!finding) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <FileText size={48} className="mx-auto mb-3 text-text-tertiary/50" />
          <div className="text-sm text-text-secondary mb-1">选择漏洞查看详情</div>
          <div className="text-xs text-text-tertiary">从左侧列表中选择一个漏洞</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 头部 */}
      <div className="border-b border-border-subtle/60 bg-surface-card/50 p-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  SEVERITY_COLORS[finding.severity] ?? SEVERITY_COLORS.info,
                )}
              >
                {SEVERITY_LABELS[finding.severity] ?? finding.severity}
              </span>
              <span className="rounded-full bg-surface-app/80 px-2 py-0.5 text-[11px] text-text-secondary">
                {STATUS_LABELS[finding.status] ?? finding.status}
              </span>
              {finding.cvssScore && (
                <span className="rounded-full bg-surface-app/80 px-2 py-0.5 text-[11px] text-text-secondary">
                  CVSS: {finding.cvssScore}
                </span>
              )}
              {finding.cweId && (
                <span className="rounded-full bg-surface-app/80 px-2 py-0.5 text-[11px] text-text-secondary">
                  {finding.cweId}
                </span>
              )}
            </div>
            <h2 className="text-sm font-medium text-text-primary">{finding.title}</h2>
          </div>
        </div>

        {/* 元信息 */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="mb-1 text-text-tertiary">文件路径</div>
            <div className="flex items-center gap-1 rounded-lg bg-surface-app/60 px-2 py-1.5 font-mono text-[11px]">
              <FileText size={12} className="flex-shrink-0 text-text-tertiary" />
              <span className="truncate">{finding.location.filePath}</span>
            </div>
          </div>
          <div>
            <div className="mb-1 text-text-tertiary">代码位置</div>
            <div className="rounded-lg bg-surface-app/60 px-2 py-1.5 font-mono text-[11px]">
              第 {finding.location.line} 行
              {finding.location.column ? `，第 ${finding.location.column} 列` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* 描述 */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <AlertCircle size={12} />
              问题描述
            </h3>
            <div className="rounded-xl border border-border-subtle/60 bg-surface-card/40 p-3 text-xs leading-relaxed text-text-primary">
              {finding.description}
            </div>
          </section>

          {/* 修复建议 */}
          {finding.recommendation && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <ChevronRight size={12} />
                修复建议
              </h3>
              <div className="rounded-xl border border-border-subtle/60 bg-surface-card/40 p-3 text-xs leading-relaxed text-text-primary">
                {finding.recommendation}
              </div>
            </section>
          )}

          {/* 代码片段 */}
          {finding.location.snippet && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <FileText size={12} />
                代码片段
              </h3>
              <div className="rounded-xl border border-border-subtle/60 bg-surface-card/40 overflow-hidden">
                <div className="border-b border-border-subtle/40 bg-surface-app/30 px-3 py-1.5 font-mono text-[10px] text-text-tertiary">
                  {finding.location.filePath}:{finding.location.line}
                </div>
                <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-text-primary">
                  <code>{finding.location.snippet}</code>
                </pre>
              </div>
            </section>
          )}

          {/* 参考链接 */}
          {finding.references && finding.references.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <ChevronRight size={12} />
                参考链接
              </h3>
              <ul className="space-y-1.5">
                {finding.references.map((ref: string, index: number) => (
                  <li key={index} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-text-secondary hover:bg-surface-hover">
                    <ChevronRight size={10} className="flex-shrink-0" />
                    <a href={ref} target="_blank" rel="noopener noreferrer" className="truncate hover:text-focus">
                      {ref}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 标签 */}
          {finding.tags && finding.tags.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <ChevronRight size={12} />
                标签
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {finding.tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="rounded-full bg-surface-app/60 px-2 py-0.5 text-[10px] text-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

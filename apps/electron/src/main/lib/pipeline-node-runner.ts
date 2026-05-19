import type {
  AgentStreamEnvelope,
  JsonSchemaOutputFormat,
  PatchWorkFileKind,
  PatchWorkFileRef,
  PipelineChangedFile,
  PipelineDeveloperStageOutput,
  PipelineExplorerReportRef,
  PipelineNodeKind,
  PipelinePatchSetSummary,
  PipelinePlannerStageOutput,
  PipelineReviewIssue,
  PipelineReviewIssueCategory,
  PipelineReviewIssueSeverity,
  PipelineReviewIssueStatus,
  PipelineReviewerStageOutput,
  PipelineTestEvidence,
  PipelineTestRun,
  PipelineVersion,
  PipelineStageOutput,
  PipelineStageOutputMap,
  PipelineStreamEvent,
  RVInsightsPermissionMode,
  SDKAssistantMessage,
  SDKContentBlock,
} from '@rv-insights/shared'
import {
  SAFE_TOOLS,
  isAgentCompatibleProvider,
} from '@rv-insights/shared'
import type { CanUseToolOptions, PermissionResult } from './agent-permission-service'
import { getChannelById, decryptApiKey } from './channel-manager'
import {
  ensurePluginManifest,
  getAgentWorkspace,
  getWorkspaceAttachedDirectories,
  getWorkspaceMcpConfig,
  getWorkspacePermissionMode,
} from './agent-workspace-manager'
import {
  getAgentSessionWorkspacePath,
  getAgentWorkspacePath,
} from './config-paths'
import {
  ClaudeAgentAdapter,
  type ClaudeAgentQueryOptions,
} from './adapters/claude-agent-adapter'
import { buildSdkEnv, resolveSDKCliPath } from './agent-sdk-env'
import type {
  AgentRuntimeRunMetadata,
  AgentRuntimeRunner,
} from './agent-runtime-types'
import { getContributionTaskByPipelineSessionId } from './contribution-task-service'
import {
  clearPatchWorkFilesByKind,
  listPatchWorkExplorerReports,
  readPatchWorkManifest,
  readPatchWorkManifestFile,
  writePatchWorkFile,
} from './pipeline-patch-work-service'
import {
  buildPipelinePatchSetDraft,
  readPipelineSubmissionDraftContext,
} from './pipeline-git-submission-service'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const V2_READ_ONLY_DISALLOWED_TOOLS = [
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
] as const

export const agentRuntimePipelineRunnerV2 = {
  enabled: process.env.RV_AGENT_RUNTIME_PIPELINE_RUNNER_V2 === '1',
}

export interface PipelineNodeExecutionContext {
  sessionId: string
  userInput: string
  currentNode: PipelineNodeKind
  version?: PipelineVersion
  reviewIteration: number
  lastApprovedNode?: PipelineNodeKind
  feedback?: string
  stageOutputs?: PipelineStageOutputMap
  signal?: AbortSignal
}

export interface PipelineNodeExecutionResult {
  output: string
  summary: string
  approved?: boolean
  issues?: string[]
  stageOutput?: PipelineStageOutput
}

export interface PipelineNodeRunner {
  runNode(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult>
  abort?(sessionId: string): void
}

export interface PipelineNodePrompts {
  systemPrompt: string
  userPrompt: string
}

export class PipelineStructuredOutputError extends Error {
  readonly code = 'PIPELINE_STRUCTURED_OUTPUT_INVALID'
  readonly node: PipelineNodeKind
  readonly issues: string[]
  readonly output: string

  constructor(node: PipelineNodeKind, issues: string[], output: string) {
    super(`Pipeline ${node} 结构化输出解析失败: ${issues.join('；')}`)
    this.name = 'PipelineStructuredOutputError'
    this.node = node
    this.issues = issues
    this.output = output
  }
}

export interface ClaudePipelineNodeRunnerOptions {
  channelId?: string
  workspaceId?: string
  onEvent?: (event: PipelineStreamEvent) => void
  runtimeRunner?: AgentRuntimeRunner
}

interface ResolvedWorkspaceContext {
  slug?: string
  name?: string
  cwd?: string
}

function buildMcpServers(workspaceSlug?: string): Record<string, Record<string, unknown>> {
  if (!workspaceSlug) return {}

  const mcpConfig = getWorkspaceMcpConfig(workspaceSlug)
  const mcpServers: Record<string, Record<string, unknown>> = {}

  for (const [name, entry] of Object.entries(mcpConfig.servers ?? {})) {
    if (!entry.enabled || name === 'memos-cloud') continue

    if (entry.type === 'stdio' && entry.command) {
      mcpServers[name] = {
        type: 'stdio',
        command: entry.command,
        ...(entry.args?.length ? { args: entry.args } : {}),
        ...(entry.env ? { env: entry.env } : {}),
      }
      continue
    }

    if ((entry.type === 'http' || entry.type === 'sse') && entry.url) {
      mcpServers[name] = {
        type: entry.type,
        url: entry.url,
      }
    }
  }

  return mcpServers
}

function resolveWorkspaceContext(
  workspaceId: string | undefined,
  sessionId: string,
): ResolvedWorkspaceContext {
  if (!workspaceId) return {}

  const workspace = getAgentWorkspace(workspaceId)
  if (!workspace) return {}

  ensurePluginManifest(workspace.slug, workspace.name)

  return {
    slug: workspace.slug,
    name: workspace.name,
    cwd: getAgentSessionWorkspacePath(workspace.slug, sessionId),
  }
}

function resolveModel(channelId?: string): string {
  if (!channelId) return DEFAULT_MODEL
  const channel = getChannelById(channelId)
  const enabled = channel?.models.find((model) => model.enabled)
  return enabled?.id ?? channel?.models[0]?.id ?? DEFAULT_MODEL
}

function compactStageOutputsForPrompt(stageOutputs: PipelineStageOutputMap | undefined): string {
  const entries = Object.values(stageOutputs ?? {})
    .filter((output): output is PipelineStageOutput => Boolean(output))
    .map((output) => {
      const { content: _content, ...compactOutput } = output
      return compactOutput
    })

  if (entries.length === 0) return ''

  return [
    '',
    '上游阶段产物（JSON，仅用于保持上下文连续）：',
    JSON.stringify(entries, null, 2),
    '',
  ].join('\n')
}

function buildSystemPrompt(node: PipelineNodeKind): string {
  const jsonOnlyRule = '最终回复必须只包含一个 JSON object，不要输出 Markdown、解释文字、工具执行计划或 JSON 之外的任何前后缀。'
  switch (node) {
    case 'explorer':
      return [
        '你是 RV Pipeline 的 Explorer 节点。',
        '目标：基于用户需求快速梳理任务背景、代码入口和可执行方向。',
        '输出要求：给出简洁的探索结论、关键文件/模块、下一步建议。',
        '必须严格遵守结构化输出 schema，不要返回 schema 之外的字段。',
        jsonOnlyRule,
      ].join('\n')
    case 'planner':
      return [
        '你是 RV Pipeline 的 Planner 节点。',
        '目标：输出可执行的开发与验证方案，避免空泛描述。',
        '输出要求：方案步骤、风险点、验证方式。',
        '必须严格遵守结构化输出 schema，不要返回 schema 之外的字段。',
        jsonOnlyRule,
      ].join('\n')
    case 'developer':
      return [
        '你是 RV Pipeline 的 Developer 节点。',
        '目标：按计划直接完成代码实现和必要测试。',
        '输出要求：说明改动、验证结果、遗留风险。',
        '必须严格遵守结构化输出 schema，不要返回 schema 之外的字段。',
        jsonOnlyRule,
      ].join('\n')
    case 'reviewer':
      return [
        '你是 RV Pipeline 的 Reviewer 节点。',
        '目标：审查本轮开发结果，给出明确通过/驳回结论。',
        '请仅围绕正确性、回归风险、测试缺口、实现质量给出判断。',
        '必须严格遵守结构化输出 schema，approved 字段必须是 boolean。',
        jsonOnlyRule,
      ].join('\n')
    case 'tester':
      return [
        '你是 RV Pipeline 的 Tester 节点。',
        '目标：执行验证并输出测试结论。',
        '输出要求：运行了什么、结果如何、是否还有阻塞项。',
        '必须严格遵守结构化输出 schema，不要返回 schema 之外的字段。',
        jsonOnlyRule,
      ].join('\n')
    case 'committer':
      return [
        '你是 RV Pipeline 的 Committer 节点。',
        '目标：生成可审核的提交信息和 PR 草稿，不执行真实 commit、push 或创建 PR。',
        '输出要求：commit message、PR 标题、PR 正文、提交状态和风险说明。',
        '必须严格遵守结构化输出 schema，不要返回 schema 之外的字段。',
        jsonOnlyRule,
      ].join('\n')
  }
}

function buildV2SystemPromptAppendix(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
): string | undefined {
  if (context.version !== 2) return undefined

  if (node === 'explorer') {
    return [
      'Pipeline v2 约束：',
      '- 不要修改源码或工作区文件。',
      '- 请输出多个候选 reports，应用会把它们写入 patch-work/explorer/report-*.md。',
      '- 每个 report 至少包含 title、summary、rationale、keyFiles。',
      '- 如果需要先说明探索过程，也必须把说明压缩进 summary / findings / reports 字段里。',
    ].join('\n')
  }

  if (node === 'planner') {
    return [
      'Pipeline v2 约束：',
      '- 不要修改源码或工作区文件。',
      '- 必须基于 selected-task.md 输出 planMarkdown 和 testPlanMarkdown。',
      '- 应用会把 planMarkdown 写入 patch-work/plan.md，把 testPlanMarkdown 写入 patch-work/test-plan.md。',
    ].join('\n')
  }

  if (node === 'developer') {
    return [
      'Pipeline v2 约束：',
      '- 必须基于已接受的 patch-work/plan.md 和 patch-work/test-plan.md 完成实现。',
      '- 可以修改源码和测试，但不要执行 git commit、git push 或创建 PR。',
      '- 最终 JSON 必须包含 changedFiles、testsRun、devMarkdown；没有可填内容时使用空数组或空字符串。',
      '- 应用会把 devMarkdown 写入 patch-work/dev.md。',
      '- devMarkdown 必须覆盖需求复述、实现摘要、变更文件、验证情况、未执行验证、风险和 reviewer 关注点。',
    ].join('\n')
  }

  if (node === 'reviewer') {
    return [
      'Pipeline v2 约束：',
      '- 必须保持 read-only，不要修改源码、patch-work 或 Git 状态。',
      '- 必须读取已接受的 patch-work/dev.md，并结合 git diff -- . \':!patch-work/**\' 审查源码变更。',
      '- 最终 JSON 必须包含 issues、structuredIssues、reviewMarkdown；没有结构化问题时 structuredIssues 使用空数组。',
      '- issues 字段保留问题标题数组；structuredIssues 提供 stable id、severity、category、detail 和 status。',
      '- 应用会把 reviewMarkdown 写入 patch-work/review.md。',
    ].join('\n')
  }

  if (node === 'tester') {
    return [
      'Pipeline v2 约束：',
      '- 必须读取已接受的 patch-work/test-plan.md、patch-work/dev.md 和最新 patch-work/review.md。',
      '- 可以运行测试和做必要修复，但不要执行 git 命令、git commit、git push 或创建 PR。',
      '- 应用会在节点结束后生成 patch-set，并保证排除 patch-work/**。',
      '- 最终 JSON 必须包含 passed、testEvidence 和 resultMarkdown；应用会写入 result.md 和 patch-work/patch-set/*。',
      '- 如果环境缺失导致测试无法运行，请把原因写入 blockers，并将 passed 设为 false。',
    ].join('\n')
  }

  if (node === 'committer') {
    return [
      'Pipeline v2 约束：',
      '- 必须读取已接受的 patch-work/result.md、patch-set/changes.patch、patch-set/changed-files.json、patch-set/diff-summary.md、patch-set/test-evidence.json、CONTRIBUTING 和 Git 状态。',
      '- 只生成 commit.md 和 pr.md 草稿，不要执行 git add、git commit、git push 或创建 PR。',
      '- 应用会把提交材料写入 patch-work/commit.md 和 patch-work/pr.md。',
      '- 最终 JSON 必须包含 commitMarkdown 和 prMarkdown；如果没有充分阻塞，也必须保持 draft-only，不得尝试真实本地提交或远端写。',
    ].join('\n')
  }

  return undefined
}

function readSelectedTaskForPrompt(context: PipelineNodeExecutionContext): string | undefined {
  if (context.version !== 2 || context.currentNode !== 'planner') return undefined

  const task = getContributionTaskByPipelineSessionId(context.sessionId)
  if (!task) {
    throw new Error(`未找到 Pipeline 贡献任务，无法读取 selected-task.md: ${context.sessionId}`)
  }

  return readPatchWorkManifestFile({
    repositoryRoot: task.repositoryRoot,
    relativePath: 'selected-task.md',
  })
}

interface AcceptedPatchWorkDocument {
  ref: PatchWorkFileRef
  content: string
}

function readAcceptedPatchWorkDocumentForPrompt(input: {
  context: PipelineNodeExecutionContext
  kind: PatchWorkFileKind
  label: string
  requireAccepted?: boolean
}): AcceptedPatchWorkDocument {
  const task = getContributionTaskByPipelineSessionId(input.context.sessionId)
  if (!task) {
    throw new Error(`未找到 Pipeline 贡献任务，无法读取 ${input.label}: ${input.context.sessionId}`)
  }

  const manifest = readPatchWorkManifest(task.repositoryRoot)
  const file = manifest.files.find((item) => item.kind === input.kind)
  if (!file) {
    throw new Error(`patch-work 文档不存在，无法读取 ${input.label}`)
  }
  if (input.requireAccepted !== false && !file.acceptedRevision) {
    throw new Error(`patch-work 文档尚未通过人工审核，无法读取 ${input.label}`)
  }

  return {
    ref: file,
    content: readPatchWorkManifestFile({
      repositoryRoot: task.repositoryRoot,
      relativePath: file.relativePath,
    }),
  }
}

function buildAcceptedDocumentPromptSection(
  title: string,
  document: AcceptedPatchWorkDocument,
): string {
  return [
    `${title}（${document.ref.relativePath}）：`,
    document.content,
  ].join('\n')
}

function buildV2PatchWorkPromptSections(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
): string[] {
  if (context.version !== 2) return []

  if (node === 'developer') {
    return [
      buildAcceptedDocumentPromptSection(
        '已接受开发方案',
        readAcceptedPatchWorkDocumentForPrompt({
          context,
          kind: 'implementation_plan',
          label: 'plan.md',
        }),
      ),
      buildAcceptedDocumentPromptSection(
        '已接受测试方案',
        readAcceptedPatchWorkDocumentForPrompt({
          context,
          kind: 'test_plan',
          label: 'test-plan.md',
        }),
      ),
    ]
  }

  if (node === 'reviewer') {
    return [
      buildAcceptedDocumentPromptSection(
        '已接受开发方案',
        readAcceptedPatchWorkDocumentForPrompt({
          context,
          kind: 'implementation_plan',
          label: 'plan.md',
        }),
      ),
      buildAcceptedDocumentPromptSection(
        '已接受测试方案',
        readAcceptedPatchWorkDocumentForPrompt({
          context,
          kind: 'test_plan',
          label: 'test-plan.md',
        }),
      ),
      buildAcceptedDocumentPromptSection(
        '已接受开发文档',
        readAcceptedPatchWorkDocumentForPrompt({
          context,
          kind: 'dev_doc',
          label: 'dev.md',
        }),
      ),
      '请使用只读方式审查当前源码 diff：`git diff -- . \':!patch-work/**\'`，不要修改任何文件。',
    ]
  }

  if (node === 'tester') {
    return [
      buildAcceptedDocumentPromptSection(
        '已接受测试方案',
        readAcceptedPatchWorkDocumentForPrompt({
          context,
          kind: 'test_plan',
          label: 'test-plan.md',
        }),
      ),
      buildAcceptedDocumentPromptSection(
        '已接受开发文档',
        readAcceptedPatchWorkDocumentForPrompt({
          context,
          kind: 'dev_doc',
          label: 'dev.md',
        }),
      ),
      buildAcceptedDocumentPromptSection(
        '审查报告',
        readAcceptedPatchWorkDocumentForPrompt({
          context,
          kind: 'review_doc',
          label: 'review.md',
          requireAccepted: false,
        }),
      ),
      '请基于已接受文档和测试执行结果输出结构化测试结论。应用会在节点完成后基于 Git 状态生成 patch-set 草稿并排除 patch-work/**；不要执行 git 命令、git commit、git push 或创建 PR。',
    ]
  }

  if (node === 'committer') {
    const task = getContributionTaskByPipelineSessionId(context.sessionId)
    if (!task) {
      throw new Error(`未找到 Pipeline 贡献任务，无法读取提交草稿上下文: ${context.sessionId}`)
    }
    const submissionContext = readPipelineSubmissionDraftContext({
      repositoryRoot: task.repositoryRoot,
    })
    const resultDoc = readAcceptedPatchWorkDocumentForPrompt({
      context,
      kind: 'test_result',
      label: 'result.md',
    })
    const patchDoc = readAcceptedPatchWorkDocumentForPrompt({
      context,
      kind: 'patch',
      label: 'patch-set/changes.patch',
    })
    const changedFilesDoc = readAcceptedPatchWorkDocumentForPrompt({
      context,
      kind: 'changed_files',
      label: 'patch-set/changed-files.json',
    })
    const diffSummaryDoc = readAcceptedPatchWorkDocumentForPrompt({
      context,
      kind: 'diff_summary',
      label: 'patch-set/diff-summary.md',
    })
    const evidenceDoc = readAcceptedPatchWorkDocumentForPrompt({
      context,
      kind: 'test_evidence',
      label: 'patch-set/test-evidence.json',
    })

    return [
      buildAcceptedDocumentPromptSection('测试报告', resultDoc),
      buildAcceptedDocumentPromptSection('patch-set/changes.patch', patchDoc),
      buildAcceptedDocumentPromptSection('patch-set/changed-files.json', changedFilesDoc),
      buildAcceptedDocumentPromptSection('patch-set/diff-summary.md', diffSummaryDoc),
      buildAcceptedDocumentPromptSection('patch-set/test-evidence.json', evidenceDoc),
      submissionContext.contributingGuidelines
        ? `CONTRIBUTING（${submissionContext.contributingGuidelinesPath}）：\n${submissionContext.contributingGuidelines}`
        : '未找到 CONTRIBUTING 说明，需在提交草稿中提示缺失。',
      [
        'Git 状态：',
        `- Working branch: ${submissionContext.workingBranch ?? 'unknown'}`,
        `- HEAD: ${submissionContext.headCommit ?? 'unknown'}`,
        submissionContext.statusPorcelain ? submissionContext.statusPorcelain : '- 工作区干净。',
        '',
        submissionContext.diffSummaryMarkdown,
        '',
        '- 不要执行 git add、git commit、git push 或创建 PR。',
      ].join('\n'),
      '请根据以上输入生成 commit.md 与 pr.md 草稿，明确风险和 blocker，但不要尝试真实提交。',
    ]
  }

  return []
}

function buildUserPrompt(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
  workspaceName?: string,
): string {
  const selectedTaskContent = node === 'planner'
    ? readSelectedTaskForPrompt(context)
    : undefined
  return [
    workspaceName ? `当前工作区：${workspaceName}` : undefined,
    selectedTaskContent
      ? `已选任务（selected-task.md）：\n${selectedTaskContent}`
      : undefined,
    ...buildV2PatchWorkPromptSections(node, context),
    compactStageOutputsForPrompt(context.stageOutputs).trim() || undefined,
    context.feedback ? `人工反馈：${context.feedback}` : undefined,
    `用户需求：${context.userInput}`,
    node === 'developer' || node === 'reviewer'
      ? `当前 reviewer 轮次：${context.reviewIteration}`
      : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n')
}

export function buildPipelineNodePrompts(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
  workspaceName?: string,
): PipelineNodePrompts {
  return {
    systemPrompt: [
      buildSystemPrompt(node),
      buildV2SystemPromptAppendix(node, context),
    ].filter((line): line is string => Boolean(line)).join('\n\n'),
    userPrompt: buildUserPrompt(node, context, workspaceName),
  }
}

function stringArraySchema(): Record<string, unknown> {
  return {
    type: 'array',
    items: { type: 'string' },
  }
}

function explorerReportDraftSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'summary', 'rationale', 'keyFiles'],
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      rationale: { type: 'string' },
      keyFiles: stringArraySchema(),
    },
  }
}

function changedFileSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['path', 'changeType', 'summary'],
    properties: {
      path: { type: 'string' },
      changeType: {
        type: 'string',
        enum: ['added', 'modified', 'deleted', 'renamed'],
      },
      summary: { type: 'string' },
    },
  }
}

function testRunSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['command', 'status', 'summary', 'durationMs'],
    properties: {
      command: { type: 'string' },
      status: {
        type: 'string',
        enum: ['passed', 'failed', 'skipped'],
      },
      summary: { type: 'string' },
      durationMs: { type: 'number' },
    },
  }
}

function reviewIssueSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'severity', 'category', 'title', 'detail', 'status', 'file', 'line', 'suggestedFix'],
    properties: {
      id: { type: 'string' },
      severity: {
        type: 'string',
        enum: ['blocker', 'major', 'minor', 'nit'],
      },
      category: {
        type: 'string',
        enum: ['correctness', 'regression', 'test_gap', 'maintainability', 'security', 'style'],
      },
      title: { type: 'string' },
      detail: { type: 'string' },
      status: {
        type: 'string',
        enum: ['open', 'fixed', 'accepted_risk'],
      },
      file: { type: 'string' },
      line: { type: 'number' },
      suggestedFix: { type: 'string' },
    },
  }
}

export function pipelineNodeJsonSchema(node: PipelineNodeKind): Record<string, unknown> {
  switch (node) {
    case 'explorer':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'findings', 'keyFiles', 'nextSteps', 'reports'],
        properties: {
          summary: { type: 'string' },
          findings: stringArraySchema(),
          keyFiles: stringArraySchema(),
          nextSteps: stringArraySchema(),
          reports: {
            type: 'array',
            items: explorerReportDraftSchema(),
          },
        },
      }
    case 'planner':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'steps', 'risks', 'verification', 'planMarkdown', 'testPlanMarkdown'],
        properties: {
          summary: { type: 'string' },
          steps: stringArraySchema(),
          risks: stringArraySchema(),
          verification: stringArraySchema(),
          planMarkdown: { type: 'string' },
          testPlanMarkdown: { type: 'string' },
        },
      }
    case 'developer':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'changes', 'tests', 'risks', 'changedFiles', 'testsRun', 'devMarkdown'],
        properties: {
          summary: { type: 'string' },
          changes: stringArraySchema(),
          tests: stringArraySchema(),
          risks: stringArraySchema(),
          changedFiles: {
            type: 'array',
            items: changedFileSchema(),
          },
          testsRun: {
            type: 'array',
            items: testRunSchema(),
          },
          devMarkdown: { type: 'string' },
        },
      }
    case 'reviewer':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['approved', 'summary', 'issues', 'structuredIssues', 'reviewMarkdown'],
        properties: {
          approved: { type: 'boolean' },
          summary: { type: 'string' },
          issues: stringArraySchema(),
          structuredIssues: {
            type: 'array',
            items: reviewIssueSchema(),
          },
          reviewMarkdown: { type: 'string' },
        },
      }
    case 'tester':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'commands', 'results', 'blockers', 'passed', 'testEvidence', 'resultMarkdown'],
        properties: {
          summary: { type: 'string' },
          commands: stringArraySchema(),
          results: stringArraySchema(),
          blockers: stringArraySchema(),
          passed: { type: 'boolean' },
          testEvidence: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['command', 'status', 'summary', 'durationMs'],
              properties: {
                command: { type: 'string' },
                status: {
                  type: 'string',
                  enum: ['passed', 'failed', 'skipped'],
                },
                summary: { type: 'string' },
                durationMs: { type: 'number' },
              },
            },
          },
          resultMarkdown: { type: 'string' },
        },
      }
    case 'committer':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'commitMessage', 'prTitle', 'prBody', 'submissionStatus', 'blockers', 'risks', 'commitMarkdown', 'prMarkdown'],
        properties: {
          summary: { type: 'string' },
          commitMessage: { type: 'string' },
          prTitle: { type: 'string' },
          prBody: { type: 'string' },
          submissionStatus: {
            type: 'string',
            enum: [
              'draft_only',
              'blocked',
            ],
          },
          blockers: stringArraySchema(),
          risks: stringArraySchema(),
          commitMarkdown: { type: 'string' },
          prMarkdown: { type: 'string' },
        },
      }
  }
}

function pipelineNodeOutputFormat(node: PipelineNodeKind): JsonSchemaOutputFormat {
  return {
    type: 'json_schema',
    name: `pipeline_${node}_artifact`,
    description: `Pipeline ${node} structured artifact`,
    schema: pipelineNodeJsonSchema(node),
  }
}

function extractAssistantText(message: SDKAssistantMessage): string {
  return message.message.content
    .filter((block): block is SDKContentBlock & { type: 'text'; text: string } =>
      block.type === 'text' && typeof (block as { text?: unknown }).text === 'string')
    .map((block) => block.text)
    .join('\n')
}

function parseJsonObjectCandidate(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text.trim()) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function extractFencedJsonCandidates(text: string): string[] {
  const candidates: string[] = []
  const fencePattern = /```(?:json|JSON)?\s*([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = fencePattern.exec(text)) !== null) {
    const candidate = match[1]?.trim()
    if (candidate) {
      candidates.push(candidate)
    }
  }

  return candidates
}

function extractBalancedJsonObjectCandidates(text: string): string[] {
  const candidates: string[] = []
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (start >= 0 && inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      if (start >= 0) {
        inString = true
      }
      continue
    }

    if (char === '{') {
      if (start < 0) {
        start = index
      }
      depth += 1
      continue
    }

    if (char === '}' && start >= 0) {
      depth -= 1
      if (depth === 0) {
        candidates.push(text.slice(start, index + 1))
        start = -1
      }
    }
  }

  return candidates
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const direct = parseJsonObjectCandidate(text)
  if (direct) return direct

  const candidates = [
    ...extractFencedJsonCandidates(text),
    ...extractBalancedJsonObjectCandidates(text),
  ]

  for (const candidate of candidates) {
    const parsed = parseJsonObjectCandidate(candidate)
    if (parsed) return parsed
  }

  return null
}

function readRequiredString(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): string {
  const value = parsed[field]
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  issues.push(`缺少或非法字段: ${field}`)
  return ''
}

function readRequiredStringArray(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): string[] {
  const value = parsed[field]
  if (!Array.isArray(value)) {
    issues.push(`缺少或非法字段: ${field}`)
    return []
  }

  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
  if (items.length !== value.length) {
    issues.push(`字段包含非字符串项: ${field}`)
  }
  return items
}

function readOptionalStringArray(
  parsed: Record<string, unknown>,
  field: string,
): string[] | undefined {
  const value = parsed[field]
  if (!Array.isArray(value)) return undefined
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function readRequiredBoolean(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): boolean {
  const value = parsed[field]
  if (typeof value === 'boolean') return value
  issues.push(`缺少或非法字段: ${field}`)
  return false
}

function readEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return typeof value === 'string' && allowed.includes(value as T)
    ? value as T
    : null
}

function readOptionalChangedFiles(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): PipelineChangedFile[] | undefined {
  const value = parsed[field]
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    issues.push(`缺少或非法字段: ${field}`)
    return undefined
  }

  const changedFiles: PipelineChangedFile[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      issues.push(`字段包含非法对象: ${field}[${index}]`)
      return
    }
    const record = item as Record<string, unknown>
    const path = typeof record.path === 'string' ? record.path.trim() : ''
    const changeType = readEnumValue(record.changeType, ['added', 'modified', 'deleted', 'renamed'] as const)
    const summary = typeof record.summary === 'string' ? record.summary.trim() : ''
    if (!path || !changeType || !summary) {
      issues.push(`缺少或非法字段: ${field}[${index}]`)
      return
    }
    changedFiles.push({ path, changeType, summary })
  })

  return changedFiles
}

function readOptionalTestRuns(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): PipelineTestRun[] | undefined {
  const value = parsed[field]
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    issues.push(`缺少或非法字段: ${field}`)
    return undefined
  }

  const testsRun: PipelineTestRun[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      issues.push(`字段包含非法对象: ${field}[${index}]`)
      return
    }
    const record = item as Record<string, unknown>
    const command = typeof record.command === 'string' ? record.command.trim() : ''
    const status = readEnumValue(record.status, ['passed', 'failed', 'skipped'] as const)
    const summary = typeof record.summary === 'string' ? record.summary.trim() : ''
    if (!command || !status || !summary) {
      issues.push(`缺少或非法字段: ${field}[${index}]`)
      return
    }
    testsRun.push({
      command,
      status,
      summary,
      durationMs: typeof record.durationMs === 'number' && Number.isFinite(record.durationMs)
        ? record.durationMs
        : undefined,
    })
  })

  return testsRun
}

function readOptionalTestEvidence(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): PipelineTestEvidence[] | undefined {
  const value = parsed[field]
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    issues.push(`缺少或非法字段: ${field}`)
    return undefined
  }

  const evidence: PipelineTestEvidence[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      issues.push(`字段包含非法对象: ${field}[${index}]`)
      return
    }
    const record = item as Record<string, unknown>
    const command = typeof record.command === 'string' ? record.command.trim() : ''
    const status = readEnumValue(record.status, ['passed', 'failed', 'skipped'] as const)
    const summary = typeof record.summary === 'string' ? record.summary.trim() : ''
    if (!command || !status || !summary) {
      issues.push(`缺少或非法字段: ${field}[${index}]`)
      return
    }
    evidence.push({
      command,
      status,
      summary,
      durationMs: typeof record.durationMs === 'number' && Number.isFinite(record.durationMs)
        ? record.durationMs
        : undefined,
    })
  })

  return evidence
}

function buildStableReviewIssueId(index: number): string {
  return `RV-REV-${String(index + 1).padStart(3, '0')}`
}

function readOptionalReviewIssues(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): PipelineReviewIssue[] | undefined {
  const value = parsed[field]
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    issues.push(`缺少或非法字段: ${field}`)
    return undefined
  }

  const reviewIssues: PipelineReviewIssue[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      issues.push(`字段包含非法对象: ${field}[${index}]`)
      return
    }
    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    const severity = readEnumValue<PipelineReviewIssueSeverity>(
      record.severity,
      ['blocker', 'major', 'minor', 'nit'] as const,
    )
    const category = readEnumValue<PipelineReviewIssueCategory>(
      record.category,
      ['correctness', 'regression', 'test_gap', 'maintainability', 'security', 'style'] as const,
    )
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const detail = typeof record.detail === 'string' ? record.detail.trim() : ''
    const status = readEnumValue<PipelineReviewIssueStatus>(
      record.status,
      ['open', 'fixed', 'accepted_risk'] as const,
    )
    const file = typeof record.file === 'string' ? record.file.trim() : ''
    const suggestedFix = typeof record.suggestedFix === 'string' ? record.suggestedFix.trim() : ''
    const line = typeof record.line === 'number' && Number.isFinite(record.line) ? record.line : undefined
    if (!id || !severity || !category || !title || !detail || !status || !file || line === undefined || !suggestedFix) {
      issues.push(`缺少或非法字段: ${field}[${index}]`)
      return
    }

    reviewIssues.push({
      id,
      severity,
      category,
      title,
      detail,
      status,
      file,
      line,
      suggestedFix,
    })
  })

  return reviewIssues
}

function readSubmissionStatus(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): 'draft_only' | 'blocked' {
  const value = parsed[field]
  if (
    value === 'draft_only'
    || value === 'blocked'
  ) {
    return value
  }
  issues.push(`缺少或非法字段: ${field}（Phase 6 仅允许 draft_only 或 blocked）`)
  return 'blocked'
}

function splitNonEmptyTextBlocks(text: string): string[] {
  return text
    .split(/\n{2,}|\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function truncateForSummary(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`
}

function extractLikelyFilePaths(text: string): string[] {
  const matches = text.match(/[A-Za-z0-9_.@/-]+\.(?:ts|tsx|js|jsx|json|md|go|rs|py|java|c|h|cpp|hpp|yml|yaml|toml|lock)\b/g) ?? []
  return [...new Set(matches)].slice(0, 12)
}

function buildExplorerFallbackStageOutput(
  text: string,
): Extract<PipelineStageOutput, { node: 'explorer' }> {
  const blocks = splitNonEmptyTextBlocks(text)
  const summarySource = blocks[0] ?? 'Explorer 返回了非 JSON 探索结果'
  const findings = blocks.length > 0
    ? blocks.slice(0, 6).map((block) => truncateForSummary(block, 240))
    : ['Explorer 没有返回可解析的结构化 JSON，已保留原始输出供人工选择。']

  return {
    node: 'explorer',
    summary: truncateForSummary(summarySource, 160),
    findings,
    keyFiles: extractLikelyFilePaths(text),
    nextSteps: [
      '从 fallback 探索报告中选择一个任务方向后进入 planner。',
      '在 planner 阶段将自然语言探索结果收敛为 plan.md 和 test-plan.md。',
    ],
    content: text,
  }
}

function extractPlannerFallbackItems(text: string, keywords: string[], fallback: string[]): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*(?:[-*]|\d+[.)]|TC-\d+\s*[:：-]?)\s*/, '')
      .replace(/\*\*/g, '')
      .trim())
    .filter(Boolean)

  const matches = lines
    .filter((line) => keywords.some((keyword) => line.includes(keyword)))
    .map((line) => truncateForSummary(line, 180))

  return [...new Set(matches)].slice(0, 8).length > 0
    ? [...new Set(matches)].slice(0, 8)
    : fallback
}

function buildPlannerFallbackStageOutput(
  text: string,
): PipelinePlannerStageOutput {
  const blocks = splitNonEmptyTextBlocks(text)
  const summarySource = blocks[0] ?? 'Planner 返回了非 JSON 方案结果'

  return {
    node: 'planner',
    summary: truncateForSummary(summarySource, 160),
    steps: extractPlannerFallbackItems(text, [
      '步骤',
      '实施',
      'Developer',
      'Reviewer',
      'Tester',
      '创建',
      '修改',
      '生成',
    ], [
      '基于 selected-task.md 补齐最小实现方案。',
      '由 developer 按方案执行必要改动。',
      '由 reviewer 和 tester 分别审查与验证结果。',
    ]),
    risks: extractPlannerFallbackItems(text, [
      '风险',
      '权限',
      '失败',
      '阻塞',
      '写入',
    ], [
      'Planner 未返回结构化 JSON，已保留自然语言输出并使用 fallback 文档进入人工审核。',
    ]),
    verification: extractPlannerFallbackItems(text, [
      '验证',
      '测试',
      'TC-',
      'bun ',
      'typecheck',
    ], [
      '人工审核 fallback 生成的 plan.md 和 test-plan.md。',
      '后续 tester 必须基于实际证据保守判定。',
    ]),
    content: text,
  }
}

interface ExplorerReportDraft {
  title: string
  summary: string
  rationale?: string
  keyFiles: string[]
}

function readOptionalString(parsed: Record<string, unknown>, field: string): string | undefined {
  const value = parsed[field]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readExplorerReportDrafts(
  parsed: Record<string, unknown>,
  fallback: Extract<PipelineStageOutput, { node: 'explorer' }>,
): ExplorerReportDraft[] {
  const reports = parsed.reports
  if (Array.isArray(reports)) {
    const drafts = reports
      .filter((item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null)
      .map((item): ExplorerReportDraft | null => {
        const title = typeof item.title === 'string' ? item.title.trim() : ''
        const summary = typeof item.summary === 'string' ? item.summary.trim() : ''
        const rationale = typeof item.rationale === 'string' ? item.rationale.trim() : undefined
        const keyFiles = Array.isArray(item.keyFiles)
          ? item.keyFiles.filter((file): file is string => typeof file === 'string' && file.trim().length > 0)
          : fallback.keyFiles
        return title && summary
          ? {
              title,
              summary,
              ...(rationale ? { rationale } : {}),
              keyFiles,
            }
          : null
      })
      .filter((item): item is ExplorerReportDraft => item !== null)

    if (drafts.length > 0) return drafts
  }

  return [{
    title: fallback.summary,
    summary: fallback.findings[0] ?? fallback.summary,
    rationale: fallback.nextSteps[0],
    keyFiles: fallback.keyFiles,
  }]
}

function buildExplorerReportMarkdown(
  draft: ExplorerReportDraft,
  index: number,
): string {
  return [
    `# 探索报告：${draft.title}`,
    '',
    '## 贡献点概述',
    draft.summary,
    '',
    '## 为什么值得做',
    draft.rationale ?? '该方向来自 Explorer 对仓库和任务的结构化分析。',
    '',
    '## 相关文件',
    ...(draft.keyFiles.length > 0 ? draft.keyFiles.map((file) => `- \`${file}\``) : ['- 待 planner 进一步确认']),
    '',
    '## 可能修改范围',
    '由 planner 在选定任务后收敛为具体实施步骤。',
    '',
    '## 风险与不确定性',
    '需要在 planner 阶段继续验证边界和测试策略。',
    '',
    '## 建议验证方式',
    '补充相关单元测试，并运行阶段指定验证命令。',
    '',
    '## 适合作为 task 的原因',
    `这是 Explorer 生成的第 ${index + 1} 个候选贡献点，适合在人工选择后进入 planner。`,
    '',
  ].join('\n')
}

function toPatchWorkDocumentRef(ref: {
  displayName: string
  relativePath: string
  checksum: string
  revision: number
}) {
  return {
    displayName: ref.displayName,
    relativePath: ref.relativePath,
    checksum: ref.checksum,
    revision: ref.revision,
  }
}

function enrichExplorerPatchWorkArtifacts(
  context: PipelineNodeExecutionContext,
  result: PipelineNodeExecutionResult,
): PipelineNodeExecutionResult {
  if (result.stageOutput?.node !== 'explorer') return result
  const task = getContributionTaskByPipelineSessionId(context.sessionId)
  if (!task) return result

  const parsed = parseJsonObject(result.output) ?? {}
  const drafts = readExplorerReportDrafts(parsed, result.stageOutput)
  clearPatchWorkFilesByKind({
    repositoryRoot: task.repositoryRoot,
    kind: 'explorer_report',
  })
  drafts.forEach((draft, index) => {
    writePatchWorkFile({
      contributionTaskId: task.id,
      pipelineSessionId: context.sessionId,
      repositoryRoot: task.repositoryRoot,
      kind: 'explorer_report',
      relativePath: `explorer/report-${String(index + 1).padStart(3, '0')}.md`,
      displayName: `探索报告 ${String(index + 1).padStart(3, '0')}.md`,
      createdByNode: 'explorer',
      content: buildExplorerReportMarkdown(draft, index),
    })
  })

  const reports: PipelineExplorerReportRef[] = listPatchWorkExplorerReports({
    repositoryRoot: task.repositoryRoot,
  })

  return {
    ...result,
    stageOutput: {
      ...result.stageOutput,
      reports,
    },
  }
}

function buildFallbackPlanMarkdown(output: PipelinePlannerStageOutput): string {
  return [
    '# 开发方案',
    '',
    '## 任务来源',
    '来自 selected-task.md。',
    '',
    '## 目标行为',
    output.summary,
    '',
    '## 非目标',
    '- 不在 planner 阶段修改源码。',
    '',
    '## 相关文件和模块',
    '- 待 developer 根据方案确认。',
    '',
    '## 实施步骤',
    ...output.steps.map((step) => `- ${step}`),
    '',
    '## 数据/类型/API 变更',
    '- 按实施步骤确认。',
    '',
    '## UI/交互变更',
    '- 按实施步骤确认。',
    '',
    '## 风险',
    ...(output.risks.length > 0 ? output.risks.map((risk) => `- ${risk}`) : ['- 暂无明确风险。']),
    '',
    '## 回滚策略',
    '- 回滚本阶段代码改动，并保留 patch-work 文档用于复盘。',
    '',
  ].join('\n')
}

function buildFallbackTestPlanMarkdown(output: PipelinePlannerStageOutput): string {
  return [
    '# 测试方案',
    '',
    '## 验证目标',
    output.summary,
    '',
    '## 单元测试',
    ...output.verification.map((item) => `- ${item}`),
    '',
    '## 集成测试',
    '- 根据涉及的 IPC / 服务边界补充。',
    '',
    '## UI/端到端验证',
    '- 验证关键用户路径。',
    '',
    '## 手动验证步骤',
    '- 按阶段 checklist 执行。',
    '',
    '## 可接受的跳过项',
    '- 无。',
    '',
    '## 失败时处理路径',
    '- 回到 planner 或 developer 修订。',
    '',
  ].join('\n')
}

function enrichPlannerPatchWorkArtifacts(
  context: PipelineNodeExecutionContext,
  result: PipelineNodeExecutionResult,
): PipelineNodeExecutionResult {
  if (result.stageOutput?.node !== 'planner') return result
  const task = getContributionTaskByPipelineSessionId(context.sessionId)
  if (!task) return result

  const parsed = parseJsonObject(result.output) ?? {}
  const planMarkdown = readOptionalString(parsed, 'planMarkdown')
    ?? buildFallbackPlanMarkdown(result.stageOutput)
  const testPlanMarkdown = readOptionalString(parsed, 'testPlanMarkdown')
    ?? buildFallbackTestPlanMarkdown(result.stageOutput)
  const planRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'implementation_plan',
    createdByNode: 'planner',
    content: planMarkdown,
  })
  const testPlanRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'test_plan',
    createdByNode: 'planner',
    content: testPlanMarkdown,
  })

  return {
    ...result,
    stageOutput: {
      ...result.stageOutput,
      planRef: toPatchWorkDocumentRef(planRef),
      testPlanRef: toPatchWorkDocumentRef(testPlanRef),
      documentRefs: [
        toPatchWorkDocumentRef(planRef),
        toPatchWorkDocumentRef(testPlanRef),
      ],
    },
  }
}

function buildFallbackDevMarkdown(output: PipelineDeveloperStageOutput): string {
  const testsRunLines = output.testsRun?.length
    ? output.testsRun.map((testRun) => `- ${testRun.status}: \`${testRun.command}\` - ${testRun.summary}`)
    : output.tests.map((test) => `- ${test}`)
  const skippedTestsRunLines = output.testsRun?.length
    ? output.testsRun
        .filter((testRun) => testRun.status === 'skipped')
        .map((testRun) => `- \`${testRun.command}\` - ${testRun.summary}`)
    : ['- developer 未提供结构化 testsRun，请结合原始输出和 diff 人工核对。']

  return [
    '# 开发文档',
    '',
    '## 需求复述',
    output.summary,
    '',
    '## 实现摘要',
    output.summary,
    '',
    '## 变更文件',
    ...(output.changedFiles?.length
      ? output.changedFiles.map((file) => `- \`${file.path}\` (${file.changeType})：${file.summary}`)
      : output.changes.map((change) => `- ${change}`)),
    '',
    '## 关键代码路径',
    ...(output.changedFiles?.length
      ? output.changedFiles.map((file) => `- \`${file.path}\``)
      : ['- 详见本轮代码 diff。']),
    '',
    '## 类型/API/IPC 变更',
    '- 详见实现摘要和变更文件。',
    '',
    '## UI 行为变更',
    '- 详见实现摘要和变更文件。',
    '',
    '## 已执行验证',
    ...testsRunLines,
    '',
    '## 未执行验证及原因',
    ...skippedTestsRunLines,
    ...(output.testsRun?.length && output.testsRun.every((testRun) => testRun.status !== 'skipped')
      ? ['- 无。']
      : []),
    '',
    '## 已知风险',
    ...(output.risks.length > 0 ? output.risks.map((risk) => `- ${risk}`) : ['- 暂无明确风险。']),
    '',
    '## 对 reviewer 的关注点',
    '- 请重点检查实现是否符合 plan.md / test-plan.md，以及补丁是否排除了 patch-work/**。',
    '',
  ].join('\n')
}

function enrichDeveloperPatchWorkArtifacts(
  context: PipelineNodeExecutionContext,
  result: PipelineNodeExecutionResult,
): PipelineNodeExecutionResult {
  if (result.stageOutput?.node !== 'developer') return result
  const task = getContributionTaskByPipelineSessionId(context.sessionId)
  if (!task) return result

  const parsed = parseStructuredOutput('developer', result.output)
  const devMarkdown = readOptionalString(parsed, 'devMarkdown')
    ?? buildFallbackDevMarkdown(result.stageOutput)
  const devDocRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'dev_doc',
    createdByNode: 'developer',
    content: devMarkdown,
  })
  const documentRef = toPatchWorkDocumentRef(devDocRef)

  return {
    ...result,
    stageOutput: {
      ...result.stageOutput,
      devDoc: documentRef,
      devDocRef: documentRef,
    },
  }
}

function buildReviewIssuesFromStrings(issues: string[]): PipelineReviewIssue[] {
  return issues.map((issue, index) => ({
    id: buildStableReviewIssueId(index),
    severity: 'major',
    category: 'correctness',
    title: issue,
    detail: issue,
    status: 'open',
  }))
}

function buildFallbackReviewMarkdown(
  output: PipelineReviewerStageOutput,
  structuredIssues: PipelineReviewIssue[],
): string {
  return [
    '# 审查报告',
    '',
    '## 结论',
    output.approved ? '通过。' : '不通过，需要回到 developer 修订。',
    '',
    '## 摘要',
    output.summary,
    '',
    '## 结构化问题',
    ...(structuredIssues.length > 0
      ? structuredIssues.map((issue) => [
        `- [${issue.id}] ${issue.severity} / ${issue.category} / ${issue.status}`,
        `  - ${issue.title}`,
        `  - ${issue.detail}`,
        issue.file ? `  - 文件：${issue.file}${issue.line ? `:${issue.line}` : ''}` : undefined,
        issue.suggestedFix ? `  - 建议：${issue.suggestedFix}` : undefined,
      ].filter((line): line is string => Boolean(line)).join('\n'))
      : ['- 无。']),
    '',
    '## Reviewer 说明',
    '- reviewer 保持 read-only，修复由 developer 执行。',
    '',
  ].join('\n')
}

function enrichReviewerPatchWorkArtifacts(
  context: PipelineNodeExecutionContext,
  result: PipelineNodeExecutionResult,
): PipelineNodeExecutionResult {
  if (result.stageOutput?.node !== 'reviewer') return result
  const task = getContributionTaskByPipelineSessionId(context.sessionId)
  if (!task) return result

  const parsed = parseStructuredOutput('reviewer', result.output)
  const structuredIssues = result.stageOutput.structuredIssues?.length
    ? result.stageOutput.structuredIssues
    : buildReviewIssuesFromStrings(result.stageOutput.issues)
  const reviewMarkdown = readOptionalString(parsed, 'reviewMarkdown')
    ?? buildFallbackReviewMarkdown(result.stageOutput, structuredIssues)
  const reviewDocRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'review_doc',
    createdByNode: 'reviewer',
    content: reviewMarkdown,
  })
  const documentRef = toPatchWorkDocumentRef(reviewDocRef)

  return {
    ...result,
    issues: result.stageOutput.issues,
    stageOutput: {
      ...result.stageOutput,
      structuredIssues,
      reviewDoc: documentRef,
      reviewDocRef: documentRef,
      reviewIteration: context.reviewIteration,
    },
  }
}

function buildTesterEvidenceFallback(output: Extract<PipelineStageOutput, { node: 'tester' }>): PipelineTestEvidence[] {
  if (output.testEvidence?.length) return output.testEvidence

  if (output.commands.length === 0) {
    return output.blockers.length > 0
      ? output.blockers.map((blocker) => ({
          command: '未执行测试命令',
          status: 'skipped',
          summary: blocker,
        }))
      : []
  }

  return output.commands.map((command, index) => ({
    command,
    status: 'skipped',
    summary: output.blockers[index]
      ?? output.results[index]
      ?? `缺少结构化测试证据，不能确认命令是否通过：${command}`,
  }))
}

function isTesterOutputApproved(
  output: Extract<PipelineStageOutput, { node: 'tester' }>,
  evidence: PipelineTestEvidence[] | undefined = output.testEvidence,
): boolean {
  if (output.passed !== true) return false
  if (output.blockers.length > 0 || output.commands.length === 0) return false
  if (!evidence || evidence.length === 0) return false
  return evidence.every((item) => item.status === 'passed')
}

function buildFallbackTestResultMarkdown(
  output: Extract<PipelineStageOutput, { node: 'tester' }>,
  evidence: PipelineTestEvidence[],
): string {
  const approved = isTesterOutputApproved(output, evidence)
  const hasFailedEvidence = evidence.some((item) => item.status === 'failed')
  const hasSkippedEvidence = evidence.some((item) => item.status === 'skipped')
  const conclusion = approved
    ? '通过。'
    : output.blockers.length > 0
      ? '阻塞，测试未完整运行。'
      : hasFailedEvidence
        ? '不通过，存在失败测试证据。'
        : hasSkippedEvidence
          ? '不通过，存在跳过或缺失的测试证据。'
          : '不通过，需要回 developer 修复。'

  return [
    '# 测试报告',
    '',
    '## 测试结论',
    conclusion,
    '',
    '## 执行环境',
    '- 由 Pipeline Tester 节点在当前工作区执行。',
    '',
    '## 执行命令',
    ...(output.commands.length > 0 ? output.commands.map((command) => `- \`${command}\``) : ['- 未执行测试命令。']),
    '',
    '## 通过项',
    ...(evidence
      .filter((item) => item.status === 'passed')
      .map((item) => `- \`${item.command}\`：${item.summary}`)),
    ...(evidence.some((item) => item.status === 'passed') ? [] : ['- 无。']),
    '',
    '## 失败项',
    ...(evidence
      .filter((item) => item.status === 'failed')
      .map((item) => `- \`${item.command}\`：${item.summary}`)),
    ...(evidence.some((item) => item.status === 'failed') ? [] : ['- 无。']),
    '',
    '## 修复尝试',
    ...(output.results.length > 0 ? output.results.map((result) => `- ${result}`) : ['- 未记录额外修复尝试。']),
    '',
    '## 剩余阻塞',
    ...(output.blockers.length > 0 ? output.blockers.map((blocker) => `- ${blocker}`) : ['- 无。']),
    '',
    '## 最终交付判断',
    approved
      ? '可以进入提交草稿阶段。'
      : '暂不建议进入提交草稿，除非人工接受风险。',
    '',
  ].join('\n')
}

function buildPatchSetSummary(input: {
  draft: ReturnType<typeof buildPipelinePatchSetDraft>
  patchRef: PatchWorkFileRef
  changedFilesRef: PatchWorkFileRef
  diffSummaryRef: PatchWorkFileRef
  testEvidenceRef: PatchWorkFileRef
}): PipelinePatchSetSummary {
  return {
    files: input.draft.changedFiles,
    additions: input.draft.additions,
    deletions: input.draft.deletions,
    patchRef: toPatchWorkDocumentRef(input.patchRef),
    changedFilesRef: toPatchWorkDocumentRef(input.changedFilesRef),
    diffSummaryRef: toPatchWorkDocumentRef(input.diffSummaryRef),
    testEvidenceRef: toPatchWorkDocumentRef(input.testEvidenceRef),
    excludesPatchWork: input.draft.excludesPatchWork,
    testEvidence: input.draft.testEvidence,
    baseBranch: input.draft.baseBranch,
    workingBranch: input.draft.workingBranch,
    headCommit: input.draft.headCommit,
  }
}

function enrichTesterPatchWorkArtifacts(
  context: PipelineNodeExecutionContext,
  result: PipelineNodeExecutionResult,
): PipelineNodeExecutionResult {
  if (result.stageOutput?.node !== 'tester') return result
  const task = getContributionTaskByPipelineSessionId(context.sessionId)
  if (!task) return result

  const parsed = parseStructuredOutput('tester', result.output)
  const evidence = buildTesterEvidenceFallback(result.stageOutput)
  const resultMarkdown = readOptionalString(parsed, 'resultMarkdown')
    ?? buildFallbackTestResultMarkdown(result.stageOutput, evidence)
  const patchSetDraft = buildPipelinePatchSetDraft({
    repositoryRoot: task.repositoryRoot,
    testEvidence: evidence,
  })
  const testResultRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'test_result',
    createdByNode: 'tester',
    content: resultMarkdown,
  })
  const patchRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'patch',
    createdByNode: 'tester',
    content: patchSetDraft.patch ? `${patchSetDraft.patch}\n` : '',
  })
  const changedFilesRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'changed_files',
    createdByNode: 'tester',
    content: `${JSON.stringify(patchSetDraft.changedFiles, null, 2)}\n`,
  })
  const diffSummaryRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'diff_summary',
    createdByNode: 'tester',
    content: patchSetDraft.diffSummaryMarkdown,
  })
  const testEvidenceRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'test_evidence',
    createdByNode: 'tester',
    content: `${JSON.stringify(patchSetDraft.testEvidence, null, 2)}\n`,
  })
  const patchSet = buildPatchSetSummary({
    draft: patchSetDraft,
    patchRef,
    changedFilesRef,
    diffSummaryRef,
    testEvidenceRef,
  })

  return {
    ...result,
    approved: isTesterOutputApproved(result.stageOutput, evidence) && patchSet.excludesPatchWork,
    issues: result.stageOutput.blockers,
    stageOutput: {
      ...result.stageOutput,
      testEvidence: evidence,
      testResultRef: toPatchWorkDocumentRef(testResultRef),
      patchSet,
      changedFiles: patchSet.files.map((file) => file.path),
    },
  }
}

function buildFallbackCommitMarkdown(output: Extract<PipelineStageOutput, { node: 'committer' }>): string {
  return [
    '# Commit 准备',
    '',
    '## 建议 Commit Message',
    output.commitMessage,
    '',
    '## 变更摘要',
    output.summary,
    '',
    '## 测试证据',
    '- 见 result.md 和 patch-set/test-evidence.json。',
    '',
    '## 风险提示',
    ...(output.risks.length > 0 ? output.risks.map((risk) => `- ${risk}`) : ['- 无。']),
    '',
    '## 是否需要 sign-off',
    '待维护者确认。',
    '',
    '## 是否建议拆分多个 commit',
    '当前仅生成草稿，不执行真实提交。',
    '',
  ].join('\n')
}

function buildFallbackPrMarkdown(output: Extract<PipelineStageOutput, { node: 'committer' }>): string {
  return [
    '# PR 草稿',
    '',
    '## Title',
    output.prTitle,
    '',
    '## Summary',
    output.prBody,
    '',
    '## Linked Issue',
    '- 无。',
    '',
    '## Changes',
    output.summary,
    '',
    '## Tests',
    '- 见 result.md 和 patch-set/test-evidence.json。',
    '',
    '## Risk',
    ...(output.risks.length > 0 ? output.risks.map((risk) => `- ${risk}`) : ['- 无。']),
    '',
    '## Notes for Maintainers',
    '当前仅保存提交材料，不执行真实本地提交或远端写操作。',
    '',
  ].join('\n')
}

function enrichCommitterPatchWorkArtifacts(
  context: PipelineNodeExecutionContext,
  result: PipelineNodeExecutionResult,
): PipelineNodeExecutionResult {
  if (result.stageOutput?.node !== 'committer') return result
  const task = getContributionTaskByPipelineSessionId(context.sessionId)
  if (!task) return result

  const parsed = parseStructuredOutput('committer', result.output)
  const commitMarkdown = readOptionalString(parsed, 'commitMarkdown')
    ?? buildFallbackCommitMarkdown(result.stageOutput)
  const prMarkdown = readOptionalString(parsed, 'prMarkdown')
    ?? buildFallbackPrMarkdown(result.stageOutput)
  const commitRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'commit_doc',
    createdByNode: 'committer',
    content: commitMarkdown,
  })
  const prRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'pr_doc',
    createdByNode: 'committer',
    content: prMarkdown,
  })
  const commitDocRef = toPatchWorkDocumentRef(commitRef)
  const prDocRef = toPatchWorkDocumentRef(prRef)

  return {
    ...result,
    approved: result.stageOutput.submissionStatus === 'draft_only',
    issues: result.stageOutput.blockers,
    stageOutput: {
      ...result.stageOutput,
      commitDocRef,
      prDocRef,
      commitRef: commitDocRef,
      prRef: prDocRef,
      localCommit: {
        attempted: false,
        status: 'not_requested',
      },
      remoteSubmission: {
        attempted: false,
        status: 'not_requested',
      },
    },
  }
}

export function enrichPipelineV2PatchWorkArtifacts(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
  result: PipelineNodeExecutionResult,
): PipelineNodeExecutionResult {
  if (context.version !== 2) return result
  if (node === 'explorer') return enrichExplorerPatchWorkArtifacts(context, result)
  if (node === 'planner') return enrichPlannerPatchWorkArtifacts(context, result)
  if (node === 'developer') return enrichDeveloperPatchWorkArtifacts(context, result)
  if (node === 'reviewer') return enrichReviewerPatchWorkArtifacts(context, result)
  if (node === 'tester') return enrichTesterPatchWorkArtifacts(context, result)
  if (node === 'committer') return enrichCommitterPatchWorkArtifacts(context, result)
  return result
}

function parseStructuredOutput(node: PipelineNodeKind, text: string): Record<string, unknown> {
  const parsed = parseJsonObject(text)
  if (!parsed) {
    throw new PipelineStructuredOutputError(node, ['输出不是合法 JSON 对象'], text)
  }
  return parsed
}

function throwIfInvalid(node: PipelineNodeKind, issues: string[], text: string): void {
  if (issues.length > 0) {
    throw new PipelineStructuredOutputError(node, issues, text)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function schemaPath(parent: string, child: string): string {
  return parent ? `${parent}.${child}` : child
}

function schemaIssuePath(path: string): string {
  return path || 'root'
}

function readSchemaStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function validateJsonSchemaValue(
  schema: Record<string, unknown>,
  value: unknown,
  path: string,
  issues: string[],
): void {
  const type = typeof schema.type === 'string' ? schema.type : undefined

  if (type === 'object') {
    if (!isRecord(value)) {
      issues.push(`缺少或非法字段: ${schemaIssuePath(path)}`)
      return
    }

    const properties = isRecord(schema.properties) ? schema.properties : {}
    const required = readSchemaStringArray(schema.required)
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        issues.push(`缺少或非法字段: ${schemaPath(path, key)}`)
      }
    }

    if (schema.additionalProperties === false) {
      const propertyNames = new Set(Object.keys(properties))
      for (const key of Object.keys(value)) {
        if (!propertyNames.has(key)) {
          issues.push(`包含 schema 之外字段: ${schemaPath(path, key)}`)
        }
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue
      if (!isRecord(propertySchema)) continue
      validateJsonSchemaValue(propertySchema, value[key], schemaPath(path, key), issues)
    }
    return
  }

  if (type === 'array') {
    if (!Array.isArray(value)) {
      issues.push(`缺少或非法字段: ${schemaIssuePath(path)}`)
      return
    }
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      issues.push(`缺少或非法字段: ${schemaIssuePath(path)}`)
    }
    if (isRecord(schema.items)) {
      value.forEach((item, index) => {
        validateJsonSchemaValue(schema.items as Record<string, unknown>, item, `${path}[${index}]`, issues)
      })
    }
    return
  }

  if (type === 'string') {
    if (typeof value !== 'string') {
      issues.push(`缺少或非法字段: ${schemaIssuePath(path)}`)
      return
    }
  } else if (type === 'boolean') {
    if (typeof value !== 'boolean') {
      issues.push(`缺少或非法字段: ${schemaIssuePath(path)}`)
      return
    }
  } else if (type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push(`缺少或非法字段: ${schemaIssuePath(path)}`)
      return
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    issues.push(`缺少或非法字段: ${schemaIssuePath(path)}`)
  }
}

function validatePipelineNodeJsonSchema(
  node: PipelineNodeKind,
  parsed: Record<string, unknown>,
): string[] {
  const issues: string[] = []
  validateJsonSchemaValue(pipelineNodeJsonSchema(node), parsed, '', issues)
  return issues
}

function buildStageOutput(node: PipelineNodeKind, text: string): PipelineStageOutput {
  const parsed = parseJsonObject(text)
  if (!parsed) {
    if (node === 'explorer') return buildExplorerFallbackStageOutput(text)
    if (node === 'planner') return buildPlannerFallbackStageOutput(text)
    throw new PipelineStructuredOutputError(node, ['输出不是合法 JSON 对象'], text)
  }
  throwIfInvalid(node, validatePipelineNodeJsonSchema(node, parsed), text)
  const issues: string[] = []
  const summary = readRequiredString(parsed, 'summary', issues)

  switch (node) {
    case 'explorer': {
      const output = {
        node,
        summary,
        findings: readRequiredStringArray(parsed, 'findings', issues),
        keyFiles: readRequiredStringArray(parsed, 'keyFiles', issues),
        nextSteps: readRequiredStringArray(parsed, 'nextSteps', issues),
        content: text,
      }
      throwIfInvalid(node, issues, text)
      return output
    }
    case 'planner': {
      const output = {
        node,
        summary,
        steps: readRequiredStringArray(parsed, 'steps', issues),
        risks: readRequiredStringArray(parsed, 'risks', issues),
        verification: readRequiredStringArray(parsed, 'verification', issues),
        content: text,
      }
      throwIfInvalid(node, issues, text)
      return output
    }
    case 'developer': {
      const changedFiles = readOptionalChangedFiles(parsed, 'changedFiles', issues)
      const testsRun = readOptionalTestRuns(parsed, 'testsRun', issues)
      const output: PipelineDeveloperStageOutput = {
        node,
        summary,
        changes: readRequiredStringArray(parsed, 'changes', issues),
        tests: readRequiredStringArray(parsed, 'tests', issues),
        risks: readRequiredStringArray(parsed, 'risks', issues),
        content: text,
      }
      if (changedFiles) {
        output.changedFiles = changedFiles
      }
      if (testsRun) {
        output.testsRun = testsRun
      }
      throwIfInvalid(node, issues, text)
      return output
    }
    case 'reviewer': {
      const structuredIssues = readOptionalReviewIssues(parsed, 'structuredIssues', issues)
      const output: PipelineReviewerStageOutput = {
        node,
        summary,
        approved: readRequiredBoolean(parsed, 'approved', issues),
        issues: readRequiredStringArray(parsed, 'issues', issues),
        content: text,
      }
      if (structuredIssues) {
        output.structuredIssues = structuredIssues
      }
      throwIfInvalid(node, issues, text)
      return output
    }
    case 'tester': {
      const testEvidence = readOptionalTestEvidence(parsed, 'testEvidence', issues)
      const output: Extract<PipelineStageOutput, { node: 'tester' }> = {
        node,
        summary,
        commands: readRequiredStringArray(parsed, 'commands', issues),
        results: readRequiredStringArray(parsed, 'results', issues),
        blockers: readRequiredStringArray(parsed, 'blockers', issues),
        content: text,
      }
      if (typeof parsed.passed === 'boolean') {
        output.passed = parsed.passed
      } else {
        issues.push('缺少或非法字段: passed')
      }
      if (testEvidence) {
        if (testEvidence.length > 0) {
          output.testEvidence = testEvidence
        } else {
          issues.push('缺少或非法字段: testEvidence')
        }
      } else {
        issues.push('缺少或非法字段: testEvidence')
      }
      throwIfInvalid(node, issues, text)
      return output
    }
    case 'committer': {
      const blockers = readRequiredStringArray(parsed, 'blockers', issues)
      const output = {
        node,
        summary,
        commitMessage: readRequiredString(parsed, 'commitMessage', issues),
        prTitle: readRequiredString(parsed, 'prTitle', issues),
        prBody: readRequiredString(parsed, 'prBody', issues),
        submissionStatus: readSubmissionStatus(parsed, 'submissionStatus', issues),
        blockers,
        risks: readRequiredStringArray(parsed, 'risks', issues),
        content: text,
      }
      throwIfInvalid(node, issues, text)
      return output
    }
  }
}

export function buildNodeExecutionResult(node: PipelineNodeKind, text: string): PipelineNodeExecutionResult {
  const stageOutput = buildStageOutput(node, text)

  if (stageOutput.node === 'reviewer') {
    return {
      output: text,
      summary: stageOutput.summary,
      approved: stageOutput.approved,
      issues: stageOutput.issues,
      stageOutput,
    }
  }

  if (stageOutput.node === 'tester') {
    const approved = isTesterOutputApproved(stageOutput)
    return {
      output: text,
      summary: stageOutput.summary,
      approved,
      issues: stageOutput.blockers,
      stageOutput,
    }
  }

  if (stageOutput.node === 'committer') {
    return {
      output: text,
      summary: stageOutput.summary,
      approved: stageOutput.submissionStatus === 'draft_only',
      issues: stageOutput.blockers,
      stageOutput,
    }
  }

  return {
    output: text,
    summary: stageOutput.summary,
    approved: true,
    stageOutput,
  }
}

function permissionModeToSdk(
  mode: RVInsightsPermissionMode,
): ClaudeAgentQueryOptions['sdkPermissionMode'] {
  if (mode === 'plan') return 'auto'
  return mode
}

export interface PipelineNodeToolPermissionOptions {
  sdkPermissionMode: ClaudeAgentQueryOptions['sdkPermissionMode']
  allowDangerouslySkipPermissions: boolean
  allowedTools?: string[]
  disallowedTools?: string[]
  canUseTool?: ClaudeAgentQueryOptions['canUseTool']
}

function isV2ReadOnlyNode(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
): boolean {
  return context.version === 2 && (node === 'explorer' || node === 'planner')
}

function hasV2DangerousBashStructure(command: string): boolean {
  if (/[|><;&]/.test(command)) return true
  if (/\$\(/.test(command) || /`/.test(command)) return true
  return false
}

function hasOutputOption(tokens: string[]): boolean {
  return tokens.some((token) => token === '-o' || token === '--output' || token.startsWith('--output='))
}

function isV2ReadOnlyGitCommand(tokens: string[]): boolean {
  const subcommand = tokens[1]
  const args = tokens.slice(2)
  if (!subcommand) return false
  if (hasOutputOption(tokens)) return false

  if (subcommand === 'status' || subcommand === 'log' || subcommand === 'diff' || subcommand === 'show') {
    return true
  }

  if (subcommand === 'branch') {
    if (args.length === 0) return true
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index]
      if (
        arg === '--show-current'
        || arg === '-a'
        || arg === '-r'
        || arg === '-v'
        || arg === '-vv'
        || arg === '--all'
        || arg === '--remotes'
        || arg === '--merged'
        || arg === '--no-merged'
      ) {
        continue
      }
      if (arg === '--list') {
        if (args[index + 1] && !args[index + 1]!.startsWith('-')) index += 1
        continue
      }
      return false
    }
    return true
  }

  if (subcommand === 'tag') {
    if (args.length === 0) return true
    if ((args[0] === '--list' || args[0] === '-l') && args.length <= 2) return true
    return false
  }

  if (subcommand === 'remote') {
    if (args.length === 0) return true
    if (args.length === 1 && args[0] === '-v') return true
    if (args[0] === 'show' && args.length <= 2) return true
    if (args[0] === 'get-url' && args.length <= 2) return true
    return false
  }

  return false
}

function isV2ReadOnlyBashCommand(command: string): boolean {
  const trimmed = command.trim()
  if (!trimmed || hasV2DangerousBashStructure(trimmed)) return false
  const tokens = trimmed.split(/\s+/)
  if (hasOutputOption(tokens)) return false

  if (tokens[0] === 'git') {
    return isV2ReadOnlyGitCommand(tokens)
  }

  if (
    tokens[0] === 'pwd'
    || tokens[0] === 'env'
    || tokens[0] === 'whoami'
    || tokens[0] === 'which'
    || tokens[0] === 'ls'
    || tokens[0] === 'head'
    || tokens[0] === 'tail'
    || tokens[0] === 'grep'
    || tokens[0] === 'rg'
    || tokens[0] === 'uname'
    || tokens[0] === 'tree'
    || tokens[0] === 'wc'
    || tokens[0] === 'file'
    || tokens[0] === 'stat'
    || tokens[0] === 'du'
    || tokens[0] === 'df'
  ) {
    return true
  }

  if (trimmed === 'node --version' || trimmed === 'bun --version') return true
  if (tokens[0] === 'npm' && ['list', 'ls', 'view', 'info', 'outdated'].includes(tokens[1] ?? '')) {
    return true
  }
  if (trimmed === 'bun pm ls') return true
  return false
}

function createV2ReadOnlyCanUseTool(): (
  toolName: string,
  input: Record<string, unknown>,
  options: CanUseToolOptions,
) => Promise<PermissionResult> {
  return async (toolName, input) => {
    if (SAFE_TOOLS.includes(toolName)) {
      return { behavior: 'allow' as const, updatedInput: input }
    }

    if (toolName === 'Bash') {
      const command = typeof input.command === 'string' ? input.command : ''
      if (isV2ReadOnlyBashCommand(command)) {
        return { behavior: 'allow' as const, updatedInput: input }
      }
    }

    return {
      behavior: 'deny' as const,
      message: 'Pipeline v2 Explorer / Planner 阶段只允许读取和安全检查，不能修改源码或工作区文件。',
    }
  }
}

export function buildPipelineNodeToolPermissionOptions(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
  permissionMode: RVInsightsPermissionMode,
): PipelineNodeToolPermissionOptions {
  if (!isV2ReadOnlyNode(node, context)) {
    return {
      sdkPermissionMode: permissionModeToSdk(permissionMode),
      allowDangerouslySkipPermissions: permissionMode === 'bypassPermissions',
    }
  }

  return {
    sdkPermissionMode: 'auto',
    allowDangerouslySkipPermissions: false,
    allowedTools: [...SAFE_TOOLS],
    disallowedTools: [...V2_READ_ONLY_DISALLOWED_TOOLS],
    canUseTool: createV2ReadOnlyCanUseTool(),
  }
}

export class ClaudePipelineNodeRunner implements PipelineNodeRunner {
  private adapter = new ClaudeAgentAdapter()
  private runtimeRunner?: AgentRuntimeRunner
  private readonly channelId?: string
  private readonly workspaceId?: string
  private readonly onEvent?: (event: PipelineStreamEvent) => void

  constructor(options: ClaudePipelineNodeRunnerOptions) {
    this.channelId = options.channelId
    this.workspaceId = options.workspaceId
    this.onEvent = options.onEvent
    this.runtimeRunner = options.runtimeRunner
  }

  abort(sessionId: string): void {
    this.adapter.abort(sessionId)
  }

  async runNode(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult> {
    const channelId = this.channelId
    if (!channelId) {
      throw new Error('Pipeline 缺少 channelId，无法执行 Claude 节点')
    }

    const channel = getChannelById(channelId)
    if (!channel) {
      throw new Error(`未找到渠道: ${channelId}`)
    }

    if (!isAgentCompatibleProvider(channel.provider)) {
      throw new Error(`渠道 ${channel.name} 不是 Agent 兼容供应商`)
    }

    const apiKey = decryptApiKey(channelId)
    const workspace = resolveWorkspaceContext(this.workspaceId, context.sessionId)
    const permissionMode = workspace.slug
      ? getWorkspacePermissionMode(workspace.slug)
      : 'auto'
    const prompts = buildPipelineNodePrompts(node, context, workspace.name)
    const model = resolveModel(channelId)
    const env = await buildSdkEnv({
      apiKey,
      baseUrl: channel.baseUrl,
      provider: channel.provider,
    })
    const mcpServers = buildMcpServers(workspace.slug)
    const additionalDirectories = workspace.slug
      ? getWorkspaceAttachedDirectories(workspace.slug)
      : []
    const permissionOptions = buildPipelineNodeToolPermissionOptions(
      node,
      context,
      permissionMode,
    )

    const queryOptions: ClaudeAgentQueryOptions = {
      sessionId: context.sessionId,
      prompt: prompts.userPrompt,
      model,
      cwd: workspace.cwd,
      sdkCliPath: resolveSDKCliPath(),
      env,
      sdkPermissionMode: permissionOptions.sdkPermissionMode,
      allowDangerouslySkipPermissions: permissionOptions.allowDangerouslySkipPermissions,
      systemPrompt: prompts.systemPrompt,
      persistSession: false,
      forkSession: false,
      mcpServers,
      additionalDirectories,
      outputFormat: pipelineNodeOutputFormat(node),
      ...(permissionOptions.canUseTool && { canUseTool: permissionOptions.canUseTool }),
      ...(permissionOptions.allowedTools && { allowedTools: permissionOptions.allowedTools }),
      ...(permissionOptions.disallowedTools && { disallowedTools: permissionOptions.disallowedTools }),
      ...(workspace.slug && {
        plugins: [{ type: 'local' as const, path: getAgentWorkspacePath(workspace.slug) }],
      }),
    }

    const signal = context.signal
    if (signal?.aborted) {
      throw new Error('Pipeline 节点执行已中止')
    }

    const handleAbort = (): void => {
      this.adapter.abort(context.sessionId)
    }
    signal?.addEventListener('abort', handleAbort, { once: true })

    this.onEvent?.({
      type: 'node_start',
      node,
      createdAt: Date.now(),
    })

    let combinedOutput = ''

    try {
      combinedOutput = agentRuntimePipelineRunnerV2.enabled
        ? await this.runNodeWithRuntimeRunner(node, context, queryOptions, model, workspace.cwd, permissionMode)
        : await this.runNodeWithLegacyAdapter(node, context, queryOptions)
    } finally {
      signal?.removeEventListener('abort', handleAbort)
    }

    const result = enrichPipelineV2PatchWorkArtifacts(
      node,
      context,
      buildNodeExecutionResult(node, combinedOutput),
    )

    this.onEvent?.({
      type: 'node_complete',
      node,
      output: result.output,
      summary: result.summary,
      approved: result.approved,
      issues: result.issues,
      artifact: result.stageOutput,
      createdAt: Date.now(),
    })

    return result
  }

  private async runNodeWithLegacyAdapter(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
    queryOptions: ClaudeAgentQueryOptions,
  ): Promise<string> {
    let combinedOutput = ''

    for await (const message of this.adapter.query(queryOptions)) {
      if (message.type === 'assistant') {
        const text = extractAssistantText(message as SDKAssistantMessage)
        if (!text) continue
        const delta = (combinedOutput ? '\n' : '') + text
        combinedOutput += delta
        this.emitTextDelta(node, delta)
        continue
      }

      if (message.type === 'result' && message.subtype !== 'success') {
        const errors = Array.isArray(message.errors)
          ? message.errors.map((item) => String(item))
          : []
        throw new Error(errors.join('\n') || `Claude 节点执行失败: ${message.subtype}`)
      }
    }

    if (context.signal?.aborted) {
      throw new Error('Pipeline 节点执行已中止')
    }

    return combinedOutput
  }

  private async runNodeWithRuntimeRunner(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
    queryOptions: ClaudeAgentQueryOptions,
    model: string,
    cwd: string | undefined,
    permissionMode: RVInsightsPermissionMode,
  ): Promise<string> {
    let combinedOutput = ''
    const metadata: AgentRuntimeRunMetadata = {
      origin: 'pipeline',
      pipeline: {
        pipelineSessionId: context.sessionId,
        nodeId: node,
        nodeRunId: `${context.sessionId}:${node}:${context.reviewIteration}`,
        version: context.version,
        reviewIteration: context.reviewIteration,
      },
    }

    const runtimeRunner = await this.getRuntimeRunner()
    const textAccumulator = createPipelineRuntimeTextAccumulator((delta) => {
      combinedOutput += delta
      this.emitTextDelta(node, delta)
    })

    for await (const envelope of runtimeRunner.run({
      sessionId: context.sessionId,
      prompt: queryOptions.prompt,
      model,
      cwd: cwd ?? process.cwd(),
      permissionMode,
      queryOptions,
      runtimeHash: 'pipeline-node-runner',
      metadata,
      abortSignal: context.signal,
    })) {
      if (context.signal?.aborted) {
        throw new Error('Pipeline 节点执行已中止')
      }
      textAccumulator.apply(envelope)

      if (envelope.event.type === 'run_failed') {
        throw new Error(envelope.event.error.message || envelope.event.error.title || 'Claude 节点执行失败')
      }
      if (envelope.event.type === 'run_stopped') {
        throw new Error('Pipeline 节点执行已中止')
      }
    }

    return combinedOutput
  }

  private async getRuntimeRunner(): Promise<AgentRuntimeRunner> {
    if (this.runtimeRunner) return this.runtimeRunner
    const { InProcessAgentRuntimeRunner } = await import('./agent-runtime-runner')
    this.runtimeRunner = new InProcessAgentRuntimeRunner({
      query: (queryOptions) => this.adapter.query(queryOptions),
      store: {
        appendMessages: () => undefined,
      },
    })
    return this.runtimeRunner
  }

  private emitTextDelta(node: PipelineNodeKind, delta: string): void {
    this.onEvent?.({
      type: 'text_delta',
      node,
      delta,
      createdAt: Date.now(),
    })
  }
}

function createPipelineRuntimeTextAccumulator(onDelta: (delta: string) => void): {
  apply: (envelope: AgentStreamEnvelope) => void
} {
  const streamedMessageIds = new Set<string>()
  let hasOutput = false

  return {
    apply: (envelope) => {
      if (envelope.event.type === 'assistant_delta') {
        streamedMessageIds.add(envelope.event.messageId)
        onDelta(envelope.event.delta)
        hasOutput = true
        return
      }

      if (envelope.event.type !== 'assistant_message') return
      if (streamedMessageIds.has(envelope.event.messageId)) return

      const text = envelope.event.contentBlocks
        .filter((block): block is { type: 'text'; text: string } =>
          Boolean(block)
          && typeof block === 'object'
          && (block as { type?: unknown }).type === 'text'
          && typeof (block as { text?: unknown }).text === 'string')
        .map((block) => block.text)
        .join('\n')
      if (text) {
        onDelta(hasOutput ? `\n${text}` : text)
        hasOutput = true
      }
    },
  }
}

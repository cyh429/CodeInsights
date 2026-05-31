import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type {
  PipelineCommitterStageOutput,
  PipelineDeveloperStageOutput,
  PipelineExplorerStageOutput,
  PipelineNodeKind,
  PipelinePlannerStageOutput,
  PipelineReviewerStageOutput,
  PipelineStageOutput,
  PipelineStreamEvent,
  PipelineTesterStageOutput,
} from '@codeinsights/shared'
import type {
  PipelineNodeExecutionContext,
  PipelineNodeExecutionResult,
  PipelineNodeRunner,
} from './pipeline-node-runner'
import { getContributionTaskByPipelineSessionId } from './contribution-task-service'
import { buildPipelinePatchSetDraft } from './pipeline-git-submission-service'
import { listPatchWorkExplorerReports, writePatchWorkFile } from './pipeline-patch-work-service'

const FIXTURE_ENABLED_VALUES = new Set(['1', 'true', 'on', 'yes', 'enabled'])

export function isPipelineFixtureRunnerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.CODEINSIGHTS_PIPELINE_FIXTURE_RUNNER?.trim().toLowerCase()
  return value ? FIXTURE_ENABLED_VALUES.has(value) : false
}

function runGit(repoRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export function setupPipelineFixtureRepository(repositoryRoot: string): void {
  mkdirSync(repositoryRoot, { recursive: true })
  runGit(repositoryRoot, ['init'])
  runGit(repositoryRoot, ['checkout', '-b', 'main'])
  runGit(repositoryRoot, ['config', 'user.name', 'CodeInsights Smoke'])
  runGit(repositoryRoot, ['config', 'user.email', 'codeinsights-smoke@example.com'])
  mkdirSync(join(repositoryRoot, 'src'), { recursive: true })
  writeFileSync(join(repositoryRoot, 'package.json'), '{"scripts":{"test":"bun test"}}\n', 'utf-8')
  writeFileSync(join(repositoryRoot, 'bun.lock'), '# smoke lock\n', 'utf-8')
  writeFileSync(join(repositoryRoot, 'src', 'index.ts'), 'export const smokeValue = 1\n', 'utf-8')
  runGit(repositoryRoot, ['add', '.'])
  runGit(repositoryRoot, ['commit', '-m', 'test: initial smoke fixture'])
  const remoteRoot = join(dirname(repositoryRoot), `${basename(repositoryRoot)}-remote.git`)
  mkdirSync(remoteRoot, { recursive: true })
  execFileSync('git', ['init', '--bare', remoteRoot], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  runGit(repositoryRoot, ['remote', 'add', 'origin', remoteRoot])
}

export interface PipelineFixtureNodeRunnerOptions {
  onEvent?: (event: PipelineStreamEvent) => void
}

export class PipelineFixtureNodeRunner implements PipelineNodeRunner {
  constructor(private readonly options: PipelineFixtureNodeRunnerOptions = {}) {}

  async runNode(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult> {
    this.emit({ type: 'node_start', node, createdAt: Date.now() })
    const result = this.buildNodeResult(node, context)
    this.emitNodeComplete(node, result)
    return result
  }

  private buildNodeResult(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ): PipelineNodeExecutionResult {
    const task = getContributionTaskByPipelineSessionId(context.sessionId)
    if (!task) {
      throw new Error(`缺少 fixture ContributionTask: ${context.sessionId}`)
    }
    const repositoryRoot = task.repositoryRoot

    if (node === 'explorer') {
      writePatchWorkFile({
        contributionTaskId: task.id,
        pipelineSessionId: context.sessionId,
        repositoryRoot,
        kind: 'explorer_report',
        createdByNode: 'explorer',
        relativePath: 'explorer/report-001.md',
        displayName: 'report-001.md',
        content: [
          '# 探索报告：Phase 6 smoke fixture',
          '',
          '## 贡献点概述',
          '验证 Pipeline v2 fixture smoke 主路径。',
          '',
        ].join('\n'),
      })
      const stageOutput: PipelineExplorerStageOutput = {
        node: 'explorer',
        summary: '发现 Phase 6 smoke 任务',
        findings: ['存在可验证的 fixture 任务'],
        keyFiles: ['src/index.ts'],
        nextSteps: ['选择 report-001'],
        reports: listPatchWorkExplorerReports({ repositoryRoot }),
        content: 'explorer smoke output',
      }
      return this.toResult(stageOutput)
    }

    if (node === 'planner') {
      const planRef = writePatchWorkFile({
        contributionTaskId: task.id,
        pipelineSessionId: context.sessionId,
        repositoryRoot,
        kind: 'implementation_plan',
        createdByNode: 'planner',
        content: '# 开发方案\n\n更新 smoke fixture 源码。\n',
      })
      const testPlanRef = writePatchWorkFile({
        contributionTaskId: task.id,
        pipelineSessionId: context.sessionId,
        repositoryRoot,
        kind: 'test_plan',
        createdByNode: 'planner',
        content: '# 测试方案\n\n运行 deterministic Pipeline smoke。\n',
      })
      const stageOutput: PipelinePlannerStageOutput = {
        node: 'planner',
        summary: '规划 smoke fixture',
        steps: ['更新源码', '生成 patch-set', '准备提交材料'],
        risks: [],
        verification: ['bun test apps/electron/src/main/lib/pipeline-smoke.test.ts'],
        planRef,
        testPlanRef,
        documentRefs: [planRef, testPlanRef],
        content: 'planner smoke output',
      }
      return this.toResult(stageOutput)
    }

    if (node === 'developer') {
      writeFileSync(
        join(repositoryRoot, 'src', 'index.ts'),
        'export const smokeValue = 2\nexport const phase6Smoke = true\n',
        'utf-8',
      )
      const devDocRef = writePatchWorkFile({
        contributionTaskId: task.id,
        pipelineSessionId: context.sessionId,
        repositoryRoot,
        kind: 'dev_doc',
        createdByNode: 'developer',
        content: '# 开发文档\n\n已更新 `src/index.ts`。\n',
      })
      const stageOutput: PipelineDeveloperStageOutput = {
        node: 'developer',
        summary: '完成 smoke fixture 修改',
        changes: ['更新 src/index.ts'],
        tests: [],
        risks: [],
        changedFiles: [{
          path: 'src/index.ts',
          changeType: 'modified',
          summary: '更新 smoke fixture 值',
        }],
        devDocRef,
        content: 'developer smoke output',
      }
      return this.toResult(stageOutput)
    }

    if (node === 'reviewer') {
      const reviewDocRef = writePatchWorkFile({
        contributionTaskId: task.id,
        pipelineSessionId: context.sessionId,
        repositoryRoot,
        kind: 'review_doc',
        createdByNode: 'reviewer',
        content: '# 审查报告\n\n通过。\n',
      })
      const stageOutput: PipelineReviewerStageOutput = {
        node: 'reviewer',
        summary: '审查通过',
        approved: true,
        issues: [],
        structuredIssues: [],
        reviewDocRef,
        content: 'reviewer smoke output',
      }
      return this.toResult(stageOutput, { approved: true, issues: [] })
    }

    if (node === 'tester') {
      const testEvidence = [{
        command: 'bun test apps/electron/src/main/lib/pipeline-smoke.test.ts',
        status: 'passed' as const,
        summary: 'deterministic smoke 通过',
        durationMs: 1,
      }]
      const patchSet = buildPipelinePatchSetDraft({
        repositoryRoot,
        testEvidence,
      })
      const testResultRef = writePatchWorkFile({
        contributionTaskId: task.id,
        pipelineSessionId: context.sessionId,
        repositoryRoot,
        kind: 'test_result',
        createdByNode: 'tester',
        content: '# 测试报告\n\nsmoke 通过。\n',
      })
      const patchRef = writePatchWorkFile({
        contributionTaskId: task.id,
        pipelineSessionId: context.sessionId,
        repositoryRoot,
        kind: 'patch',
        createdByNode: 'tester',
        content: patchSet.patch,
      })
      const changedFilesRef = writePatchWorkFile({
        contributionTaskId: task.id,
        pipelineSessionId: context.sessionId,
        repositoryRoot,
        kind: 'changed_files',
        createdByNode: 'tester',
        content: JSON.stringify(patchSet.changedFiles, null, 2),
      })
      const diffSummaryRef = writePatchWorkFile({
        contributionTaskId: task.id,
        pipelineSessionId: context.sessionId,
        repositoryRoot,
        kind: 'diff_summary',
        createdByNode: 'tester',
        content: patchSet.diffSummaryMarkdown,
      })
      const testEvidenceRef = writePatchWorkFile({
        contributionTaskId: task.id,
        pipelineSessionId: context.sessionId,
        repositoryRoot,
        kind: 'test_evidence',
        createdByNode: 'tester',
        content: JSON.stringify(testEvidence, null, 2),
      })
      const stageOutput: PipelineTesterStageOutput = {
        node: 'tester',
        summary: '测试通过并生成 patch-set',
        commands: testEvidence.map((item) => item.command),
        results: ['deterministic smoke 通过'],
        blockers: [],
        testResultRef,
        patchSet: {
          files: patchSet.changedFiles,
          additions: patchSet.additions,
          deletions: patchSet.deletions,
          patchRef,
          changedFilesRef,
          excludesPatchWork: patchSet.excludesPatchWork,
          diffSummaryRef,
          testEvidenceRef,
          testEvidence,
          baseBranch: patchSet.baseBranch,
          workingBranch: patchSet.workingBranch,
          headCommit: patchSet.headCommit,
        },
        passed: true,
        testEvidence,
        changedFiles: patchSet.changedFiles.map((file) => file.path),
        content: 'tester smoke output',
      }
      return this.toResult(stageOutput)
    }

    const commitDocRef = writePatchWorkFile({
      contributionTaskId: task.id,
      pipelineSessionId: context.sessionId,
      repositoryRoot,
      kind: 'commit_doc',
      createdByNode: 'committer',
      content: '# Commit 准备\n\nfeat(pipeline): add deterministic smoke fixture\n',
    })
    const prDocRef = writePatchWorkFile({
      contributionTaskId: task.id,
      pipelineSessionId: context.sessionId,
      repositoryRoot,
      kind: 'pr_doc',
      createdByNode: 'committer',
      content: '# PR 草稿\n\n## Summary\n- Add deterministic smoke fixture\n',
    })
    const stageOutput: PipelineCommitterStageOutput = {
      node: 'committer',
      summary: '提交材料已生成',
      commitMessage: 'feat(pipeline): add deterministic smoke fixture',
      prTitle: 'Add deterministic smoke fixture',
      prBody: '## Summary\n- Add deterministic smoke fixture',
      submissionStatus: 'draft_only',
      blockers: [],
      risks: [],
      commitDocRef,
      prDocRef,
      localCommit: {
        attempted: false,
        status: 'not_requested',
      },
      remoteSubmission: {
        attempted: false,
        status: 'not_requested',
      },
      content: 'committer smoke output',
    }
    return this.toResult(stageOutput)
  }

  private toResult(
    stageOutput: PipelineStageOutput,
    review?: { approved?: boolean; issues?: string[] },
  ): PipelineNodeExecutionResult {
    return {
      output: stageOutput.content,
      summary: stageOutput.summary,
      approved: review?.approved,
      issues: review?.issues,
      stageOutput,
    }
  }

  private emitNodeComplete(
    node: PipelineNodeKind,
    result: PipelineNodeExecutionResult,
  ): void {
    this.emit({
      type: 'node_complete',
      node,
      output: result.output,
      summary: result.summary,
      approved: result.approved,
      issues: result.issues,
      artifact: result.stageOutput,
      createdAt: Date.now(),
    })
  }

  private emit(event: PipelineStreamEvent): void {
    this.options.onEvent?.(event)
  }
}

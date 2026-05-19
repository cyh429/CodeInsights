import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  PipelineNodeKind,
  PipelineStreamEvent,
} from '@rv-insights/shared'

mock.module('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
  app: {
    isPackaged: false,
    getPath: () => '',
  },
}))

const {
  CodexCliPipelineNodeRunner,
  CodexSdkPipelineNodeRunner,
  SpawnCodexCliExecutor,
  buildCodexCliArgs,
  buildWindowsTaskkillArgs,
  killCodexCliProcessTree,
} = await import('./codex-pipeline-node-runner')
const { RoutedPipelineNodeRunner } = await import('./pipeline-node-router')
const { resolvePipelineCodexChannelId } = await import('./pipeline-codex-settings')
const { createChannel } = await import('./channel-manager')
const { createContributionTask } = await import('./contribution-task-service')
const {
  acceptPatchWorkDocuments,
  writePatchWorkFile,
} = await import('./pipeline-patch-work-service')

import type {
  CodexCliExecutor,
  CodexCliRunInput,
  CodexSdkOptions,
  CodexSdkThreadOptions,
  CodexSdkTurnOptions,
  CreateCodexSdkClient,
} from './codex-pipeline-node-runner'
import type {
  PipelineNodeExecutionContext,
  PipelineNodeExecutionResult,
  PipelineNodeRunner,
} from './pipeline-node-runner'

function context(node: PipelineNodeKind): PipelineNodeExecutionContext {
  return {
    sessionId: 'session-1',
    userInput: '修复 Pipeline bug',
    currentNode: node,
    reviewIteration: 0,
  }
}

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function gitOrNull(repoRoot: string, args: string[]): string | null {
  try {
    return git(repoRoot, args)
  } catch {
    return null
  }
}

function initializeGitRepo(repoRoot: string): void {
  git(repoRoot, ['init'])
  git(repoRoot, ['config', 'user.name', 'RV Test'])
  git(repoRoot, ['config', 'user.email', 'rv-test@example.com'])
  mkdirSync(join(repoRoot, 'src'), { recursive: true })
  writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 1\n', 'utf-8')
  git(repoRoot, ['add', 'src/index.ts'])
  git(repoRoot, ['commit', '-m', 'initial'])
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('等待条件超时')
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function createLongRunningCodexFixture(): {
  codexPath: string
  grandchildPidPath: string
  tempDir: string
} {
  const tempDir = mkdtempSync(join(tmpdir(), 'rv-codex-cli-abort-'))
  const grandchildPidPath = join(tempDir, 'grandchild.pid')
  const grandchildPath = join(tempDir, 'grandchild.mjs')
  const codexPath = join(tempDir, 'fake-codex')

  writeFileSync(grandchildPath, [
    "import { writeFileSync } from 'node:fs'",
    `writeFileSync(${JSON.stringify(grandchildPidPath)}, String(process.pid), 'utf8')`,
    "process.on('SIGTERM', () => {})",
    'setInterval(() => {}, 1000)',
  ].join('\n'), 'utf8')

  writeFileSync(codexPath, [
    `#!${process.execPath}`,
    "import { spawn } from 'node:child_process'",
    `const child = spawn(process.execPath, [${JSON.stringify(grandchildPath)}], { stdio: 'ignore' })`,
    'child.unref()',
    "process.on('SIGTERM', () => {})",
    'process.stdin.resume()',
    'setInterval(() => {}, 1000)',
  ].join('\n'), 'utf8')
  chmodSync(codexPath, 0o755)

  return { codexPath, grandchildPidPath, tempDir }
}

function createProcessHandle(pid: number): {
  child: ChildProcessWithoutNullStreams
  killSignals: Array<NodeJS.Signals | number | undefined>
} {
  const killSignals: Array<NodeJS.Signals | number | undefined> = []
  const child = {
    pid,
    kill: (signal?: NodeJS.Signals | number) => {
      killSignals.push(signal)
      return true
    },
  } as unknown as ChildProcessWithoutNullStreams

  return { child, killSignals }
}

class FakeCodexCliExecutor implements CodexCliExecutor {
  readonly calls: CodexCliRunInput[] = []

  constructor(
    private readonly finalResponse: string,
    private readonly onRun?: (input: CodexCliRunInput) => void,
  ) {}

  abort(): void {}

  async run(input: CodexCliRunInput) {
    this.calls.push(input)
    this.onRun?.(input)
    return { finalResponse: this.finalResponse }
  }
}

const originalProcessCodexApiKey = process.env.CODEX_API_KEY
const originalProcessCodexHome = process.env.CODEX_HOME

type CodexTestChangeType = 'added' | 'modified' | 'deleted' | 'renamed'
type CodexTestEvidenceStatus = 'passed' | 'failed' | 'skipped'
type CodexTestSubmissionStatus = 'draft_only' | 'blocked'

interface CodexTestChangedFile {
  path: string
  changeType: CodexTestChangeType
  summary: string
}

interface CodexTestRun {
  command: string
  status: CodexTestEvidenceStatus
  summary: string
  durationMs: number
}

interface CodexTestReviewIssue {
  id: string
  severity: 'blocker' | 'major' | 'minor' | 'nit'
  category: 'correctness' | 'regression' | 'test_gap' | 'maintainability' | 'security' | 'style'
  title: string
  detail: string
  status: 'open' | 'fixed' | 'accepted_risk'
  file: string
  line: number
  suggestedFix: string
}

function developerResponse(input: {
  summary: string
  changes?: string[]
  tests?: string[]
  risks?: string[]
  changedFiles?: CodexTestChangedFile[]
  testsRun?: CodexTestRun[]
  devMarkdown?: string
}): string {
  return JSON.stringify({
    summary: input.summary,
    changes: input.changes ?? [],
    tests: input.tests ?? [],
    risks: input.risks ?? [],
    changedFiles: input.changedFiles ?? [],
    testsRun: input.testsRun ?? [],
    devMarkdown: input.devMarkdown ?? '',
  })
}

function reviewerResponse(input: {
  approved: boolean
  summary: string
  issues?: string[]
  structuredIssues?: CodexTestReviewIssue[]
  reviewMarkdown?: string
}): string {
  return JSON.stringify({
    approved: input.approved,
    summary: input.summary,
    issues: input.issues ?? [],
    structuredIssues: input.structuredIssues ?? [],
    reviewMarkdown: input.reviewMarkdown ?? '',
  })
}

function testerResponse(input: {
  summary: string
  commands?: string[]
  results?: string[]
  blockers?: string[]
  passed: boolean
  testEvidence?: CodexTestRun[]
  resultMarkdown?: string
}): string {
  return JSON.stringify({
    summary: input.summary,
    commands: input.commands ?? [],
    results: input.results ?? [],
    blockers: input.blockers ?? [],
    passed: input.passed,
    testEvidence: input.testEvidence ?? [{
      command: 'bun test',
      status: 'passed',
      summary: '通过',
      durationMs: 1,
    }],
    resultMarkdown: input.resultMarkdown ?? '',
  })
}

function committerResponse(input: {
  summary: string
  commitMessage: string
  prTitle: string
  prBody: string
  submissionStatus: CodexTestSubmissionStatus
  blockers?: string[]
  risks?: string[]
  commitMarkdown?: string
  prMarkdown?: string
}): string {
  return JSON.stringify({
    summary: input.summary,
    commitMessage: input.commitMessage,
    prTitle: input.prTitle,
    prBody: input.prBody,
    submissionStatus: input.submissionStatus,
    blockers: input.blockers ?? [],
    risks: input.risks ?? [],
    commitMarkdown: input.commitMarkdown ?? '',
    prMarkdown: input.prMarkdown ?? '',
  })
}

describe('codex-pipeline-node-runner', () => {
  test('resolvePipelineCodexChannelId 默认不注入渠道，使用本机 Codex auth', () => {
    expect(resolvePipelineCodexChannelId({}, {})).toBeUndefined()
  })

  test('resolvePipelineCodexChannelId 优先使用 settings 中的 Codex 渠道', () => {
    expect(resolvePipelineCodexChannelId(
      { pipelineCodexChannelId: 'settings-channel' },
      { RV_PIPELINE_CODEX_CHANNEL_ID: 'env-channel' },
    )).toBe('settings-channel')
  })

  test('resolvePipelineCodexChannelId 保留环境变量作为兼容 fallback', () => {
    expect(resolvePipelineCodexChannelId(
      {},
      { RV_PIPELINE_CODEX_CHANNEL_ID: '  env-channel  ' },
    )).toBe('env-channel')
  })

  test('resolvePipelineCodexChannelId 显式本机 auth 不回退旧环境变量', () => {
    expect(resolvePipelineCodexChannelId(
      { pipelineCodexChannelId: null },
      { RV_PIPELINE_CODEX_CHANNEL_ID: 'env-channel' },
    )).toBeUndefined()
  })

  beforeEach(() => {
    process.env.CODEX_API_KEY = 'test-codex-key'
    delete process.env.CODEX_HOME
  })

  afterEach(() => {
    if (originalProcessCodexApiKey === undefined) {
      delete process.env.CODEX_API_KEY
    } else {
      process.env.CODEX_API_KEY = originalProcessCodexApiKey
    }
    if (originalProcessCodexHome === undefined) {
      delete process.env.CODEX_HOME
    } else {
      process.env.CODEX_HOME = originalProcessCodexHome
    }
  })

  test('buildCodexCliArgs 构造 codex exec 结构化输出参数', () => {
    const args = buildCodexCliArgs({
      schemaPath: '/tmp/schema.json',
      outputPath: '/tmp/final.json',
      cwd: '/repo',
      additionalDirectories: ['/extra-a', '/extra-b'],
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.4',
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
    })

    expect(args).toEqual([
      'exec',
      '--json',
      '--sandbox',
      'workspace-write',
      '--output-schema',
      '/tmp/schema.json',
      '--output-last-message',
      '/tmp/final.json',
      '--config',
      'approval_policy="never"',
      '--skip-git-repo-check',
      '--config',
      'openai_base_url="https://api.openai.com/v1"',
      '--model',
      'gpt-5.4',
      '--cd',
      '/repo',
      '--add-dir',
      '/extra-a',
      '--add-dir',
      '/extra-b',
    ])
  })

  test('killCodexCliProcessTree 在 Windows 下使用 taskkill 级联清理', () => {
    const { child, killSignals } = createProcessHandle(1234)
    const taskkillPids: number[] = []

    killCodexCliProcessTree(child, {
      platform: 'win32',
      runTaskkill: (pid) => {
        taskkillPids.push(pid)
      },
    })

    expect(taskkillPids).toEqual([1234])
    expect(killSignals).toEqual([])
  })

  test('buildWindowsTaskkillArgs 构造 Windows 级联终止参数', () => {
    expect(buildWindowsTaskkillArgs(1234)).toEqual(['/F', '/T', '/PID', '1234'])
  })

  test('killCodexCliProcessTree 在 taskkill 失败后回退强杀直接子进程', () => {
    const { child, killSignals } = createProcessHandle(1234)

    killCodexCliProcessTree(child, {
      platform: 'win32',
      runTaskkill: () => {
        throw new Error('taskkill failed')
      },
    })

    expect(killSignals).toEqual(['SIGKILL'])
  })

  if (process.platform !== 'win32') {
    test('SpawnCodexCliExecutor 通过 AbortSignal 强杀 Codex CLI 进程树', async () => {
      const fixture = createLongRunningCodexFixture()
      const controller = new AbortController()
      let grandchildPid: number | undefined
      const executor = new SpawnCodexCliExecutor(fixture.codexPath)
      const runPromise = executor.run({
        sessionId: 'session-abort',
        prompt: '保持运行',
        schema: { type: 'object' },
        additionalDirectories: [],
        env: {},
        sandboxMode: 'workspace-write',
        approvalPolicy: 'never',
        signal: controller.signal,
      })

      try {
        await waitForCondition(() => existsSync(fixture.grandchildPidPath))
        const observedGrandchildPid = Number(readFileSync(fixture.grandchildPidPath, 'utf8'))
        grandchildPid = observedGrandchildPid
        expect(isProcessAlive(observedGrandchildPid)).toBe(true)

        controller.abort()

        await expect(runPromise).rejects.toThrow(/Codex CLI 执行已中止/)
        await waitForCondition(() => !isProcessAlive(observedGrandchildPid))
      } finally {
        controller.abort()
        if (grandchildPid && isProcessAlive(grandchildPid)) {
          process.kill(grandchildPid, 'SIGKILL')
        }
        await runPromise.catch(() => undefined)
        rmSync(fixture.tempDir, { recursive: true, force: true })
      }
    })
  }

  test('Codex CLI runner 执行 developer 并解析结构化结果', async () => {
    const events: PipelineStreamEvent[] = []
    const executor = new FakeCodexCliExecutor(developerResponse({
      summary: '完成修复',
      changes: ['新增 Codex CLI runner'],
      tests: ['bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts'],
      risks: [],
      devMarkdown: '# 开发文档\n\n## 实现摘要\n完成修复。\n',
    }))
    const runner = new CodexCliPipelineNodeRunner({
      executor,
      onEvent: (event) => events.push(event),
    })

    const result = await runner.runNode('developer', context('developer'))

    expect(executor.calls).toHaveLength(1)
    expect(executor.calls[0]?.sandboxMode).toBe('workspace-write')
    expect(executor.calls[0]?.schema).toMatchObject({
      required: ['summary', 'changes', 'tests', 'risks', 'changedFiles', 'testsRun', 'devMarkdown'],
    })
    expect(result.summary).toBe('完成修复')
    expect(result.approved).toBe(true)
    expect(result.stageOutput).toMatchObject({
      node: 'developer',
      changes: ['新增 Codex CLI runner'],
    })
    expect(events.map((event) => event.type)).toEqual([
      'node_start',
      'text_delta',
      'node_complete',
    ])
  })

  test('Codex CLI runner 在 v2 developer 后写入 dev.md 并回填文档 ref', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    const previousGitDir = process.env.GIT_DIR
    const previousGitConfigCount = process.env.GIT_CONFIG_COUNT
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'rv-codex-v2-dev-config-'))
    const repoRoot = mkdtempSync(join(tmpdir(), 'rv-codex-v2-dev-repo-'))
    process.env.RV_INSIGHTS_CONFIG_DIR = tempConfigDir
    process.env.GIT_DIR = '/__rv_bad_git_dir__'
    process.env.GIT_CONFIG_COUNT = '1'
    try {
      initializeGitRepo(repoRoot)
      createContributionTask({
        id: 'task-codex-dev-doc',
        pipelineSessionId: 'session-codex-dev-doc',
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'developing',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-dev-doc',
        pipelineSessionId: 'session-codex-dev-doc',
        repositoryRoot: repoRoot,
        kind: 'implementation_plan',
        createdByNode: 'planner',
        content: '# 开发方案\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-dev-doc',
        pipelineSessionId: 'session-codex-dev-doc',
        repositoryRoot: repoRoot,
        kind: 'test_plan',
        createdByNode: 'planner',
        content: '# 测试方案\n',
      })
      acceptPatchWorkDocuments({
        repositoryRoot: repoRoot,
        gateId: 'gate-plan',
        kinds: ['implementation_plan', 'test_plan'],
      })
      const executor = new FakeCodexCliExecutor(developerResponse({
        summary: '完成 Phase 4 developer',
        changes: ['写入 dev.md'],
        tests: ['bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts'],
        risks: [],
        devMarkdown: '# 开发文档\n\n## 实现摘要\n写入 dev.md。\n',
        changedFiles: [
          {
            path: 'apps/electron/src/main/lib/codex-pipeline-node-runner.ts',
            changeType: 'modified',
            summary: '补充 dev.md 写入',
          },
        ],
        testsRun: [
          {
            command: 'bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts',
            status: 'passed',
            summary: '通过',
            durationMs: 30,
          },
        ],
      }))
      const runner = new CodexCliPipelineNodeRunner({ executor })

      const result = await runner.runNode('developer', {
        sessionId: 'session-codex-dev-doc',
        userInput: '实现 Phase 4',
        currentNode: 'developer',
        version: 2,
        reviewIteration: 0,
      })

      expect(executor.calls[0]?.env.GIT_DIR).toBe('/__rv_insights_git_disabled__')
      expect(executor.calls[0]?.env.RV_INSIGHTS_GIT_DISABLED).toBe('1')
      expect(executor.calls[0]?.prompt).toContain('已接受开发方案（plan.md）')
      expect(result.stageOutput).toMatchObject({
        node: 'developer',
        devDoc: {
          relativePath: 'dev.md',
        },
      })
      expect(readFileSync(join(repoRoot, 'patch-work', 'dev.md'), 'utf-8')).toContain('写入 dev.md')
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
      if (previousGitDir === undefined) {
        delete process.env.GIT_DIR
      } else {
        process.env.GIT_DIR = previousGitDir
      }
      if (previousGitConfigCount === undefined) {
        delete process.env.GIT_CONFIG_COUNT
      } else {
        process.env.GIT_CONFIG_COUNT = previousGitConfigCount
      }
      rmSync(tempConfigDir, { recursive: true, force: true })
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('Codex CLI runner 在 v2 tester 后写入 result.md 和排除 patch-work 的 patch-set', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'rv-codex-v2-tester-config-'))
    const repoRoot = mkdtempSync(join(tmpdir(), 'rv-codex-v2-tester-repo-'))
    process.env.RV_INSIGHTS_CONFIG_DIR = tempConfigDir
    try {
      initializeGitRepo(repoRoot)
      writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 2\n', 'utf-8')
      createContributionTask({
        id: 'task-codex-tester',
        pipelineSessionId: 'session-codex-tester',
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'testing',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-tester',
        pipelineSessionId: 'session-codex-tester',
        repositoryRoot: repoRoot,
        kind: 'test_plan',
        createdByNode: 'planner',
        content: '# 测试方案\n\n- 运行 bun test\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-tester',
        pipelineSessionId: 'session-codex-tester',
        repositoryRoot: repoRoot,
        kind: 'dev_doc',
        createdByNode: 'developer',
        content: '# 开发文档\n\n已修改 src/index.ts。\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-tester',
        pipelineSessionId: 'session-codex-tester',
        repositoryRoot: repoRoot,
        kind: 'review_doc',
        createdByNode: 'reviewer',
        content: '# 审查报告\n\n通过，进入 tester。\n',
      })
      acceptPatchWorkDocuments({
        repositoryRoot: repoRoot,
        gateId: 'gate-test-plan',
        kinds: ['test_plan', 'dev_doc'],
      })
      const executor = new FakeCodexCliExecutor(testerResponse({
        summary: '测试通过',
        commands: ['bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts'],
        results: ['Phase 5 tester 测试通过'],
        blockers: [],
        passed: true,
        testEvidence: [
          {
            command: 'bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts',
            status: 'passed',
            summary: '通过',
            durationMs: 120,
          },
        ],
        resultMarkdown: '# 测试报告\n\n## 测试结论\n通过。\n',
      }))
      const runner = new CodexCliPipelineNodeRunner({ executor })

      const result = await runner.runNode('tester', {
        sessionId: 'session-codex-tester',
        userInput: '实现 Phase 5',
        currentNode: 'tester',
        version: 2,
        reviewIteration: 0,
      })

      expect(executor.calls[0]?.sandboxMode).toBe('workspace-write')
      expect(executor.calls[0]?.prompt).toContain('已接受测试方案（test-plan.md）')
      expect(executor.calls[0]?.prompt).toContain('已接受开发文档（dev.md）')
      expect(executor.calls[0]?.prompt).toContain('审查报告（review.md）')
      expect(executor.calls[0]?.prompt).toContain('不要执行 git 命令、git commit、git push 或创建 PR')
      expect(result.stageOutput).toMatchObject({
        node: 'tester',
        passed: true,
        testResultRef: {
          relativePath: 'result.md',
        },
        patchSet: {
          excludesPatchWork: true,
          patchRef: {
            relativePath: 'patch-set/changes.patch',
          },
          changedFilesRef: {
            relativePath: 'patch-set/changed-files.json',
          },
          diffSummaryRef: {
            relativePath: 'patch-set/diff-summary.md',
          },
          testEvidenceRef: {
            relativePath: 'patch-set/test-evidence.json',
          },
        },
      })
      expect(readFileSync(join(repoRoot, 'patch-work', 'result.md'), 'utf-8')).toContain('测试结论')
      expect(readFileSync(join(repoRoot, 'patch-work', 'patch-set', 'changes.patch'), 'utf-8')).toContain('src/index.ts')
      expect(readFileSync(join(repoRoot, 'patch-work', 'patch-set', 'changes.patch'), 'utf-8')).not.toContain('patch-work')
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
      rmSync(tempConfigDir, { recursive: true, force: true })
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('Codex CLI runner 在 v2 tester 中阻断 Git/PR 命令并回滚绝对路径 Git 污染', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'rv-codex-v2-tester-commit-config-'))
    const repoRoot = mkdtempSync(join(tmpdir(), 'rv-codex-v2-tester-commit-repo-'))
    process.env.RV_INSIGHTS_CONFIG_DIR = tempConfigDir
    try {
      initializeGitRepo(repoRoot)
      const initialHead = git(repoRoot, ['rev-parse', 'HEAD'])
      const realGitPath = execFileSync('sh', ['-lc', 'command -v git'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
      createContributionTask({
        id: 'task-codex-tester-commit',
        pipelineSessionId: 'session-codex-tester-commit',
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'testing',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-tester-commit',
        pipelineSessionId: 'session-codex-tester-commit',
        repositoryRoot: repoRoot,
        kind: 'test_plan',
        createdByNode: 'planner',
        content: '# 测试方案\n\n- 运行 bun test\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-tester-commit',
        pipelineSessionId: 'session-codex-tester-commit',
        repositoryRoot: repoRoot,
        kind: 'dev_doc',
        createdByNode: 'developer',
        content: '# 开发文档\n\n已修改 src/index.ts。\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-tester-commit',
        pipelineSessionId: 'session-codex-tester-commit',
        repositoryRoot: repoRoot,
        kind: 'review_doc',
        createdByNode: 'reviewer',
        content: '# 审查报告\n\n通过，进入 tester。\n',
      })
      acceptPatchWorkDocuments({
        repositoryRoot: repoRoot,
        gateId: 'gate-test-plan',
        kinds: ['test_plan', 'dev_doc'],
      })
      const executor = new FakeCodexCliExecutor(testerResponse({
        summary: '测试通过且命令防护生效',
        commands: ['bun test'],
        results: ['通过'],
        blockers: [],
        passed: true,
        testEvidence: [
          {
            command: 'bun test',
            status: 'passed',
            summary: '通过',
            durationMs: 1,
          },
        ],
        resultMarkdown: '# 测试报告\n\n## 测试结论\n通过。\n',
      }), (input) => {
        const guardedEnv = {
          ...process.env,
          ...input.env,
        }
        let gitBlocked = false
        let prBlocked = false
        writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 3\n', 'utf-8')
        try {
          execFileSync('git', ['-C', repoRoot, 'status'], {
            env: guardedEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        } catch {
          gitBlocked = true
        }
        try {
          execFileSync('gh', ['pr', 'create', '--title', 'blocked', '--body', 'blocked'], {
            env: guardedEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        } catch {
          prBlocked = true
        }
        expect(gitBlocked).toBe(true)
        expect(prBlocked).toBe(true)
        expect(input.env.RV_INSIGHTS_REAL_GIT).toBeUndefined()
        expect(input.env.GIT_DIR).toBe('/__rv_insights_git_disabled__')

        let absoluteGitBlocked = false
        try {
          execFileSync(realGitPath, ['-C', repoRoot, 'status'], {
            env: guardedEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        } catch {
          absoluteGitBlocked = true
        }
        expect(absoluteGitBlocked).toBe(true)

        const bypassEnv = {
          ...guardedEnv,
          GIT_DIR: join(repoRoot, '.git'),
          GIT_WORK_TREE: repoRoot,
        }
        execFileSync(realGitPath, ['-C', repoRoot, 'tag', 'rv-forbidden-tag'], {
          env: bypassEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        execFileSync(realGitPath, ['-C', repoRoot, 'branch', 'rv-forbidden-branch'], {
          env: bypassEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        execFileSync(realGitPath, ['-C', repoRoot, 'config', 'rv-insights.forbidden', 'true'], {
          env: bypassEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        execFileSync(realGitPath, ['-C', repoRoot, 'add', 'src/index.ts'], {
          env: bypassEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        execFileSync(realGitPath, ['-C', repoRoot, 'commit', '-m', 'tester should not commit'], {
          env: bypassEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      })
      const runner = new CodexCliPipelineNodeRunner({ executor })

      await expect(runner.runNode('tester', {
        sessionId: 'session-codex-tester-commit',
        userInput: '实现 Phase 5',
        currentNode: 'tester',
        version: 2,
        reviewIteration: 0,
      })).rejects.toThrow('Pipeline v2 禁止节点创建真实 Git commit')

      expect(executor.calls[0]?.env.GIT_TERMINAL_PROMPT).toBe('0')
      expect(git(repoRoot, ['rev-parse', 'HEAD'])).toBe(initialHead)
      expect(git(repoRoot, ['tag', '--list', 'rv-forbidden-tag'])).toBe('')
      expect(git(repoRoot, ['branch', '--list', 'rv-forbidden-branch'])).toBe('')
      expect(gitOrNull(repoRoot, ['config', '--local', '--get', 'rv-insights.forbidden'])).toBeNull()
      expect(git(repoRoot, ['diff', '--cached', '--name-only'])).toBe('')
      expect(existsSync(join(repoRoot, 'patch-work', 'result.md'))).toBe(false)
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
      rmSync(tempConfigDir, { recursive: true, force: true })
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('Codex CLI runner 在 v2 tester 中检测绝对路径 git reset --hard 丢弃补丁', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'rv-codex-v2-tester-reset-config-'))
    const repoRoot = mkdtempSync(join(tmpdir(), 'rv-codex-v2-tester-reset-repo-'))
    process.env.RV_INSIGHTS_CONFIG_DIR = tempConfigDir
    try {
      initializeGitRepo(repoRoot)
      writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 2\n', 'utf-8')
      const realGitPath = execFileSync('sh', ['-lc', 'command -v git'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
      createContributionTask({
        id: 'task-codex-tester-reset',
        pipelineSessionId: 'session-codex-tester-reset',
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'testing',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-tester-reset',
        pipelineSessionId: 'session-codex-tester-reset',
        repositoryRoot: repoRoot,
        kind: 'test_plan',
        createdByNode: 'planner',
        content: '# 测试方案\n\n- 运行 bun test\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-tester-reset',
        pipelineSessionId: 'session-codex-tester-reset',
        repositoryRoot: repoRoot,
        kind: 'dev_doc',
        createdByNode: 'developer',
        content: '# 开发文档\n\n已修改 src/index.ts。\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-tester-reset',
        pipelineSessionId: 'session-codex-tester-reset',
        repositoryRoot: repoRoot,
        kind: 'review_doc',
        createdByNode: 'reviewer',
        content: '# 审查报告\n\n通过，进入 tester。\n',
      })
      acceptPatchWorkDocuments({
        repositoryRoot: repoRoot,
        gateId: 'gate-test-plan',
        kinds: ['test_plan', 'dev_doc'],
      })
      const executor = new FakeCodexCliExecutor(testerResponse({
        summary: '测试通过但不应丢弃补丁',
        commands: ['bun test'],
        results: ['通过'],
        blockers: [],
        passed: true,
        testEvidence: [
          {
            command: 'bun test',
            status: 'passed',
            summary: '通过',
            durationMs: 1,
          },
        ],
      }), (input) => {
        execFileSync(realGitPath, ['-C', repoRoot, 'reset', '--hard', 'HEAD'], {
          env: {
            ...process.env,
            ...input.env,
            GIT_DIR: join(repoRoot, '.git'),
            GIT_WORK_TREE: repoRoot,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      })
      const runner = new CodexCliPipelineNodeRunner({ executor })

      await expect(runner.runNode('tester', {
        sessionId: 'session-codex-tester-reset',
        userInput: '实现 Phase 5',
        currentNode: 'tester',
        version: 2,
        reviewIteration: 0,
      })).rejects.toThrow('Pipeline v2 禁止节点丢弃工作区补丁')

      expect(existsSync(join(repoRoot, 'patch-work', 'result.md'))).toBe(false)
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
      rmSync(tempConfigDir, { recursive: true, force: true })
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('Codex CLI runner 在 v2 committer 中只生成 commit.md / pr.md 草稿且不创建提交', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'rv-codex-v2-committer-config-'))
    const repoRoot = mkdtempSync(join(tmpdir(), 'rv-codex-v2-committer-repo-'))
    process.env.RV_INSIGHTS_CONFIG_DIR = tempConfigDir
    try {
      initializeGitRepo(repoRoot)
      writeFileSync(join(repoRoot, 'CONTRIBUTING.md'), '# Contributing\n\n请使用 Conventional Commits。\n', 'utf-8')
      writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 2\n', 'utf-8')
      const initialHead = git(repoRoot, ['rev-parse', 'HEAD'])
      createContributionTask({
        id: 'task-codex-committer',
        pipelineSessionId: 'session-codex-committer',
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'committing',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-committer',
        pipelineSessionId: 'session-codex-committer',
        repositoryRoot: repoRoot,
        kind: 'test_result',
        createdByNode: 'tester',
        content: '# 测试报告\n\n## 测试结论\n通过。\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-committer',
        pipelineSessionId: 'session-codex-committer',
        repositoryRoot: repoRoot,
        kind: 'patch',
        createdByNode: 'tester',
        content: 'diff --git a/src/index.ts b/src/index.ts\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-committer',
        pipelineSessionId: 'session-codex-committer',
        repositoryRoot: repoRoot,
        kind: 'changed_files',
        createdByNode: 'tester',
        content: '[{"path":"src/index.ts","changeType":"modified","summary":"更新实现"}]\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-committer',
        pipelineSessionId: 'session-codex-committer',
        repositoryRoot: repoRoot,
        kind: 'diff_summary',
        createdByNode: 'tester',
        content: '# Diff 摘要\n\n- src/index.ts\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-committer',
        pipelineSessionId: 'session-codex-committer',
        repositoryRoot: repoRoot,
        kind: 'test_evidence',
        createdByNode: 'tester',
        content: '[{"command":"bun test","status":"passed","summary":"通过"}]\n',
      })
      acceptPatchWorkDocuments({
        repositoryRoot: repoRoot,
        gateId: 'gate-tester',
        kinds: ['test_result', 'patch', 'changed_files', 'diff_summary', 'test_evidence'],
      })
      const executor = new FakeCodexCliExecutor(committerResponse({
        summary: '提交材料已生成',
        commitMessage: 'feat(pipeline): add draft submission',
        prTitle: 'Add draft submission materials',
        prBody: '## Summary\n- Add draft submission\n\n## Tests\n- bun test',
        submissionStatus: 'draft_only',
        blockers: [],
        risks: ['未执行真实 commit'],
        commitMarkdown: '# Commit 准备\n\n## 建议 Commit Message\nfeat(pipeline): add draft submission\n',
        prMarkdown: '# PR 草稿\n\n## 标题\nAdd draft submission materials\n',
      }))
      const runner = new CodexCliPipelineNodeRunner({ executor })

      const result = await runner.runNode('committer', {
        sessionId: 'session-codex-committer',
        userInput: '准备提交材料',
        currentNode: 'committer',
        version: 2,
        reviewIteration: 0,
      })

      expect(executor.calls[0]?.sandboxMode).toBe('read-only')
      expect(executor.calls[0]?.prompt).toContain('测试报告（result.md）')
      expect(executor.calls[0]?.prompt).toContain('CONTRIBUTING')
      expect(executor.calls[0]?.prompt).toContain('不要执行 git add、git commit、git push 或创建 PR')
      expect(result.stageOutput).toMatchObject({
        node: 'committer',
        submissionStatus: 'draft_only',
        commitDocRef: {
          relativePath: 'commit.md',
        },
        prDocRef: {
          relativePath: 'pr.md',
        },
      })
      expect(readFileSync(join(repoRoot, 'patch-work', 'commit.md'), 'utf-8')).toContain('feat(pipeline): add draft submission')
      expect(readFileSync(join(repoRoot, 'patch-work', 'pr.md'), 'utf-8')).toContain('Add draft submission materials')
      expect(git(repoRoot, ['rev-parse', 'HEAD'])).toBe(initialHead)
      expect(git(repoRoot, ['diff', '--cached', '--name-only'])).toBe('')
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
      rmSync(tempConfigDir, { recursive: true, force: true })
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('Codex CLI runner 在 executor 返回后若 signal 已中止则不发送 node_complete', async () => {
    const controller = new AbortController()
    const events: PipelineStreamEvent[] = []
    const executor: CodexCliExecutor = {
      abort: () => {},
      run: async () => {
        controller.abort()
        return {
          finalResponse: developerResponse({
            summary: '不应发布成功结果',
            changes: [],
            tests: [],
            risks: [],
          }),
        }
      },
    }
    const runner = new CodexCliPipelineNodeRunner({
      executor,
      onEvent: (event) => events.push(event),
    })

    await expect(runner.runNode('developer', {
      ...context('developer'),
      signal: controller.signal,
    })).rejects.toThrow(/Pipeline 节点执行已中止/)
    expect(events.map((event) => event.type)).toEqual(['node_start'])
  })

  test('Codex CLI runner 无渠道时保留凭证环境并过滤宿主会话环境', async () => {
    const previousCodexKey = process.env.CODEX_API_KEY
    const previousCodexThreadId = process.env.CODEX_THREAD_ID
    const previousAnthropicToken = process.env.ANTHROPIC_AUTH_TOKEN
    const previousHome = process.env.HOME
    const previousUserProfile = process.env.USERPROFILE
    const previousCodexHome = process.env.CODEX_HOME
    const tempHome = mkdtempSync(join(tmpdir(), 'rv-codex-cli-api-key-home-'))
    const ambientCodexHome = join(tempHome, 'ambient-codex-home')
    process.env.HOME = tempHome
    process.env.USERPROFILE = tempHome
    process.env.CODEX_HOME = ambientCodexHome
    process.env.CODEX_API_KEY = 'codex-env-key'
    process.env.CODEX_THREAD_ID = 'outer-thread-id'
    process.env.ANTHROPIC_AUTH_TOKEN = 'anthropic-token'
    try {
      const executor = new FakeCodexCliExecutor(developerResponse({
        summary: '完成修复',
        changes: [],
        tests: [],
        risks: [],
      }))
      const runner = new CodexCliPipelineNodeRunner({
        executor,
      })

      await runner.runNode('developer', context('developer'))

      expect(executor.calls[0]?.apiKey).toBeUndefined()
      expect(executor.calls[0]?.env.CODEX_API_KEY).toBe('codex-env-key')
      expect(executor.calls[0]?.env.CODEX_HOME).not.toBe(ambientCodexHome)
      expect(executor.calls[0]?.env.CODEX_HOME).toContain('rv-codex-home-')
      expect(executor.calls[0]?.env.CODEX_THREAD_ID).toBeUndefined()
      expect(executor.calls[0]?.env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    } finally {
      if (previousCodexKey === undefined) {
        delete process.env.CODEX_API_KEY
      } else {
        process.env.CODEX_API_KEY = previousCodexKey
      }
      if (previousCodexThreadId === undefined) {
        delete process.env.CODEX_THREAD_ID
      } else {
        process.env.CODEX_THREAD_ID = previousCodexThreadId
      }
      if (previousAnthropicToken === undefined) {
        delete process.env.ANTHROPIC_AUTH_TOKEN
      } else {
        process.env.ANTHROPIC_AUTH_TOKEN = previousAnthropicToken
      }
      if (previousHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = previousHome
      }
      if (previousUserProfile === undefined) {
        delete process.env.USERPROFILE
      } else {
        process.env.USERPROFILE = previousUserProfile
      }
      if (previousCodexHome === undefined) {
        delete process.env.CODEX_HOME
      } else {
        process.env.CODEX_HOME = previousCodexHome
      }
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('Codex SDK runner 执行 reviewer 并保留驳回结论', async () => {
    const sdkOptions: CodexSdkOptions[] = []
    const threadOptions: CodexSdkThreadOptions[] = []
    const turnOptions: CodexSdkTurnOptions[] = []
    const createCodexClient: CreateCodexSdkClient = (options) => {
      sdkOptions.push(options)
      return {
        startThread: (optionsForThread) => {
          threadOptions.push(optionsForThread ?? {})
          return {
              run: async (_input, optionsForTurn) => {
                turnOptions.push(optionsForTurn ?? {})
                return {
                  finalResponse: reviewerResponse({
                    approved: false,
                    summary: '需要返工',
                    issues: ['缺少回归测试'],
                  }),
                }
            },
          }
        },
      }
    }
    const runner = new CodexSdkPipelineNodeRunner({
      createCodexClient,
      codexPath: '/mock/codex',
    })

    const result = await runner.runNode('reviewer', context('reviewer'))

    expect(sdkOptions[0]?.codexPathOverride).toBe('/mock/codex')
    expect(sdkOptions[0]?.apiKey).toBeUndefined()
    expect(sdkOptions[0]?.baseUrl).toBeUndefined()
    expect(threadOptions[0]).toMatchObject({
      sandboxMode: 'read-only',
      skipGitRepoCheck: true,
      approvalPolicy: 'never',
    })
    expect(threadOptions[0]?.model).toBeUndefined()
    expect(turnOptions[0]?.outputSchema).toMatchObject({
      required: ['approved', 'summary', 'issues', 'structuredIssues', 'reviewMarkdown'],
    })
    expect(result.approved).toBe(false)
    expect(result.issues).toEqual(['缺少回归测试'])
  })

  test('Codex SDK runner 无渠道时保留凭证环境并过滤宿主会话环境', async () => {
    const previousCodexKey = process.env.CODEX_API_KEY
    const previousOpenAiKey = process.env.OPENAI_API_KEY
    const previousCodexThreadId = process.env.CODEX_THREAD_ID
    const previousAnthropicToken = process.env.ANTHROPIC_AUTH_TOKEN
    const previousHome = process.env.HOME
    const previousUserProfile = process.env.USERPROFILE
    const previousCodexHome = process.env.CODEX_HOME
    const tempHome = mkdtempSync(join(tmpdir(), 'rv-codex-sdk-api-key-home-'))
    const ambientCodexHome = join(tempHome, 'ambient-codex-home')
    process.env.HOME = tempHome
    process.env.USERPROFILE = tempHome
    process.env.CODEX_HOME = ambientCodexHome
    process.env.CODEX_API_KEY = 'codex-env-key'
    process.env.OPENAI_API_KEY = 'openai-env-key'
    process.env.CODEX_THREAD_ID = 'outer-thread-id'
    process.env.ANTHROPIC_AUTH_TOKEN = 'anthropic-token'
    try {
      const sdkOptions: CodexSdkOptions[] = []
      const createCodexClient: CreateCodexSdkClient = (options) => {
        sdkOptions.push(options)
        return {
          startThread: () => ({
            run: async () => ({
              finalResponse: developerResponse({
                summary: '完成修复',
                changes: [],
                tests: [],
                risks: [],
              }),
            }),
          }),
        }
      }
      const runner = new CodexSdkPipelineNodeRunner({
        createCodexClient,
        codexPath: '/mock/codex',
      })

      await runner.runNode('developer', context('developer'))

      expect(sdkOptions[0]?.apiKey).toBeUndefined()
      expect(sdkOptions[0]?.baseUrl).toBeUndefined()
      expect(sdkOptions[0]?.env?.CODEX_API_KEY).toBe('codex-env-key')
      expect(sdkOptions[0]?.env?.OPENAI_API_KEY).toBe('openai-env-key')
      expect(sdkOptions[0]?.env?.CODEX_HOME).not.toBe(ambientCodexHome)
      expect(sdkOptions[0]?.env?.CODEX_HOME).toContain('rv-codex-home-')
      expect(sdkOptions[0]?.env?.CODEX_THREAD_ID).toBeUndefined()
      expect(sdkOptions[0]?.env?.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    } finally {
      if (previousCodexKey === undefined) {
        delete process.env.CODEX_API_KEY
      } else {
        process.env.CODEX_API_KEY = previousCodexKey
      }
      if (previousOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY
      } else {
        process.env.OPENAI_API_KEY = previousOpenAiKey
      }
      if (previousCodexThreadId === undefined) {
        delete process.env.CODEX_THREAD_ID
      } else {
        process.env.CODEX_THREAD_ID = previousCodexThreadId
      }
      if (previousAnthropicToken === undefined) {
        delete process.env.ANTHROPIC_AUTH_TOKEN
      } else {
        process.env.ANTHROPIC_AUTH_TOKEN = previousAnthropicToken
      }
      if (previousHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = previousHome
      }
      if (previousUserProfile === undefined) {
        delete process.env.USERPROFILE
      } else {
        process.env.USERPROFILE = previousUserProfile
      }
      if (previousCodexHome === undefined) {
        delete process.env.CODEX_HOME
      } else {
        process.env.CODEX_HOME = previousCodexHome
      }
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('Codex SDK runner v2 无渠道时优先使用 native auth 并隔离 ambient CODEX_API_KEY', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    const previousHome = process.env.HOME
    const previousCodexHome = process.env.CODEX_HOME
    const previousCodexKey = process.env.CODEX_API_KEY
    const previousCodexThreadId = process.env.CODEX_THREAD_ID
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'rv-codex-sdk-native-auth-config-'))
    const repoRoot = mkdtempSync(join(tmpdir(), 'rv-codex-sdk-native-auth-repo-'))
    const nativeHome = mkdtempSync(join(tmpdir(), 'rv-codex-native-home-'))
    const nativeCodexHome = join(nativeHome, 'custom-codex-home')
    process.env.RV_INSIGHTS_CONFIG_DIR = tempConfigDir
    process.env.HOME = nativeHome
    process.env.CODEX_HOME = nativeCodexHome
    process.env.CODEX_API_KEY = 'ambient-codex-key'
    process.env.CODEX_THREAD_ID = 'outer-thread-id'
    try {
      mkdirSync(nativeCodexHome, { recursive: true })
      writeFileSync(join(nativeCodexHome, 'auth.json'), '{}\n', 'utf-8')
      initializeGitRepo(repoRoot)
      createContributionTask({
        id: 'task-codex-sdk-native-auth',
        pipelineSessionId: 'session-codex-sdk-native-auth',
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'developing',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-sdk-native-auth',
        pipelineSessionId: 'session-codex-sdk-native-auth',
        repositoryRoot: repoRoot,
        kind: 'implementation_plan',
        createdByNode: 'planner',
        content: '# 开发方案\n\n- 保留本机 Codex auth。\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-sdk-native-auth',
        pipelineSessionId: 'session-codex-sdk-native-auth',
        repositoryRoot: repoRoot,
        kind: 'test_plan',
        createdByNode: 'planner',
        content: '# 测试方案\n\n- 验证 Git guard 与本机 auth 可共存。\n',
      })
      acceptPatchWorkDocuments({
        repositoryRoot: repoRoot,
        gateId: 'gate-native-auth-plan',
        kinds: ['implementation_plan', 'test_plan'],
      })

      const sdkOptions: CodexSdkOptions[] = []
      const createCodexClient: CreateCodexSdkClient = (options) => {
        sdkOptions.push(options)
        return {
          startThread: () => ({
            run: async () => ({
              finalResponse: developerResponse({
                summary: '完成修复',
                changes: ['尊重 CODEX_HOME'],
                tests: [],
                risks: [],
                devMarkdown: '# 开发文档\n\n尊重 CODEX_HOME。\n',
              }),
            }),
          }),
        }
      }
      const runner = new CodexSdkPipelineNodeRunner({
        createCodexClient,
        codexPath: '/mock/codex',
      })

      await runner.runNode('developer', {
        sessionId: 'session-codex-sdk-native-auth',
        userInput: '验证本机 Codex auth',
        currentNode: 'developer',
        version: 2,
        reviewIteration: 0,
      })

      const env = sdkOptions[0]?.env
      expect(sdkOptions[0]?.apiKey).toBeUndefined()
      expect(env?.HOME).not.toBe(nativeHome)
      expect(env?.CODEX_HOME).toBe(nativeCodexHome)
      expect(env?.CODEX_API_KEY).toBeUndefined()
      expect(env?.CODEX_THREAD_ID).toBeUndefined()
      expect(env?.GIT_DIR).toBe('/__rv_insights_git_disabled__')
      expect(env?.GIT_CONFIG_GLOBAL).toContain('rv-codex-home-')
      expect(env?.PATH).toContain('rv-codex-command-guard-')
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
      if (previousHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = previousHome
      }
      if (previousCodexHome === undefined) {
        delete process.env.CODEX_HOME
      } else {
        process.env.CODEX_HOME = previousCodexHome
      }
      if (previousCodexKey === undefined) {
        delete process.env.CODEX_API_KEY
      } else {
        process.env.CODEX_API_KEY = previousCodexKey
      }
      if (previousCodexThreadId === undefined) {
        delete process.env.CODEX_THREAD_ID
      } else {
        process.env.CODEX_THREAD_ID = previousCodexThreadId
      }
      rmSync(tempConfigDir, { recursive: true, force: true })
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(nativeHome, { recursive: true, force: true })
    }
  })

  test('Codex SDK runner 无渠道且无 CODEX_API_KEY / 本机 auth 时 fail-fast', async () => {
    const previousHome = process.env.HOME
    const previousUserProfile = process.env.USERPROFILE
    const previousCodexHome = process.env.CODEX_HOME
    const previousCodexKey = process.env.CODEX_API_KEY
    const tempHome = mkdtempSync(join(tmpdir(), 'rv-codex-no-auth-home-'))
    process.env.HOME = tempHome
    process.env.USERPROFILE = tempHome
    delete process.env.CODEX_API_KEY
    delete process.env.CODEX_HOME
    try {
      let clientCreated = false
      const createCodexClient: CreateCodexSdkClient = () => {
        clientCreated = true
        throw new Error('不应创建 Codex client')
      }
      const runner = new CodexSdkPipelineNodeRunner({
        createCodexClient,
        codexPath: '/mock/codex',
      })

      await expect(runner.runNode('developer', context('developer'))).rejects.toThrow(
        /未配置 Pipeline Codex 渠道/,
      )
      expect(clientCreated).toBe(false)
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = previousHome
      }
      if (previousUserProfile === undefined) {
        delete process.env.USERPROFILE
      } else {
        process.env.USERPROFILE = previousUserProfile
      }
      if (previousCodexKey === undefined) {
        delete process.env.CODEX_API_KEY
      } else {
        process.env.CODEX_API_KEY = previousCodexKey
      }
      if (previousCodexHome === undefined) {
        delete process.env.CODEX_HOME
      } else {
        process.env.CODEX_HOME = previousCodexHome
      }
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('Codex SDK runner 遇到非法 JSON 时不发送 node_complete', async () => {
    const events: PipelineStreamEvent[] = []
    const createCodexClient: CreateCodexSdkClient = () => ({
      startThread: () => ({
        run: async () => ({ finalResponse: '不是 JSON' }),
      }),
    })
    const runner = new CodexSdkPipelineNodeRunner({
      createCodexClient,
      codexPath: '/mock/codex',
      onEvent: (event) => events.push(event),
    })

    await expect(runner.runNode('reviewer', context('reviewer'))).rejects.toThrow(/输出不是合法 JSON 对象/)
    expect(events.map((event) => event.type)).toEqual(['node_start'])
  })

  test('Codex SDK runner 若在准备阶段中止则不启动 turn 或发送 node_start', async () => {
    const controller = new AbortController()
    const events: PipelineStreamEvent[] = []
    let startThreadCalled = false
    const createCodexClient: CreateCodexSdkClient = () => {
      controller.abort()
      return {
        startThread: () => {
          startThreadCalled = true
          return {
            run: async () => {
              throw new Error('run 不应被调用')
            },
          }
        },
      }
    }
    const runner = new CodexSdkPipelineNodeRunner({
      createCodexClient,
      codexPath: '/mock/codex',
      onEvent: (event) => events.push(event),
    })

    await expect(runner.runNode('developer', {
      ...context('developer'),
      signal: controller.signal,
    })).rejects.toThrow(/Pipeline 节点执行已中止/)
    expect(startThreadCalled).toBe(false)
    expect(events).toEqual([])
  })

  test('Codex SDK runner 在返回后若 signal 已中止则不写 dev.md 或发送 node_complete', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'rv-codex-sdk-abort-config-'))
    const repoRoot = mkdtempSync(join(tmpdir(), 'rv-codex-sdk-abort-repo-'))
    const controller = new AbortController()
    const events: PipelineStreamEvent[] = []
    process.env.RV_INSIGHTS_CONFIG_DIR = tempConfigDir
    try {
      initializeGitRepo(repoRoot)
      createContributionTask({
        id: 'task-codex-sdk-abort',
        pipelineSessionId: 'session-codex-sdk-abort',
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'developing',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-sdk-abort',
        pipelineSessionId: 'session-codex-sdk-abort',
        repositoryRoot: repoRoot,
        kind: 'implementation_plan',
        createdByNode: 'planner',
        content: '# 开发方案\n',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-codex-sdk-abort',
        pipelineSessionId: 'session-codex-sdk-abort',
        repositoryRoot: repoRoot,
        kind: 'test_plan',
        createdByNode: 'planner',
        content: '# 测试方案\n',
      })
      acceptPatchWorkDocuments({
        repositoryRoot: repoRoot,
        gateId: 'gate-plan',
        kinds: ['implementation_plan', 'test_plan'],
      })
      const createCodexClient: CreateCodexSdkClient = () => ({
        startThread: () => ({
          run: async () => {
            controller.abort()
            return {
              finalResponse: developerResponse({
                summary: '不应写入 dev.md',
                changes: ['不应落盘'],
                tests: [],
                risks: [],
                devMarkdown: '# 开发文档\n\n不应出现。\n',
              }),
            }
          },
        }),
      })
      const runner = new CodexSdkPipelineNodeRunner({
        createCodexClient,
        codexPath: '/mock/codex',
        onEvent: (event) => events.push(event),
      })

      await expect(runner.runNode('developer', {
        sessionId: 'session-codex-sdk-abort',
        userInput: '实现 Phase 4',
        currentNode: 'developer',
        version: 2,
        reviewIteration: 0,
        signal: controller.signal,
      })).rejects.toThrow(/Pipeline 节点执行已中止/)
      expect(events.map((event) => event.type)).toEqual(['node_start'])
      expect(existsSync(join(repoRoot, 'patch-work', 'dev.md'))).toBe(false)
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
      rmSync(tempConfigDir, { recursive: true, force: true })
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('Codex SDK runner 会读取 OpenAI 兼容渠道配置', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    process.env.RV_INSIGHTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'rv-codex-openai-channel-'))
    try {
      const channel = createChannel({
        name: 'OpenAI 渠道',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai-test',
        enabled: true,
        models: [
          { id: 'gpt-5.4', name: 'GPT-5.4', enabled: true },
          { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', enabled: false },
        ],
      })
      const sdkOptions: CodexSdkOptions[] = []
      const threadOptions: CodexSdkThreadOptions[] = []
      const createCodexClient: CreateCodexSdkClient = (options) => {
        sdkOptions.push(options)
        return {
          startThread: (optionsForThread) => {
            threadOptions.push(optionsForThread ?? {})
            return {
              run: async () => ({
                finalResponse: developerResponse({
                  summary: '完成修复',
                  changes: ['使用 OpenAI 渠道'],
                  tests: [],
                  risks: [],
                }),
              }),
            }
          },
        }
      }
      const runner = new CodexSdkPipelineNodeRunner({
        channelId: channel.id,
        createCodexClient,
        codexPath: '/mock/codex',
      })

      await runner.runNode('developer', context('developer'))

      expect(sdkOptions[0]).toMatchObject({
        apiKey: 'sk-openai-test',
        baseUrl: 'https://api.openai.com/v1',
      })
      expect(threadOptions[0]?.model).toBe('gpt-5.4')
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
    }
  })

  test('Codex SDK runner 会读取 Custom OpenAI 兼容渠道配置', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    process.env.RV_INSIGHTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'rv-codex-custom-channel-'))
    try {
      const channel = createChannel({
        name: 'Custom 渠道',
        provider: 'custom',
        baseUrl: 'https://llm.example.com/v1',
        apiKey: 'sk-custom-test',
        enabled: true,
        models: [
          { id: 'custom-codex-model', name: 'Custom Codex', enabled: true },
        ],
      })
      const sdkOptions: CodexSdkOptions[] = []
      const threadOptions: CodexSdkThreadOptions[] = []
      const createCodexClient: CreateCodexSdkClient = (options) => {
        sdkOptions.push(options)
        return {
          startThread: (optionsForThread) => {
            threadOptions.push(optionsForThread ?? {})
            return {
              run: async () => ({
                finalResponse: developerResponse({
                  summary: '完成修复',
                  changes: ['使用 Custom 渠道'],
                  tests: [],
                  risks: [],
                }),
              }),
            }
          },
        }
      }
      const runner = new CodexSdkPipelineNodeRunner({
        channelId: channel.id,
        createCodexClient,
        codexPath: '/mock/codex',
      })

      await runner.runNode('developer', context('developer'))

      expect(sdkOptions[0]).toMatchObject({
        apiKey: 'sk-custom-test',
        baseUrl: 'https://llm.example.com/v1',
      })
      expect(threadOptions[0]?.model).toBe('custom-codex-model')
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
    }
  })

  test('Codex SDK runner 明确拒绝非 OpenAI 兼容渠道', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    process.env.RV_INSIGHTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'rv-codex-channel-'))
    try {
      const channel = createChannel({
        name: 'Claude 渠道',
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-test',
        enabled: true,
        models: [{ id: 'claude-sonnet-4-6', name: 'Claude', enabled: true }],
      })
      const createCodexClient: CreateCodexSdkClient = () => {
        throw new Error('不应创建 Codex client')
      }
      const runner = new CodexSdkPipelineNodeRunner({
        channelId: channel.id,
        createCodexClient,
        codexPath: '/mock/codex',
      })

      await expect(runner.runNode('developer', context('developer'))).rejects.toThrow(
        /Codex 节点需要 OpenAI 或 Custom 渠道/,
      )
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
    }
  })

  test('Codex CLI runner 明确拒绝已禁用的 OpenAI 兼容渠道', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    process.env.RV_INSIGHTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'rv-codex-cli-disabled-channel-'))
    try {
      const channel = createChannel({
        name: '禁用 CLI OpenAI 渠道',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai-test',
        enabled: false,
        models: [{ id: 'gpt-5.4', name: 'GPT-5.4', enabled: true }],
      })
      const executor = new FakeCodexCliExecutor(developerResponse({
        summary: '不应执行',
        changes: [],
        tests: [],
        risks: [],
      }))
      const runner = new CodexCliPipelineNodeRunner({
        channelId: channel.id,
        executor,
      })

      await expect(runner.runNode('developer', context('developer'))).rejects.toThrow(
        /Codex 渠道已禁用/,
      )
      expect(executor.calls).toHaveLength(0)
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
    }
  })

  test('Codex SDK runner 明确拒绝已禁用的 OpenAI 兼容渠道', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    process.env.RV_INSIGHTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'rv-codex-disabled-channel-'))
    try {
      const channel = createChannel({
        name: '禁用 OpenAI 渠道',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai-test',
        enabled: false,
        models: [{ id: 'gpt-5.4', name: 'GPT-5.4', enabled: true }],
      })
      const createCodexClient: CreateCodexSdkClient = () => {
        throw new Error('不应创建 Codex client')
      }
      const runner = new CodexSdkPipelineNodeRunner({
        channelId: channel.id,
        createCodexClient,
        codexPath: '/mock/codex',
      })

      await expect(runner.runNode('developer', context('developer'))).rejects.toThrow(
        /Codex 渠道已禁用/,
      )
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
    }
  })
})

class FakePipelineRunner implements PipelineNodeRunner {
  readonly nodes: PipelineNodeKind[] = []

  constructor(private readonly summary: string) {}

  async runNode(
    node: PipelineNodeKind,
    _context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult> {
    this.nodes.push(node)
    return {
      output: this.summary,
      summary: this.summary,
      approved: true,
    }
  }
}

describe('pipeline-node-router', () => {
  test('developer/reviewer 走 Codex，其余节点保留 Claude', async () => {
    const claudeRunner = new FakePipelineRunner('claude')
    const codexRunner = new FakePipelineRunner('codex')
    const runner = new RoutedPipelineNodeRunner({
      claudeRunner,
      codexRunner,
    })

    await runner.runNode('explorer', context('explorer'))
    await runner.runNode('planner', context('planner'))
    await runner.runNode('developer', context('developer'))
    await runner.runNode('reviewer', context('reviewer'))
    await runner.runNode('tester', context('tester'))

    expect(claudeRunner.nodes).toEqual(['explorer', 'planner', 'tester'])
    expect(codexRunner.nodes).toEqual(['developer', 'reviewer'])
  })
})

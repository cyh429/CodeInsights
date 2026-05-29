import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  PipelineGateKind,
  PipelineGateRequest,
  PipelineNodeKind,
} from '@codeinsights/shared'
import { createPipelineService } from './pipeline-service'
import { createAgentWorkspace } from './agent-workspace-manager'
import { getAgentSessionWorkspacePath } from './config-paths'
import { getContributionTaskByPipelineSessionId, getContributionTaskEvents } from './contribution-task-service'
import { setupPipelineFixtureRepository } from './pipeline-fixture-runner'
import { readPatchWorkManifest } from './pipeline-patch-work-service'

function runGit(repoRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForGate(
  service: ReturnType<typeof createPipelineService>,
  sessionId: string,
  kind: PipelineGateKind,
  node: PipelineNodeKind,
): Promise<PipelineGateRequest> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const gate = service.getPendingGates().find((item) =>
      item.sessionId === sessionId
      && item.kind === kind
      && item.node === node)
    if (gate) return gate
    await wait(10)
  }
  throw new Error(`未等到 Pipeline gate: ${node}/${kind}`)
}

describe('pipeline deterministic smoke', () => {
  const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
  const originalFixtureRunner = process.env.CODEINSIGHTS_PIPELINE_FIXTURE_RUNNER
  let tempConfigDir = ''

  beforeEach(() => {
    tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-pipeline-smoke-config-'))
    process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
    process.env.CODEINSIGHTS_PIPELINE_FIXTURE_RUNNER = '1'
  })

  afterEach(() => {
    if (originalConfigDir == null) {
      delete process.env.CODEINSIGHTS_CONFIG_DIR
    } else {
      process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
    }
    if (originalFixtureRunner == null) {
      delete process.env.CODEINSIGHTS_PIPELINE_FIXTURE_RUNNER
    } else {
      process.env.CODEINSIGHTS_PIPELINE_FIXTURE_RUNNER = originalFixtureRunner
    }
    rmSync(tempConfigDir, { recursive: true, force: true })
  })

  async function prepareSmokeRun(submissionMode: 'local_patch' | 'local_commit') {
    const workspace = createAgentWorkspace(`Pipeline smoke ${submissionMode}`)
    const service = createPipelineService()
    const session = service.createSession(`Pipeline smoke ${submissionMode}`, 'channel-smoke', workspace.id, 2)
    const repositoryRoot = getAgentSessionWorkspacePath(workspace.slug, session.id)
    setupPipelineFixtureRepository(repositoryRoot)
    const commitCountBefore = Number(runGit(repositoryRoot, ['rev-list', '--count', 'HEAD']))
    const startPromise = service.start({
      sessionId: session.id,
      userInput: '运行 deterministic Pipeline smoke',
      channelId: 'channel-smoke',
      workspaceId: workspace.id,
    })

    const explorerGate = await waitForGate(service, session.id, 'task_selection', 'explorer')
    await service.respondGate({
      gateId: explorerGate.gateId,
      sessionId: session.id,
      kind: 'task_selection',
      action: 'approve',
      selectedReportId: 'report-001',
      createdAt: Date.now(),
    })

    const plannerGate = await waitForGate(service, session.id, 'document_review', 'planner')
    await service.respondGate({
      gateId: plannerGate.gateId,
      sessionId: session.id,
      kind: 'document_review',
      action: 'approve',
      createdAt: Date.now(),
    })

    const developerGate = await waitForGate(service, session.id, 'document_review', 'developer')
    await service.respondGate({
      gateId: developerGate.gateId,
      sessionId: session.id,
      kind: 'document_review',
      action: 'approve',
      createdAt: Date.now(),
    })

    const testerGate = await waitForGate(service, session.id, 'document_review', 'tester')
    await service.respondGate({
      gateId: testerGate.gateId,
      sessionId: session.id,
      kind: 'document_review',
      action: 'approve',
      createdAt: Date.now(),
    })

    const committerGate = await waitForGate(service, session.id, 'submission_review', 'committer')
    await service.respondGate({
      gateId: committerGate.gateId,
      sessionId: session.id,
      kind: 'submission_review',
      action: 'approve',
      submissionMode,
      localCommitOperationId: `op-smoke-${submissionMode}`,
      createdAt: Date.now(),
    })
    await startPromise

    return {
      service,
      session,
      repositoryRoot,
      commitCountBefore,
      task: getContributionTaskByPipelineSessionId(session.id),
    }
  }

  test('draft-only smoke 走完 v2 主路径且不产生 Git commit', async () => {
    const { service, session, repositoryRoot, commitCountBefore, task } = await prepareSmokeRun('local_patch')

    expect(task).toMatchObject({
      status: 'completed',
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      selectedReportId: 'report-001',
    })
    expect(Number(runGit(repositoryRoot, ['rev-list', '--count', 'HEAD']))).toBe(commitCountBefore)
    expect(existsSync(join(repositoryRoot, 'patch-work', 'patch-set', 'changes.patch'))).toBe(true)
    expect(existsSync(join(repositoryRoot, 'patch-work', 'commit.md'))).toBe(true)
    expect(existsSync(join(repositoryRoot, 'patch-work', 'pr.md'))).toBe(true)
    expect(readFileSync(join(repositoryRoot, 'patch-work', 'patch-set', 'changed-files.json'), 'utf-8')).toContain('src/index.ts')
    expect(readPatchWorkManifest(repositoryRoot).files.map((file) => file.relativePath)).toEqual(
      expect.arrayContaining([
        'selected-task.md',
        'plan.md',
        'test-plan.md',
        'dev.md',
        'patch-set/changes.patch',
        'patch-set/changed-files.json',
        'commit.md',
        'pr.md',
      ]),
    )
    await expect(service.getSessionState(session.id)).resolves.toMatchObject({
      status: 'completed',
      lastApprovedNode: 'committer',
      stageOutputs: {
        committer: {
          submissionStatus: 'draft_only',
          localCommit: {
            attempted: false,
            status: 'not_requested',
          },
        },
      },
    })
  }, 20_000)

  test('local commit smoke 只提交候选源码文件并保留 patch-work 未提交', async () => {
    const { service, session, repositoryRoot, commitCountBefore, task } = await prepareSmokeRun('local_commit')

    expect(task).toMatchObject({
      status: 'completed',
      contributionMode: 'local_commit',
    })
    expect(Number(runGit(repositoryRoot, ['rev-list', '--count', 'HEAD']))).toBe(commitCountBefore + 1)
    const committedFiles = runGit(repositoryRoot, ['show', '--name-only', '--pretty=format:', 'HEAD'])
      .split('\n')
      .filter(Boolean)
      .sort()
    expect(committedFiles).toEqual(['src/index.ts'])
    expect(committedFiles.some((file) => file === 'patch-work' || file.startsWith('patch-work/'))).toBe(false)
    expect(runGit(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all'])).toContain('patch-work/')
    expect(getContributionTaskEvents(task!.id).find((event) => event.type === 'local_commit_created')).toMatchObject({
      type: 'local_commit_created',
      payload: {
        operationId: 'op-smoke-local_commit',
        files: ['src/index.ts'],
      },
    })
    await expect(service.getSessionState(session.id)).resolves.toMatchObject({
      status: 'completed',
      stageOutputs: {
        committer: {
          submissionStatus: 'local_commit_created',
          localCommit: {
            attempted: true,
            status: 'created',
            operationId: 'op-smoke-local_commit',
          },
        },
      },
    })
  }, 20_000)

  test('mock remote smoke 必须经过独立远端确认且保持可审计', async () => {
    let remoteCalls = 0
    let remoteTaskId = ''
    const service = createPipelineService({
      createRemoteSubmission: (input) => {
        remoteCalls += 1
        const confirmation = getContributionTaskEvents(remoteTaskId).find((event) =>
          event.type === 'remote_write_confirmed'
          && event.payload?.operationId === input.operationId)
        expect(confirmation?.payload).toMatchObject({
          operationId: input.operationId,
          commitHash: input.commitHash,
          remoteName: 'origin',
          baseBranch: 'main',
          headBranch: 'feature/pipeline-fixture-smoke',
          remoteWriteConfirmed: true,
        })
        return {
          attempted: true,
          operationId: input.operationId,
          status: 'created',
          type: 'pull_request',
          provider: 'github_api',
          commitHash: input.commitHash,
          remoteName: 'origin',
          sanitizedRemoteUrl: 'https://github.com/example/pipeline-fixture.git',
          githubRepo: 'example/pipeline-fixture',
          baseBranch: 'main',
          headBranch: 'feature/pipeline-fixture-smoke',
          prTitle: input.prTitle,
          prBody: input.prBody,
          prUrl: 'https://github.com/example/pipeline-fixture/pull/6',
          prNumber: 6,
          draft: true,
          createdAt: 123456,
        }
      },
    })
    const workspace = createAgentWorkspace('Pipeline smoke remote mocked')
    const session = service.createSession('Pipeline smoke remote mocked', 'channel-smoke', workspace.id, 2)
    const repositoryRoot = getAgentSessionWorkspacePath(workspace.slug, session.id)
    setupPipelineFixtureRepository(repositoryRoot)
    runGit(repositoryRoot, ['checkout', '-b', 'feature/pipeline-fixture-smoke'])
    const commitCountBefore = Number(runGit(repositoryRoot, ['rev-list', '--count', 'HEAD']))
    const startPromise = service.start({
      sessionId: session.id,
      userInput: '运行 deterministic Pipeline remote smoke',
      channelId: 'channel-smoke',
      workspaceId: workspace.id,
    })

    const explorerGate = await waitForGate(service, session.id, 'task_selection', 'explorer')
    await service.respondGate({
      gateId: explorerGate.gateId,
      sessionId: session.id,
      kind: 'task_selection',
      action: 'approve',
      selectedReportId: 'report-001',
      createdAt: Date.now(),
    })

    const plannerGate = await waitForGate(service, session.id, 'document_review', 'planner')
    await service.respondGate({
      gateId: plannerGate.gateId,
      sessionId: session.id,
      kind: 'document_review',
      action: 'approve',
      createdAt: Date.now(),
    })

    const developerGate = await waitForGate(service, session.id, 'document_review', 'developer')
    await service.respondGate({
      gateId: developerGate.gateId,
      sessionId: session.id,
      kind: 'document_review',
      action: 'approve',
      createdAt: Date.now(),
    })

    const testerGate = await waitForGate(service, session.id, 'document_review', 'tester')
    await service.respondGate({
      gateId: testerGate.gateId,
      sessionId: session.id,
      kind: 'document_review',
      action: 'approve',
      createdAt: Date.now(),
    })

    const committerGate = await waitForGate(service, session.id, 'submission_review', 'committer')
    await service.respondGate({
      gateId: committerGate.gateId,
      sessionId: session.id,
      kind: 'submission_review',
      action: 'approve',
      submissionMode: 'remote_pr',
      localCommitOperationId: 'op-smoke-remote-local-commit',
      remoteSubmissionOperationId: 'op-smoke-remote-pr',
      createdAt: Date.now(),
    })

    const remoteGate = await waitForGate(service, session.id, 'remote_write_confirmation', 'committer')
    expect(remoteGate.remoteWritePlan).toMatchObject({
      operationId: 'op-smoke-remote-pr',
      remoteName: 'origin',
      baseBranch: 'main',
      headBranch: 'feature/pipeline-fixture-smoke',
    })
    expect(remoteCalls).toBe(0)
    remoteTaskId = getContributionTaskByPipelineSessionId(session.id)!.id
    await service.respondGate({
      gateId: remoteGate.gateId,
      sessionId: session.id,
      kind: 'remote_write_confirmation',
      action: 'approve',
      submissionMode: 'remote_pr',
      remoteSubmissionOperationId: 'op-smoke-remote-pr',
      remoteWriteConfirmed: true,
      createdAt: Date.now(),
    })
    await startPromise

    const task = getContributionTaskByPipelineSessionId(session.id)
    expect(task).toMatchObject({
      status: 'completed',
      contributionMode: 'remote_pr',
      allowRemoteWrites: true,
    })
    expect(remoteCalls).toBe(1)
    expect(Number(runGit(repositoryRoot, ['rev-list', '--count', 'HEAD']))).toBe(commitCountBefore + 1)
    expect(runGit(repositoryRoot, ['show', '--name-only', '--pretty=format:', 'HEAD'])
      .split('\n')
      .filter(Boolean)).toEqual(['src/index.ts'])
    expect(getContributionTaskEvents(task!.id).filter((event) => event.type === 'remote_write_confirmed'))
      .toHaveLength(1)
    expect(getContributionTaskEvents(task!.id).filter((event) => event.type === 'remote_submission_created'))
      .toHaveLength(1)
    await expect(service.getSessionState(session.id)).resolves.toMatchObject({
      status: 'completed',
      stageOutputs: {
        committer: {
          submissionStatus: 'remote_pr_created',
          remoteSubmission: {
            attempted: true,
            status: 'created',
            operationId: 'op-smoke-remote-pr',
            prUrl: 'https://github.com/example/pipeline-fixture/pull/6',
          },
        },
      },
    })
  }, 20_000)
})

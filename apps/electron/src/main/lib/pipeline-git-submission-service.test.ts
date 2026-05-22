import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildPipelinePatchSetDraft,
  createLocalPipelineCommit,
  createRemotePipelineSubmission,
  PipelineRemoteSubmissionError,
  readPipelineSubmissionDraftContext,
  redactSecretText,
  sanitizeRemoteUrl,
  validateCommitPreconditions,
  validateRemoteSubmissionPreconditions,
} from './pipeline-git-submission-service'

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function setupGitRepo(repoRoot: string): void {
  git(repoRoot, ['init'])
  git(repoRoot, ['config', 'user.name', 'CodeInsights Test'])
  git(repoRoot, ['config', 'user.email', 'codeinsights-test@example.com'])
  mkdirSync(join(repoRoot, 'src'), { recursive: true })
  writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 1\n', 'utf-8')
  git(repoRoot, ['add', 'src/index.ts'])
  git(repoRoot, ['commit', '-m', 'initial'])
}

function markRemoteBase(repoRoot: string, remoteName = 'origin', baseBranch = 'main'): void {
  git(repoRoot, ['update-ref', `refs/remotes/${remoteName}/${baseBranch}`, 'HEAD'])
}

describe('pipeline-git-submission-service', () => {
  let repoRoot = ''

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-patch-set-repo-'))
    setupGitRepo(repoRoot)
  })

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test('生成 patch-set 草稿时默认排除 patch-work/** 且不创建本地 commit', () => {
    writeFileSync(join(repoRoot, 'src', 'index.ts'), [
      'export const value = 2',
      'export const label = "patch-work/** 只是正文字符串"',
      '',
    ].join('\n'), 'utf-8')
    writeFileSync(join(repoRoot, 'src', 'new-file.ts'), 'export const added = true\n', 'utf-8')
    git(repoRoot, ['add', 'src/index.ts'])
    mkdirSync(join(repoRoot, 'patch-work', 'patch-set'), { recursive: true })
    writeFileSync(join(repoRoot, 'patch-work', 'result.md'), '# 测试报告\n', 'utf-8')
    writeFileSync(join(repoRoot, 'patch-work', 'patch-set', 'changes.patch'), '不应进入 patch-set\n', 'utf-8')
    const commitCountBefore = git(repoRoot, ['rev-list', '--count', 'HEAD'])

    const draft = buildPipelinePatchSetDraft({
      repositoryRoot: repoRoot,
      testEvidence: [
        {
          command: 'bun test apps/electron/src/main/lib/pipeline-git-submission-service.test.ts',
          status: 'passed',
          durationMs: 12,
          summary: '通过',
        },
      ],
    })

    expect(draft.excludesPatchWork).toBe(true)
    expect(draft.patch).toContain('diff --git a/src/index.ts b/src/index.ts')
    expect(draft.patch).toContain('diff --git a/src/new-file.ts b/src/new-file.ts')
    expect(draft.patch).toContain('patch-work/** 只是正文字符串')
    expect(draft.patch).not.toContain('patch-work/result.md')
    expect(draft.patch).not.toContain('patch-work/patch-set/changes.patch')
    expect(draft.changedFiles.map((file) => file.path).sort()).toEqual([
      'src/index.ts',
      'src/new-file.ts',
    ])
    expect(draft.changedFiles.find((file) => file.path === 'src/index.ts')).toMatchObject({
      changeType: 'modified',
    })
    expect(draft.changedFiles.find((file) => file.path === 'src/new-file.ts')).toMatchObject({
      changeType: 'added',
    })
    expect(draft.diffSummaryMarkdown).toContain('src/index.ts')
    expect(draft.diffSummaryMarkdown).toContain('patch-work/** 已从 patch-set 中排除')
    expect(draft.diffSummaryMarkdown).not.toContain('patch-work/result.md')
    expect(draft.testEvidence).toEqual([
      expect.objectContaining({
        command: 'bun test apps/electron/src/main/lib/pipeline-git-submission-service.test.ts',
        status: 'passed',
      }),
    ])
    expect(git(repoRoot, ['rev-list', '--count', 'HEAD'])).toBe(commitCountBefore)
  })

  test('非 Git 仓库不能生成 patch-set 草稿', () => {
    const notRepo = mkdtempSync(join(tmpdir(), 'codeinsights-not-git-'))
    try {
      expect(() => buildPipelinePatchSetDraft({
        repositoryRoot: notRepo,
        testEvidence: [],
      })).toThrow('不是 Git 仓库')
    } finally {
      rmSync(notRepo, { recursive: true, force: true })
    }
  })

  test('patch-set 草稿不读取 patch-work 内部历史补丁', () => {
    mkdirSync(join(repoRoot, 'patch-work', 'patch-set'), { recursive: true })
    writeFileSync(join(repoRoot, 'patch-work', 'patch-set', 'changes.patch'), [
      'diff --git a/secret.ts b/secret.ts',
      '+SECRET',
    ].join('\n'), 'utf-8')

    const draft = buildPipelinePatchSetDraft({
      repositoryRoot: repoRoot,
      testEvidence: [],
    })

    expect(draft.patch).not.toContain('SECRET')
    expect(readFileSync(join(repoRoot, 'patch-work', 'patch-set', 'changes.patch'), 'utf-8')).toContain('SECRET')
  })

  test('读取 committer draft-only 上下文时包含 Git 状态和 CONTRIBUTING 且不执行提交', () => {
    writeFileSync(join(repoRoot, 'CONTRIBUTING.md'), [
      '# Contributing',
      '',
      '- Commit message 使用 Conventional Commits。',
      '- PR 需要列出测试证据。',
      '',
    ].join('\n'), 'utf-8')
    git(repoRoot, ['add', 'CONTRIBUTING.md'])
    git(repoRoot, ['commit', '-m', 'docs: add contributing'])
    writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 2\n', 'utf-8')
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    writeFileSync(join(repoRoot, 'patch-work', 'commit.md'), '# 不应进入提交候选\n', 'utf-8')
    const commitCountBefore = git(repoRoot, ['rev-list', '--count', 'HEAD'])

    const context = readPipelineSubmissionDraftContext({
      repositoryRoot: repoRoot,
    })

    expect(context.workingBranch).toBeDefined()
    expect(context.headCommit).toBe(git(repoRoot, ['rev-parse', 'HEAD']))
    expect(context.changedFiles.map((file) => file.path)).toEqual(['src/index.ts'])
    expect(context.statusPorcelain).toContain('src/index.ts')
    expect(context.statusPorcelain).not.toContain('patch-work/commit.md')
    expect(context.contributingGuidelines).toContain('Conventional Commits')
    expect(context.contributingGuidelinesPath).toBe('CONTRIBUTING.md')
    expect(context.diffSummaryMarkdown).toContain('patch-work/** 已从提交候选中排除')
    expect(git(repoRoot, ['rev-list', '--count', 'HEAD'])).toBe(commitCountBefore)
  })

  test('读取 CONTRIBUTING 时拒绝指向仓库外的 symlink', () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'codeinsights-contributing-secret-'))
    try {
      const outsideSecret = join(outsideDir, 'CONTRIBUTING.md')
      writeFileSync(outsideSecret, '# Secret\n\nLOCAL_SECRET_TOKEN=should-not-leak\n', 'utf-8')
      symlinkSync(outsideSecret, join(repoRoot, 'CONTRIBUTING.md'))
      mkdirSync(join(repoRoot, 'docs'), { recursive: true })
      writeFileSync(join(repoRoot, 'docs', 'CONTRIBUTING.md'), '# Safe Contributing\n\n使用 Conventional Commits。\n', 'utf-8')

      const context = readPipelineSubmissionDraftContext({
        repositoryRoot: repoRoot,
      })

      expect(context.contributingGuidelines).toContain('Conventional Commits')
      expect(context.contributingGuidelines).not.toContain('LOCAL_SECRET_TOKEN')
      expect(context.contributingGuidelinesPath).toBe('docs/CONTRIBUTING.md')
    } finally {
      rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  test('本地 commit gate 计划默认排除 patch-work/** 且不执行提交', () => {
    writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 7\n', 'utf-8')
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    writeFileSync(join(repoRoot, 'patch-work', 'commit.md'), '# Commit 准备\n', 'utf-8')
    const commitCountBefore = git(repoRoot, ['rev-list', '--count', 'HEAD'])

    const plan = validateCommitPreconditions({
      repositoryRoot: repoRoot,
      commitMessage: 'feat(pipeline): add local commit gate',
      operationId: 'op-local-commit-plan',
    })

    expect(plan.canCommit).toBe(true)
    expect(plan.blockers).toEqual([])
    expect(plan.changedFiles.map((file) => file.path)).toEqual(['src/index.ts'])
    expect(plan.excludedFiles).toEqual(['patch-work/commit.md'])
    expect(plan.commitMessage).toBe('feat(pipeline): add local commit gate')
    expect(plan.operationId).toBe('op-local-commit-plan')
    expect(git(repoRoot, ['rev-list', '--count', 'HEAD'])).toBe(commitCountBefore)
  })

  test('用户未明确确认 local_commit 时不会创建本地 commit', () => {
    writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 8\n', 'utf-8')
    const commitCountBefore = git(repoRoot, ['rev-list', '--count', 'HEAD'])

    expect(() => createLocalPipelineCommit({
      repositoryRoot: repoRoot,
      commitMessage: 'feat(pipeline): add guarded local commit',
      operationId: 'op-local-commit-denied',
      confirmed: false,
    })).toThrow('用户未确认本地 commit')

    expect(git(repoRoot, ['rev-list', '--count', 'HEAD'])).toBe(commitCountBefore)
  })

  test('用户确认后只 stage 非 patch-work 候选并创建本地 commit', () => {
    writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 9\n', 'utf-8')
    writeFileSync(join(repoRoot, 'src', 'local-commit.ts'), 'export const localCommit = true\n', 'utf-8')
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    writeFileSync(join(repoRoot, 'patch-work', 'commit.md'), '# Commit 准备\n', 'utf-8')
    const commitCountBefore = Number(git(repoRoot, ['rev-list', '--count', 'HEAD']))

    const result = createLocalPipelineCommit({
      repositoryRoot: repoRoot,
      commitMessage: 'feat(pipeline): add guarded local commit',
      operationId: 'op-local-commit-created',
      confirmed: true,
    })

    expect(result.status).toBe('created')
    expect(result.operationId).toBe('op-local-commit-created')
    expect(result.commitHash).toBe(git(repoRoot, ['rev-parse', 'HEAD']))
    expect(result.files.map((file) => file.path).sort()).toEqual([
      'src/index.ts',
      'src/local-commit.ts',
    ])
    expect(result.excludedFiles).toEqual(['patch-work/commit.md'])
    expect(Number(git(repoRoot, ['rev-list', '--count', 'HEAD']))).toBe(commitCountBefore + 1)
    const committedFiles = git(repoRoot, ['show', '--name-only', '--pretty=format:', 'HEAD'])
      .split('\n')
      .filter(Boolean)
      .sort()
    expect(committedFiles).toEqual([
      'src/index.ts',
      'src/local-commit.ts',
    ])
    expect(git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all'])).toContain('patch-work/commit.md')
  })

  test('远端写 preflight 会脱敏 remote URL 且未授权时阻止提交', () => {
    git(repoRoot, ['remote', 'add', 'origin', 'https://token:secret@github.com/example/repo.git'])

    const plan = validateRemoteSubmissionPreconditions({
      repositoryRoot: repoRoot,
      operationId: 'op-remote-preflight',
      commitHash: git(repoRoot, ['rev-parse', 'HEAD']),
      prTitle: 'Add remote submission',
      prBody: '## Summary\n- Test remote submission',
      allowRemoteWrites: false,
      remoteName: 'origin',
      headBranch: 'feature/remote-submit',
      baseBranch: 'main',
      draft: true,
    })

    expect(plan.canSubmit).toBe(false)
    expect(plan.blockers).toContain('用户未允许远端写能力')
    expect(plan.sanitizedRemoteUrl).toBe('https://github.com/example/repo.git')
    expect(sanitizeRemoteUrl('https://user:token@github.com/example/repo.git')).toBe('https://github.com/example/repo.git')
  })

  test('远端写 preflight 会拒绝不安全的 remote 与 branch 名称', () => {
    git(repoRoot, ['remote', 'add', 'origin', 'https://github.com/example/repo.git'])

    const plan = validateRemoteSubmissionPreconditions({
      repositoryRoot: repoRoot,
      operationId: 'op-remote-unsafe-ref',
      commitHash: git(repoRoot, ['rev-parse', 'HEAD']),
      prTitle: 'Add remote submission',
      prBody: '## Summary\n- Test remote submission',
      allowRemoteWrites: true,
      remoteName: '--upload-pack=/tmp/evil',
      headBranch: 'feature/safe:main',
      baseBranch: 'main',
      draft: true,
    })

    expect(plan.canSubmit).toBe(false)
    expect(plan.blockers).toContain('remote 名称包含不安全字符')
    expect(plan.blockers).toContain('head branch 包含不安全字符')
  })

  test('远端写 preflight 拒绝把 base/default 分支作为 head branch', () => {
    git(repoRoot, ['remote', 'add', 'origin', 'https://github.com/example/repo.git'])
    markRemoteBase(repoRoot)

    const plan = validateRemoteSubmissionPreconditions({
      repositoryRoot: repoRoot,
      operationId: 'op-remote-default-branch',
      commitHash: git(repoRoot, ['rev-parse', 'HEAD']),
      prTitle: 'Add remote submission',
      prBody: '## Summary\n- Test remote submission',
      allowRemoteWrites: true,
      remoteName: 'origin',
      headBranch: 'main',
      baseBranch: 'main',
      draft: true,
    })

    expect(plan.canSubmit).toBe(false)
    expect(plan.blockers).toContain('远端 head branch 不能是 base/default 分支')
  })

  test('远端写 preflight 拒绝待推送 commit tree 中的 patch-work/**', () => {
    git(repoRoot, ['remote', 'add', 'origin', 'https://github.com/example/repo.git'])
    markRemoteBase(repoRoot)
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    writeFileSync(join(repoRoot, 'patch-work', 'secret.md'), 'LOCAL_SECRET_TOKEN=should-not-push\n', 'utf-8')
    git(repoRoot, ['add', 'patch-work/secret.md'])
    git(repoRoot, ['commit', '-m', 'test: accidentally commit patch work'])

    const plan = validateRemoteSubmissionPreconditions({
      repositoryRoot: repoRoot,
      operationId: 'op-remote-patch-work-tree',
      commitHash: git(repoRoot, ['rev-parse', 'HEAD']),
      prTitle: 'Add remote submission',
      prBody: '## Summary\n- Test remote submission',
      allowRemoteWrites: true,
      remoteName: 'origin',
      headBranch: 'feature/remote-submit',
      baseBranch: 'main',
      draft: true,
    })

    expect(plan.canSubmit).toBe(false)
    expect(plan.blockers.join('\n')).toContain('patch-work/** 已存在于待推送 commit tree')
  })

  test('远端写 preflight 拒绝 push range 历史中曾包含 patch-work/**', () => {
    git(repoRoot, ['remote', 'add', 'origin', 'https://github.com/example/repo.git'])
    markRemoteBase(repoRoot)
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    writeFileSync(join(repoRoot, 'patch-work', 'transient.md'), '不应出现在远端历史\n', 'utf-8')
    git(repoRoot, ['add', 'patch-work/transient.md'])
    git(repoRoot, ['commit', '-m', 'test: add transient patch work'])
    rmSync(join(repoRoot, 'patch-work'), { recursive: true, force: true })
    git(repoRoot, ['add', '-A'])
    git(repoRoot, ['commit', '-m', 'test: remove transient patch work'])

    const plan = validateRemoteSubmissionPreconditions({
      repositoryRoot: repoRoot,
      operationId: 'op-remote-patch-work-range',
      commitHash: git(repoRoot, ['rev-parse', 'HEAD']),
      prTitle: 'Add remote submission',
      prBody: '## Summary\n- Test remote submission',
      allowRemoteWrites: true,
      remoteName: 'origin',
      headBranch: 'feature/remote-submit',
      baseBranch: 'main',
      draft: true,
    })

    expect(plan.canSubmit).toBe(false)
    expect(plan.blockers.join('\n')).toContain('patch-work/** 曾出现在待推送历史')
  })

  test('用户未二次确认 remote_pr 时不会执行 push 或创建 PR', () => {
    git(repoRoot, ['remote', 'add', 'origin', 'https://github.com/example/repo.git'])
    const calls: string[] = []

    expect(() => createRemotePipelineSubmission({
      repositoryRoot: repoRoot,
      operationId: 'op-remote-denied',
      commitHash: git(repoRoot, ['rev-parse', 'HEAD']),
      prTitle: 'Add remote submission',
      prBody: '## Summary\n- Test remote submission',
      allowRemoteWrites: true,
      confirmed: false,
      remoteName: 'origin',
      headBranch: 'feature/remote-submit',
      baseBranch: 'main',
      draft: true,
      commandRunner: (command, args) => {
        calls.push([command, ...args].join(' '))
        return ''
      },
    })).toThrow('用户未确认远端写')

    expect(calls).toEqual([])
  })

  test('用户二次确认后以 mock runner 执行 push 并创建 draft PR', () => {
    git(repoRoot, ['remote', 'add', 'origin', 'https://github.com/example/repo.git'])
    markRemoteBase(repoRoot)
    const commitHash = git(repoRoot, ['rev-parse', 'HEAD'])
    const calls: string[] = []

    const result = createRemotePipelineSubmission({
      repositoryRoot: repoRoot,
      operationId: 'op-remote-created',
      commitHash,
      prTitle: 'Add remote submission',
      prBody: '## Summary\n- Test remote submission',
      allowRemoteWrites: true,
      confirmed: true,
      remoteName: 'origin',
      headBranch: 'feature/remote-submit',
      baseBranch: 'main',
      draft: true,
      commandRunner: (command, args) => {
        calls.push([command, ...args].join(' '))
        if (command === 'git' && args[0] === 'ls-remote') return `${commitHash}\trefs/heads/main\n`
        if (command === 'gh' && args[0] === 'auth') return 'Logged in\n'
        if (command === 'git' && args[0] === 'push') return ''
        if (command === 'gh' && args[0] === 'pr') return 'https://github.com/example/repo/pull/42\n'
        return ''
      },
    })

    expect(result.status).toBe('created')
    expect(result.operationId).toBe('op-remote-created')
    expect(result.commitHash).toBe(commitHash)
    expect(result.sanitizedRemoteUrl).toBe('https://github.com/example/repo.git')
    expect(result.prUrl).toBe('https://github.com/example/repo/pull/42')
    expect(result.draft).toBe(true)
    expect(calls).toEqual([
      'git ls-remote --exit-code --heads origin refs/heads/main',
      'gh auth status',
      `git push origin ${commitHash}:refs/heads/feature/remote-submit`,
      'gh pr create --repo example/repo --title Add remote submission --body ## Summary\n- Test remote submission --base main --head feature/remote-submit --draft',
    ])
  })

  test('远端写使用 push URL 脱敏展示并显式传递 gh --repo', () => {
    git(repoRoot, ['remote', 'add', 'origin', 'https://github.com/fetch/repo.git'])
    git(repoRoot, [
      'config',
      'remote.origin.pushurl',
      'https://token:secret@github.com/push/repo.git',
    ])
    markRemoteBase(repoRoot)
    const commitHash = git(repoRoot, ['rev-parse', 'HEAD'])
    const calls: string[] = []

    const result = createRemotePipelineSubmission({
      repositoryRoot: repoRoot,
      operationId: 'op-remote-push-url',
      commitHash,
      prTitle: 'Add remote submission',
      prBody: '## Summary\n- Test remote submission',
      allowRemoteWrites: true,
      confirmed: true,
      remoteName: 'origin',
      headBranch: 'feature/remote-submit',
      baseBranch: 'main',
      draft: true,
      commandRunner: (command, args) => {
        calls.push([command, ...args].join(' '))
        if (command === 'git' && args[0] === 'ls-remote') return `${commitHash}\trefs/heads/main\n`
        if (command === 'gh' && args[0] === 'auth') return 'Logged in\n'
        if (command === 'git' && args[0] === 'push') return ''
        if (command === 'gh' && args[0] === 'pr') return 'https://github.com/push/repo/pull/7\n'
        return ''
      },
    })

    expect(result.sanitizedRemoteUrl).toBe('https://github.com/push/repo.git')
    expect(result.githubRepo).toBe('push/repo')
    expect(calls).toContain(
      'gh pr create --repo push/repo --title Add remote submission --body ## Summary\n- Test remote submission --base main --head feature/remote-submit --draft',
    )
  })

  test('远端命令错误进入上层前会脱敏 credential 与 token', () => {
    git(repoRoot, ['remote', 'add', 'origin', 'https://github.com/example/repo.git'])
    markRemoteBase(repoRoot)
    const commitHash = git(repoRoot, ['rev-parse', 'HEAD'])
    const secretMessage = [
      'fatal: https://user:secret@github.com/example/repo.git failed',
      'Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz',
      'GITHUB_TOKEN=github_pat_abcdefghijklmnopqrstuvwxyz',
    ].join('\n')

    expect(() => createRemotePipelineSubmission({
      repositoryRoot: repoRoot,
      operationId: 'op-remote-secret-error',
      commitHash,
      prTitle: 'Add remote submission',
      prBody: '## Summary\n- Test remote submission',
      allowRemoteWrites: true,
      confirmed: true,
      remoteName: 'origin',
      headBranch: 'feature/remote-submit',
      baseBranch: 'main',
      draft: true,
      commandRunner: (command, args) => {
        if (command === 'git' && args[0] === 'ls-remote') return `${commitHash}\trefs/heads/main\n`
        if (command === 'gh' && args[0] === 'auth') return 'Logged in\n'
        if (command === 'git' && args[0] === 'push') throw new Error(secretMessage)
        return ''
      },
    })).toThrow('[REDACTED]')

    const redacted = redactSecretText(secretMessage)
    expect(redacted).not.toContain('secret')
    expect(redacted).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz')
    expect(redacted).not.toContain('github_pat_abcdefghijklmnopqrstuvwxyz')
    expect(redacted).toContain('https://github.com/example/repo.git')
  })

  test('PR 已存在时会从 gh pr view 恢复为成功结果', () => {
    git(repoRoot, ['remote', 'add', 'origin', 'https://github.com/example/repo.git'])
    markRemoteBase(repoRoot)
    const commitHash = git(repoRoot, ['rev-parse', 'HEAD'])
    const calls: string[] = []

    const result = createRemotePipelineSubmission({
      repositoryRoot: repoRoot,
      operationId: 'op-remote-pr-exists',
      commitHash,
      prTitle: 'Add remote submission',
      prBody: '## Summary\n- Test remote submission',
      allowRemoteWrites: true,
      confirmed: true,
      remoteName: 'origin',
      headBranch: 'feature/remote-submit',
      baseBranch: 'main',
      draft: true,
      commandRunner: (command, args) => {
        calls.push([command, ...args].join(' '))
        if (command === 'git' && args[0] === 'ls-remote') return `${commitHash}\trefs/heads/main\n`
        if (command === 'gh' && args[0] === 'auth') return 'Logged in\n'
        if (command === 'git' && args[0] === 'push') return ''
        if (command === 'gh' && args[0] === 'pr' && args[1] === 'create') {
          throw new Error('a pull request for branch feature/remote-submit already exists')
        }
        if (command === 'gh' && args[0] === 'pr' && args[1] === 'view') {
          return 'https://github.com/example/repo/pull/42\n'
        }
        return ''
      },
    })

    expect(result.status).toBe('created')
    expect(result.prUrl).toBe('https://github.com/example/repo/pull/42')
    expect(calls).toContain(
      'gh pr view --repo example/repo --head feature/remote-submit --json url,number --jq .url',
    )
  })

  test('push 成功但 PR 创建失败时返回可持久化的 pushed 状态', () => {
    git(repoRoot, ['remote', 'add', 'origin', 'https://github.com/example/repo.git'])
    markRemoteBase(repoRoot)
    const commitHash = git(repoRoot, ['rev-parse', 'HEAD'])

    try {
      createRemotePipelineSubmission({
        repositoryRoot: repoRoot,
        operationId: 'op-remote-pr-failed',
        commitHash,
        prTitle: 'Add remote submission',
        prBody: '## Summary\n- Test remote submission',
        allowRemoteWrites: true,
        confirmed: true,
        remoteName: 'origin',
        headBranch: 'feature/remote-submit',
        baseBranch: 'main',
        draft: true,
        commandRunner: (command, args) => {
          if (command === 'git' && args[0] === 'ls-remote') return `${commitHash}\trefs/heads/main\n`
          if (command === 'gh' && args[0] === 'auth') return 'Logged in\n'
          if (command === 'git' && args[0] === 'push') return ''
          if (command === 'gh' && args[0] === 'pr') {
            throw new Error('gh pr create failed for https://user:secret@github.com/example/repo.git')
          }
          return ''
        },
      })
      throw new Error('应抛出 PipelineRemoteSubmissionError')
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineRemoteSubmissionError)
      const submissionError = error as PipelineRemoteSubmissionError
      expect(submissionError.remoteSubmission).toMatchObject({
        operationId: 'op-remote-pr-failed',
        status: 'pushed',
        commitHash,
        pushedRef: 'refs/heads/feature/remote-submit',
      })
      expect(submissionError.remoteSubmission?.error).not.toContain('secret')
    }
  })

  test('本地 commit 使用 literal pathspec，文件名不能扩大 stage 范围', () => {
    writeFileSync(join(repoRoot, ':(glob)**'), 'literal pathspec file\n', 'utf-8')
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    writeFileSync(join(repoRoot, 'patch-work', 'commit.md'), '# Commit 准备\n', 'utf-8')

    const result = createLocalPipelineCommit({
      repositoryRoot: repoRoot,
      commitMessage: 'feat(pipeline): keep pathspec literal',
      operationId: 'op-local-commit-literal-pathspec',
      confirmed: true,
    })

    expect(result.files.map((file) => file.path)).toEqual([':(glob)**'])
    expect(git(repoRoot, ['show', '--name-only', '--pretty=format:', 'HEAD'])
      .split('\n')
      .filter(Boolean)).toEqual([':(glob)**'])
    expect(git(repoRoot, ['diff', '--cached', '--name-only', '--', 'patch-work', 'patch-work/**'])).toBe('')
    expect(git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all'])).toContain('patch-work/commit.md')
  })

  test('已 staged 的 patch-work 文件会阻止本地 commit', () => {
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    writeFileSync(join(repoRoot, 'patch-work', 'commit.md'), '# Commit 准备\n', 'utf-8')
    git(repoRoot, ['add', 'patch-work/commit.md'])
    writeFileSync(join(repoRoot, 'src', 'index.ts'), 'export const value = 10\n', 'utf-8')

    const plan = validateCommitPreconditions({
      repositoryRoot: repoRoot,
      commitMessage: 'feat(pipeline): refuse patch-work commit',
      operationId: 'op-local-commit-blocked',
    })

    expect(plan.canCommit).toBe(false)
    expect(plan.blockers.join('\n')).toContain('patch-work')
    expect(() => createLocalPipelineCommit({
      repositoryRoot: repoRoot,
      commitMessage: 'feat(pipeline): refuse patch-work commit',
      operationId: 'op-local-commit-blocked',
      confirmed: true,
    })).toThrow('patch-work')
  })
})

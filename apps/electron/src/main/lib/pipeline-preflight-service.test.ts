import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { runPipelinePreflight } from './pipeline-preflight-service'

function runGit(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  }).trim()
}

function initRepo(repoRoot: string): void {
  runGit(repoRoot, ['init'])
  runGit(repoRoot, ['checkout', '-b', 'main'])
  writeFileSync(join(repoRoot, 'package.json'), '{"scripts":{"test":"bun test"}}\n', 'utf-8')
  writeFileSync(join(repoRoot, 'bun.lock'), '# lock\n', 'utf-8')
  runGit(repoRoot, ['add', '.'])
  runGit(repoRoot, ['-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-m', 'init'])
}

function createFakeCli(root: string, name: string): string {
  const cliPath = join(root, name)
  writeFileSync(cliPath, '#!/bin/sh\necho "1.0.0"\n', 'utf-8')
  chmodSync(cliPath, 0o755)
  return cliPath
}

describe('pipeline-preflight-service', () => {
  let tempRoot = ''
  let extraDirs: string[] = []

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'codeinsights-preflight-'))
    extraDirs = []
  })

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true })
    for (const dir of extraDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('非 Git root 返回 blocker', async () => {
    const result = await runPipelinePreflight({
      repositoryRoot: tempRoot,
    }, {
      resolveClaudeCliPath: () => join(tempRoot, 'missing-claude'),
      resolveCodexCliPath: () => join(tempRoot, 'missing-codex'),
    })

    expect(result.ok).toBe(false)
    expect(result.repository.root).toBe(tempRoot)
    expect(result.blockers.map((item) => item.code)).toContain('repository_not_git_root')
  })

  test('干净 Git 仓库返回仓库信息、runtime 和包管理器', async () => {
    initRepo(tempRoot)
    const cliRoot = mkdtempSync(join(tmpdir(), 'codeinsights-preflight-cli-'))
    extraDirs.push(cliRoot)
    const claudePath = createFakeCli(cliRoot, 'claude')
    const codexPath = createFakeCli(cliRoot, 'codex')

    const result = await runPipelinePreflight({
      repositoryRoot: tempRoot,
    }, {
      resolveClaudeCliPath: () => claudePath,
      resolveCodexCliPath: () => codexPath,
    })

    expect(result.ok).toBe(true)
    expect(result.repository).toMatchObject({
      root: tempRoot,
      currentBranch: 'main',
      hasUncommittedChanges: false,
      hasConflicts: false,
    })
    expect(result.packageManager).toBe('bun')
    expect(result.runtimes.find((runtime) => runtime.kind === 'claude-cli')?.available).toBe(true)
    expect(result.runtimes.find((runtime) => runtime.kind === 'codex-cli')?.available).toBe(true)
    expect(result.runtimes.find((runtime) => runtime.kind === 'git')?.available).toBe(true)
    expect(result.warnings.map((item) => item.code)).toContain('git_remote_missing')
  })

  test('CLI 缺失时返回稳定 blocker code', async () => {
    initRepo(tempRoot)

    const result = await runPipelinePreflight({
      repositoryRoot: tempRoot,
    }, {
      resolveClaudeCliPath: () => join(tempRoot, 'missing-claude'),
      resolveCodexCliPath: () => join(tempRoot, 'missing-codex'),
    })

    expect(result.ok).toBe(false)
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining(['claude_cli_missing', 'codex_cli_missing']),
    )
  })

  test('CLI resolver 抛错时返回 blocker 而不是中断 preflight', async () => {
    initRepo(tempRoot)
    const cliRoot = mkdtempSync(join(tmpdir(), 'codeinsights-preflight-cli-'))
    extraDirs.push(cliRoot)
    const claudePath = createFakeCli(cliRoot, 'claude')

    const result = await runPipelinePreflight({
      repositoryRoot: tempRoot,
    }, {
      resolveClaudeCliPath: () => claudePath,
      resolveCodexCliPath: () => {
        throw new Error('resolver boom')
      },
    })

    expect(result.ok).toBe(false)
    expect(result.blockers.map((item) => item.code)).toContain('codex_cli_missing')
    expect(result.runtimes.find((runtime) => runtime.kind === 'codex-cli')).toMatchObject({
      available: false,
      error: 'resolver boom',
    })
  })

  test('仓库存在冲突时返回 blocker', async () => {
    initRepo(tempRoot)
    const cliRoot = mkdtempSync(join(tmpdir(), 'codeinsights-preflight-cli-'))
    extraDirs.push(cliRoot)
    const claudePath = createFakeCli(cliRoot, 'claude')
    const codexPath = createFakeCli(cliRoot, 'codex')

    writeFileSync(join(tempRoot, 'conflict.txt'), 'base\n', 'utf-8')
    runGit(tempRoot, ['add', 'conflict.txt'])
    runGit(tempRoot, ['-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-m', 'base'])
    runGit(tempRoot, ['checkout', '-b', 'feature'])
    writeFileSync(join(tempRoot, 'conflict.txt'), 'feature\n', 'utf-8')
    runGit(tempRoot, ['add', 'conflict.txt'])
    runGit(tempRoot, ['-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-m', 'feature'])
    runGit(tempRoot, ['checkout', 'main'])
    writeFileSync(join(tempRoot, 'conflict.txt'), 'main\n', 'utf-8')
    runGit(tempRoot, ['add', 'conflict.txt'])
    runGit(tempRoot, ['-c', 'user.email=test@example.com', '-c', 'user.name=Test', 'commit', '-m', 'main'])

    try {
      runGit(tempRoot, ['merge', 'feature'])
    } catch {
      // 预期产生冲突
    }

    const result = await runPipelinePreflight({
      repositoryRoot: tempRoot,
    }, {
      resolveClaudeCliPath: () => claudePath,
      resolveCodexCliPath: () => codexPath,
    })

    expect(result.ok).toBe(false)
    expect(result.repository.hasConflicts).toBe(true)
    expect(result.blockers.map((item) => item.code)).toContain('git_conflicts')
  })
})

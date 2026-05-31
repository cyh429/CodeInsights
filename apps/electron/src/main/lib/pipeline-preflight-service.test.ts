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

function createFailingCli(root: string, name: string, stderr: string): string {
  const cliPath = join(root, name)
  writeFileSync(cliPath, `#!/bin/sh\necho "${stderr}" >&2\nexit 1\n`, 'utf-8')
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

  test('仓库目录不存在时返回 repository_missing blocker 和稳定 fingerprint', async () => {
    const missingRoot = join(tempRoot, 'missing-repo')

    const result = await runPipelinePreflight({
      repositoryRoot: missingRoot,
      requireClaudeCli: false,
      requireCodexCli: false,
    })

    expect(result.ok).toBe(false)
    expect(result.repository.root).toBe(missingRoot)
    expect(result.blockers.map((item) => item.code)).toContain('repository_missing')
    expect(result.checkedAt).toBeGreaterThan(0)
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/)
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

  test('工作区未提交变更返回 warning，且远端 URL 会脱敏', async () => {
    initRepo(tempRoot)
    runGit(tempRoot, ['remote', 'add', 'origin', 'https://token-123@example.com/org/repo.git'])
    writeFileSync(join(tempRoot, 'src.ts'), 'export const dirty = true\n', 'utf-8')
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
    expect(result.repository.hasUncommittedChanges).toBe(true)
    expect(result.repository.remoteUrl).toBe('https://***@example.com/org/repo.git')
    expect(JSON.stringify(result)).not.toContain('token-123')
    expect(result.warnings.map((item) => item.code)).toContain('git_uncommitted_changes')
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  test('远端 URL query/hash 和 runtime diagnostic 中的凭据会脱敏', async () => {
    initRepo(tempRoot)
    runGit(tempRoot, [
      'remote',
      'add',
      'origin',
      'https://github.com/org/repo.git?access_token=secret-token&plain=ok#secret-fragment',
    ])
    const cliRoot = mkdtempSync(join(tmpdir(), 'codeinsights-preflight-cli-'))
    extraDirs.push(cliRoot)
    const claudePath = createFailingCli(
      cliRoot,
      'claude',
      'Authorization: Basic abc123 token=secret-token url=https://github.com/org/repo.git?api_key=secret-token',
    )
    const codexPath = createFakeCli(cliRoot, 'codex')

    const result = await runPipelinePreflight({
      repositoryRoot: tempRoot,
    }, {
      resolveClaudeCliPath: () => claudePath,
      resolveCodexCliPath: () => codexPath,
    })

    const serialized = JSON.stringify(result)
    expect(result.repository.remoteUrl).toContain('access_token=***')
    expect(result.repository.remoteUrl).toContain('#***')
    expect(serialized).not.toContain('secret-token')
    expect(serialized).not.toContain('secret-fragment')
    expect(serialized).not.toContain('abc123')
    expect(serialized).toContain('Authorization: Basic ***')
  })

  test('dirty 文件集合变化会改变 preflight fingerprint', async () => {
    initRepo(tempRoot)
    const cliRoot = mkdtempSync(join(tmpdir(), 'codeinsights-preflight-cli-'))
    extraDirs.push(cliRoot)
    const claudePath = createFakeCli(cliRoot, 'claude')
    const codexPath = createFakeCli(cliRoot, 'codex')

    writeFileSync(join(tempRoot, 'first.ts'), 'export const first = true\n', 'utf-8')
    const first = await runPipelinePreflight({
      repositoryRoot: tempRoot,
    }, {
      resolveClaudeCliPath: () => claudePath,
      resolveCodexCliPath: () => codexPath,
    })

    writeFileSync(join(tempRoot, 'second.ts'), 'export const second = true\n', 'utf-8')
    const second = await runPipelinePreflight({
      repositoryRoot: tempRoot,
    }, {
      resolveClaudeCliPath: () => claudePath,
      resolveCodexCliPath: () => codexPath,
    })

    expect(first.repository.hasUncommittedChanges).toBe(true)
    expect(second.repository.hasUncommittedChanges).toBe(true)
    expect(first.repository.statusDigest).not.toBe(second.repository.statusDigest)
    expect(first.fingerprint).not.toBe(second.fingerprint)
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

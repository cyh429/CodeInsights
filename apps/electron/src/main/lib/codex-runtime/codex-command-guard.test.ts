import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import {
  assertCodexGitGuardSnapshotsUnchanged,
  blockedCodexCliShellScript,
  codexGitGuardShellScript,
  createCodexGitGuardSnapshots,
  createCodexExecutionGuard,
  parseCodexGitRefs,
} from './codex-command-guard'

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

describe('codex-command-guard', () => {
  test('Git 快照能拦截绝对路径 git 绕过后创建的真实 commit 并回滚 HEAD', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-codex-git-snapshot-'))
    try {
      git(repoRoot, ['init'])
      git(repoRoot, ['config', 'user.email', 'codex-guard@example.test'])
      git(repoRoot, ['config', 'user.name', 'Codex Guard'])
      writeFileSync(join(repoRoot, 'tracked.txt'), 'before\n', 'utf-8')
      git(repoRoot, ['add', 'tracked.txt'])
      git(repoRoot, ['commit', '-m', 'initial'])
      const initialHead = git(repoRoot, ['rev-parse', 'HEAD'])
      const snapshots = createCodexGitGuardSnapshots([repoRoot])
      const bypassGitBinary = process.platform === 'win32' ? 'git' : '/usr/bin/git'

      writeFileSync(join(repoRoot, 'tracked.txt'), 'after\n', 'utf-8')
      execFileSync(bypassGitBinary, ['-C', repoRoot, 'add', 'tracked.txt'], { stdio: 'ignore' })
      execFileSync(bypassGitBinary, ['-C', repoRoot, 'commit', '-m', 'bypass guard'], { stdio: 'ignore' })

      expect(() => assertCodexGitGuardSnapshotsUnchanged(snapshots, 'agent'))
        .toThrow('Agent Codex Runtime 禁止修改 Git 状态')
      expect(git(repoRoot, ['rev-parse', 'HEAD'])).toBe(initialHead)
      expect(git(repoRoot, ['diff', '--name-only', 'HEAD'])).toBe('tracked.txt')
      expect(git(repoRoot, ['diff', '--cached', '--name-only'])).toBe('')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('按 purpose 区分 Pipeline 和 Agent 文案', () => {
    expect(codexGitGuardShellScript('pipeline')).toContain('CodeInsights Pipeline v2 禁止 Codex 节点直接执行 git')
    expect(codexGitGuardShellScript('agent')).toContain('CodeInsights Agent Codex Runtime 禁止直接执行 git')
    expect(blockedCodexCliShellScript('gh', 'pipeline')).toContain('CodeInsights Pipeline v2 禁止执行 gh')
    expect(blockedCodexCliShellScript('gh', 'agent')).toContain('CodeInsights Agent Codex Runtime 禁止执行 gh')
  })

  test('API key 模式隔离 CODEX_HOME 并阻断 Git 远端写和交互凭证', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'codeinsights-codex-guard-repo-'))
    git(repoRoot, ['init'])
    git(repoRoot, ['remote', 'add', 'origin', 'https://example.com/repo.git'])

    const guard = await createCodexExecutionGuard({
      PATH: ['/usr/bin', '/bin'].join(delimiter),
      CODEX_HOME: '/ambient/codex-home',
      CODEX_API_KEY: 'env-key',
    }, repoRoot, {
      auth: { kind: 'api_key' },
      purpose: 'pipeline',
    })

    try {
      expect(guard.env.CODEX_HOME).not.toBe('/ambient/codex-home')
      expect(guard.env.CODEX_HOME).toContain('codeinsights-codex-home-')
      expect(guard.env.GIT_DIR).toBe('/__codeinsights_git_disabled__')
      expect(guard.env.CODEINSIGHTS_GIT_DISABLED).toBe('1')
      expect(guard.env.GIT_TERMINAL_PROMPT).toBe('0')
      expect(guard.env.GIT_ASKPASS).toBe('')
      expect(guard.env.SSH_ASKPASS).toBe('')
      expect(guard.env.GCM_INTERACTIVE).toBe('Never')
      expect(guard.env.GIT_CONFIG_KEY_0).toBe('remote.origin.pushurl')
      expect(guard.env.GIT_CONFIG_VALUE_0).toBe('file:///__codeinsights_remote_writes_disabled__')
      expect(guard.env.PATH?.split(delimiter)[0]).toContain('codeinsights-codex-command-guard-')
    } finally {
      await guard.cleanup()
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('native auth 模式只传明确 CODEX_HOME 并清理 CODEX_API_KEY', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'codeinsights-codex-guard-native-'))
    const nativeCodexHome = join(tempHome, 'codex-home')
    mkdirSync(nativeCodexHome, { recursive: true })
    writeFileSync(join(nativeCodexHome, 'auth.json'), '{}\n', 'utf-8')

    const guard = await createCodexExecutionGuard({
      PATH: '/usr/bin',
      CODEX_API_KEY: 'ambient-key',
    }, undefined, {
      auth: { kind: 'native', codexHome: nativeCodexHome },
      purpose: 'agent',
    })

    try {
      expect(guard.env.CODEX_HOME).toBe(nativeCodexHome)
      expect(guard.env.CODEX_API_KEY).toBeUndefined()
      expect(guard.env.HOME).not.toBe(tempHome)
      expect(guard.env.USERPROFILE).toBe(guard.env.HOME)
      expect(guard.env.XDG_CONFIG_HOME).toContain('codeinsights-codex-home-')
    } finally {
      await guard.cleanup()
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('parseCodexGitRefs 仅解析 refs 输出', () => {
    expect(parseCodexGitRefs([
      'refs/heads/main:abc123',
      'invalid-line',
      'refs/tags/v1:def456',
      'HEAD:ignored',
    ].join('\n'))).toEqual(new Map([
      ['refs/heads/main', 'abc123'],
      ['refs/tags/v1', 'def456'],
    ]))
  })
})

import { describe, expect, test } from 'bun:test'
import {
  buildCodexEnv,
  buildInternalGitEnv,
  isUnsafeGitEnvironmentKey,
  sanitizeCodexGitEnvironment,
} from './codex-env'

describe('codex-env', () => {
  test('buildCodexEnv 保留 PATH 并过滤宿主会话环境', async () => {
    const env = await buildCodexEnv({
      PATH: '/usr/bin',
      HOME: '/tmp/home',
      CODEX_API_KEY: 'codex-key',
      CODEX_THREAD_ID: 'outer-thread',
      ANTHROPIC_AUTH_TOKEN: 'anthropic-token',
      OPENAI_API_KEY: 'openai-key',
      AWS_ACCESS_KEY_ID: 'aws-key',
      NPM_TOKEN: 'npm-token',
    })

    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/tmp/home')
    expect(env.CODEX_API_KEY).toBe('codex-key')
    expect(env.CODEX_THREAD_ID).toBeUndefined()
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(env.OPENAI_API_KEY).toBeUndefined()
    expect(env.AWS_ACCESS_KEY_ID).toBeUndefined()
    expect(env.NPM_TOKEN).toBeUndefined()
  })

  test('sanitizeCodexGitEnvironment 清理 GitHub token 和危险 Git env', () => {
    const env = sanitizeCodexGitEnvironment({
      PATH: '/usr/bin',
      GH_TOKEN: 'gh-token',
      GITHUB_TOKEN: 'github-token',
      GITHUB_PAT: 'github-pat',
      SSH_AUTH_SOCK: '/tmp/ssh.sock',
      GIT_DIR: '/bad/git-dir',
      GIT_WORK_TREE: '/bad/tree',
      GIT_INDEX_FILE: '/bad/index',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'remote.origin.pushurl',
      GIT_CONFIG_VALUE_0: 'https://example.com/repo.git',
      CODEINSIGHTS_REAL_GIT: '/usr/bin/git',
    })

    expect(env).toEqual({ PATH: '/usr/bin' })
  })

  test('buildInternalGitEnv 清理会影响内部 git 命令的宿主变量', () => {
    const env = buildInternalGitEnv({
      PATH: '/usr/bin',
      GIT_DIR: '/bad/git-dir',
      GIT_WORK_TREE: '/bad/tree',
      GIT_CONFIG_SYSTEM: '/bad/system',
    })

    expect(env).toEqual({ PATH: '/usr/bin' })
    expect(isUnsafeGitEnvironmentKey('GIT_INDEX_FILE')).toBe(true)
    expect(isUnsafeGitEnvironmentKey('PATH')).toBe(false)
  })
})

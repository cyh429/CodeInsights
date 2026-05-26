import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import type { CodexAuthState } from './codex-auth'
import { buildInternalGitEnv } from './codex-env'

export type CodexExecutionGuardPurpose = 'pipeline' | 'agent'

export interface CodexCommandGuard {
  env: Record<string, string>
  cleanup(): Promise<void>
}

export interface CodexCommandGuardOptions {
  auth: CodexAuthState
  purpose?: CodexExecutionGuardPurpose
}

export interface CodexGitGuardSnapshot {
  repositoryRoot: string
  headCommit: string
  refs: string
  stagedStatus: string
  dirtyPaths: string[]
  configPath: string
  configExists: boolean
  configContent: string
}

export function runCodexGuardedGitOrNull(repositoryRoot: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', repositoryRoot, ...args], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: buildInternalGitEnv(),
    }).trim()
  } catch {
    return null
  }
}

export function listCodexGuardedGitRemotes(repositoryRoot: string): string[] {
  return (runCodexGuardedGitOrNull(repositoryRoot, ['remote']) ?? '')
    .split('\n')
    .map((remote) => remote.trim())
    .filter(Boolean)
}

export function parseCodexGitRefs(output: string): Map<string, string> {
  const refs = new Map<string, string>()
  output.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex <= 0) return
      const refName = line.slice(0, separatorIndex)
      const objectName = line.slice(separatorIndex + 1)
      if (!refName.startsWith('refs/') || !objectName) return
      refs.set(refName, objectName)
    })
  return refs
}

export function createCodexGitGuardSnapshots(paths: Array<string | undefined>): CodexGitGuardSnapshot[] {
  const snapshots: CodexGitGuardSnapshot[] = []
  const seenRoots = new Set<string>()

  for (const path of paths) {
    if (!path) continue
    const snapshot = createCodexGitGuardSnapshot(path)
    if (!snapshot || seenRoots.has(snapshot.repositoryRoot)) continue
    seenRoots.add(snapshot.repositoryRoot)
    snapshots.push(snapshot)
  }

  return snapshots
}

export function createCodexGitGuardSnapshot(path: string): CodexGitGuardSnapshot | null {
  const repositoryRoot = runCodexGuardedGitOrNull(path, ['rev-parse', '--show-toplevel'])
  if (!repositoryRoot) return null

  const headCommit = runCodexGuardedGitOrNull(repositoryRoot, ['rev-parse', 'HEAD'])
  if (!headCommit) return null

  return {
    repositoryRoot,
    headCommit,
    refs: runCodexGuardedGitOrNull(repositoryRoot, [
      'for-each-ref',
      '--format=%(refname):%(objectname)',
      'refs',
    ]) ?? '',
    stagedStatus: readCodexGitStagedStatus(repositoryRoot),
    dirtyPaths: readCodexGitDirtyPaths(repositoryRoot),
    ...readCodexGitConfigSnapshot(repositoryRoot),
  }
}

export function assertCodexGitGuardSnapshotsUnchanged(
  snapshots: CodexGitGuardSnapshot[],
  purpose: CodexExecutionGuardPurpose = 'pipeline',
): void {
  const violations = snapshots.flatMap((snapshot) => assertCodexGitGuardSnapshotUnchanged(snapshot))
  if (violations.length > 0) {
    throw new Error(`${codexGuardName(purpose)} 禁止修改 Git 状态：${violations.join('、')}`)
  }
}

function assertCodexGitGuardSnapshotUnchanged(snapshot: CodexGitGuardSnapshot): string[] {
  const violations: string[] = []
  const currentHead = runCodexGuardedGitOrNull(snapshot.repositoryRoot, ['rev-parse', 'HEAD'])
  if (!currentHead) {
    violations.push(`${snapshot.repositoryRoot} 读取 Git HEAD 失败`)
  } else if (currentHead !== snapshot.headCommit) {
    runCodexGuardedGitOrNull(snapshot.repositoryRoot, ['reset', '--soft', snapshot.headCommit])
    violations.push(`${snapshot.repositoryRoot} 创建真实 Git commit`)
  }

  const currentRefsOutput = runCodexGuardedGitOrNull(snapshot.repositoryRoot, [
    'for-each-ref',
    '--format=%(refname):%(objectname)',
    'refs',
  ]) ?? ''
  if (currentRefsOutput !== snapshot.refs) {
    restoreCodexGitRefs(snapshot, currentRefsOutput)
    violations.push(`${snapshot.repositoryRoot} 修改 Git refs`)
  }

  const currentStagedStatus = readCodexGitStagedStatus(snapshot.repositoryRoot)
  if (currentStagedStatus !== snapshot.stagedStatus) {
    if (!snapshot.stagedStatus.trim()) {
      runCodexGuardedGitOrNull(snapshot.repositoryRoot, ['reset', '-q'])
    }
    violations.push(`${snapshot.repositoryRoot} 修改 Git index`)
  }

  const currentConfigExists = existsSync(snapshot.configPath)
  const currentConfigContent = currentConfigExists ? readFileSync(snapshot.configPath, 'utf-8') : ''
  if (currentConfigExists !== snapshot.configExists || currentConfigContent !== snapshot.configContent) {
    if (snapshot.configExists) {
      writeFileSync(snapshot.configPath, snapshot.configContent, 'utf-8')
    } else {
      rmSync(snapshot.configPath, { force: true })
    }
    violations.push(`${snapshot.repositoryRoot} 修改 Git config`)
  }

  const currentDirtyPaths = readCodexGitDirtyPaths(snapshot.repositoryRoot)
  if (snapshot.dirtyPaths.length > 0 && currentDirtyPaths.length === 0) {
    violations.push(`${snapshot.repositoryRoot} 丢弃工作区补丁`)
  }

  return violations
}

function restoreCodexGitRefs(snapshot: CodexGitGuardSnapshot, currentRefsOutput: string): void {
  const expectedRefs = parseCodexGitRefs(snapshot.refs)
  const currentRefs = parseCodexGitRefs(currentRefsOutput)
  for (const [refName] of currentRefs) {
    if (!expectedRefs.has(refName)) {
      runCodexGuardedGitOrNull(snapshot.repositoryRoot, ['update-ref', '-d', refName])
    }
  }
  for (const [refName, objectName] of expectedRefs) {
    if (currentRefs.get(refName) !== objectName) {
      runCodexGuardedGitOrNull(snapshot.repositoryRoot, ['update-ref', refName, objectName])
    }
  }
}

function readCodexGitConfigSnapshot(
  repositoryRoot: string,
): Pick<CodexGitGuardSnapshot, 'configPath' | 'configExists' | 'configContent'> {
  const configPathRaw = runCodexGuardedGitOrNull(repositoryRoot, ['rev-parse', '--git-path', 'config']) ?? '.git/config'
  const configPath = resolve(repositoryRoot, configPathRaw)
  const configExists = existsSync(configPath)
  return {
    configPath,
    configExists,
    configContent: configExists ? readFileSync(configPath, 'utf-8') : '',
  }
}

function readCodexGitStagedStatus(repositoryRoot: string): string {
  return runCodexGuardedGitOrNull(repositoryRoot, [
    'diff',
    '--cached',
    '--name-status',
    '--',
    '.',
  ]) ?? ''
}

function readCodexGitDirtyPaths(repositoryRoot: string): string[] {
  const output = runCodexGuardedGitOrNull(repositoryRoot, [
    'diff',
    '--name-only',
    'HEAD',
    '--',
    '.',
  ]) ?? ''
  return output.split('\n')
    .map((line) => line.trim().replace(/\\/g, '/'))
    .filter(Boolean)
    .sort()
}

function codexGuardName(purpose: CodexExecutionGuardPurpose): string {
  return purpose === 'agent' ? 'Agent Codex Runtime' : 'Pipeline v2 Codex 节点'
}

function codexGuardMessage(
  purpose: CodexExecutionGuardPurpose,
  command?: string,
): string {
  if (purpose === 'agent') {
    return command
      ? `CodeInsights Agent Codex Runtime 禁止执行 ${command}`
      : 'CodeInsights Agent Codex Runtime 禁止直接执行 git；请通过应用授权的文件与版本控制流程处理。'
  }

  return command
    ? `CodeInsights Pipeline v2 禁止执行 ${command}`
    : 'CodeInsights Pipeline v2 禁止 Codex 节点直接执行 git；请依赖 Pipeline 提供的结构化上下文和 patch-set 服务。'
}

export function withCodexRemoteWriteGuards(
  env: Record<string, string>,
  repositoryRoot: string | undefined,
): Record<string, string> {
  const guarded: Record<string, string> = {
    ...env,
    GIT_TERMINAL_PROMPT: '0',
  }
  if (!repositoryRoot) return guarded

  const remotes = listCodexGuardedGitRemotes(repositoryRoot)
  const existingCount = Number.parseInt(guarded.GIT_CONFIG_COUNT ?? '0', 10)
  const baseIndex = Number.isFinite(existingCount) && existingCount > 0 ? existingCount : 0
  remotes.forEach((remote, index) => {
    const configIndex = baseIndex + index
    guarded[`GIT_CONFIG_KEY_${configIndex}`] = `remote.${remote}.pushurl`
    guarded[`GIT_CONFIG_VALUE_${configIndex}`] = 'file:///__codeinsights_remote_writes_disabled__'
  })
  guarded.GIT_CONFIG_COUNT = String(baseIndex + remotes.length)
  return guarded
}

export function codexGitGuardShellScript(purpose: CodexExecutionGuardPurpose = 'pipeline'): string {
  return [
    '#!/bin/sh',
    `echo "${codexGuardMessage(purpose)}" >&2`,
    'exit 126',
    '',
  ].join('\n')
}

export function codexGitGuardCmdScript(purpose: CodexExecutionGuardPurpose = 'pipeline'): string {
  return [
    '@echo off',
    `echo ${codexGuardMessage(purpose)} 1>&2`,
    'exit /b 126',
    '',
  ].join('\r\n')
}

export function blockedCodexCliShellScript(
  command: string,
  purpose: CodexExecutionGuardPurpose = 'pipeline',
): string {
  return [
    '#!/bin/sh',
    `echo "${codexGuardMessage(purpose, command)}" >&2`,
    'exit 126',
    '',
  ].join('\n')
}

export function blockedCodexCliCmdScript(
  command: string,
  purpose: CodexExecutionGuardPurpose = 'pipeline',
): string {
  return [
    '@echo off',
    `echo ${codexGuardMessage(purpose, command)} 1>&2`,
    'exit /b 126',
    '',
  ].join('\r\n')
}

export async function createCodexExecutionGuard(
  env: Record<string, string>,
  repositoryRoot: string | undefined,
  options: CodexCommandGuardOptions,
): Promise<CodexCommandGuard> {
  const purpose = options.purpose ?? 'pipeline'
  const guarded = withCodexRemoteWriteGuards(env, repositoryRoot)
  if (options.auth.kind === 'native') {
    delete guarded.CODEX_API_KEY
  }
  const originalPath = guarded.PATH ?? process.env.PATH ?? ''
  const guardHome = await mkdtemp(join(tmpdir(), 'codeinsights-codex-home-'))
  const gitConfigPath = join(guardHome, '.gitconfig')
  const isolatedCodexHome = options.auth.kind === 'native' && options.auth.codexHome
    ? options.auth.codexHome
    : join(guardHome, '.codex')
  let guardDir: string | undefined

  await mkdir(join(guardHome, '.config'), { recursive: true })
  if (options.auth.kind === 'api_key') {
    await mkdir(isolatedCodexHome, { recursive: true })
  }
  await writeFile(gitConfigPath, '', 'utf-8')

  const guardedGitEnv: Record<string, string> = {}
  if (repositoryRoot) {
    guardDir = await mkdtemp(join(tmpdir(), 'codeinsights-codex-command-guard-'))
    const gitShellPath = join(guardDir, 'git')
    const gitCmdPath = join(guardDir, 'git.cmd')
    await writeFile(gitShellPath, codexGitGuardShellScript(purpose), 'utf-8')
    await writeFile(gitCmdPath, codexGitGuardCmdScript(purpose), 'utf-8')
    await chmod(gitShellPath, 0o755)

    for (const command of ['gh', 'hub']) {
      const shellPath = join(guardDir, command)
      const cmdPath = join(guardDir, `${command}.cmd`)
      await writeFile(shellPath, blockedCodexCliShellScript(command, purpose), 'utf-8')
      await writeFile(cmdPath, blockedCodexCliCmdScript(command, purpose), 'utf-8')
      await chmod(shellPath, 0o755)
    }

    guardedGitEnv.GIT_DIR = '/__codeinsights_git_disabled__'
    guardedGitEnv.CODEINSIGHTS_GIT_DISABLED = '1'
    guardedGitEnv.PATH = [guardDir, originalPath].filter(Boolean).join(delimiter)
  }

  return {
    env: {
      ...guarded,
      HOME: guardHome,
      USERPROFILE: guardHome,
      XDG_CONFIG_HOME: join(guardHome, '.config'),
      CODEX_HOME: isolatedCodexHome,
      GIT_CONFIG_GLOBAL: gitConfigPath,
      GIT_CONFIG_NOSYSTEM: '1',
      GCM_INTERACTIVE: 'Never',
      GIT_ASKPASS: '',
      SSH_ASKPASS: '',
      ...guardedGitEnv,
    },
    cleanup: async () => {
      if (guardDir) {
        await rm(guardDir, { recursive: true, force: true })
      }
      await rm(guardHome, { recursive: true, force: true })
    },
  }
}

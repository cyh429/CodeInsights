/**
 * Pipeline v2 启动前检查服务
 *
 * 提前识别仓库、Git、CLI 和包管理器风险，避免长流程后期失败。
 */

import { existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import type {
  PipelinePackageManager,
  PipelinePreflightInput,
  PipelinePreflightIssue,
  PipelinePreflightResult,
  PipelinePreflightRuntimeKind,
  PipelinePreflightRuntimeStatus,
} from '@codeinsights/shared'

interface CommandRunResult {
  status: number | null
  stdout: string
  stderr: string
  error?: string
}

interface PipelinePreflightDependencies {
  runCommand?: (
    command: string,
    args: string[],
    options: { cwd?: string; timeoutMs?: number },
  ) => CommandRunResult
  resolveClaudeCliPath?: () => string
  resolveCodexCliPath?: () => string
}

const CODEX_PLATFORM_PACKAGE_BY_TARGET: Record<string, string> = {
  'x86_64-unknown-linux-musl': '@openai/codex-linux-x64',
  'aarch64-unknown-linux-musl': '@openai/codex-linux-arm64',
  'x86_64-apple-darwin': '@openai/codex-darwin-x64',
  'aarch64-apple-darwin': '@openai/codex-darwin-arm64',
  'x86_64-pc-windows-msvc': '@openai/codex-win32-x64',
  'aarch64-pc-windows-msvc': '@openai/codex-win32-arm64',
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): CommandRunResult {
  try {
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      encoding: 'utf-8',
      timeout: options.timeoutMs ?? 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
      },
    })

    return {
      status: result.status,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      error: result.error?.message,
    }
  } catch (error) {
    return {
      status: null,
      stdout: '',
      stderr: '',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function createModuleRequire(): NodeJS.Require {
  const filename = typeof __filename === 'string'
    ? __filename
    : join(process.cwd(), 'package.json')
  return createRequire(filename)
}

function resolveClaudeCliPath(): string {
  const subpkg = `claude-agent-sdk-${process.platform}-${process.arch}`
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'

  try {
    const cjsRequire = createModuleRequire()
    const sdkEntryPath = cjsRequire.resolve('@anthropic-ai/claude-agent-sdk')
    const anthropicDir = dirname(dirname(sdkEntryPath))
    return join(anthropicDir, subpkg, binaryName)
  } catch {
    return join(process.cwd(), 'node_modules', '@anthropic-ai', subpkg, binaryName)
  }
}

function resolveCodexTargetTriple(): string {
  if (process.platform === 'linux' || process.platform === 'android') {
    if (process.arch === 'x64') return 'x86_64-unknown-linux-musl'
    if (process.arch === 'arm64') return 'aarch64-unknown-linux-musl'
  }

  if (process.platform === 'darwin') {
    if (process.arch === 'x64') return 'x86_64-apple-darwin'
    if (process.arch === 'arm64') return 'aarch64-apple-darwin'
  }

  if (process.platform === 'win32') {
    if (process.arch === 'x64') return 'x86_64-pc-windows-msvc'
    if (process.arch === 'arm64') return 'aarch64-pc-windows-msvc'
  }

  throw new Error(`不支持的 Codex CLI 平台: ${process.platform} (${process.arch})`)
}

function resolveCodexCliPath(): string {
  const targetTriple = resolveCodexTargetTriple()
  const platformPackage = CODEX_PLATFORM_PACKAGE_BY_TARGET[targetTriple]
  if (!platformPackage) {
    throw new Error(`不支持的 Codex CLI target: ${targetTriple}`)
  }

  const cjsRequire = createModuleRequire()
  const codexPackageJsonPath = cjsRequire.resolve('@openai/codex/package.json')
  const codexRequire = createRequire(codexPackageJsonPath)
  const platformPackageJsonPath = codexRequire.resolve(`${platformPackage}/package.json`)
  const vendorRoot = join(dirname(platformPackageJsonPath), 'vendor')
  const binaryName = process.platform === 'win32' ? 'codex.exe' : 'codex'
  return join(vendorRoot, targetTriple, 'codex', binaryName)
}

function buildIssue(
  code: PipelinePreflightIssue['code'],
  message: string,
): PipelinePreflightIssue {
  return { code, message }
}

function parseRuntimeVersion(stdout: string): string | undefined {
  const firstLine = stdout.split('\n').find((line) => line.trim().length > 0)
  return firstLine?.trim()
}

function checkExecutableRuntime(
  kind: PipelinePreflightRuntimeKind,
  path: string | undefined,
  missingCode: PipelinePreflightIssue['code'],
  blockers: PipelinePreflightIssue[],
  commandRunner: PipelinePreflightDependencies['runCommand'],
): PipelinePreflightRuntimeStatus {
  if (!path || !existsSync(path)) {
    blockers.push(buildIssue(missingCode, `${kind} 不可用或未安装`))
    return {
      kind,
      available: false,
      path,
      error: '未找到可执行文件',
    }
  }

  const result = (commandRunner ?? runCommand)(path, ['--version'], {
    timeoutMs: 5000,
  })
  if (result.status !== 0) {
    blockers.push(buildIssue(missingCode, `${kind} 无法执行`))
    return {
      kind,
      available: false,
      path,
      error: result.stderr || result.error || '执行失败',
    }
  }

  return {
    kind,
    available: true,
    path,
    version: parseRuntimeVersion(result.stdout),
  }
}

function checkResolvedExecutableRuntime(
  kind: PipelinePreflightRuntimeKind,
  resolver: () => string,
  missingCode: PipelinePreflightIssue['code'],
  blockers: PipelinePreflightIssue[],
  commandRunner: PipelinePreflightDependencies['runCommand'],
): PipelinePreflightRuntimeStatus {
  try {
    return checkExecutableRuntime(
      kind,
      resolver(),
      missingCode,
      blockers,
      commandRunner,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    blockers.push(buildIssue(missingCode, `${kind} 解析失败`))
    return {
      kind,
      available: false,
      error: message,
    }
  }
}

function detectPackageManager(repositoryRoot: string): PipelinePackageManager {
  if (existsSync(join(repositoryRoot, 'bun.lock')) || existsSync(join(repositoryRoot, 'bun.lockb'))) {
    return 'bun'
  }
  if (existsSync(join(repositoryRoot, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(repositoryRoot, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(repositoryRoot, 'package-lock.json'))) return 'npm'
  return 'unknown'
}

function hasConflictStatus(statusLine: string): boolean {
  const code = statusLine.slice(0, 2)
  return (
    code.includes('U')
    || code === 'AA'
    || code === 'DD'
  )
}

function getGitOutput(
  args: string[],
  repositoryRoot: string,
  commandRunner: PipelinePreflightDependencies['runCommand'],
): CommandRunResult {
  return (commandRunner ?? runCommand)('git', args, {
    cwd: repositoryRoot,
    timeoutMs: 10000,
  })
}

export async function runPipelinePreflight(
  input: PipelinePreflightInput,
  deps: PipelinePreflightDependencies = {},
): Promise<PipelinePreflightResult> {
  const repositoryRoot = resolve(input.repositoryRoot)
  const blockers: PipelinePreflightIssue[] = []
  const warnings: PipelinePreflightIssue[] = []
  const runtimes: PipelinePreflightRuntimeStatus[] = []
  const repository = {
    root: repositoryRoot,
    currentBranch: undefined as string | undefined,
    baseBranch: undefined as string | undefined,
    remoteUrl: undefined as string | undefined,
    hasUncommittedChanges: false,
    hasConflicts: false,
  }

  if (!existsSync(repositoryRoot)) {
    blockers.push(buildIssue('repository_missing', `仓库目录不存在: ${repositoryRoot}`))
  }

  const gitVersion = getGitOutput(['--version'], repositoryRoot, deps.runCommand)
  if (gitVersion.status !== 0) {
    if (input.requireGit !== false) {
      blockers.push(buildIssue('git_missing', 'Git 不可用或未安装'))
    }
    runtimes.push({
      kind: 'git',
      available: false,
      error: gitVersion.stderr || gitVersion.error || 'Git 执行失败',
    })
  } else {
    runtimes.push({
      kind: 'git',
      available: true,
      version: parseRuntimeVersion(gitVersion.stdout),
    })

    const rootResult = getGitOutput(['rev-parse', '--show-toplevel'], repositoryRoot, deps.runCommand)
    const detectedRoot = rootResult.status === 0 && rootResult.stdout
      ? realpathSync(resolve(rootResult.stdout))
      : undefined
    const requestedRoot = existsSync(repositoryRoot)
      ? realpathSync(repositoryRoot)
      : repositoryRoot
    if (rootResult.status !== 0 || detectedRoot !== requestedRoot) {
      blockers.push(buildIssue('repository_not_git_root', '请选择 Git 仓库根目录'))
    } else {
      const branchResult = getGitOutput(['branch', '--show-current'], repositoryRoot, deps.runCommand)
      repository.currentBranch = branchResult.stdout || undefined

      if (!repository.currentBranch) {
        warnings.push(buildIssue('git_detached_head', '当前仓库处于 detached HEAD 状态'))
      }

      const upstreamResult = getGitOutput([
        'rev-parse',
        '--abbrev-ref',
        '--symbolic-full-name',
        '@{u}',
      ], repositoryRoot, deps.runCommand)
      repository.baseBranch = upstreamResult.status === 0 ? upstreamResult.stdout : undefined

      const remoteResult = getGitOutput(['config', '--get', 'remote.origin.url'], repositoryRoot, deps.runCommand)
      repository.remoteUrl = remoteResult.status === 0 ? remoteResult.stdout : undefined
      if (!repository.remoteUrl) {
        warnings.push(buildIssue('git_remote_missing', '未配置 remote.origin.url'))
      }

      const statusResult = getGitOutput(['status', '--porcelain'], repositoryRoot, deps.runCommand)
      const statusLines = statusResult.stdout
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0)
      repository.hasUncommittedChanges = statusLines.length > 0
      repository.hasConflicts = statusLines.some(hasConflictStatus)

      if (repository.hasUncommittedChanges) {
        warnings.push(buildIssue('git_uncommitted_changes', '工作区存在未提交变更'))
      }
      if (repository.hasConflicts) {
        blockers.push(buildIssue('git_conflicts', '工作区存在 Git 冲突'))
      }
    }
  }

  const packageManager = detectPackageManager(repositoryRoot)
  if (packageManager === 'unknown') {
    warnings.push(buildIssue('package_manager_unknown', '未识别包管理器'))
  }

  if (input.requireClaudeCli !== false) {
    runtimes.push(checkResolvedExecutableRuntime(
      'claude-cli',
      deps.resolveClaudeCliPath ?? resolveClaudeCliPath,
      'claude_cli_missing',
      blockers,
      deps.runCommand,
    ))
  }

  if (input.requireCodexCli !== false) {
    runtimes.push(checkResolvedExecutableRuntime(
      'codex-cli',
      deps.resolveCodexCliPath ?? resolveCodexCliPath,
      'codex_cli_missing',
      blockers,
      deps.runCommand,
    ))
  }

  return {
    ok: blockers.length === 0,
    repository,
    runtimes,
    packageManager,
    warnings,
    blockers,
  }
}

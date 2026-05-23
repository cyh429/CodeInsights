import { lstatSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { CodeInsightsPermissionMode } from '@codeinsights/shared'
import type { PermissionResult, CanUseToolOptions } from '../agent-permission-service'
import type { ExitPlanPermissionResult } from '../agent-exit-plan-service'
import { validateToolInput } from '../agent-tool-input-validator'
import { estimateTokenCount, WRITE_CONTENT_TOKEN_THRESHOLD } from '../agent-tool-token-estimator'

const PLAN_MODE_DENY_MESSAGE = '计划模式下不允许执行写操作，请在计划审批通过后再执行'

// Plan 模式下允许的只读工具（不包含 Write/Edit/Bash 等写操作）
const PLAN_MODE_ALLOWED_TOOLS = new Set([
  'Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
  'Agent', 'TodoRead', 'TodoWrite', 'TaskOutput',
  'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet',
  'ListMcpResourcesTool', 'ReadMcpResourceTool',
])

const READ_ONLY_BASH_COMMANDS = new Set([
  'pwd', 'ls', 'cat', 'head', 'tail', 'wc', 'rg', 'grep',
  'find', 'du', 'df', 'file', 'stat',
])

const READ_ONLY_GIT_SUBCOMMANDS = new Set([
  'status', 'rev-parse', 'ls-files',
])

const READ_ONLY_FIND_FLAGS = new Set([
  '-print', '-print0', '-not',
])

const READ_ONLY_FIND_VALUE_OPTIONS = new Set([
  '-maxdepth', '-mindepth', '-name', '-iname', '-path', '-ipath',
  '-type', '-size', '-mtime', '-mmin', '-ctime', '-cmin', '-atime', '-amin',
  '-newer', '-perm', '-user', '-group',
])

export interface PermissionToolHandler {
  (toolName: string, input: Record<string, unknown>, options: CanUseToolOptions): Promise<PermissionResult>
}

export interface AskUserQuestionHandler {
  (input: Record<string, unknown>, signal: AbortSignal): Promise<PermissionResult>
}

export interface ExitPlanModeHandler {
  (input: Record<string, unknown>, signal: AbortSignal): Promise<ExitPlanPermissionResult>
}

export interface PermissionToolDispatcherOptions {
  initialPermissionMode: CodeInsightsPermissionMode
  agentCwd: string
  getPermissionMode: () => CodeInsightsPermissionMode
  setPermissionMode: (mode: CodeInsightsPermissionMode) => void
  syncAdapterPermissionMode?: (mode: CodeInsightsPermissionMode) => void
  emitEnterPlanMode: () => void
  autoCanUseTool: PermissionToolHandler
  askUserQuestion: AskUserQuestionHandler
  exitPlanMode: ExitPlanModeHandler
}

/**
 * 判断 Bash 命令是否是只读的（计划模式下安全可执行）。
 *
 * 使用 allowlist 而不是 blocklist：Plan 模式只允许明确的查看类命令。
 */
export function isBashCommandReadOnly(command: string): boolean {
  if (/[\r\n]/.test(command)) return false

  const normalized = stripAllowedStderrRedirect(command.trim()).trim()
  if (!normalized) return false

  // 拒绝 shell 组合、命令替换和重定向，避免只读命令被拼接成写操作。
  if (/[|;&<>`$]/.test(normalized)) return false
  // 未引入完整 shell parser 前，保守拒绝 quote / escape / glob / brace expansion。
  if (/['"\\*?[\]{}]/.test(normalized)) return false

  const match = normalized.match(/^([A-Za-z0-9_.-]+)(?:\s+(.*))?$/)
  if (!match) return false

  const commandName = match[1]!.toLowerCase()
  const args = match[2] ?? ''

  if (commandName === 'git') {
    const subcommand = args.trim().split(/\s+/)[0]?.toLowerCase()
    if (!subcommand || !READ_ONLY_GIT_SUBCOMMANDS.has(subcommand)) return false
    return !/(^|\s)(--output(?:=|\s)|-o(?:\s|$)|--ext-diff\b|--textconv\b|--open-files-in-pager(?:=|\s|$)|--paginate\b|--pager(?:=|\s|$))/.test(args)
  }

  if (commandName === 'find') {
    return hasReadOnlyFindArgs(args)
  }

  if (commandName === 'rg') {
    return hasReadOnlyRipgrepArgs(args)
  }

  return READ_ONLY_BASH_COMMANDS.has(commandName)
}

export function isPlanMarkdownPathAllowed(filePath: string, agentCwd: string): boolean {
  if (filePath !== filePath.trim()) return false
  if (/[\r\n]/.test(filePath)) return false
  if (!filePath.toLowerCase().endsWith('.md')) return false
  if (hasParentPathSegment(filePath)) return false

  const planRoot = resolve(agentCwd, '.context')
  const candidatePath = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(agentCwd, filePath)
  const relativePath = relative(planRoot, candidatePath)

  if (
    relativePath === ''
    || isEscapingRelativePath(relativePath)
    || isAbsolute(relativePath)
  ) {
    return false
  }

  return isPathInsideRealPlanRoot(planRoot, candidatePath)
}

function isPathInsideRealPlanRoot(planRoot: string, candidatePath: string): boolean {
  const planRootStat = safeLstat(planRoot)
  if (planRootStat?.isSymbolicLink()) return false

  const planRootExists = planRootStat != null
  const realPlanRoot = planRootExists ? safeRealpath(planRoot) : planRoot
  if (!realPlanRoot) return false

  const existingCandidatePath = findNearestExistingPath(candidatePath, planRoot)
  if (!existingCandidatePath) return true

  const existingCandidateStat = safeLstat(existingCandidatePath)
  if (!existingCandidateStat || existingCandidateStat.isSymbolicLink()) {
    return false
  }
  if (existingCandidateStat.isFile() && existingCandidateStat.nlink > 1) {
    return false
  }

  const realCandidatePath = safeRealpath(existingCandidatePath)
  if (!realCandidatePath) return false

  const realRelativePath = relative(realPlanRoot, realCandidatePath)
  return realRelativePath === ''
    || (!isEscapingRelativePath(realRelativePath) && !isAbsolute(realRelativePath))
}

function safeLstat(targetPath: string): ReturnType<typeof lstatSync> | null {
  try {
    return lstatSync(targetPath)
  } catch {
    return null
  }
}

function pathExistsOrIsSymlink(targetPath: string): boolean {
  return safeLstat(targetPath) != null
}

function safeRealpath(targetPath: string): string | null {
  try {
    return realpathSync(targetPath)
  } catch {
    return null
  }
}

function findNearestExistingPath(candidatePath: string, stopAt: string): string | null {
  let currentPath = candidatePath
  while (isPathInsideOrSame(currentPath, stopAt)) {
    if (pathExistsOrIsSymlink(currentPath)) return currentPath
    const parentPath = resolve(currentPath, '..')
    if (parentPath === currentPath) break
    currentPath = parentPath
  }
  return null
}

function isPathInsideOrSame(targetPath: string, parentPath: string): boolean {
  const relativePath = relative(parentPath, targetPath)
  return relativePath === ''
    || (!isEscapingRelativePath(relativePath) && !isAbsolute(relativePath))
}

function hasParentPathSegment(targetPath: string): boolean {
  return targetPath.split(/[\\/]+/).includes('..')
}

function isEscapingRelativePath(relativePath: string): boolean {
  return relativePath === '..' || relativePath.startsWith(`..${sep}`)
}

function stripAllowedStderrRedirect(command: string): string {
  return command.replace(/(^|\s)2>\s*\/dev\/null(?=\s|$)/g, ' ')
}

function hasReadOnlyRipgrepArgs(args: string): boolean {
  const tokens = splitBashArgs(args)
  for (const token of tokens) {
    if (token === '--pre' || token.startsWith('--pre=')) return false
    if (token === '--pre-glob' || token.startsWith('--pre-glob=')) return false
  }
  return true
}

function hasReadOnlyFindArgs(args: string): boolean {
  const tokens = splitBashArgs(args)
  let expectsValue = false

  for (const token of tokens) {
    if (expectsValue) {
      expectsValue = false
      continue
    }

    if (!token.startsWith('-') || token === '!' || token === '(' || token === ')') {
      continue
    }

    if (READ_ONLY_FIND_FLAGS.has(token)) continue
    if (token === '-o' || token === '-or' || token === '-a' || token === '-and') continue
    if (READ_ONLY_FIND_VALUE_OPTIONS.has(token)) {
      expectsValue = true
      continue
    }

    return false
  }

  return !expectsValue
}

function splitBashArgs(args: string): string[] {
  return args.trim().length > 0 ? args.trim().split(/\s+/) : []
}

export function evaluatePlanModeTool(
  toolName: string,
  input: Record<string, unknown>,
  agentCwd: string,
): PermissionResult {
  if (PLAN_MODE_ALLOWED_TOOLS.has(toolName)) {
    return { behavior: 'allow' as const, updatedInput: input }
  }

  if (toolName === 'Write' || toolName === 'Edit') {
    const filePath = typeof input.file_path === 'string' ? input.file_path : ''
    if (isPlanMarkdownPathAllowed(filePath, agentCwd)) {
      return { behavior: 'allow' as const, updatedInput: input }
    }
  }

  if (toolName === 'Bash') {
    const command = typeof input.command === 'string' ? input.command : ''
    if (isBashCommandReadOnly(command)) {
      return { behavior: 'allow' as const, updatedInput: input }
    }
    return { behavior: 'deny' as const, message: PLAN_MODE_DENY_MESSAGE }
  }

  return { behavior: 'deny' as const, message: PLAN_MODE_DENY_MESSAGE }
}

/**
 * 权限工具分派器。
 *
 * 保持 canUseTool 的模式分派语义集中可测；外层编排器仍负责注入服务、事件和 SDK 模式同步。
 */
export class PermissionToolDispatcher {
  private readonly agentCwd: string
  private readonly getPermissionMode: () => CodeInsightsPermissionMode
  private readonly setPermissionMode: (mode: CodeInsightsPermissionMode) => void
  private readonly syncAdapterPermissionMode?: (mode: CodeInsightsPermissionMode) => void
  private readonly emitEnterPlanMode: () => void
  private readonly autoCanUseTool: PermissionToolHandler
  private readonly askUserQuestion: AskUserQuestionHandler
  private readonly exitPlanMode: ExitPlanModeHandler
  private planModeEntered: boolean

  constructor(options: PermissionToolDispatcherOptions) {
    this.agentCwd = options.agentCwd
    this.getPermissionMode = options.getPermissionMode
    this.setPermissionMode = options.setPermissionMode
    this.syncAdapterPermissionMode = options.syncAdapterPermissionMode
    this.emitEnterPlanMode = options.emitEnterPlanMode
    this.autoCanUseTool = options.autoCanUseTool
    this.askUserQuestion = options.askUserQuestion
    this.exitPlanMode = options.exitPlanMode
    this.planModeEntered = options.initialPermissionMode === 'plan'
  }

  createCanUseTool(): PermissionToolHandler {
    return (toolName, input, options) => this.canUseTool(toolName, input, options)
  }

  isPlanModeEntered(): boolean {
    return this.planModeEntered
  }

  syncPlanModeState(mode: CodeInsightsPermissionMode): void {
    this.planModeEntered = mode === 'plan'
  }

  private async canUseTool(
    toolName: string,
    input: Record<string, unknown>,
    options: CanUseToolOptions,
  ): Promise<PermissionResult> {
    const currentMode = this.getPermissionMode()

    // 参数校验守卫（所有模式、所有工具，优先于权限检查）
    const validationFailure = validateToolInput(toolName, input)
    if (validationFailure) {
      console.warn(`[Agent 工具验证] 参数缺失: tool=${toolName}, mode=${currentMode}`)
      return validationFailure
    }

    const writeProtection = this.checkLargeWrite(toolName, input)
    if (writeProtection) return writeProtection

    // 完全自动模式：透明化（用户选择了完全信任 Agent）
    if (currentMode === 'bypassPermissions' && (toolName === 'EnterPlanMode' || toolName === 'ExitPlanMode')) {
      return { behavior: 'allow' as const, updatedInput: input }
    }

    if (toolName === 'ExitPlanMode') {
      if (!this.planModeEntered) {
        return { behavior: 'allow' as const, updatedInput: input }
      }
      const result = await this.exitPlanMode(input, options.signal)
      if (result.behavior === 'allow' && 'targetMode' in result && result.targetMode) {
        this.setPermissionMode(result.targetMode)
        this.planModeEntered = false
        this.syncAdapterPermissionMode?.(result.targetMode)
      }
      return result
    }

    if (toolName === 'EnterPlanMode') {
      this.planModeEntered = true
      if (currentMode !== 'plan') {
        this.setPermissionMode('plan')
        this.syncAdapterPermissionMode?.('plan')
      }
      this.emitEnterPlanMode()
      return { behavior: 'allow' as const, updatedInput: input }
    }

    // AskUserQuestion 始终走交互式问答流程，不受权限模式影响
    if (toolName === 'AskUserQuestion') {
      return this.askUserQuestion(input, options.signal)
    }

    switch (currentMode) {
      case 'bypassPermissions':
        return { behavior: 'allow' as const, updatedInput: input }

      case 'plan':
        return evaluatePlanModeTool(toolName, input, this.agentCwd)

      case 'auto':
        return this.autoCanUseTool(toolName, input, options)

      default:
        return { behavior: 'allow' as const, updatedInput: input }
    }
  }

  private checkLargeWrite(toolName: string, input: Record<string, unknown>): PermissionResult | null {
    if (toolName !== 'Write' || typeof input.content !== 'string') return null

    const estimatedTokens = estimateTokenCount(input.content)
    if (estimatedTokens <= WRITE_CONTENT_TOKEN_THRESHOLD) return null

    console.warn(
      `[Agent 工具验证] Write 内容过大: tokens≈${estimatedTokens}, chars=${input.content.length}, file=${String(input.file_path)}`,
    )
    return {
      behavior: 'deny' as const,
      message:
        `The content for Write tool (~${estimatedTokens} estimated tokens, ${input.content.length} chars) is too large and may be truncated. ` +
        `Please split the write into smaller sequential steps: write the first portion of the file now, then use Edit tool to append remaining sections incrementally.`,
    }
  }
}

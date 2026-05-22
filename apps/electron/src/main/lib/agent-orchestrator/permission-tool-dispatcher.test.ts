import { describe, expect, test } from 'bun:test'
import { linkSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type { CodeInsightsPermissionMode } from '@codeinsights/shared'
import type { PermissionResult, CanUseToolOptions } from '../agent-permission-service'
import type { ExitPlanPermissionResult } from '../agent-exit-plan-service'
import {
  PermissionToolDispatcher,
  isBashCommandReadOnly,
  isPlanMarkdownPathAllowed,
  type PermissionToolHandler,
} from './permission-tool-dispatcher'

const TEST_AGENT_CWD = resolve('/tmp/codeinsights-session')

interface ToolCall {
  toolName: string
  input: Record<string, unknown>
  options: CanUseToolOptions
}

interface SignalCall {
  input: Record<string, unknown>
  signal: AbortSignal
}

interface DispatcherHandlers {
  autoCanUseTool?: PermissionToolHandler
  askUserQuestion?: (input: Record<string, unknown>, signal: AbortSignal) => Promise<PermissionResult>
  exitPlanMode?: (input: Record<string, unknown>, signal: AbortSignal) => Promise<ExitPlanPermissionResult>
}

interface DispatcherFixture {
  dispatcher: PermissionToolDispatcher
  canUseTool: PermissionToolHandler
  autoCalls: ToolCall[]
  askCalls: SignalCall[]
  exitCalls: SignalCall[]
  modeUpdates: CodeInsightsPermissionMode[]
  syncedModes: CodeInsightsPermissionMode[]
  enterPlanEvents: () => number
  currentMode: () => CodeInsightsPermissionMode
}

function createToolOptions(overrides: Partial<CanUseToolOptions> = {}): CanUseToolOptions {
  const controller = new AbortController()
  return {
    signal: controller.signal,
    toolUseID: 'tool-use-1',
    ...overrides,
  }
}

function createFixture(
  initialMode: CodeInsightsPermissionMode,
  handlers: DispatcherHandlers = {},
): DispatcherFixture {
  let currentMode = initialMode
  let enterPlanEventCount = 0
  const autoCalls: ToolCall[] = []
  const askCalls: SignalCall[] = []
  const exitCalls: SignalCall[] = []
  const modeUpdates: CodeInsightsPermissionMode[] = []
  const syncedModes: CodeInsightsPermissionMode[] = []

  const dispatcher = new PermissionToolDispatcher({
    initialPermissionMode: initialMode,
    agentCwd: TEST_AGENT_CWD,
    getPermissionMode: () => currentMode,
    setPermissionMode: (mode) => {
      currentMode = mode
      modeUpdates.push(mode)
    },
    syncAdapterPermissionMode: (mode) => {
      syncedModes.push(mode)
    },
    emitEnterPlanMode: () => {
      enterPlanEventCount += 1
    },
    autoCanUseTool: handlers.autoCanUseTool ?? (async (toolName, input, options) => {
      autoCalls.push({ toolName, input, options })
      return { behavior: 'allow' as const, updatedInput: { ...input, auto: true } }
    }),
    askUserQuestion: handlers.askUserQuestion ?? (async (input, signal) => {
      askCalls.push({ input, signal })
      return { behavior: 'allow' as const, updatedInput: { ...input, answers: { choice: 'ok' } } }
    }),
    exitPlanMode: handlers.exitPlanMode ?? (async (input, signal) => {
      exitCalls.push({ input, signal })
      return { behavior: 'allow' as const, updatedInput: input, targetMode: 'auto' }
    }),
  })

  return {
    dispatcher,
    canUseTool: dispatcher.createCanUseTool(),
    autoCalls,
    askCalls,
    exitCalls,
    modeUpdates,
    syncedModes,
    enterPlanEvents: () => enterPlanEventCount,
    currentMode: () => currentMode,
  }
}

describe('PermissionToolDispatcher', () => {
  test('bypassPermissions 放行普通工具和 PlanMode 工具，但仍先执行参数校验', async () => {
    const fixture = createFixture('bypassPermissions')
    const input = { command: 'rm -rf /tmp/example' }

    await expect(fixture.canUseTool('Bash', input, createToolOptions())).resolves.toEqual({
      behavior: 'allow',
      updatedInput: input,
    })
    await expect(fixture.canUseTool('EnterPlanMode', {}, createToolOptions())).resolves.toEqual({
      behavior: 'allow',
      updatedInput: {},
    })
    await expect(fixture.canUseTool('ExitPlanMode', {}, createToolOptions())).resolves.toEqual({
      behavior: 'allow',
      updatedInput: {},
    })

    expect(fixture.enterPlanEvents()).toBe(0)
    expect(fixture.exitCalls).toHaveLength(0)
    expect(fixture.dispatcher.isPlanModeEntered()).toBe(false)

    const missingParamResult = await fixture.canUseTool('Write', { content: 'hello' }, createToolOptions())
    expect(missingParamResult.behavior).toBe('deny')
    if (missingParamResult.behavior === 'deny') {
      expect(missingParamResult.message).toContain('"file_path"')
    }
  })

  test('AskUserQuestion 不受权限模式影响，始终走交互式问答处理', async () => {
    for (const mode of ['auto', 'plan', 'bypassPermissions'] satisfies CodeInsightsPermissionMode[]) {
      const fixture = createFixture(mode)
      const input = { questions: [{ question: '继续吗？', options: [] }] }
      const options = createToolOptions()

      const result = await fixture.canUseTool('AskUserQuestion', input, options)

      expect(result).toEqual({
        behavior: 'allow',
        updatedInput: { ...input, answers: { choice: 'ok' } },
      })
      expect(fixture.askCalls).toEqual([{ input, signal: options.signal }])
      expect(fixture.autoCalls).toHaveLength(0)
    }
  })

  test('plan 模式保留只读工具、计划 Markdown 写入和只读 Bash 策略', async () => {
    const fixture = createFixture('plan')

    const readInput = { file_path: '/tmp/file.ts' }
    await expect(fixture.canUseTool('Read', readInput, createToolOptions())).resolves.toEqual({
      behavior: 'allow',
      updatedInput: readInput,
    })

    const writeMarkdownInput = { file_path: '.context/plan.md', content: '计划' }
    await expect(fixture.canUseTool('Write', writeMarkdownInput, createToolOptions())).resolves.toEqual({
      behavior: 'allow',
      updatedInput: writeMarkdownInput,
    })

    const writeProjectMarkdownResult = await fixture.canUseTool(
      'Write',
      { file_path: 'AGENTS.md', content: '覆盖规则' },
      createToolOptions(),
    )
    expect(writeProjectMarkdownResult.behavior).toBe('deny')

    const editSourceInput = {
      file_path: '/tmp/source.ts',
      old_string: 'old',
      new_string: 'new',
    }
    const editSourceResult = await fixture.canUseTool('Edit', editSourceInput, createToolOptions())
    expect(editSourceResult.behavior).toBe('deny')

    const readOnlyBashInput = { command: 'git status 2>/dev/null' }
    await expect(fixture.canUseTool('Bash', readOnlyBashInput, createToolOptions())).resolves.toEqual({
      behavior: 'allow',
      updatedInput: readOnlyBashInput,
    })

    const writeBashResult = await fixture.canUseTool('Bash', { command: 'git commit -m test' }, createToolOptions())
    expect(writeBashResult.behavior).toBe('deny')

    const mcpResult = await fixture.canUseTool('mcp__docs__search', { query: '资料' }, createToolOptions())
    expect(mcpResult.behavior).toBe('deny')
  })

  test('EnterPlanMode 会切入 plan 权限策略', async () => {
    const fixture = createFixture('auto')

    await expect(fixture.canUseTool('EnterPlanMode', {}, createToolOptions())).resolves.toEqual({
      behavior: 'allow',
      updatedInput: {},
    })

    expect(fixture.currentMode()).toBe('plan')
    expect(fixture.modeUpdates).toEqual(['plan'])
    expect(fixture.syncedModes).toEqual(['plan'])
    expect(fixture.dispatcher.isPlanModeEntered()).toBe(true)

    const writeMarkdownInput = { file_path: '.context/plan.md', content: '计划' }
    await expect(fixture.canUseTool('Write', writeMarkdownInput, createToolOptions())).resolves.toEqual({
      behavior: 'allow',
      updatedInput: writeMarkdownInput,
    })
    expect((await fixture.canUseTool('Bash', { command: 'git commit -m test' }, createToolOptions())).behavior).toBe('deny')
    expect((await fixture.canUseTool('mcp__docs__search', { query: '资料' }, createToolOptions())).behavior).toBe('deny')
    expect(fixture.autoCalls).toHaveLength(0)
  })

  test('ExitPlanMode 仅在已进入计划模式后走审批，并同步目标权限模式', async () => {
    const exitCalls: SignalCall[] = []
    const fixture = createFixture('auto', {
      exitPlanMode: async (input, signal) => {
        exitCalls.push({ input, signal })
        return { behavior: 'allow' as const, updatedInput: input, targetMode: 'bypassPermissions' }
      },
    })

    const exitBeforePlanInput = { allowedPrompts: [] }
    await expect(fixture.canUseTool('ExitPlanMode', exitBeforePlanInput, createToolOptions())).resolves.toEqual({
      behavior: 'allow',
      updatedInput: exitBeforePlanInput,
    })
    expect(exitCalls).toHaveLength(0)

    await expect(fixture.canUseTool('EnterPlanMode', {}, createToolOptions())).resolves.toEqual({
      behavior: 'allow',
      updatedInput: {},
    })
    expect(fixture.enterPlanEvents()).toBe(1)
    expect(fixture.dispatcher.isPlanModeEntered()).toBe(true)
    expect(fixture.modeUpdates).toEqual(['plan'])
    expect(fixture.syncedModes).toEqual(['plan'])

    const exitAfterPlanInput = { allowedPrompts: [{ tool: 'Bash', prompt: 'bun test' }] }
    const exitOptions = createToolOptions()
    const exitAfterPlanResult = await fixture.canUseTool('ExitPlanMode', exitAfterPlanInput, exitOptions)
    expect(exitAfterPlanResult).toMatchObject({
      behavior: 'allow',
      updatedInput: exitAfterPlanInput,
    })
    expect((exitAfterPlanResult as ExitPlanPermissionResult)).toMatchObject({
      targetMode: 'bypassPermissions',
    })

    expect(exitCalls).toEqual([{ input: exitAfterPlanInput, signal: exitOptions.signal }])
    expect(fixture.modeUpdates).toEqual(['plan', 'bypassPermissions'])
    expect(fixture.syncedModes).toEqual(['plan', 'bypassPermissions'])
    expect(fixture.currentMode()).toBe('bypassPermissions')
    expect(fixture.dispatcher.isPlanModeEntered()).toBe(false)
  })

  test('ExitPlanMode 拒绝时保留计划状态且不切换权限模式', async () => {
    const fixture = createFixture('plan', {
      exitPlanMode: async (input) => ({
        behavior: 'deny' as const,
        message: typeof input.feedback === 'string' ? input.feedback : '用户要求修改计划',
      }),
    })

    const result = await fixture.canUseTool(
      'ExitPlanMode',
      { feedback: '请补充测试计划' },
      createToolOptions(),
    )

    expect(result).toEqual({
      behavior: 'deny',
      message: '请补充测试计划',
    })
    expect(fixture.modeUpdates).toEqual([])
    expect(fixture.syncedModes).toEqual([])
    expect(fixture.currentMode()).toBe('plan')
    expect(fixture.dispatcher.isPlanModeEntered()).toBe(true)
  })

  test('运行中同步到 plan 模式后 ExitPlanMode 走审批流程', async () => {
    const exitCalls: SignalCall[] = []
    const fixture = createFixture('auto', {
      exitPlanMode: async (input, signal) => {
        exitCalls.push({ input, signal })
        return { behavior: 'deny' as const, message: '需要继续完善计划' }
      },
    })
    fixture.dispatcher.syncPlanModeState('plan')

    const input = { allowedPrompts: [{ tool: 'Bash', prompt: 'bun test' }] }
    const options = createToolOptions()
    const result = await fixture.canUseTool('ExitPlanMode', input, options)

    expect(result).toEqual({
      behavior: 'deny',
      message: '需要继续完善计划',
    })
    expect(exitCalls).toEqual([{ input, signal: options.signal }])
    expect(fixture.dispatcher.isPlanModeEntered()).toBe(true)
  })

  test('运行中同步离开 plan 模式后 ExitPlanMode 不再保留计划状态', async () => {
    const fixture = createFixture('plan')
    fixture.dispatcher.syncPlanModeState('auto')

    await expect(fixture.canUseTool('ExitPlanMode', {}, createToolOptions())).resolves.toEqual({
      behavior: 'allow',
      updatedInput: {},
    })
    expect(fixture.exitCalls).toEqual([])
    expect(fixture.dispatcher.isPlanModeEntered()).toBe(false)
  })

  test('auto 模式委托 autoCanUseTool 并透传工具调用上下文', async () => {
    const autoCalls: ToolCall[] = []
    const fixture = createFixture('auto', {
      autoCanUseTool: async (toolName, input, options) => {
        autoCalls.push({ toolName, input, options })
        return { behavior: 'deny' as const, message: '需要审批' }
      },
    })
    const input = { command: 'npm install' }
    const options = createToolOptions({ agentID: 'worker-1' })

    await expect(fixture.canUseTool('Bash', input, options)).resolves.toEqual({
      behavior: 'deny',
      message: '需要审批',
    })
    expect(autoCalls).toEqual([{ toolName: 'Bash', input, options }])
  })

  test('Write 超大内容在所有模式下优先拒绝并提示分块写入', async () => {
    const fixture = createFixture('bypassPermissions')
    const result = await fixture.canUseTool(
      'Write',
      { file_path: '/tmp/large.txt', content: 'x'.repeat(70_000) },
      createToolOptions(),
    )

    expect(result.behavior).toBe('deny')
    if (result.behavior === 'deny') {
      expect(result.message).toContain('split the write into smaller sequential steps')
    }
  })

  test('isBashCommandReadOnly 覆盖只读与写操作边界', () => {
    expect(isBashCommandReadOnly('git status')).toBe(true)
    expect(isBashCommandReadOnly('cat file 2>/dev/null')).toBe(true)
    expect(isBashCommandReadOnly('cat file 2> /dev/null')).toBe(true)
    expect(isBashCommandReadOnly('find . -maxdepth 2 -type f')).toBe(true)
    expect(isBashCommandReadOnly('git commit -m test')).toBe(false)
    expect(isBashCommandReadOnly('git checkout -- package.json')).toBe(false)
    expect(isBashCommandReadOnly('git diff')).toBe(false)
    expect(isBashCommandReadOnly('git log')).toBe(false)
    expect(isBashCommandReadOnly('git show HEAD')).toBe(false)
    expect(isBashCommandReadOnly('git grep -Otouch needle .')).toBe(false)
    expect(isBashCommandReadOnly('git grep --open-files-in-pager=rm import')).toBe(false)
    expect(isBashCommandReadOnly('git diff --textconv')).toBe(false)
    expect(isBashCommandReadOnly('echo ok > result.txt')).toBe(false)
    expect(isBashCommandReadOnly('ls\nrm -rf /tmp/x')).toBe(false)
    expect(isBashCommandReadOnly('ls\rrm -rf /tmp/x')).toBe(false)
    expect(isBashCommandReadOnly('ls\n2>/dev/null')).toBe(false)
    expect(isBashCommandReadOnly('cat input | tee output.txt')).toBe(false)
    expect(isBashCommandReadOnly('rg * needle .')).toBe(false)
    expect(isBashCommandReadOnly('rg $x--pre=touch needle .')).toBe(false)
    expect(isBashCommandReadOnly('find * -maxdepth 1')).toBe(false)
    expect(isBashCommandReadOnly('find . $x-delete')).toBe(false)
    expect(isBashCommandReadOnly('rg {--pre=touch,needle} .')).toBe(false)
    expect(isBashCommandReadOnly('python -c \'open("x","w").write("1")\'')).toBe(false)
    expect(isBashCommandReadOnly('curl -o out.txt https://example.com')).toBe(false)
    expect(isBashCommandReadOnly('find . -delete')).toBe(false)
    expect(isBashCommandReadOnly('find . -exec rm {} ;')).toBe(false)
    expect(isBashCommandReadOnly('find . -fprint0 /tmp/plan-bypass')).toBe(false)
    expect(isBashCommandReadOnly("rg --pre 'touch /tmp/plan-bypass' needle .")).toBe(false)
    expect(isBashCommandReadOnly("rg '--pre' 'touch /tmp/plan-bypass' needle .")).toBe(false)
    expect(isBashCommandReadOnly('rg "--pre" touch needle .')).toBe(false)
    expect(isBashCommandReadOnly('rg "--pre-glob=*.md" needle .')).toBe(false)
    expect(isBashCommandReadOnly("find . '-fprint0' /tmp/plan-bypass")).toBe(false)
    expect(isBashCommandReadOnly('find . "-delete"')).toBe(false)
    expect(isBashCommandReadOnly('git diff "--output=/tmp/plan-bypass"')).toBe(false)
    expect(isBashCommandReadOnly('rg --pre\\=touch needle .')).toBe(false)
    expect(isBashCommandReadOnly('cat file 2>/dev/null.foo')).toBe(false)
  })

  test('isPlanMarkdownPathAllowed 只允许 .context 内的 Markdown 计划文件', () => {
    expect(isPlanMarkdownPathAllowed('.context/plan.md', TEST_AGENT_CWD)).toBe(true)
    expect(isPlanMarkdownPathAllowed(resolve(TEST_AGENT_CWD, '.context', 'plan.md'), TEST_AGENT_CWD)).toBe(true)
    expect(isPlanMarkdownPathAllowed('.context/..draft.md', TEST_AGENT_CWD)).toBe(true)
    expect(isPlanMarkdownPathAllowed(' .context/plan.md', TEST_AGENT_CWD)).toBe(false)
    expect(isPlanMarkdownPathAllowed('.context/plan.md ', TEST_AGENT_CWD)).toBe(false)
    expect(isPlanMarkdownPathAllowed('.context/plan.md\n', TEST_AGENT_CWD)).toBe(false)
    expect(isPlanMarkdownPathAllowed('AGENTS.md', TEST_AGENT_CWD)).toBe(false)
    expect(isPlanMarkdownPathAllowed('README.md', TEST_AGENT_CWD)).toBe(false)
    expect(isPlanMarkdownPathAllowed('.context/../AGENTS.md', TEST_AGENT_CWD)).toBe(false)
    expect(isPlanMarkdownPathAllowed('.context/plan.txt', TEST_AGENT_CWD)).toBe(false)
  })

  test('isPlanMarkdownPathAllowed 拒绝 .context 内 symlink 逃逸', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'codeinsights-permission-'))
    try {
      const agentCwd = resolve(tempRoot, 'session')
      const planDir = resolve(agentCwd, '.context')
      const outsideDir = resolve(tempRoot, 'outside')
      mkdirSync(planDir, { recursive: true })
      mkdirSync(outsideDir, { recursive: true })
      writeFileSync(resolve(outsideDir, 'README.md'), 'outside')
      symlinkSync(outsideDir, resolve(planDir, 'link'), 'dir')

      expect(isPlanMarkdownPathAllowed('.context/link/README.md', agentCwd)).toBe(false)
      expect(isPlanMarkdownPathAllowed('.context/link/../escape.md', agentCwd)).toBe(false)
      expect(isPlanMarkdownPathAllowed(resolve(planDir, 'link', 'README.md'), agentCwd)).toBe(false)
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  test('isPlanMarkdownPathAllowed 拒绝 .context 内 broken symlink 文件逃逸', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'codeinsights-permission-'))
    try {
      const agentCwd = resolve(tempRoot, 'session')
      const planDir = resolve(agentCwd, '.context')
      const outsideDir = resolve(tempRoot, 'outside')
      mkdirSync(planDir, { recursive: true })
      mkdirSync(outsideDir, { recursive: true })
      symlinkSync(resolve(outsideDir, 'created-outside.txt'), resolve(planDir, 'link.md'))

      expect(isPlanMarkdownPathAllowed('.context/link.md', agentCwd)).toBe(false)
      expect(isPlanMarkdownPathAllowed(resolve(planDir, 'link.md'), agentCwd)).toBe(false)
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  test('isPlanMarkdownPathAllowed 拒绝 .context 内 hardlink 文件逃逸', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'codeinsights-permission-'))
    try {
      const agentCwd = resolve(tempRoot, 'session')
      const planDir = resolve(agentCwd, '.context')
      const outsideFile = resolve(tempRoot, 'outside.md')
      const linkedFile = resolve(planDir, 'linked.md')
      mkdirSync(planDir, { recursive: true })
      writeFileSync(outsideFile, 'outside')
      linkSync(outsideFile, linkedFile)

      expect(isPlanMarkdownPathAllowed('.context/linked.md', agentCwd)).toBe(false)
      expect(isPlanMarkdownPathAllowed(linkedFile, agentCwd)).toBe(false)
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})

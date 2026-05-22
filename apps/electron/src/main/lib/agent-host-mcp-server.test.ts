import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentRuntimeManifest } from '@codeinsights/shared'
import {
  AGENT_HOST_BRIDGE_TOOLS,
  handleListWorkspaceFiles,
  handleMemoryAppend,
  handleMemorySearch,
  handleOpenFile,
  handleScheduleTask,
  handleSendChannelMessage,
  handleWorkspaceSearch,
} from './agent-host-mcp-server'

let tempDir = ''
let previousConfigDir: string | undefined

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'codeinsights-host-mcp-'))
  previousConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
  process.env.CODEINSIGHTS_CONFIG_DIR = join(tempDir, 'config')
  mkdirSync(process.env.CODEINSIGHTS_CONFIG_DIR, { recursive: true })
})

afterEach(() => {
  if (previousConfigDir === undefined) {
    delete process.env.CODEINSIGHTS_CONFIG_DIR
  } else {
    process.env.CODEINSIGHTS_CONFIG_DIR = previousConfigDir
  }
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

describe('agent host MCP bridge handlers', () => {
  test('声明稳定的内置工具列表', () => {
    expect(AGENT_HOST_BRIDGE_TOOLS).toEqual([
      'codeinsights_workspace_search',
      'codeinsights_list_workspace_files',
      'codeinsights_memory_search',
      'codeinsights_open_file',
      'codeinsights_memory_append',
      'codeinsights_send_channel_message',
      'codeinsights_schedule_task',
    ])
  })

  test('搜索和打开文件只读取 manifest 允许范围内的文本文件', async () => {
    const manifest = createManifest()
    mkdirSync(manifest.defaultCwd, { recursive: true })
    mkdirSync(manifest.sessionCwd!, { recursive: true })
    writeFileSync(join(manifest.defaultCwd, 'notes.md'), 'alpha\nneedle in workspace\n')
    writeFileSync(join(manifest.sessionCwd!, 'todo.txt'), 'session needle\n')

    const searchResult = await handleWorkspaceSearch({ manifest }, { query: 'needle', root: 'workspace' })
    expect(searchResult.isError).toBeUndefined()
    expect(searchResult.content[0]?.text).toContain('workspace/notes.md:2')

    const openResult = await handleOpenFile({ manifest }, { path: 'session/todo.txt' })
    expect(openResult.isError).toBeUndefined()
    expect(openResult.content[0]?.text).toBe('session needle\n')
  })

  test('拒绝读取允许范围外路径和符号链接逃逸', async () => {
    const manifest = createManifest()
    mkdirSync(manifest.defaultCwd, { recursive: true })
    const outsideFile = join(tempDir, 'outside.txt')
    writeFileSync(outsideFile, 'secret\n')
    symlinkSync(outsideFile, join(manifest.defaultCwd, 'link.txt'))

    const outsideResult = await handleOpenFile({ manifest }, { path: outsideFile })
    expect(outsideResult.isError).toBe(true)
    expect(outsideResult.content[0]?.text).toContain('允许的运行时范围')

    const symlinkResult = await handleOpenFile({ manifest }, { path: 'workspace/link.txt' })
    expect(symlinkResult.isError).toBe(true)
    expect(symlinkResult.content[0]?.text).toContain('允许的运行时范围')
  })

  test('列出文件时限制深度并忽略重目录', async () => {
    const manifest = createManifest()
    mkdirSync(join(manifest.defaultCwd, 'src', 'deep'), { recursive: true })
    mkdirSync(join(manifest.defaultCwd, 'node_modules', 'pkg'), { recursive: true })
    writeFileSync(join(manifest.defaultCwd, 'src', 'index.ts'), 'export {}\n')
    writeFileSync(join(manifest.defaultCwd, 'src', 'deep', 'hidden.ts'), 'hidden\n')
    writeFileSync(join(manifest.defaultCwd, 'node_modules', 'pkg', 'index.js'), 'ignored\n')

    const result = await handleListWorkspaceFiles({ manifest }, { root: 'workspace', maxDepth: 1 })
    expect(result.content[0]?.text).toContain('dir workspace/src')
    expect(result.content[0]?.text).toContain('file workspace/src/index.ts')
    expect(result.content[0]?.text).not.toContain('hidden.ts')
    expect(result.content[0]?.text).not.toContain('node_modules')
  })

  test('记忆未启用时返回保守错误，不发起外部请求', async () => {
    const manifest = createManifest()
    writeFileSync(join(process.env.CODEINSIGHTS_CONFIG_DIR!, 'memory.json'), JSON.stringify({
      enabled: false,
      apiKey: '',
      userId: '',
    }))

    const result = await handleMemorySearch({ manifest }, { query: 'anything' })
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('记忆服务未启用')
  })

  test('记忆启用时通过注入依赖执行 search 和 append', async () => {
    const manifest = createManifest()
    writeFileSync(join(process.env.CODEINSIGHTS_CONFIG_DIR!, 'memory.json'), JSON.stringify({
      enabled: true,
      apiKey: 'test-key',
      userId: 'user-1',
    }))

    const searchResult = await handleMemorySearch({
      manifest,
      dependencies: {
        memorySearch: async (_credentials, query) => ({
          facts: [{ id: '1', text: `fact:${query}` }],
          preferences: [],
        }),
      },
    }, { query: 'needle' })
    expect(searchResult.content[0]?.text).toContain('fact:needle')

    let appended = false
    const appendResult = await handleMemoryAppend({
      manifest,
      dependencies: {
        memoryAppend: async () => {
          appended = true
        },
      },
    }, { userMessage: 'remember this' })
    expect(appended).toBe(true)
    expect(appendResult.content[0]?.text).toContain('Memory stored')
  })

  test('channel 发送和定时任务默认不可用，注入 adapter 后才执行', async () => {
    const manifest = createManifest()
    const context = { manifest }

    expect((await handleSendChannelMessage(context, {
      channel: 'feishu',
      target: 'chat-1',
      message: 'hello',
    })).isError).toBe(true)
    expect((await handleScheduleTask(context, {
      title: 'follow-up',
      prompt: 'check later',
    })).isError).toBe(true)

    const enabledContext = {
      manifest,
      dependencies: {
        channelSender: async () => 'sent',
        taskScheduler: async () => 'scheduled',
      },
    }
    expect((await handleSendChannelMessage(enabledContext, {
      channel: 'feishu',
      target: 'chat-1',
      message: 'hello',
    })).content[0]?.text).toBe('sent')
    expect((await handleScheduleTask(enabledContext, {
      title: 'follow-up',
      prompt: 'check later',
    })).content[0]?.text).toBe('scheduled')
  })
})

function createManifest(): AgentRuntimeManifest {
  const workspaceRoot = join(tempDir, 'workspace')
  const runtimeRoot = join(workspaceRoot, 'runtime')
  const defaultCwd = join(workspaceRoot, 'workspace-files')
  const sessionCwd = join(workspaceRoot, 'sessions', 'session-1', 'cwd')
  mkdirSync(workspaceRoot, { recursive: true })
  if (!existsSync(defaultCwd)) mkdirSync(defaultCwd, { recursive: true })
  if (!existsSync(sessionCwd)) mkdirSync(sessionCwd, { recursive: true })

  return {
    manifestVersion: 1,
    materializerVersion: 'test',
    workspaceId: 'workspace-1',
    workspaceSlug: 'workspace',
    sessionId: 'session-1',
    workspaceRoot,
    runtimeRoot,
    claudeConfigDir: join(runtimeRoot, '.claude'),
    defaultCwd,
    sessionCwd,
    mcpConfigPath: join(runtimeRoot, 'mcp.json'),
    settingsPath: join(runtimeRoot, '.claude', 'settings.json'),
    claudeMdPath: join(runtimeRoot, 'CLAUDE.md'),
    skillsDir: join(runtimeRoot, '.claude', 'skills'),
    pluginsDir: join(runtimeRoot, '.claude', 'plugins'),
    sessionRuntimeManifestPath: join(workspaceRoot, 'sessions', 'session-1', 'runtime-manifest.json'),
    settingsHash: 'sha256:test',
    mcpHash: 'sha256:test',
    skillsSnapshotHash: 'sha256:test',
    pluginsSnapshotHash: 'sha256:test',
    runtimeHash: 'sha256:test',
    enabledMcpServers: [],
    enabledSkills: [],
    enabledPlugins: [],
    additionalDirectories: [],
    hostBridge: {
      enabled: true,
      tools: [...AGENT_HOST_BRIDGE_TOOLS],
    },
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-18T00:00:00.000Z',
    generatedAt: '2026-05-18T00:00:00.000Z',
    sourceConfigHash: 'sha256:test',
  }
}

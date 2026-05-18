import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { AgentWorkspace } from '@rv-insights/shared'
import { buildAgentRuntimeManifest } from './agent-runtime-manifest-registry'

let tempDir = ''

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rv-runtime-manifest-'))
})

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

describe('buildAgentRuntimeManifest', () => {
  test('只读解析旧 workspace MCP、Skill、plugin 和附加目录', () => {
    const workspace = createWorkspace('default')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    mkdirSync(join(workspaceRoot, 'skills', 'review-skill'), { recursive: true })
    mkdirSync(join(workspaceRoot, '.claude-plugin'), { recursive: true })
    mkdirSync(join(workspaceRoot, 'workspace-files'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'skills', 'review-skill', 'SKILL.md'), [
      '---',
      'name: Review Skill',
      'version: 1.0.0',
      '---',
      '检查代码。',
      '',
    ].join('\n'))
    writeFileSync(join(workspaceRoot, 'mcp.json'), JSON.stringify({
      servers: {
        filesystem: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          enabled: true,
        },
      },
    }, null, 2))
    writeFileSync(join(workspaceRoot, '.claude-plugin', 'plugin.json'), JSON.stringify({
      name: 'rv-insights-workspace-default',
      version: '1.0.0',
    }, null, 2))
    writeFileSync(join(workspaceRoot, 'config.json'), JSON.stringify({
      permissionMode: 'auto',
      attachedDirectories: ['/Users/zq/Desktop/reference'],
    }, null, 2))

    const manifest = buildAgentRuntimeManifest({
      workspace,
      sessionId: 'session-1',
      workspacesRoot: tempDir,
      generatedAt: '2026-05-18T00:00:00.000Z',
    })

    expect(manifest.manifestVersion).toBe(1)
    expect(manifest.workspaceId).toBe('workspace-default')
    expect(manifest.workspaceSlug).toBe('default')
    expect(manifest.defaultCwd).toBe(join(workspaceRoot, 'workspace-files'))
    expect(manifest.sessionCwd).toBe(join(workspaceRoot, 'sessions', 'session-1', 'cwd'))
    expect(manifest.mcpConfigPath).toBe(join(workspaceRoot, 'runtime', 'mcp.json'))
    expect(manifest.enabledMcpServers).toEqual([{
      id: 'filesystem',
      scope: 'workspace',
      enabled: true,
      type: 'stdio',
      hash: expect.stringMatching(/^sha256:/),
    }])
    expect(manifest.enabledSkills).toEqual([{
      id: 'review-skill',
      sourcePath: join(workspaceRoot, 'skills', 'review-skill'),
      snapshotPath: join(workspaceRoot, 'runtime', '.claude', 'skills', 'review-skill'),
      materializeMode: 'readonly-source',
      enabled: true,
      hash: expect.stringMatching(/^sha256:/),
    }])
    expect(manifest.enabledPlugins).toEqual([{
      id: 'rv-insights-workspace-default',
      sourcePath: join(workspaceRoot, '.claude-plugin', 'plugin.json'),
      snapshotPath: join(workspaceRoot, 'runtime', '.claude', 'plugins', 'rv-insights-workspace-default', 'plugin.json'),
      hash: expect.stringMatching(/^sha256:/),
    }])
    expect(manifest.additionalDirectories).toEqual([{ path: '/Users/zq/Desktop/reference', mode: 'read' }])
    expect(manifest.sourceConfigHash).toMatch(/^sha256:/)
    expect(manifest.runtimeHash).toMatch(/^sha256:/)
  })

  test('缺失旧配置时生成空能力快照', () => {
    const workspace = createWorkspace('empty')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)

    const manifest = buildAgentRuntimeManifest({
      workspace,
      workspacesRoot: tempDir,
      generatedAt: '2026-05-18T00:00:00.000Z',
    })

    expect(manifest.workspaceRoot).toBe(workspaceRoot)
    expect(manifest.enabledMcpServers).toEqual([])
    expect(manifest.enabledSkills).toEqual([])
    expect(manifest.enabledPlugins).toEqual([])
    expect(manifest.additionalDirectories).toEqual([])
  })

  test('相同源配置生成稳定 hash', () => {
    const workspace = createWorkspace('stable')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    mkdirSync(join(workspaceRoot, 'skills', 'a'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'skills', 'a', 'SKILL.md'), '---\nname: A\n---\nA\n')

    const first = buildAgentRuntimeManifest({ workspace, workspacesRoot: tempDir, generatedAt: '2026-05-18T00:00:00.000Z' })
    const second = buildAgentRuntimeManifest({ workspace, workspacesRoot: tempDir, generatedAt: '2026-05-18T01:00:00.000Z' })

    expect(second.sourceConfigHash).toBe(first.sourceConfigHash)
    expect(second.runtimeHash).toBe(first.runtimeHash)
  })

  test('旧 skills-inactive 参与 source hash 但不进入 enabledSkills', () => {
    const workspace = createWorkspace('inactive')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    mkdirSync(join(workspaceRoot, 'skills-inactive', 'disabled'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'skills-inactive', 'disabled', 'SKILL.md'), '---\nname: Disabled\n---\nold\n')

    const first = buildAgentRuntimeManifest({ workspace, workspacesRoot: tempDir })
    writeFileSync(join(workspaceRoot, 'skills-inactive', 'disabled', 'SKILL.md'), '---\nname: Disabled\n---\nnew\n')
    const second = buildAgentRuntimeManifest({ workspace, workspacesRoot: tempDir })

    expect(first.enabledSkills).toEqual([])
    expect(second.enabledSkills).toEqual([])
    expect(second.sourceConfigHash).not.toBe(first.sourceConfigHash)
  })

  test('拒绝解析 workspace 内的符号链接 Skill', () => {
    const workspace = createWorkspace('unsafe')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    const outsideDir = join(tempDir, 'outside')
    mkdirSync(outsideDir)
    writeFileSync(join(outsideDir, 'SKILL.md'), '---\nname: Unsafe\n---\n')
    mkdirSync(join(workspaceRoot, 'skills'), { recursive: true })
    symlinkSync(outsideDir, join(workspaceRoot, 'skills', 'unsafe-skill'))

    expect(() => buildAgentRuntimeManifest({ workspace, workspacesRoot: tempDir })).toThrow('符号链接')
  })

  test('拒绝 workspace slug 路径穿越', () => {
    const workspace = createWorkspace('../../outside')
    mkdirSync(join(tempDir, '..', 'outside'), { recursive: true })

    expect(() => buildAgentRuntimeManifest({ workspace, workspacesRoot: tempDir })).toThrow('非法 workspace slug')
  })

  test('清理 plugin manifest name 后再生成 snapshot path', () => {
    const workspace = createWorkspace('plugin-safe')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    mkdirSync(join(workspaceRoot, '.claude-plugin'), { recursive: true })
    writeFileSync(join(workspaceRoot, '.claude-plugin', 'plugin.json'), JSON.stringify({
      name: '../unsafe plugin',
      version: '1.0.0',
    }, null, 2))

    const manifest = buildAgentRuntimeManifest({ workspace, workspacesRoot: tempDir })

    expect(manifest.enabledPlugins[0]?.id).toBe('-unsafe-plugin')
    expect(manifest.enabledPlugins[0]?.snapshotPath).toBe(join(workspaceRoot, 'runtime', '.claude', 'plugins', '-unsafe-plugin', 'plugin.json'))
  })

  test('拒绝 mcp/config/plugin 入口符号链接', () => {
    const workspace = createWorkspace('symlink-files')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    const outsideFile = join(tempDir, 'outside-mcp.json')
    writeFileSync(outsideFile, JSON.stringify({ servers: {} }))
    symlinkSync(outsideFile, join(workspaceRoot, 'mcp.json'))

    expect(() => buildAgentRuntimeManifest({ workspace, workspacesRoot: tempDir })).toThrow('符号链接')
  })

  test('拒绝 nested skill 和 skills-inactive 中的符号链接', () => {
    const workspace = createWorkspace('nested-symlink')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    mkdirSync(join(workspaceRoot, 'skills', 'nested'), { recursive: true })
    mkdirSync(join(workspaceRoot, 'skills-inactive', 'disabled'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'skills', 'nested', 'SKILL.md'), '---\nname: Nested\n---\n')
    writeFileSync(join(workspaceRoot, 'skills-inactive', 'disabled', 'SKILL.md'), '---\nname: Disabled\n---\n')
    symlinkSync(tempDir, join(workspaceRoot, 'skills', 'nested', 'link'))

    expect(() => buildAgentRuntimeManifest({ workspace, workspacesRoot: tempDir })).toThrow('符号链接')

    rmSync(join(workspaceRoot, 'skills', 'nested', 'link'))
    symlinkSync(tempDir, join(workspaceRoot, 'skills-inactive', 'disabled', 'link'))

    expect(() => buildAgentRuntimeManifest({ workspace, workspacesRoot: tempDir })).toThrow('符号链接')
  })
})

function createWorkspace(slug: string): AgentWorkspace {
  return {
    id: `workspace-${slug}`,
    name: `Workspace ${slug}`,
    slug,
    createdAt: Date.UTC(2026, 4, 18),
    updatedAt: Date.UTC(2026, 4, 18, 1),
  }
}

function createWorkspaceFiles(slug: string): string {
  const workspaceRoot = join(tempDir, slug)
  mkdirSync(workspaceRoot, { recursive: true })
  return workspaceRoot
}

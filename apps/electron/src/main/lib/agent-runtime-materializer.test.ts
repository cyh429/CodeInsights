import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentWorkspace } from '@codeinsights/shared'
import {
  AgentRuntimeMaterializationError,
  hasMaterializedAgentRuntime,
  materializeAgentRuntimeForNewSession,
  readMaterializedAgentRuntime,
} from './agent-runtime-materializer'

let tempDir = ''

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'codeinsights-runtime-materializer-'))
})

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

describe('materializeAgentRuntimeForNewSession', () => {
  test('为新 session 写入 runtime、session cwd、snapshot 和 manifest', () => {
    const workspace = createWorkspace('default')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    mkdirSync(join(workspaceRoot, 'workspace-files'), { recursive: true })
    mkdirSync(join(workspaceRoot, 'skills', 'review-skill'), { recursive: true })
    mkdirSync(join(workspaceRoot, '.claude-plugin'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'skills', 'review-skill', 'SKILL.md'), '---\nname: Review\n---\n检查代码。\n')
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
      name: 'codeinsights-workspace-default',
      version: '1.0.0',
    }, null, 2))

    const manifest = materializeAgentRuntimeForNewSession({
      workspace,
      sessionId: 'session-1',
      workspacesRoot: tempDir,
      generatedAt: '2026-05-18T00:00:00.000Z',
    })

    expect(manifest.sessionCwd).toBe(join(workspaceRoot, 'sessions', 'session-1', 'cwd'))
    expect(existsSync(join(workspaceRoot, 'runtime', '.claude', 'settings.json'))).toBe(true)
    expect(existsSync(join(workspaceRoot, 'runtime', 'mcp.json'))).toBe(true)
    expect(existsSync(join(workspaceRoot, 'runtime', '.claude', 'codeinsights-host-bridge.json'))).toBe(true)
    expect(existsSync(join(workspaceRoot, 'runtime', 'CLAUDE.md'))).toBe(true)
    expect(existsSync(join(workspaceRoot, 'runtime', '.claude', 'skills', 'review-skill', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(workspaceRoot, 'runtime', '.claude', 'plugins', 'codeinsights-workspace-default', 'plugin.json'))).toBe(true)
    expect(existsSync(join(workspaceRoot, 'sessions', 'session-1', 'cwd', '.context'))).toBe(true)
    expect(JSON.parse(readFileSync(join(workspaceRoot, 'sessions', 'session-1', 'runtime-manifest.json'), 'utf-8'))).toMatchObject({
      manifestVersion: 1,
      workspaceSlug: 'default',
      sessionId: 'session-1',
      sessionCwd: join(workspaceRoot, 'sessions', 'session-1', 'cwd'),
    })
    expect(JSON.parse(readFileSync(join(workspaceRoot, 'runtime', '.claude', 'settings.json'), 'utf-8'))).toMatchObject({
      enabledPlugins: [{
        type: 'local',
        path: join(workspaceRoot, 'runtime', '.claude', 'plugins', 'codeinsights-workspace-default'),
      }],
      plansDirectory: '.context',
      skipWebFetchPreflight: true,
    })
    expect(JSON.parse(readFileSync(join(workspaceRoot, 'sessions', 'session-1', 'cwd', '.claude', 'settings.json'), 'utf-8'))).toMatchObject({
      plansDirectory: '.context',
      skipWebFetchPreflight: true,
    })
    expect(JSON.parse(readFileSync(join(workspaceRoot, 'runtime', 'mcp.json'), 'utf-8'))).toMatchObject({
      servers: {
        filesystem: {
          enabled: true,
        },
      },
    })
    expect(JSON.parse(readFileSync(join(workspaceRoot, 'runtime', '.claude', 'codeinsights-host-bridge.json'), 'utf-8'))).toMatchObject({
      enabled: true,
      serverName: 'codeinsights_host',
      version: expect.any(String),
      tools: [
        'codeinsights_workspace_search',
        'codeinsights_list_workspace_files',
        'codeinsights_memory_search',
        'codeinsights_open_file',
      ],
    })
  })

  test('settings 白名单字段冲突时写冲突文件并阻断 materialize', () => {
    const workspace = createWorkspace('conflict')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    mkdirSync(join(workspaceRoot, 'runtime', '.claude'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'runtime', '.claude', 'settings.json'), JSON.stringify({
      plansDirectory: 'custom-plans',
      userCustomKey: true,
    }, null, 2))

    expect(() => materializeAgentRuntimeForNewSession({
      workspace,
      sessionId: 'session-1',
      workspacesRoot: tempDir,
    })).toThrow(AgentRuntimeMaterializationError)

    const conflictsPath = join(workspaceRoot, 'runtime', '.claude', '.codeinsights-conflicts.json')
    expect(existsSync(conflictsPath)).toBe(true)
    expect(JSON.parse(readFileSync(conflictsPath, 'utf-8'))).toMatchObject({
      settingsPath: join(workspaceRoot, 'runtime', '.claude', 'settings.json'),
      conflicts: [{ key: 'plansDirectory', existing: 'custom-plans', desired: '.context' }],
    })
    expect(existsSync(join(workspaceRoot, 'sessions', 'session-1', 'runtime-manifest.json'))).toBe(false)
  })

  test('session cwd project settings 冲突时写冲突文件并阻断 materialize', () => {
    const workspace = createWorkspace('project-conflict')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    mkdirSync(join(workspaceRoot, 'sessions', 'session-1', 'cwd', '.claude'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'sessions', 'session-1', 'cwd', '.claude', 'settings.json'), JSON.stringify({
      skipWebFetchPreflight: false,
    }, null, 2))

    expect(() => materializeAgentRuntimeForNewSession({
      workspace,
      sessionId: 'session-1',
      workspacesRoot: tempDir,
    })).toThrow(AgentRuntimeMaterializationError)

    const conflictsPath = join(workspaceRoot, 'sessions', 'session-1', 'cwd', '.claude', '.codeinsights-conflicts.json')
    expect(JSON.parse(readFileSync(conflictsPath, 'utf-8'))).toMatchObject({
      settingsPath: join(workspaceRoot, 'sessions', 'session-1', 'cwd', '.claude', 'settings.json'),
      conflicts: [{ key: 'skipWebFetchPreflight', existing: false, desired: true }],
    })
  })

  test('拒绝 runtime 写入目标符号链接', () => {
    const workspace = createWorkspace('unsafe')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    mkdirSync(join(workspaceRoot, 'runtime', '.claude'), { recursive: true })
    const outsideFile = join(tempDir, 'outside-settings.json')
    writeFileSync(outsideFile, '{}')
    symlinkSync(outsideFile, join(workspaceRoot, 'runtime', '.claude', 'settings.json'))

    expect(() => materializeAgentRuntimeForNewSession({
      workspace,
      sessionId: 'session-1',
      workspacesRoot: tempDir,
    })).toThrow('符号链接')
  })

  test('旧 session cwd 不因新 session materialize 被迁移或删除', () => {
    const workspace = createWorkspace('legacy')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    const legacyCwd = join(workspaceRoot, 'legacy-session')
    mkdirSync(legacyCwd, { recursive: true })
    writeFileSync(join(legacyCwd, 'note.md'), 'legacy cwd\n')

    materializeAgentRuntimeForNewSession({
      workspace,
      sessionId: 'new-session',
      workspacesRoot: tempDir,
    })

    expect(existsSync(join(workspaceRoot, 'sessions', 'new-session', 'cwd'))).toBe(true)
    expect(existsSync(join(workspaceRoot, 'legacy-session', 'note.md'))).toBe(true)
    expect(existsSync(join(workspaceRoot, 'sessions', 'legacy-session', 'runtime-manifest.json'))).toBe(false)
  })

  test('materialized runtime 判定会拒绝 symlink 或 session 不匹配的 manifest', () => {
    const workspace = createWorkspace('manifest-check')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)
    mkdirSync(join(workspaceRoot, 'sessions', 'legacy-session'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'sessions', 'legacy-session', 'runtime-manifest.json'), JSON.stringify({
      manifestVersion: 1,
      workspaceSlug: 'manifest-check',
      sessionId: 'other-session',
      sessionCwd: join(workspaceRoot, 'sessions', 'legacy-session', 'cwd'),
      sessionRuntimeManifestPath: join(workspaceRoot, 'sessions', 'legacy-session', 'runtime-manifest.json'),
    }, null, 2))

    expect(hasMaterializedAgentRuntime('manifest-check', 'legacy-session', tempDir)).toBe(false)

    rmSync(join(workspaceRoot, 'sessions', 'legacy-session', 'runtime-manifest.json'))
    const outsideManifest = join(tempDir, 'outside-runtime-manifest.json')
    writeFileSync(outsideManifest, '{}')
    symlinkSync(outsideManifest, join(workspaceRoot, 'sessions', 'legacy-session', 'runtime-manifest.json'))

    expect(hasMaterializedAgentRuntime('manifest-check', 'legacy-session', tempDir)).toBe(false)
  })

  test('恢复已物化 runtime 时校验 host bridge 产物未被篡改', () => {
    const workspace = createWorkspace('tamper')
    const workspaceRoot = createWorkspaceFiles(workspace.slug)

    materializeAgentRuntimeForNewSession({
      workspace,
      sessionId: 'session-1',
      workspacesRoot: tempDir,
    })

    expect(readMaterializedAgentRuntime('tamper', 'session-1', tempDir)).not.toBeNull()

    writeFileSync(join(workspaceRoot, 'runtime', '.claude', 'codeinsights-host-bridge.json'), JSON.stringify({
      enabled: true,
      serverName: 'codeinsights_host',
      version: 'tampered',
      tools: ['codeinsights_workspace_search'],
    }, null, 2))

    expect(readMaterializedAgentRuntime('tamper', 'session-1', tempDir)).toBeNull()
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

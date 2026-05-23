import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildWorkspacePluginSnapshots,
  expandDmiSlashCommand,
  importLocalClaudePlugin,
  materializePluginSnapshot,
} from './agent-plugin-catalog'

let tempDir = ''

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'codeinsights-plugin-catalog-'))
})

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

describe('agent plugin catalog', () => {
  test('从 config.json 解析 enabled plugin refs 并建立 command 索引', () => {
    const workspaceRoot = createWorkspace('default')
    const pluginRoot = createLocalPlugin('reviewer', {
      dmiCommand: true,
      sdkCommand: true,
    })
    writeFileSync(join(workspaceRoot, 'config.json'), JSON.stringify({
      pluginCatalog: [{
        id: 'reviewer',
        name: 'Reviewer',
        sourcePath: pluginRoot,
        sourceType: 'local',
      }],
      enabledPlugins: [{ id: 'reviewer', enabled: true }],
    }, null, 2))

    const plugins = buildWorkspacePluginSnapshots({
      workspaceRoot,
      pluginsDir: join(workspaceRoot, 'runtime', '.claude', 'plugins'),
    })

    expect(plugins).toHaveLength(1)
    expect(plugins[0]).toMatchObject({
      id: 'reviewer',
      name: 'reviewer',
      sourcePath: join(pluginRoot, '.claude-plugin'),
      snapshotPath: join(workspaceRoot, 'runtime', '.claude', 'plugins', 'reviewer'),
      sourceType: 'local',
      enabled: true,
    })
    expect(plugins[0]?.commands.map((command) => ({
      name: command.name,
      handler: command.handler,
    }))).toEqual([
      { name: 'inspect', handler: 'app-dmi' },
      { name: 'sdk-only', handler: 'sdk' },
    ])
  })

  test('禁用 plugin ref 后不进入 runtime snapshot', () => {
    const workspaceRoot = createWorkspace('disabled')
    const pluginRoot = createLocalPlugin('reviewer')
    writeFileSync(join(workspaceRoot, 'config.json'), JSON.stringify({
      pluginCatalog: [{ id: 'reviewer', name: 'Reviewer', sourcePath: pluginRoot, sourceType: 'local' }],
      enabledPlugins: [{ id: 'reviewer', enabled: false }],
    }, null, 2))

    const plugins = buildWorkspacePluginSnapshots({
      workspaceRoot,
      pluginsDir: join(workspaceRoot, 'runtime', '.claude', 'plugins'),
    })

    expect(plugins).toEqual([])
  })

  test('导入本地 Claude Code plugin 会写 catalog 和 enabled ref', () => {
    const workspaceRoot = createWorkspace('import')
    const pluginRoot = createLocalPlugin('imported')

    const entry = importLocalClaudePlugin({ workspaceRoot, sourcePath: pluginRoot, enabled: true })

    expect(entry).toMatchObject({
      id: 'imported',
      name: 'imported',
      sourcePath: join(pluginRoot, '.claude-plugin'),
      sourceType: 'local',
      enabledByDefault: true,
    })
    expect(JSON.parse(readFileSync(join(workspaceRoot, 'config.json'), 'utf-8'))).toMatchObject({
      pluginCatalog: [{ id: 'imported', sourcePath: join(pluginRoot, '.claude-plugin') }],
      enabledPlugins: [{ id: 'imported', enabled: true }],
    })
  })

  test('materialize plugin snapshot 复制源目录并校验 hash', () => {
    const workspaceRoot = createWorkspace('snapshot')
    const pluginRoot = createLocalPlugin('snapshotter', { dmiCommand: true })
    writeFileSync(join(workspaceRoot, 'config.json'), JSON.stringify({
      pluginCatalog: [{ id: 'snapshotter', name: 'Snapshotter', sourcePath: pluginRoot, sourceType: 'local' }],
      enabledPlugins: [{ id: 'snapshotter', enabled: true }],
    }, null, 2))
    const [plugin] = buildWorkspacePluginSnapshots({
      workspaceRoot,
      pluginsDir: join(workspaceRoot, 'runtime', '.claude', 'plugins'),
    })

    materializePluginSnapshot(workspaceRoot, plugin!)

    expect(existsSync(join(plugin!.snapshotPath, 'plugin.json'))).toBe(true)
    expect(existsSync(join(plugin!.snapshotPath, 'commands', 'inspect.md'))).toBe(true)
  })

  test('DMI slash command 由应用层展开，非 DMI command 保持原 prompt', () => {
    const workspaceRoot = createWorkspace('dmi')
    const pluginRoot = createLocalPlugin('dmi-plugin', { dmiCommand: true, sdkCommand: true })
    writeFileSync(join(workspaceRoot, 'config.json'), JSON.stringify({
      pluginCatalog: [{ id: 'dmi-plugin', name: 'DMI', sourcePath: pluginRoot, sourceType: 'local' }],
      enabledPlugins: [{ id: 'dmi-plugin', enabled: true }],
    }, null, 2))
    const [plugin] = buildWorkspacePluginSnapshots({
      workspaceRoot,
      pluginsDir: join(workspaceRoot, 'runtime', '.claude', 'plugins'),
    })

    const expanded = expandDmiSlashCommand({
      prompt: '/inspect src/main.ts',
      commands: plugin!.commands,
    })
    const sdkOnly = expandDmiSlashCommand({
      prompt: '/sdk-only src/main.ts',
      commands: plugin!.commands,
    })

    expect(expanded.expanded).toBe(true)
    expect(expanded.prompt).toContain('请检查下面的目标')
    expect(expanded.prompt).toContain('src/main.ts')
    expect(sdkOnly).toEqual({ expanded: false, prompt: '/sdk-only src/main.ts' })
  })

  test('DMI slash command 优先从 snapshot 展开，避免运行时读取已变化的源目录', () => {
    const workspaceRoot = createWorkspace('dmi-snapshot')
    const pluginRoot = createLocalPlugin('dmi-snapshot', { dmiCommand: true })
    writeFileSync(join(workspaceRoot, 'config.json'), JSON.stringify({
      pluginCatalog: [{ id: 'dmi-snapshot', name: 'DMI Snapshot', sourcePath: pluginRoot, sourceType: 'local' }],
      enabledPlugins: [{ id: 'dmi-snapshot', enabled: true }],
    }, null, 2))
    const [plugin] = buildWorkspacePluginSnapshots({
      workspaceRoot,
      pluginsDir: join(workspaceRoot, 'runtime', '.claude', 'plugins'),
    })
    materializePluginSnapshot(workspaceRoot, plugin!)
    writeFileSync(join(pluginRoot, '.claude-plugin', 'commands', 'inspect.md'), [
      '---',
      'name: inspect',
      'dmi: true',
      '---',
      '源目录已变化。',
      '',
    ].join('\n'))

    const expanded = expandDmiSlashCommand({
      prompt: '/inspect src/main.ts',
      commands: plugin!.commands,
    })

    expect(expanded.prompt).toContain('请检查下面的目标')
    expect(expanded.prompt).not.toContain('源目录已变化')
  })

  test('拒绝 plugin source 中的符号链接，避免 snapshot 失败后 fallback 全局 plugin', () => {
    const workspaceRoot = createWorkspace('symlink')
    const pluginRoot = createLocalPlugin('unsafe')
    symlinkSync(tempDir, join(pluginRoot, '.claude-plugin', 'unsafe-link'))
    writeFileSync(join(workspaceRoot, 'config.json'), JSON.stringify({
      pluginCatalog: [{ id: 'unsafe', name: 'Unsafe', sourcePath: pluginRoot, sourceType: 'local' }],
      enabledPlugins: [{ id: 'unsafe', enabled: true }],
    }, null, 2))

    expect(() => buildWorkspacePluginSnapshots({
      workspaceRoot,
      pluginsDir: join(workspaceRoot, 'runtime', '.claude', 'plugins'),
    })).toThrow('符号链接')
  })

  test('导入本地 plugin 时拒绝覆盖 workspace config symlink', () => {
    const workspaceRoot = createWorkspace('config-symlink')
    const pluginRoot = createLocalPlugin('safe')
    const outsideConfig = join(tempDir, 'outside-config.json')
    writeFileSync(outsideConfig, '{}')
    symlinkSync(outsideConfig, join(workspaceRoot, 'config.json'))

    expect(() => importLocalClaudePlugin({ workspaceRoot, sourcePath: pluginRoot })).toThrow('符号链接')
  })
})

function createWorkspace(slug: string): string {
  const workspaceRoot = join(tempDir, slug)
  mkdirSync(workspaceRoot, { recursive: true })
  return workspaceRoot
}

function createLocalPlugin(name: string, options: { dmiCommand?: boolean; sdkCommand?: boolean } = {}): string {
  const root = join(tempDir, `source-${name}`)
  const pluginDir = join(root, '.claude-plugin')
  mkdirSync(pluginDir, { recursive: true })
  writeFileSync(join(pluginDir, 'plugin.json'), JSON.stringify({
    name,
    description: `${name} plugin`,
  }, null, 2))

  if (options.dmiCommand || options.sdkCommand) {
    mkdirSync(join(pluginDir, 'commands'), { recursive: true })
  }
  if (options.dmiCommand) {
    writeFileSync(join(pluginDir, 'commands', 'inspect.md'), [
      '---',
      'name: inspect',
      'description: Inspect target',
      'dmi: true',
      '---',
      '请检查下面的目标。',
      '',
    ].join('\n'))
  }
  if (options.sdkCommand) {
    writeFileSync(join(pluginDir, 'commands', 'sdk-only.md'), [
      '---',
      'name: sdk-only',
      'description: SDK command',
      '---',
      'SDK should handle this.',
      '',
    ].join('\n'))
  }

  return root
}

import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import {
  applyOpencodeAsarUnpackedPath,
  buildOpencodeBinaryPath,
  detectOpencodeBinaryVersion,
  resolveOpencodeCliPath,
  resolveOpencodePlatformPackage,
} from './opencode-binary'

describe('opencode-binary', () => {
  test('按平台和架构映射 opencode platform package', () => {
    expect(resolveOpencodePlatformPackage('darwin', 'arm64')).toBe('opencode-darwin-arm64')
    expect(resolveOpencodePlatformPackage('darwin', 'x64')).toBe('opencode-darwin-x64')
    expect(resolveOpencodePlatformPackage('linux', 'x64')).toBe('opencode-linux-x64')
    expect(resolveOpencodePlatformPackage('win32', 'arm64')).toBe('opencode-windows-arm64')
  })

  test('构造 opencode-ai 与平台包 binary 路径并处理 asar.unpacked', () => {
    const mainPackage = join('/app.asar', 'node_modules', 'opencode-ai', 'package.json')
    const platformPackage = join('/app.asar', 'node_modules', 'opencode-darwin-arm64', 'package.json')

    expect(applyOpencodeAsarUnpackedPath('/app/app.asar/node_modules/opencode-ai/bin/opencode.exe', true))
      .toBe('/app/app.asar.unpacked/node_modules/opencode-ai/bin/opencode.exe')
    expect(buildOpencodeBinaryPath({ packageJsonPath: mainPackage, packageName: 'opencode-ai', isPackaged: true }))
      .toBe(join('/app.asar.unpacked', 'node_modules', 'opencode-ai', 'bin', 'opencode.exe'))
    expect(buildOpencodeBinaryPath({ packageJsonPath: platformPackage, packageName: 'opencode-darwin-arm64', isPackaged: true }))
      .toBe(join('/app.asar.unpacked', 'node_modules', 'opencode-darwin-arm64', 'bin', 'opencode'))
  })

  test('优先使用 custom path，其次解析 workspace package，最后可显式允许 PATH fallback', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'codeinsights-opencode-binary-'))
    const systemBin = join(tempDir, 'opencode')
    await writeFile(systemBin, '#!/bin/sh\n', 'utf-8')
    await chmod(systemBin, 0o755)

    const custom = resolveOpencodeCliPath({ customPath: '/opt/opencode/bin/opencode' })
    expect(custom).toEqual({ path: '/opt/opencode/bin/opencode', source: 'custom' })

    const workspace = resolveOpencodeCliPath({
      moduleResolve: (specifier) => {
        if (specifier === 'opencode-ai/package.json') {
          return join('/repo', 'apps', 'electron', 'node_modules', 'opencode-ai', 'package.json')
        }
        throw new Error(`missing ${specifier}`)
      },
    })
    expect(workspace.source).toBe('workspace')
    expect(workspace.path).toContain(join('node_modules', 'opencode-ai', 'bin', 'opencode.exe'))

    const system = resolveOpencodeCliPath({
      moduleResolve: () => {
        throw new Error('not installed')
      },
      env: { PATH: tempDir },
      allowSystemPathFallback: true,
    })
    expect(system).toEqual({ path: systemBin, source: 'system-path' })
  })

  test('版本检测返回 source 与版本号', async () => {
    const version = await detectOpencodeBinaryVersion(
      { path: '/bin/opencode', source: 'custom' },
      async () => ({ stdout: '1.15.11\n', stderr: '' }),
    )

    expect(version).toEqual({
      path: '/bin/opencode',
      source: 'custom',
      version: '1.15.11',
    })
  })
})

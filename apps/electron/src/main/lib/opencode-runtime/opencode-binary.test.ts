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
    const workspacePackageRoot = join(tempDir, 'node_modules', 'opencode-ai')
    const workspaceBin = join(workspacePackageRoot, 'bin', 'opencode.exe')
    await mkdir(join(workspacePackageRoot, 'bin'), { recursive: true })
    await writeFile(join(workspacePackageRoot, 'package.json'), '{}\n', 'utf-8')
    await writeFile(workspaceBin, '#!/bin/sh\n', 'utf-8')
    await writeFile(systemBin, '#!/bin/sh\n', 'utf-8')
    await chmod(workspaceBin, 0o755)
    await chmod(systemBin, 0o755)

    const custom = resolveOpencodeCliPath({ customPath: '/opt/opencode/bin/opencode' })
    expect(custom).toEqual({ path: '/opt/opencode/bin/opencode', source: 'custom' })

    const workspace = resolveOpencodeCliPath({
      moduleResolve: (specifier) => {
        if (specifier === 'opencode-ai/package.json') {
          return join(workspacePackageRoot, 'package.json')
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

  test('packaged 场景解析 bundled package，默认不走 PATH decoy', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'codeinsights-opencode-packaged-binary-'))
    const systemBin = join(tempDir, 'opencode')
    const appRoot = join(tempDir, 'CodeInsights.app', 'Contents', 'Resources', 'app')
    const platformPackageRoot = join(appRoot, 'node_modules', 'opencode-darwin-arm64')
    const platformBin = join(platformPackageRoot, 'bin', 'opencode')
    await mkdir(join(appRoot, 'node_modules', 'opencode-ai'), { recursive: true })
    await mkdir(join(platformPackageRoot, 'bin'), { recursive: true })
    await writeFile(join(appRoot, 'node_modules', 'opencode-ai', 'package.json'), '{}\n', 'utf-8')
    await writeFile(join(platformPackageRoot, 'package.json'), '{}\n', 'utf-8')
    await writeFile(platformBin, '#!/bin/sh\n', 'utf-8')
    await writeFile(systemBin, '#!/bin/sh\n', 'utf-8')
    await chmod(platformBin, 0o755)
    await chmod(systemBin, 0o755)

    const bundled = resolveOpencodeCliPath({
      isPackaged: true,
      platform: 'darwin',
      arch: 'arm64',
      env: { PATH: tempDir },
      allowSystemPathFallback: false,
      moduleResolve: (specifier) => {
        if (specifier === 'opencode-ai/package.json') {
          return join(appRoot, 'node_modules', 'opencode-ai', 'package.json')
        }
        if (specifier === 'opencode-darwin-arm64/package.json') {
          return join(platformPackageRoot, 'package.json')
        }
        throw new Error(`missing ${specifier}`)
      },
    })

    expect(bundled.source).toBe('bundled')
    expect(bundled.path).toBe(platformBin)
    expect(bundled.path).not.toBe(systemBin)
  })

  test('platform package 存在但 binary 缺失时不返回坏路径', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'codeinsights-opencode-missing-platform-bin-'))
    const appRoot = join(tempDir, 'CodeInsights.app', 'Contents', 'Resources', 'app')
    const platformPackageRoot = join(appRoot, 'node_modules', 'opencode-darwin-arm64')
    await mkdir(join(appRoot, 'node_modules', 'opencode-ai'), { recursive: true })
    await mkdir(platformPackageRoot, { recursive: true })
    await writeFile(join(appRoot, 'node_modules', 'opencode-ai', 'package.json'), '{}\n', 'utf-8')
    await writeFile(join(platformPackageRoot, 'package.json'), '{}\n', 'utf-8')

    expect(() => resolveOpencodeCliPath({
      isPackaged: true,
      platform: 'darwin',
      arch: 'arm64',
      allowSystemPathFallback: false,
      moduleResolve: (specifier) => {
        if (specifier === 'opencode-ai/package.json') {
          return join(appRoot, 'node_modules', 'opencode-ai', 'package.json')
        }
        if (specifier === 'opencode-darwin-arm64/package.json') {
          return join(platformPackageRoot, 'package.json')
        }
        throw new Error(`missing ${specifier}`)
      },
    })).toThrow('未找到 opencode CLI binary')
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

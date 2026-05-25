import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  applyAsarUnpackedPath,
  buildCodexBinaryPath,
  resolveCodexPlatformPackage,
  resolveCodexTargetTriple,
} from './codex-binary'

describe('codex-binary', () => {
  test('按平台和架构解析 Codex target triple', () => {
    expect(resolveCodexTargetTriple('darwin', 'arm64')).toBe('aarch64-apple-darwin')
    expect(resolveCodexTargetTriple('darwin', 'x64')).toBe('x86_64-apple-darwin')
    expect(resolveCodexTargetTriple('linux', 'x64')).toBe('x86_64-unknown-linux-musl')
    expect(resolveCodexTargetTriple('win32', 'arm64')).toBe('aarch64-pc-windows-msvc')
  })

  test('按 target triple 映射平台包', () => {
    expect(resolveCodexPlatformPackage('aarch64-apple-darwin')).toBe('@openai/codex-darwin-arm64')
    expect(resolveCodexPlatformPackage('x86_64-pc-windows-msvc')).toBe('@openai/codex-win32-x64')
    expect(() => resolveCodexPlatformPackage('unknown-target')).toThrow(/不支持的 Codex CLI target/)
  })

  test('打包环境下将 asar 路径切换到 asar.unpacked', () => {
    expect(applyAsarUnpackedPath('/app/app.asar/node_modules/pkg/bin/codex', true))
      .toBe('/app/app.asar.unpacked/node_modules/pkg/bin/codex')
    expect(applyAsarUnpackedPath('/app/app.asar/node_modules/pkg/bin/codex', false))
      .toBe('/app/app.asar/node_modules/pkg/bin/codex')
  })

  test('构造平台包 vendor 下的 Codex binary 路径', () => {
    const platformPackageJsonPath = join('/app.asar', 'node_modules', '@openai', 'codex-darwin-arm64', 'package.json')

    expect(buildCodexBinaryPath({
      platformPackageJsonPath,
      targetTriple: 'aarch64-apple-darwin',
      platform: 'darwin',
      isPackaged: true,
    })).toBe(join(
      '/app.asar.unpacked',
      'node_modules',
      '@openai',
      'codex-darwin-arm64',
      'vendor',
      'aarch64-apple-darwin',
      'codex',
      'codex',
    ))
  })
})

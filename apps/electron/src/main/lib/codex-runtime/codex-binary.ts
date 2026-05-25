import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

export const CODEX_PLATFORM_PACKAGE_BY_TARGET: Record<string, string> = {
  'x86_64-unknown-linux-musl': '@openai/codex-linux-x64',
  'aarch64-unknown-linux-musl': '@openai/codex-linux-arm64',
  'x86_64-apple-darwin': '@openai/codex-darwin-x64',
  'aarch64-apple-darwin': '@openai/codex-darwin-arm64',
  'x86_64-pc-windows-msvc': '@openai/codex-win32-x64',
  'aarch64-pc-windows-msvc': '@openai/codex-win32-arm64',
}

function createModuleRequire(): NodeJS.Require {
  const filename = typeof __filename === 'string'
    ? __filename
    : join(process.cwd(), 'package.json')
  return createRequire(filename)
}

export function resolveCodexTargetTriple(
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch,
): string {
  if (platform === 'linux' || platform === 'android') {
    if (arch === 'x64') return 'x86_64-unknown-linux-musl'
    if (arch === 'arm64') return 'aarch64-unknown-linux-musl'
  }

  if (platform === 'darwin') {
    if (arch === 'x64') return 'x86_64-apple-darwin'
    if (arch === 'arm64') return 'aarch64-apple-darwin'
  }

  if (platform === 'win32') {
    if (arch === 'x64') return 'x86_64-pc-windows-msvc'
    if (arch === 'arm64') return 'aarch64-pc-windows-msvc'
  }

  throw new Error(`不支持的 Codex CLI 平台: ${platform} (${arch})`)
}

export function resolveCodexPlatformPackage(targetTriple: string): string {
  const platformPackage = CODEX_PLATFORM_PACKAGE_BY_TARGET[targetTriple]
  if (!platformPackage) {
    throw new Error(`不支持的 Codex CLI target: ${targetTriple}`)
  }
  return platformPackage
}

export function applyAsarUnpackedPath(binaryPath: string, isPackaged: boolean): string {
  if (!isPackaged || !binaryPath.includes('.asar')) return binaryPath
  return binaryPath.replace(/\.asar([/\\])/, '.asar.unpacked$1')
}

export function buildCodexBinaryPath(input: {
  platformPackageJsonPath: string
  targetTriple: string
  platform?: NodeJS.Platform
  isPackaged?: boolean
}): string {
  const vendorRoot = join(dirname(input.platformPackageJsonPath), 'vendor')
  const binaryName = input.platform === 'win32' ? 'codex.exe' : 'codex'
  const binaryPath = join(vendorRoot, input.targetTriple, 'codex', binaryName)
  return applyAsarUnpackedPath(binaryPath, Boolean(input.isPackaged))
}

function resolveElectronPackaged(cjsRequire: NodeJS.Require): boolean {
  try {
    const electronApp = cjsRequire('electron').app as { isPackaged?: boolean }
    return Boolean(electronApp?.isPackaged)
  } catch {
    // test / 非 Electron 环境忽略
    return false
  }
}

export function resolveCodexCliPath(): string {
  const targetTriple = resolveCodexTargetTriple()
  const platformPackage = resolveCodexPlatformPackage(targetTriple)
  const cjsRequire = createModuleRequire()
  const codexPackageJsonPath = cjsRequire.resolve('@openai/codex/package.json')
  const codexRequire = createRequire(codexPackageJsonPath)
  const platformPackageJsonPath = codexRequire.resolve(`${platformPackage}/package.json`)

  return buildCodexBinaryPath({
    platformPackageJsonPath,
    targetTriple,
    platform: process.platform,
    isPackaged: resolveElectronPackaged(cjsRequire),
  })
}

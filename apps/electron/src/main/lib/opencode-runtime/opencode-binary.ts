import { execFile } from 'node:child_process'
import { accessSync, constants, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { delimiter, dirname, join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type OpencodeBinarySource = 'bundled' | 'workspace' | 'custom' | 'system-path'

export interface ResolvedOpencodeBinary {
  path: string
  source: OpencodeBinarySource
}

export interface OpencodeBinaryVersionInfo extends ResolvedOpencodeBinary {
  version: string
}

export interface ResolveOpencodeCliPathOptions {
  customPath?: string
  platform?: NodeJS.Platform
  arch?: NodeJS.Architecture
  isPackaged?: boolean
  env?: Record<string, string | undefined>
  allowSystemPathFallback?: boolean
  moduleResolve?: (specifier: string) => string
}

export type OpencodeVersionExecutor = (
  binaryPath: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>

export function resolveOpencodePlatformPackage(
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch,
): string {
  if (platform === 'darwin') {
    if (arch === 'arm64') return 'opencode-darwin-arm64'
    if (arch === 'x64') return 'opencode-darwin-x64'
  }

  if (platform === 'linux' || platform === 'android') {
    if (arch === 'arm64') return 'opencode-linux-arm64'
    if (arch === 'x64') return 'opencode-linux-x64'
  }

  if (platform === 'win32') {
    if (arch === 'arm64') return 'opencode-windows-arm64'
    if (arch === 'x64') return 'opencode-windows-x64'
  }

  throw new Error(`不支持的 opencode 平台: ${platform} (${arch})`)
}

export function applyOpencodeAsarUnpackedPath(binaryPath: string, isPackaged: boolean): string {
  if (!isPackaged || !binaryPath.includes('.asar')) return binaryPath
  return binaryPath.replace(/\.asar([/\\])/, '.asar.unpacked$1')
}

export function buildOpencodeBinaryPath(input: {
  packageJsonPath: string
  packageName: string
  isPackaged?: boolean
}): string {
  const packageRoot = dirname(input.packageJsonPath)
  const binaryName = input.packageName === 'opencode-ai' || input.packageName.includes('windows')
    ? 'opencode.exe'
    : 'opencode'
  return applyOpencodeAsarUnpackedPath(join(packageRoot, 'bin', binaryName), Boolean(input.isPackaged))
}

export function resolveOpencodeCliPath(options: ResolveOpencodeCliPathOptions = {}): ResolvedOpencodeBinary {
  if (options.customPath?.trim()) {
    return { path: options.customPath.trim(), source: 'custom' }
  }

  const moduleResolve = options.moduleResolve ?? createDefaultModuleResolve()
  const isPackaged = options.isPackaged ?? resolveElectronPackaged()

  const mainPackagePath = tryResolveModule(moduleResolve, 'opencode-ai/package.json')
  if (mainPackagePath) {
    const mainBinaryPath = buildOpencodeBinaryPath({
      packageJsonPath: mainPackagePath,
      packageName: 'opencode-ai',
      isPackaged,
    })
    if (isExecutable(mainBinaryPath)) {
      return {
        path: mainBinaryPath,
        source: isPackaged ? 'bundled' : 'workspace',
      }
    }
  }

  const platformPackageName = resolveOpencodePlatformPackage(options.platform, options.arch)
  const platformPackagePath = tryResolveModule(moduleResolve, `${platformPackageName}/package.json`)
  if (platformPackagePath) {
    const platformBinaryPath = buildOpencodeBinaryPath({
      packageJsonPath: platformPackagePath,
      packageName: platformPackageName,
      isPackaged,
    })
    if (isExecutable(platformBinaryPath)) {
      return {
        path: platformBinaryPath,
        source: isPackaged ? 'bundled' : 'workspace',
      }
    }
  }

  if (options.allowSystemPathFallback === true) {
    const systemPath = findExecutableOnPath('opencode', options.env?.PATH)
    if (systemPath) return { path: systemPath, source: 'system-path' }
  }

  throw new Error('未找到 opencode CLI binary。请安装 opencode-ai 依赖或配置自定义 binary 路径。')
}

export async function detectOpencodeBinaryVersion(
  binary: ResolvedOpencodeBinary,
  executor: OpencodeVersionExecutor = defaultVersionExecutor,
): Promise<OpencodeBinaryVersionInfo> {
  const result = await executor(binary.path, ['--version'])
  const version = parseVersion(result.stdout) ?? parseVersion(result.stderr)
  if (!version) {
    throw new Error(`无法解析 opencode 版本输出: ${result.stdout || result.stderr}`)
  }
  return { ...binary, version }
}

function createDefaultModuleResolve(): (specifier: string) => string {
  const filename = typeof __filename === 'string'
    ? __filename
    : join(process.cwd(), 'package.json')
  const cjsRequire = createRequire(filename)
  return (specifier: string) => cjsRequire.resolve(specifier)
}

function tryResolveModule(
  moduleResolve: (specifier: string) => string,
  specifier: string,
): string | null {
  try {
    return moduleResolve(specifier)
  } catch {
    return null
  }
}

function resolveElectronPackaged(): boolean {
  try {
    const cjsRequire = createRequire(typeof __filename === 'string' ? __filename : join(process.cwd(), 'package.json'))
    const electronApp = cjsRequire('electron').app as { isPackaged?: boolean }
    return Boolean(electronApp?.isPackaged)
  } catch {
    return false
  }
}

function findExecutableOnPath(command: string, pathValue: string | undefined): string | null {
  if (!pathValue) return null
  const suffixes = process.platform === 'win32' ? ['', '.exe', '.cmd'] : ['']
  for (const dir of pathValue.split(delimiter).filter(Boolean)) {
    for (const suffix of suffixes) {
      const candidate = join(dir, `${command}${suffix}`)
      if (isExecutable(candidate)) return candidate
    }
  }
  return null
}

function isExecutable(path: string): boolean {
  if (!existsSync(path)) return false
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return process.platform === 'win32'
  }
}

async function defaultVersionExecutor(
  binaryPath: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(binaryPath, args, {
    encoding: 'utf-8',
    windowsHide: true,
  })
  return {
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function parseVersion(output: string): string | null {
  const match = output.match(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/)
  return match?.[0] ?? null
}

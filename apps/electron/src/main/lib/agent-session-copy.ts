import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function copyTreeWithoutSymlinks(sourcePath: string, destPath: string): void {
  const stat = lstatSync(sourcePath)
  if (stat.isSymbolicLink()) {
    console.warn(`[Agent 会话] 跳过 fork 源目录中的符号链接: ${sourcePath}`)
    return
  }
  if (stat.isDirectory()) {
    if (!existsSync(destPath)) {
      mkdirSync(destPath, { recursive: true })
    }
    for (const entry of readdirSync(sourcePath)) {
      copyTreeWithoutSymlinks(join(sourcePath, entry), join(destPath, entry))
    }
    return
  }
  if (stat.isFile()) {
    const parentDir = dirname(destPath)
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true })
    }
    copyFileSync(sourcePath, destPath)
  }
}

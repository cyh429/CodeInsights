import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { copyTreeWithoutSymlinks } from './agent-session-copy'

let tempDir = ''

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rv-session-copy-'))
})

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

describe('copyTreeWithoutSymlinks', () => {
  test('复制普通文件并跳过任意层级符号链接', () => {
    const sourceDir = join(tempDir, 'source')
    const destDir = join(tempDir, 'dest')
    const outsideFile = join(tempDir, 'outside.txt')
    mkdirSync(join(sourceDir, 'nested'), { recursive: true })
    writeFileSync(join(sourceDir, 'root.txt'), 'root')
    writeFileSync(join(sourceDir, 'nested', 'child.txt'), 'child')
    writeFileSync(outsideFile, 'outside')
    symlinkSync(outsideFile, join(sourceDir, 'root-link'))
    symlinkSync(outsideFile, join(sourceDir, 'nested', 'child-link'))

    copyTreeWithoutSymlinks(sourceDir, destDir)

    expect(readFileSync(join(destDir, 'root.txt'), 'utf-8')).toBe('root')
    expect(readFileSync(join(destDir, 'nested', 'child.txt'), 'utf-8')).toBe('child')
    expect(existsSync(join(destDir, 'root-link'))).toBe(false)
    expect(existsSync(join(destDir, 'nested', 'child-link'))).toBe(false)
  })
})

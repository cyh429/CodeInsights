import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildSearchSnippet, findFirstJsonlMatch } from './jsonl-search'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

function createTempJsonl(lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'codeinsights-search-'))
  tempDirs.push(dir)
  const filePath = join(dir, 'messages.jsonl')
  writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return filePath
}

describe('buildSearchSnippet', () => {
  test('命中中间文本时会生成带省略号的片段与相对坐标', () => {
    const content = '0123456789'.repeat(10) + '关键字' + 'abcdefghij'.repeat(10)
    const result = buildSearchSnippet(content, '关键字', '关键字')

    expect(result).not.toBeNull()
    expect(result?.snippet.startsWith('...')).toBe(true)
    expect(result?.snippet.includes('关键字')).toBe(true)
    expect(result?.matchStart).toBeGreaterThan(0)
    expect(result?.matchLength).toBe(3)
  })

  test('未命中时返回 null', () => {
    expect(buildSearchSnippet('hello world', 'missing', 'missing')).toBeNull()
  })
})

describe('findFirstJsonlMatch', () => {
  test('逐行扫描 JSONL，跳过坏行并返回第一条匹配', async () => {
    const filePath = createTempJsonl([
      '{bad json',
      JSON.stringify({ content: '第一条没有命中' }),
      JSON.stringify({ content: '第二条包含关键字内容', id: 'match-1' }),
      JSON.stringify({ content: '第三条也包含关键字', id: 'match-2' }),
    ])

    const result = await findFirstJsonlMatch<{ content?: string; id?: string }, string>(
      filePath,
      async (parsed) => {
        if (!parsed.content?.includes('关键字')) return null
        return parsed.id ?? null
      },
    )

    expect(result).toBe('match-1')
  })

  test('没有命中时返回 null', async () => {
    const filePath = createTempJsonl([
      JSON.stringify({ content: 'alpha' }),
      JSON.stringify({ content: 'beta' }),
    ])

    const result = await findFirstJsonlMatch<{ content?: string }, string>(
      filePath,
      async (parsed) => {
        if (!parsed.content?.includes('关键字')) return null
        return parsed.content
      },
    )

    expect(result).toBeNull()
  })
})

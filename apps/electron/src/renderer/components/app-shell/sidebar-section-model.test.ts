import { describe, expect, test } from 'bun:test'
import {
  buildDateSidebarSections,
  sortByUpdatedAtDesc,
} from './sidebar-section-model'

interface TestSession {
  id: string
  updatedAt: number
}

function makeSession(id: string, updatedAt: number): TestSession {
  return { id, updatedAt }
}

function sectionIds(sections: ReturnType<typeof buildDateSidebarSections<TestSession>>) {
  return sections.map((section) => ({
    id: section.id,
    label: section.label,
    items: section.items.map((item) => item.id),
  }))
}

describe('sortByUpdatedAtDesc', () => {
  test('按 updatedAt 降序返回新数组，不修改输入', () => {
    const older = makeSession('older', 10)
    const newer = makeSession('newer', 20)
    const input = [older, newer]

    expect(sortByUpdatedAtDesc(input).map((item) => item.id)).toEqual(['newer', 'older'])
    expect(input.map((item) => item.id)).toEqual(['older', 'newer'])
  })
})

describe('buildDateSidebarSections', () => {
  test('按今天、昨天、更早分组，并在组内按 updatedAt 降序排列', () => {
    const now = Date.parse('2026-05-08T15:30:00+08:00')
    const todayEarly = Date.parse('2026-05-08T08:00:00+08:00')
    const todayLate = Date.parse('2026-05-08T12:00:00+08:00')
    const yesterday = Date.parse('2026-05-07T12:00:00+08:00')
    const earlier = Date.parse('2026-05-01T12:00:00+08:00')

    const sections = buildDateSidebarSections([
      makeSession('today-early', todayEarly),
      makeSession('earlier', earlier),
      makeSession('today-late', todayLate),
      makeSession('yesterday', yesterday),
    ], { now })

    expect(sectionIds(sections)).toEqual([
      { id: 'date-today', label: '今天', items: ['today-late', 'today-early'] },
      { id: 'date-yesterday', label: '昨天', items: ['yesterday'] },
      { id: 'date-earlier', label: '更早', items: ['earlier'] },
    ])
  })

  test('支持自定义日期分组 id 前缀', () => {
    const now = Date.parse('2026-05-08T15:30:00+08:00')

    expect(sectionIds(buildDateSidebarSections([
      makeSession('today', now),
    ], { idPrefix: 'chat-date', now }))).toEqual([
      { id: 'chat-date-today', label: '今天', items: ['today'] },
    ])
  })
})

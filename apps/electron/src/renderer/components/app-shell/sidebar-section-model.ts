export type SidebarDateGroupLabel = '今天' | '昨天' | '更早'

export interface SidebarUpdatedAtItem {
  updatedAt: number
}

export interface DateSidebarSection<TItem extends SidebarUpdatedAtItem> {
  id: string
  label: SidebarDateGroupLabel
  items: TItem[]
}

export interface BuildDateSidebarSectionsOptions {
  now?: number
  idPrefix?: string
}

const DAY_MS = 86_400_000

export function sortByUpdatedAtDesc<TItem extends SidebarUpdatedAtItem>(
  items: readonly TItem[],
): TItem[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function buildDateSidebarSections<TItem extends SidebarUpdatedAtItem>(
  items: readonly TItem[],
  options: BuildDateSidebarSectionsOptions = {},
): DateSidebarSection<TItem>[] {
  const { now = Date.now(), idPrefix = 'date' } = options
  const nowDate = new Date(now)
  const todayStart = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
  ).getTime()
  const yesterdayStart = todayStart - DAY_MS
  const groups: Record<SidebarDateGroupLabel, TItem[]> = {
    今天: [],
    昨天: [],
    更早: [],
  }

  for (const item of sortByUpdatedAtDesc(items)) {
    if (item.updatedAt >= todayStart) {
      groups.今天.push(item)
    } else if (item.updatedAt >= yesterdayStart) {
      groups.昨天.push(item)
    } else {
      groups.更早.push(item)
    }
  }

  return [
    { id: `${idPrefix}-today`, label: '今天' as const, items: groups.今天 },
    { id: `${idPrefix}-yesterday`, label: '昨天' as const, items: groups.昨天 },
    { id: `${idPrefix}-earlier`, label: '更早' as const, items: groups.更早 },
  ].filter((section) => section.items.length > 0)
}

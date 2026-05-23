/**
 * 飞书 mention 与 @ 标签转换工具
 *
 * 只包含纯函数，Bridge 继续负责 Bot open_id 获取、缓存和消息发送副作用。
 */

import type { FeishuGroupMember, FeishuMention } from '@codeinsights/shared'

export interface FeishuMentionTarget {
  name: string
  openId: string
}

export interface ConvertMentionNamesOptions {
  botOpenId?: string | null
}

/**
 * 从 mention.id 中提取 open_id。
 */
export function extractFeishuMentionOpenId(mention: FeishuMention): string | null {
  const { id } = mention
  if (typeof id === 'string') return id
  if (typeof id === 'object' && id !== null) return id.open_id ?? null
  return null
}

/**
 * 列出可用于匹配的 mention 目标，排除 @所有人 和无 open_id 条目。
 */
export function listFeishuMentionTargets(mentions: FeishuMention[] | undefined): FeishuMentionTarget[] {
  if (!mentions || mentions.length === 0) return []

  return mentions.flatMap((mention) => {
    const openId = extractFeishuMentionOpenId(mention)
    if (!openId || openId === 'all') return []
    return [{ name: mention.name, openId }]
  })
}

/**
 * 判断指定 open_id 是否出现在 mention 列表中。
 */
export function isFeishuOpenIdMentioned(
  mentions: FeishuMention[] | undefined,
  openId: string | null | undefined,
): boolean {
  if (!openId) return false
  return listFeishuMentionTargets(mentions).some((target) => target.openId === openId)
}

/**
 * 将 Agent 文本中的 @Name 转换为飞书卡片 markdown 的 <at> 标签。
 */
export function convertMentionNamesToAtTags(
  text: string,
  members: FeishuGroupMember[] | undefined,
  options: ConvertMentionNamesOptions = {},
): string {
  if (!members || members.length === 0) return text

  const nameToId = new Map<string, string>()
  for (const member of members) {
    if (member.openId !== options.botOpenId) {
      nameToId.set(member.name, member.openId)
    }
  }
  if (nameToId.size === 0) return text

  const names = Array.from(nameToId.keys()).sort((a, b) => b.length - a.length)
  const escapedNames = names.map(escapeRegExp)
  const pattern = new RegExp(`@(${escapedNames.join('|')})(?![\\w])`, 'g')

  return text.replace(pattern, (_, name: string) => {
    const openId = nameToId.get(name)
    return openId ? `<at id=${openId}>${name}</at>` : `@${name}`
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

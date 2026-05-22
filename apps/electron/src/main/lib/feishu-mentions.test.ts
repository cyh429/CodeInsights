import { describe, expect, test } from 'bun:test'
import type { FeishuGroupMember, FeishuMention } from '@codeinsights/shared'
import {
  convertMentionNamesToAtTags,
  extractFeishuMentionOpenId,
  isFeishuOpenIdMentioned,
  listFeishuMentionTargets,
} from './feishu-mentions'

describe('feishu-mentions', () => {
  test('提取 mention open_id，兼容字符串和对象 id', () => {
    expect(extractFeishuMentionOpenId({
      key: '@_user_1',
      id: 'ou_string',
      name: 'String User',
    })).toBe('ou_string')

    expect(extractFeishuMentionOpenId({
      key: '@_user_2',
      id: { open_id: 'ou_object', union_id: 'on_union' },
      name: 'Object User',
    })).toBe('ou_object')

    expect(extractFeishuMentionOpenId({
      key: '@_user_3',
      id: { union_id: 'on_union_only' },
      name: 'No OpenId',
    })).toBeNull()
  })

  test('列出可匹配 mention 目标并过滤 @所有人', () => {
    const mentions: FeishuMention[] = [
      { key: '@_user_1', id: 'all', name: '所有人' },
      { key: '@_user_2', id: { open_id: 'ou_bot' }, name: 'CodeInsights Bot' },
      { key: '@_user_3', id: { union_id: 'on_user' }, name: 'No OpenId' },
    ]

    expect(listFeishuMentionTargets(mentions)).toEqual([
      { name: 'CodeInsights Bot', openId: 'ou_bot' },
    ])
  })

  test('检测指定 open_id 是否被 mention', () => {
    const mentions: FeishuMention[] = [
      { key: '@_user_1', id: { open_id: 'ou_alice' }, name: 'Alice' },
      { key: '@_user_2', id: 'all', name: '所有人' },
    ]

    expect(isFeishuOpenIdMentioned(mentions, 'ou_alice')).toBe(true)
    expect(isFeishuOpenIdMentioned(mentions, 'ou_bob')).toBe(false)
    expect(isFeishuOpenIdMentioned(mentions, null)).toBe(false)
  })

  test('将群成员 @Name 转换为飞书 at 标签并保留未知名称', () => {
    const members: FeishuGroupMember[] = [
      { openId: 'ou_alice', name: 'Alice' },
      { openId: 'ou_bob', name: 'Bob' },
    ]

    const result = convertMentionNamesToAtTags('请 @Alice 和 @Unknown 看一下，@Bob 复核。', members)

    expect(result).toBe('请 <at id=ou_alice>Alice</at> 和 @Unknown 看一下，<at id=ou_bob>Bob</at> 复核。')
  })

  test('按名称长度优先转换，避免短名称截断长名称', () => {
    const members: FeishuGroupMember[] = [
      { openId: 'ou_ann', name: 'Ann' },
      { openId: 'ou_ann_lee', name: 'Ann Lee' },
    ]

    const result = convertMentionNamesToAtTags('@Ann Lee 和 @Ann 都看一下', members)

    expect(result).toBe('<at id=ou_ann_lee>Ann Lee</at> 和 <at id=ou_ann>Ann</at> 都看一下')
  })

  test('转义成员名中的正则字符，并避免匹配后缀单词字符', () => {
    const members: FeishuGroupMember[] = [
      { openId: 'ou_plus', name: 'A+B' },
      { openId: 'ou_designer', name: '张三(设计)' },
    ]

    const result = convertMentionNamesToAtTags('请 @A+B @张三(设计) 看；@A+B2 保持原样', members)

    expect(result).toBe('请 <at id=ou_plus>A+B</at> <at id=ou_designer>张三(设计)</at> 看；@A+B2 保持原样')
  })

  test('保留中文名称后缀的旧匹配语义', () => {
    const members: FeishuGroupMember[] = [
      { openId: 'ou_zhang', name: '张三' },
    ]

    const result = convertMentionNamesToAtTags('@张三丰 请看', members)

    expect(result).toBe('<at id=ou_zhang>张三</at>丰 请看')
  })

  test('转换时排除 Bot 自身成员', () => {
    const members: FeishuGroupMember[] = [
      { openId: 'ou_bot', name: 'CodeInsights Bot' },
      { openId: 'ou_alice', name: 'Alice' },
    ]

    const result = convertMentionNamesToAtTags('@CodeInsights Bot 和 @Alice', members, {
      botOpenId: 'ou_bot',
    })

    expect(result).toBe('@CodeInsights Bot 和 <at id=ou_alice>Alice</at>')
  })
})

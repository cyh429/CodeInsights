/**
 * App Mode Atom - 应用模式状态
 *
 * - pipeline: CodeInsights Pipeline 主入口
 * - chat: 对话模式
 * - agent: Agent 模式（原 Flow）
 * - scan: 漏洞扫描工作台
 */

import { atomWithStorage } from 'jotai/utils'

export type AppMode = 'pipeline' | 'chat' | 'agent' | 'scan'

/** App 模式，自动持久化到 localStorage */
export const appModeAtom = atomWithStorage<AppMode>('codeinsights-app-mode', 'pipeline')

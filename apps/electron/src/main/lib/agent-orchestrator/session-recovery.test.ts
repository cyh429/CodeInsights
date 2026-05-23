import { describe, expect, test } from 'bun:test'
import {
  SESSION_NOT_FOUND_RECOVERY_REASON,
  createSessionNotFoundRecoveryPatch,
  isSessionNotFoundError,
} from './session-recovery'

describe('session-recovery', () => {
  test('从 error message 识别 session-not-found 错误', () => {
    expect(isSessionNotFoundError('No conversation found with session ID abc')).toBe(true)
    expect(isSessionNotFoundError('SDK failed: No conversation found for workspace with session abc')).toBe(true)
  })

  test('从 stderr 识别 session-not-found 错误', () => {
    expect(isSessionNotFoundError('', 'stderr: No conversation found with session ID abc')).toBe(true)
  })

  test('非 session-not-found 错误不误判', () => {
    expect(isSessionNotFoundError('network timeout', 'No account found with user id')).toBe(false)
    expect(isSessionNotFoundError('conversation loaded', 'session restored')).toBe(false)
  })

  test('恢复 patch 清空 resumeSessionId 并使用上下文回填 prompt', () => {
    const patch = createSessionNotFoundRecoveryPatch({
      contextPrompt: '<conversation_history>\n[user]: 历史\n</conversation_history>\n\n当前问题',
    })

    expect(patch).toEqual({
      prompt: '<conversation_history>\n[user]: 历史\n</conversation_history>\n\n当前问题',
      resumeSessionId: undefined,
      retryReason: SESSION_NOT_FOUND_RECOVERY_REASON,
    })
  })
})

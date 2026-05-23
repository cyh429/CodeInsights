export const SESSION_NOT_FOUND_RECOVERY_REASON = 'Session 已失效，切换到上下文回填模式'

export interface SessionNotFoundRecoveryPatchInput {
  contextPrompt: string
}

export interface SessionNotFoundRecoveryPatch {
  prompt: string
  resumeSessionId: undefined
  retryReason: string
}

/**
 * 判断错误是否为 SDK session 不存在。
 *
 * 当 resume 目标 session 已过期或被清理时，SDK 会抛出此错误。
 */
export function isSessionNotFoundError(errorMessage: string, stderr?: string): boolean {
  const pattern = /No conversation found.*with session/i
  return pattern.test(errorMessage) || (!!stderr && pattern.test(stderr))
}

/**
 * 生成 session-not-found 恢复时需要写回 queryOptions 的无副作用 patch。
 */
export function createSessionNotFoundRecoveryPatch(
  input: SessionNotFoundRecoveryPatchInput,
): SessionNotFoundRecoveryPatch {
  return {
    prompt: input.contextPrompt,
    resumeSessionId: undefined,
    retryReason: SESSION_NOT_FOUND_RECOVERY_REASON,
  }
}

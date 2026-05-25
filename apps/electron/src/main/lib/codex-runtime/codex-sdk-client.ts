import type {
  CodexOptions,
  Input,
  ThreadEvent,
  ThreadOptions,
  TurnOptions,
} from '@openai/codex-sdk'

export interface CodexSdkThreadLike {
  readonly id: string | null
  runStreamed(input: Input, turnOptions?: TurnOptions): Promise<{ events: AsyncGenerator<ThreadEvent> }>
}

export interface CodexSdkClientLike {
  startThread(options?: ThreadOptions): CodexSdkThreadLike
  resumeThread(id: string, options?: ThreadOptions): CodexSdkThreadLike
}

export type CreateCodexSdkClient = (
  options: CodexOptions,
) => CodexSdkClientLike | Promise<CodexSdkClientLike>

export const createDefaultCodexSdkClient: CreateCodexSdkClient = async (options) => {
  const { Codex } = await import('@openai/codex-sdk')
  return new Codex(options)
}

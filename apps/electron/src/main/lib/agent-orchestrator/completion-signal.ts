import type { AgentMessage } from '@codeinsights/shared'

export interface CompletionSignalOptions {
  stoppedByUser?: boolean
  startedAt?: number
  resultSubtype?: string
}

export interface CompletionSignalCallbacks {
  onError: (error: string) => void
  onComplete: (messages?: AgentMessage[], opts?: CompletionSignalOptions) => void
}

export interface SendCompletionSignalInput {
  callbacks: CompletionSignalCallbacks
  messages?: AgentMessage[] | (() => AgentMessage[])
  startedAt?: number
  error?: string
  options?: Omit<CompletionSignalOptions, 'startedAt'>
}

export function buildCompletionOptions(
  startedAt: number | undefined,
  options: Omit<CompletionSignalOptions, 'startedAt'> = {},
): CompletionSignalOptions {
  return {
    ...options,
    startedAt,
  }
}

export function sendCompletionSignal(input: SendCompletionSignalInput): void {
  if (input.error !== undefined) {
    input.callbacks.onError(input.error)
  }
  const messages = typeof input.messages === 'function'
    ? input.messages()
    : input.messages
  input.callbacks.onComplete(
    messages,
    buildCompletionOptions(input.startedAt, input.options),
  )
}

import { createHash } from 'node:crypto'

export type OpencodeAuthSource = 'native' | 'channel' | 'smoke'

export interface OpencodeNativeAuthInput {
  source: 'native'
  modelId?: string
}

export interface OpencodeChannelAuthInput {
  source: 'channel'
  channelId: string
  providerId: string
  baseUrl?: string
  modelId: string
  apiKey: string
}

export interface OpencodeSmokeAuthInput {
  source: 'smoke'
  providerId?: string
  baseUrl?: string
  modelId?: string
  apiKey?: string
}

export type OpencodeAuthInput =
  | OpencodeNativeAuthInput
  | OpencodeChannelAuthInput
  | OpencodeSmokeAuthInput

export interface OpencodeAuthState {
  source: OpencodeAuthSource
  authSourceHash: string
  env: Record<string, string>
  apiKeyEnvName?: string
  redactedSummary: Record<string, string | undefined>
}

export interface BuildOpencodeChannelApiKeyEnvNameInput {
  channelId: string
  providerId: string
  modelId: string
}

export function buildOpencodeChannelApiKeyEnvName(input: BuildOpencodeChannelApiKeyEnvNameInput): string {
  const providerPart = sanitizeEnvNamePart(input.providerId).slice(0, 32)
  const digest = hashText(`${input.channelId}\0${input.providerId}\0${input.modelId}`)
    .slice(0, 8)
    .toUpperCase()
  return `CODEINSIGHTS_OPENCODE_CHANNEL_${providerPart}_${digest}_API_KEY`
}

export function createOpencodeSecretFingerprint(secret: string): string {
  return `sha256:${hashText(secret).slice(0, 12)}`
}

export function createOpencodeAuthState(input: OpencodeAuthInput): OpencodeAuthState {
  if (input.source === 'channel') {
    const apiKeyEnvName = buildOpencodeChannelApiKeyEnvName(input)
    const apiKeyFingerprint = createOpencodeSecretFingerprint(input.apiKey)
    const redactedSummary = removeUndefinedValues({
      source: 'channel',
      channelId: input.channelId,
      providerId: input.providerId,
      baseUrl: input.baseUrl,
      apiKeyFingerprint,
    })

    return {
      source: 'channel',
      apiKeyEnvName,
      env: { [apiKeyEnvName]: input.apiKey },
      authSourceHash: stableHash({
        source: 'channel',
        channelId: input.channelId,
        providerId: input.providerId,
        baseUrl: input.baseUrl,
        modelId: input.modelId,
        apiKeyFingerprint,
      }),
      redactedSummary,
    }
  }

  if (input.source === 'smoke') {
    const apiKeyFingerprint = input.apiKey ? createOpencodeSecretFingerprint(input.apiKey) : undefined
    return {
      source: 'smoke',
      env: {},
      authSourceHash: stableHash({
        source: 'smoke',
        providerId: input.providerId,
        baseUrl: input.baseUrl,
        modelId: input.modelId,
        apiKeyFingerprint,
      }),
      redactedSummary: removeUndefinedValues({
        source: 'smoke',
        providerId: input.providerId,
        baseUrl: input.baseUrl,
        apiKeyFingerprint,
      }),
    }
  }

  return {
    source: 'native',
    env: {},
    authSourceHash: stableHash({ source: 'native' }),
    redactedSummary: { source: 'native' },
  }
}

function removeUndefinedValues(input: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
}

function stableHash(value: unknown): string {
  return `sha256:${hashText(stableStringify(value)).slice(0, 12)}`
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function sanitizeEnvNamePart(value: string): string {
  const sanitized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return sanitized || 'VALUE'
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

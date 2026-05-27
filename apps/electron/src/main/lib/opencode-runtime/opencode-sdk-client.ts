export interface OpencodeServerAuth {
  username: string
  password: string
}

export type OpencodeFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface CreateOpencodeClientWrapperInput {
  baseUrl: string
  auth: OpencodeServerAuth
  fetchImpl?: OpencodeFetch
  timeoutMs?: number
}

export interface OpencodeHealthResponse {
  healthy: boolean
  version?: string
}

export interface OpencodeClientWrapper {
  getHealth(): Promise<OpencodeHealthResponse>
  requestJson<T>(path: string, init?: RequestInit): Promise<T>
}

export interface OpencodeClientLogInput {
  url: string
  headers?: Record<string, string>
  body?: unknown
}

export interface OpencodeClientLogSummary {
  url: string
  headers: Record<string, string>
  body?: unknown
}

export class OpencodeClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'OpencodeClientError'
  }
}

export function createOpencodeClientWrapper(input: CreateOpencodeClientWrapperInput): OpencodeClientWrapper {
  const fetchImpl = input.fetchImpl ?? fetch
  const baseUrl = input.baseUrl.replace(/\/+$/, '')

  async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const headers = new Headers(init.headers)
    headers.set('Authorization', buildOpencodeBasicAuthHeader(input.auth.username, input.auth.password))
    headers.set('Accept', 'application/json')
    const response = await fetchWithTimeout(fetchImpl, url, { ...init, headers }, input.timeoutMs)
    if (!response.ok) {
      throw await toOpencodeClientError(response)
    }
    if (response.status === 204) {
      return {} as T
    }
    return await response.json() as T
  }

  return {
    requestJson,
    getHealth: () => requestJson<OpencodeHealthResponse>('/global/health'),
  }
}

export function buildOpencodeBasicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf-8').toString('base64')}`
}

export function redactOpencodeClientLog(input: OpencodeClientLogInput): OpencodeClientLogSummary {
  return {
    url: input.url,
    headers: redactHeaders(input.headers ?? {}),
    ...(input.body !== undefined ? { body: redactUnknown(input.body) } : {}),
  }
}

async function fetchWithTimeout(
  fetchImpl: OpencodeFetch,
  url: string,
  init: RequestInit,
  timeoutMs: number | undefined,
): Promise<Response> {
  if (!timeoutMs || timeoutMs <= 0) {
    return await fetchImpl(url, init)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: init.signal ?? controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function toOpencodeClientError(response: Response): Promise<OpencodeClientError> {
  if (response.status === 401 || response.status === 403) {
    return new OpencodeClientError('runtime_server_auth_failed', 'opencode server 鉴权失败', response.status)
  }
  const rawText = await response.text().catch(() => '')
  const redactedText = redactSecretText(rawText)
  return new OpencodeClientError(
    'runtime_server_request_failed',
    `opencode server 请求失败 (${response.status})${redactedText ? `: ${redactedText}` : ''}`,
    response.status,
  )
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    next[key] = isSecretKey(key) ? '[REDACTED]' : value
  }
  return next
}

function redactUnknown(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return typeof value === 'string' ? redactSecretText(value) : value
  if (Array.isArray(value)) return value.map((item) => redactUnknown(item))
  const record = value as Record<string, unknown>
  const next: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(record)) {
    next[key] = isSecretKey(key) ? '[REDACTED]' : redactUnknown(item)
  }
  return next
}

export function redactSecretText(value: string): string {
  return value
    .replace(/Basic\s+[A-Za-z0-9+/=]+/g, 'Basic [REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9._-]+/g, 'sk-[REDACTED]')
    .replace(/server-password|secret-password/g, '[REDACTED]')
}

function isSecretKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return normalized === 'authorization'
    || normalized.includes('apikey')
    || normalized.includes('api_key')
    || normalized.includes('token')
    || normalized.includes('secret')
    || normalized.includes('password')
}

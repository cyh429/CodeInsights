import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Readable } from 'node:stream'
import type { OpencodeClient } from '@opencode-ai/sdk/client'

export interface OpencodeServerAuth {
  username: string
  password: string
}

export type OpencodeFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
export type OpencodePermissionResponse = 'once' | 'always' | 'reject'

export interface CreateOpencodeClientWrapperInput {
  baseUrl: string
  auth?: OpencodeServerAuth
  fetchImpl?: OpencodeFetch
  timeoutMs?: number
  createSdkClient?: CreateOpencodeSdkClient
}

export interface OpencodeHealthResponse {
  healthy: boolean
  version?: string
}

export interface OpencodeSessionInfo {
  id: string
  title?: string
  directory?: string
  version?: string
  [key: string]: unknown
}

export interface OpencodePromptAsyncInput {
  sessionId: string
  prompt: string
  model?: string
  agent?: string
  noReply?: boolean
  directory?: string
  messageId?: string
}

export interface OpencodeCreateSessionInput {
  title?: string
  parentId?: string
  directory?: string
}

export interface OpencodeAbortSessionInput {
  sessionId: string
  directory?: string
}

export interface OpencodeListMessagesInput {
  sessionId: string
  directory?: string
  limit?: number
}

export interface OpencodePermissionReplyInput {
  sessionId: string
  permissionId: string
  response: OpencodePermissionResponse
  directory?: string
}

export interface OpencodeSubscribeEventsInput {
  directory?: string
  signal?: AbortSignal
  maxRetryAttempts?: number
}

export interface OpencodeConfigSummary {
  model?: string
  share?: string
  autoupdate?: boolean
  server?: {
    hostname?: string
    corsCount?: number
  }
  permission?: {
    doomLoop?: string
    externalDirectory?: string
    edit?: string
    bashRuleCount?: number
  }
  providerIds: string[]
  enabledProviderIds: string[]
}

export type OpencodeServerEvent = Record<string, unknown>

export interface OpencodeClientWrapper {
  getHealth(): Promise<OpencodeHealthResponse>
  subscribeEvents(input?: OpencodeSubscribeEventsInput): Promise<AsyncIterable<OpencodeServerEvent>>
  createSession(input?: OpencodeCreateSessionInput): Promise<OpencodeSessionInfo>
  promptAsync(input: OpencodePromptAsyncInput): Promise<void>
  abortSession(input: OpencodeAbortSessionInput): Promise<boolean>
  listMessages(input: OpencodeListMessagesInput): Promise<unknown[]>
  respondPermission(input: OpencodePermissionReplyInput): Promise<boolean>
  getConfigSummary(): Promise<OpencodeConfigSummary>
  requestJson<T>(path: string, init?: RequestInit): Promise<T>
}

export interface OpencodeClientLogInput {
  url: string
  headers?: Record<string, string>
  body?: unknown
}

export type CreateOpencodeSdkClient = (input: {
  baseUrl: string
  fetch: (request: Request) => Promise<Response>
}) => OpencodeClient | Promise<OpencodeClient>

interface SdkFieldsResult<T> {
  data?: T
  error?: unknown
  request?: Request
  response: Response
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
  const fetchImpl = input.fetchImpl ?? nodeHttpFetch
  const baseUrl = input.baseUrl.replace(/\/+$/, '')
  let sdkClientPromise: Promise<OpencodeClient> | undefined

  async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const headers = new Headers(init.headers)
    if (input.auth) {
      headers.set('Authorization', buildOpencodeBasicAuthHeader(input.auth.username, input.auth.password))
    }
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

  async function getSdkClient(): Promise<OpencodeClient> {
    sdkClientPromise ??= Promise.resolve().then(async () => {
      const createSdkClient = input.createSdkClient ?? defaultCreateOpencodeSdkClient
      return await createSdkClient({
        baseUrl,
        fetch: createBasicAuthFetch({
          auth: input.auth,
          fetchImpl,
          timeoutMs: input.timeoutMs,
        }),
      })
    })
    return await sdkClientPromise
  }

  return {
    requestJson,
    getHealth: () => requestJson<OpencodeHealthResponse>('/global/health'),
    async subscribeEvents(subscribeInput: OpencodeSubscribeEventsInput = {}) {
      const client = await getSdkClient()
      const result = await client.event.subscribe({
        headers: buildOpencodeAuthHeaders(input.auth),
        ...(subscribeInput.directory ? { query: { directory: subscribeInput.directory } } : {}),
        ...(subscribeInput.signal ? { signal: subscribeInput.signal } : {}),
        sseMaxRetryAttempts: subscribeInput.maxRetryAttempts ?? 0,
      })
      return result.stream as AsyncIterable<OpencodeServerEvent>
    },
    async createSession(createInput: OpencodeCreateSessionInput = {}) {
      const client = await getSdkClient()
      const result = await client.session.create({
        ...(createInput.directory ? { query: { directory: createInput.directory } } : {}),
        ...((createInput.title || createInput.parentId)
          ? {
            body: {
              ...(createInput.parentId ? { parentID: createInput.parentId } : {}),
              ...(createInput.title ? { title: createInput.title } : {}),
            },
          }
          : {}),
      })
      return assertOpencodeSession(await unwrapSdkFields<OpencodeSessionInfo>(result, 'session.create'))
    },
    async promptAsync(promptInput: OpencodePromptAsyncInput) {
      const client = await getSdkClient()
      const result = await client.session.promptAsync({
        path: { id: promptInput.sessionId },
        ...(promptInput.directory ? { query: { directory: promptInput.directory } } : {}),
        body: {
          ...(promptInput.messageId ? { messageID: promptInput.messageId } : {}),
          ...(promptInput.model ? { model: parseOpencodeModel(promptInput.model) } : {}),
          ...(promptInput.agent ? { agent: promptInput.agent } : {}),
          ...(promptInput.noReply !== undefined ? { noReply: promptInput.noReply } : {}),
          parts: [{ type: 'text', text: promptInput.prompt }],
        },
      })
      await unwrapSdkFields<Record<string, never>>(result, 'session.promptAsync')
    },
    async abortSession(abortInput: OpencodeAbortSessionInput) {
      const client = await getSdkClient()
      const result = await client.session.abort({
        path: { id: abortInput.sessionId },
        ...(abortInput.directory ? { query: { directory: abortInput.directory } } : {}),
      })
      return Boolean(await unwrapSdkFields<boolean>(result, 'session.abort'))
    },
    async listMessages(messagesInput: OpencodeListMessagesInput) {
      const client = await getSdkClient()
      const result = await client.session.messages({
        path: { id: messagesInput.sessionId },
        query: {
          ...(messagesInput.directory ? { directory: messagesInput.directory } : {}),
          ...(messagesInput.limit !== undefined ? { limit: messagesInput.limit } : {}),
        },
      })
      const data = await unwrapSdkFields<unknown[]>(result, 'session.messages')
      return Array.isArray(data) ? data : []
    },
    async respondPermission(replyInput: OpencodePermissionReplyInput) {
      const client = await getSdkClient()
      const result = await client.postSessionIdPermissionsPermissionId({
        path: { id: replyInput.sessionId, permissionID: replyInput.permissionId },
        ...(replyInput.directory ? { query: { directory: replyInput.directory } } : {}),
        body: { response: replyInput.response },
      })
      return Boolean(await unwrapSdkFields<boolean>(result, 'permissions.reply'))
    },
    async getConfigSummary() {
      const config = await requestJson<unknown>('/config')
      return summarizeOpencodeConfig(config)
    },
  }
}

export function buildOpencodeBasicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf-8').toString('base64')}`
}

export function buildOpencodeAuthHeaders(auth: OpencodeServerAuth | undefined): Headers {
  const headers = new Headers()
  if (auth) {
    headers.set('Authorization', buildOpencodeBasicAuthHeader(auth.username, auth.password))
  }
  return headers
}

export function createBasicAuthFetch(input: {
  auth?: OpencodeServerAuth
  fetchImpl?: OpencodeFetch
  timeoutMs?: number
}): (request: Request) => Promise<Response> {
  const fetchImpl = input.fetchImpl ?? fetch
  return async (request: Request): Promise<Response> => {
    const headers = new Headers(request.headers)
    if (input.auth) {
      headers.set('Authorization', buildOpencodeBasicAuthHeader(input.auth.username, input.auth.password))
    }
    const authenticatedRequest = new Request(request, { headers })
    return await fetchWithTimeout(fetchImpl, authenticatedRequest, { signal: authenticatedRequest.signal }, input.timeoutMs)
  }
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
  request: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number | undefined,
): Promise<Response> {
  if (!timeoutMs || timeoutMs <= 0) {
    return await fetchImpl(request, init)
  }

  const controller = new AbortController()
  const sourceSignal = init?.signal
  const onAbort = (): void => controller.abort()
  if (sourceSignal?.aborted) controller.abort()
  sourceSignal?.addEventListener('abort', onAbort, { once: true })
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(request, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
    sourceSignal?.removeEventListener('abort', onAbort)
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

async function defaultCreateOpencodeSdkClient(input: {
  baseUrl: string
  fetch: (request: Request) => Promise<Response>
}): Promise<OpencodeClient> {
  const { createOpencodeClient } = await import('@opencode-ai/sdk/client')
  return createOpencodeClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    responseStyle: 'fields',
  })
}

async function unwrapSdkFields<T>(result: unknown, operation: string): Promise<T> {
  if (!isSdkFieldsResult<T>(result)) {
    throw new OpencodeClientError('runtime_server_response_invalid', `opencode SDK ${operation} 返回结构无效`)
  }
  if (result.error !== undefined) {
    throw createErrorFromSdkResult(result, operation)
  }
  if (!result.response.ok) {
    throw await toOpencodeClientError(result.response)
  }
  return result.data as T
}

function isSdkFieldsResult<T>(value: unknown): value is SdkFieldsResult<T> {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.response instanceof Response
}

function createErrorFromSdkResult(result: SdkFieldsResult<unknown>, operation: string): OpencodeClientError {
  const message = redactSecretText(safeJsonStringify(result.error) ?? `${operation} failed`)
  const code = result.response.status === 401 || result.response.status === 403
    ? 'runtime_server_auth_failed'
    : 'runtime_server_request_failed'
  return new OpencodeClientError(code, `opencode SDK ${operation} 请求失败: ${message}`, result.response.status)
}

function assertOpencodeSession(value: OpencodeSessionInfo): OpencodeSessionInfo {
  if (!value || typeof value.id !== 'string' || value.id.trim() === '') {
    throw new OpencodeClientError('runtime_server_response_invalid', 'opencode session.create 未返回有效 session id')
  }
  return value
}

export function parseOpencodeModel(model: string): { providerID: string; modelID: string } {
  const trimmed = model.trim()
  const slashIndex = trimmed.indexOf('/')
  if (slashIndex <= 0 || slashIndex === trimmed.length - 1) {
    return { providerID: 'codeinsights', modelID: trimmed }
  }
  return {
    providerID: trimmed.slice(0, slashIndex),
    modelID: trimmed.slice(slashIndex + 1),
  }
}

function summarizeOpencodeConfig(value: unknown): OpencodeConfigSummary {
  const config = toRecord(value)
  const server = toRecord(config.server)
  const permission = toRecord(config.permission)
  const bash = toRecord(permission.bash)
  const provider = toRecord(config.provider)
  return {
    ...(typeof config.model === 'string' ? { model: config.model } : {}),
    ...(typeof config.share === 'string' ? { share: config.share } : {}),
    ...(typeof config.autoupdate === 'boolean' ? { autoupdate: config.autoupdate } : {}),
    server: {
      ...(typeof server.hostname === 'string' ? { hostname: server.hostname } : {}),
      ...(Array.isArray(server.cors) ? { corsCount: server.cors.length } : {}),
    },
    permission: {
      ...(typeof permission.doom_loop === 'string' ? { doomLoop: permission.doom_loop } : {}),
      ...(typeof permission.external_directory === 'string' ? { externalDirectory: permission.external_directory } : {}),
      ...(typeof permission.edit === 'string' ? { edit: permission.edit } : {}),
      bashRuleCount: Object.keys(bash).length,
    },
    providerIds: Object.keys(provider).sort(),
    enabledProviderIds: Array.isArray(config.enabled_providers)
      ? config.enabled_providers.filter((item): item is string => typeof item === 'string').sort()
      : [],
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function safeJsonStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

async function nodeHttpFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init)
  const url = new URL(request.url)
  const body = await readRequestBody(request)
  const headers = headersToNodeHeaders(request.headers)
  if (body && !hasHeader(headers, 'content-length')) {
    headers['content-length'] = String(body.byteLength)
  }
  return await new Promise<Response>((resolve, reject) => {
    let settled = false
    const rejectOnce = (error: unknown): void => {
      if (settled) return
      settled = true
      reject(error)
    }
    const resolveOnce = (response: Response): void => {
      if (settled) return
      settled = true
      resolve(response)
    }
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest
    const nodeRequest = transport({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: request.method,
      headers,
    }, (nodeResponse) => {
      const responseHeaders = new Headers()
      for (const [key, value] of Object.entries(nodeResponse.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) responseHeaders.append(key, item)
        } else if (value !== undefined) {
          responseHeaders.set(key, String(value))
        }
      }
      const bodyStream = Readable.toWeb(nodeResponse) as unknown as ReadableStream<Uint8Array>
      resolveOnce(new Response(bodyStream, {
        status: nodeResponse.statusCode ?? 0,
        statusText: nodeResponse.statusMessage,
        headers: responseHeaders,
      }))
    })
    const onAbort = (): void => {
      const error = new DOMException('The operation was aborted.', 'AbortError')
      nodeRequest.destroy(error)
      rejectOnce(error)
    }
    if (request.signal.aborted) {
      onAbort()
      return
    }
    request.signal.addEventListener('abort', onAbort, { once: true })
    nodeRequest.on('error', (error) => {
      request.signal.removeEventListener('abort', onAbort)
      rejectOnce(error)
    })
    nodeRequest.on('close', () => {
      request.signal.removeEventListener('abort', onAbort)
    })
    if (body) nodeRequest.write(body)
    nodeRequest.end()
  })
}

async function readRequestBody(request: Request): Promise<Buffer | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  const arrayBuffer = await request.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

function headersToNodeHeaders(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key] = value
  })
  return record
}

function hasHeader(headers: Record<string, string>, key: string): boolean {
  const normalized = key.toLowerCase()
  return Object.keys(headers).some((item) => item.toLowerCase() === normalized)
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

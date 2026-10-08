import { isRecord, isSuccessEnvelope, jsonResponse } from './envelope'
import { validateRequest } from './validation'

// Published from trusted main, never from the PR artifact. No Secret or binding.
const productionOrigin = 'https://population-viewer.t2421-loop.workers.dev'
const upstreamTimeoutMs = 12_000
const knownErrorCodes = new Set([
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'UPSTREAM_ERROR',
  'UPSTREAM_TIMEOUT',
  'INVALID_REQUEST',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
])
const passthroughErrorStatuses = new Set([400, 404, 405, 429, 502, 503, 504])

function allowHeader(status: number): Record<string, string> {
  return status === 405 ? { Allow: 'GET' } : {}
}
function retryAfterHeader(retryAfter: string | null): Record<string, string> {
  const isPlainSeconds = retryAfter !== null && /^\d{1,6}$/.test(retryAfter)
  return isPlainSeconds ? { 'Retry-After': retryAfter } : {}
}
function errorResponse(
  status: number,
  error: string,
  retryAfter: string | null = null,
) {
  return Response.json(
    { error },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        ...allowHeader(status),
        ...retryAfterHeader(retryAfter),
      },
    },
  )
}
const upstreamError = () => errorResponse(502, 'UPSTREAM_ERROR')

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('Content-Type') ?? ''
  return /^application\/json(?:\s*;|$)/i.test(contentType)
}
function knownErrorCode(data: Record<string, unknown>): string | undefined {
  const { error } = data
  return typeof error === 'string' && knownErrorCodes.has(error)
    ? error
    : undefined
}

// 本番APIの応答のうち、既知の形だけを同じstatusで通し、それ以外は固定の失敗にする。
function relayUpstreamResponse(response: Response, data: unknown): Response {
  if (!isRecord(data)) return upstreamError()
  if (response.status === 200 && isSuccessEnvelope(data))
    return jsonResponse(data)
  const errorCode = passthroughErrorStatuses.has(response.status)
    ? knownErrorCode(data)
    : undefined
  if (errorCode === undefined) return upstreamError()
  return errorResponse(
    response.status,
    errorCode,
    response.headers.get('Retry-After'),
  )
}

export default {
  async fetch(request: Request): Promise<Response> {
    const validation = validateRequest(request.method, new URL(request.url))
    if (!validation.ok) return errorResponse(validation.status, validation.code)

    const signal = AbortSignal.timeout(upstreamTimeoutMs)
    try {
      // Reconstruct the URL and headers; never forward browser credentials or IPs.
      const response = await fetch(
        `${productionOrigin}${validation.upstreamPath}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          redirect: 'manual',
          signal,
        },
      )
      if (!isJsonResponse(response)) {
        await response.body?.cancel()
        return upstreamError()
      }
      return relayUpstreamResponse(response, await response.json())
    } catch {
      return signal.aborted
        ? errorResponse(504, 'UPSTREAM_TIMEOUT')
        : upstreamError()
    }
  },
}

import { validateRequest } from './validation'

// Published from trusted main, never from the PR artifact. No Secret or binding.
const productionOrigin = 'https://population-viewer.t2421-loop.workers.dev'
const errorCodes = new Set([
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'UPSTREAM_ERROR',
  'UPSTREAM_TIMEOUT',
  'INVALID_REQUEST',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
])

function errorResponse(status: number, error: string, retryAfter?: string) {
  return Response.json(
    { error },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        ...(status === 405 ? { Allow: 'GET' } : {}),
        ...(retryAfter && /^\d{1,6}$/.test(retryAfter)
          ? { 'Retry-After': retryAfter }
          : {}),
      },
    },
  )
}

export default {
  async fetch(request: Request): Promise<Response> {
    const validation = validateRequest(request.method, new URL(request.url))
    if (!validation.ok) return errorResponse(validation.status, validation.code)

    const signal = AbortSignal.timeout(12_000)
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
      if (
        !/^application\/json(?:\s*;|$)/i.test(
          response.headers.get('Content-Type') ?? '',
        )
      ) {
        await response.body?.cancel()
        return errorResponse(502, 'UPSTREAM_ERROR')
      }
      const data: unknown = await response.json()
      if (typeof data !== 'object' || data === null)
        return errorResponse(502, 'UPSTREAM_ERROR')
      if (response.status === 200 && 'message' in data && 'result' in data) {
        if (
          data.message === null &&
          typeof data.result === 'object' &&
          data.result
        )
          return Response.json(data, {
            headers: { 'Cache-Control': 'no-store' },
          })
      }
      if (
        [400, 404, 405, 429, 502, 503, 504].includes(response.status) &&
        'error' in data &&
        typeof data.error === 'string' &&
        errorCodes.has(data.error)
      )
        return errorResponse(
          response.status,
          data.error,
          response.headers.get('Retry-After') ?? undefined,
        )
      return errorResponse(502, 'UPSTREAM_ERROR')
    } catch {
      return signal.aborted
        ? errorResponse(504, 'UPSTREAM_TIMEOUT')
        : errorResponse(502, 'UPSTREAM_ERROR')
    }
  },
}

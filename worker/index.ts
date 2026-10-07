import { retryAfterSeconds, upstreamOrigin, upstreamTimeoutMs } from './config'
import { isValidResponse, validateRequest } from './validation'

interface Env {
  YUMEMI_API_KEY?: string
  API_RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>
  }
}

function error(
  status: number,
  code: string,
  headers: HeadersInit = {},
): Response {
  return Response.json(
    { error: code },
    { status, headers: { 'Cache-Control': 'no-store', ...headers } },
  )
}

async function proxy(path: string, key: string): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
      reject(new Error('Upstream timeout'))
    }, upstreamTimeoutMs)
  })

  try {
    const data = await Promise.race([
      (async () => {
        // 固定originと検証済みのパス・queryだけを使用し、認証情報やredirectを転送しない。
        const response = await fetch(`${upstreamOrigin}${path}`, {
          method: 'GET',
          headers: { 'X-API-KEY': key },
          redirect: 'manual',
          signal: controller.signal,
        })
        if (!response.ok) {
          await response.body?.cancel()
          throw new Error('Upstream error')
        }
        return (await response.json()) as unknown
      })(),
      timeout,
    ])
    if (!isValidResponse(data, key)) {
      return error(502, 'UPSTREAM_ERROR')
    }
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // 上流の例外・本文・ヘッダーを応答やログに露出させない。
    return timedOut
      ? error(504, 'UPSTREAM_TIMEOUT')
      : error(502, 'UPSTREAM_ERROR')
  } finally {
    clearTimeout(timer)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    // Static Assetsが非APIの静的配信とSPA fallbackを処理する。
    if (!url.pathname.startsWith('/api/'))
      return new Response('Not Found', { status: 404 })

    // 本番ではCloudflareが設定するIPだけを使い、両API共通のキーで制限する。
    const ip = request.headers.get('CF-Connecting-IP')
    if (!ip) return error(503, 'SERVICE_UNAVAILABLE')
    try {
      const { success } = await env.API_RATE_LIMITER.limit({ key: `ip:${ip}` })
      if (!success)
        return error(429, 'RATE_LIMITED', {
          'Retry-After': String(retryAfterSeconds),
        })
    } catch {
      return error(503, 'SERVICE_UNAVAILABLE')
    }

    const validation = validateRequest(request.method, url)
    if (!validation.ok) {
      return error(
        validation.status,
        validation.code,
        validation.status === 405 ? { Allow: 'GET' } : {},
      )
    }

    const key = env.YUMEMI_API_KEY
    if (!key?.trim()) return error(503, 'SERVICE_UNAVAILABLE')
    return proxy(validation.path, key)
  },
}

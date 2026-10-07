import { retryAfterSeconds, upstreamOrigin, upstreamTimeoutMs } from './config'
import { isSafeUpstreamResponse, validateRequest } from './validation'

interface Env {
  YUMEMI_API_KEY?: string
  API_RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>
  }
}

function errorResponse(
  status: number,
  code: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(
    { error: code },
    { status, headers: { 'Cache-Control': 'no-store', ...extraHeaders } },
  )
}

async function fetchUpstreamJson(
  upstreamPath: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<unknown> {
  // 固定originと検証済みのパス・queryだけを使用し、認証情報やredirectを転送しない。
  const response = await fetch(`${upstreamOrigin}${upstreamPath}`, {
    method: 'GET',
    headers: { 'X-API-KEY': apiKey },
    redirect: 'manual',
    signal,
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error('Upstream error')
  }
  return response.json()
}

async function proxyApiRequest(
  upstreamPath: string,
  apiKey: string,
): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
      reject(new Error('Upstream timeout'))
    }, upstreamTimeoutMs)
  })

  try {
    const upstreamData = await Promise.race([
      fetchUpstreamJson(upstreamPath, apiKey, controller.signal),
      timeoutPromise,
    ])
    if (!isSafeUpstreamResponse(upstreamData, apiKey)) {
      return errorResponse(502, 'UPSTREAM_ERROR')
    }
    return Response.json(upstreamData, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    // 上流の例外・本文・ヘッダーを応答やログに露出させない。
    return timedOut
      ? errorResponse(504, 'UPSTREAM_TIMEOUT')
      : errorResponse(502, 'UPSTREAM_ERROR')
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
    if (!ip) return errorResponse(503, 'SERVICE_UNAVAILABLE')
    try {
      const { success } = await env.API_RATE_LIMITER.limit({ key: `ip:${ip}` })
      if (!success)
        return errorResponse(429, 'RATE_LIMITED', {
          'Retry-After': String(retryAfterSeconds),
        })
    } catch {
      return errorResponse(503, 'SERVICE_UNAVAILABLE')
    }

    const validation = validateRequest(request.method, url)
    if (!validation.ok) {
      return errorResponse(
        validation.status,
        validation.code,
        validation.status === 405 ? { Allow: 'GET' } : {},
      )
    }

    const apiKey = env.YUMEMI_API_KEY
    if (!apiKey?.trim()) return errorResponse(503, 'SERVICE_UNAVAILABLE')
    return proxyApiRequest(validation.upstreamPath, apiKey)
  },
}

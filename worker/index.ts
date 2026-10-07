import {
  retryAfterSeconds,
  upstreamOrigin,
  upstreamTimeoutMs,
  upstreamUserAgent,
} from './config'
import { isSafeUpstreamResponse, validateRequest } from './validation'

interface Env {
  YUMEMI_API_KEY?: string
  API_RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>
  }
}

type UpstreamFailureCode =
  | 'UPSTREAM_HTTP_ERROR'
  | 'UPSTREAM_JSON_ERROR'
  | 'UPSTREAM_RESPONSE_REJECTED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_TYPE_ERROR'
  | 'UPSTREAM_DOM_EXCEPTION'
  | 'UPSTREAM_EXCEPTION'

interface UpstreamDiagnostic {
  status: number
  httpFailed: boolean
  responseType: 'JSON' | 'HTML' | 'OTHER' | 'MISSING'
  challenge: boolean
}

function logUpstreamFailure(
  diagnostic: UpstreamDiagnostic,
  code: UpstreamFailureCode,
): void {
  // 固定分類・数値・booleanだけを出力し、生のヘッダーや例外は渡さない。
  const { status, responseType, challenge } = diagnostic
  const safeStatus =
    Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0
  console.error(
    JSON.stringify({ status: safeStatus, code, responseType, challenge }),
  )
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
  diagnostic: UpstreamDiagnostic,
): Promise<unknown> {
  // 固定originと検証済みのパス・queryだけを使用し、認証情報やredirectを転送しない。
  const response = await fetch(`${upstreamOrigin}${upstreamPath}`, {
    method: 'GET',
    headers: { 'X-API-KEY': apiKey, 'User-Agent': upstreamUserAgent },
    redirect: 'manual',
    signal,
  })
  diagnostic.status = response.status
  const mediaType = response.headers
    .get('Content-Type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase()
  diagnostic.responseType = !mediaType
    ? 'MISSING'
    : mediaType === 'application/json' ||
        /^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(mediaType)
      ? 'JSON'
      : mediaType === 'text/html'
        ? 'HTML'
        : 'OTHER'
  diagnostic.challenge = response.headers.get('cf-mitigated') === 'challenge'
  if (!response.ok) {
    diagnostic.httpFailed = true
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
  const diagnostic: UpstreamDiagnostic = {
    status: 0,
    httpFailed: false,
    responseType: 'MISSING',
    challenge: false,
  }
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
      fetchUpstreamJson(upstreamPath, apiKey, controller.signal, diagnostic),
      timeoutPromise,
    ])
    if (!isSafeUpstreamResponse(upstreamData, apiKey)) {
      logUpstreamFailure(diagnostic, 'UPSTREAM_RESPONSE_REJECTED')
      return errorResponse(502, 'UPSTREAM_ERROR')
    }
    return Response.json(upstreamData, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error: unknown) {
    // 上流の例外・本文・ヘッダーを応答やログに露出させない。
    const code: UpstreamFailureCode = timedOut
      ? 'UPSTREAM_TIMEOUT'
      : diagnostic.httpFailed
        ? 'UPSTREAM_HTTP_ERROR'
        : error instanceof SyntaxError
          ? 'UPSTREAM_JSON_ERROR'
          : error instanceof TypeError
            ? 'UPSTREAM_TYPE_ERROR'
            : error instanceof DOMException
              ? 'UPSTREAM_DOM_EXCEPTION'
              : 'UPSTREAM_EXCEPTION'
    logUpstreamFailure(diagnostic, code)
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

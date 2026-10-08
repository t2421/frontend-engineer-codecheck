import {
  retryAfterSeconds,
  upstreamOrigin,
  upstreamTimeoutMs,
  upstreamUserAgent,
} from './config'
import { jsonResponse } from './envelope'
import { isSafeUpstreamResponse, validateRequest } from './validation'

interface Env {
  YUMEMI_API_KEY?: string
  API_RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>
  }
}

type UpstreamFailureCode =
  'UPSTREAM_HTTP_ERROR' | 'UPSTREAM_TIMEOUT' | 'UNKNOWN'

// ログに出す唯一の情報。例外・本文・ヘッダーは入れない。
interface UpstreamDiagnostic {
  status: number
  code: UpstreamFailureCode
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
  if (!response.ok) {
    diagnostic.code = 'UPSTREAM_HTTP_ERROR'
    await response.body?.cancel()
    throw new Error('Upstream error')
  }
  return response.json()
}

function startUpstreamTimeout(onTimeout: () => void) {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout()
      controller.abort()
      reject(new Error('Upstream timeout'))
    }, upstreamTimeoutMs)
  })
  return {
    signal: controller.signal,
    expired,
    cancel: () => clearTimeout(timer),
  }
}

function upstreamFailureResponse(code: UpstreamFailureCode): Response {
  return code === 'UPSTREAM_TIMEOUT'
    ? errorResponse(504, 'UPSTREAM_TIMEOUT')
    : errorResponse(502, 'UPSTREAM_ERROR')
}

async function proxyApiRequest(
  upstreamPath: string,
  apiKey: string,
): Promise<Response> {
  const diagnostic: UpstreamDiagnostic = { status: 0, code: 'UNKNOWN' }
  const timeout = startUpstreamTimeout(() => {
    diagnostic.code = 'UPSTREAM_TIMEOUT'
  })
  try {
    const upstreamData = await Promise.race([
      fetchUpstreamJson(upstreamPath, apiKey, timeout.signal, diagnostic),
      timeout.expired,
    ])
    if (!isSafeUpstreamResponse(upstreamData, apiKey))
      throw new Error('Unsafe upstream response')
    return jsonResponse(upstreamData)
  } catch {
    console.error(JSON.stringify(diagnostic))
    return upstreamFailureResponse(diagnostic.code)
  } finally {
    timeout.cancel()
  }
}

// 本番ではCloudflareが設定するIPだけを使い、両API共通のキーで制限する。
async function rateLimitRejection(
  request: Request,
  env: Env,
): Promise<Response | undefined> {
  const ip = request.headers.get('CF-Connecting-IP')
  if (!ip) return errorResponse(503, 'SERVICE_UNAVAILABLE')
  try {
    const { success } = await env.API_RATE_LIMITER.limit({ key: `ip:${ip}` })
    if (success) return undefined
    return errorResponse(429, 'RATE_LIMITED', {
      'Retry-After': String(retryAfterSeconds),
    })
  } catch {
    return errorResponse(503, 'SERVICE_UNAVAILABLE')
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    // Static Assetsが非APIの静的配信とSPA fallbackを処理する。
    if (!url.pathname.startsWith('/api/'))
      return new Response('Not Found', { status: 404 })

    const rejection = await rateLimitRejection(request, env)
    if (rejection) return rejection

    const validation = validateRequest(request.method, url)
    if (!validation.ok) {
      const allowHeader: Record<string, string> =
        validation.status === 405 ? { Allow: 'GET' } : {}
      return errorResponse(validation.status, validation.code, allowHeader)
    }

    const apiKey = env.YUMEMI_API_KEY
    if (!apiKey?.trim()) return errorResponse(503, 'SERVICE_UNAVAILABLE')
    return proxyApiRequest(validation.upstreamPath, apiKey)
  },
}

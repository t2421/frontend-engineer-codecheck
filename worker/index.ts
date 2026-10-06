interface Env {
  YUMEMI_API_KEY?: string
  API_RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>
  }
}

const prefecturesPath = '/api/v1/prefectures'
const populationPath = '/api/v1/population/composition/perYear'
const upstreamOrigin = 'https://frontend-engineer-codecheck-api.mirai.yumemi.io'

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

async function proxy(url: URL, key: string): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
      reject(new Error('Upstream timeout'))
    }, 10_000)
  })

  try {
    const data = await Promise.race([
      (async () => {
        // 固定originと検証済みのパス・queryだけを使用し、認証情報やredirectを転送しない。
        const response = await fetch(
          `${upstreamOrigin}${url.pathname}${url.search}`,
          {
            method: 'GET',
            headers: { 'X-API-KEY': key },
            redirect: 'manual',
            signal: controller.signal,
          },
        )
        if (!response.ok) {
          await response.body?.cancel()
          throw new Error('Upstream error')
        }
        return (await response.json()) as unknown
      })(),
      timeout,
    ])
    // エラーenvelope・不正JSON・上流によるSecret反射をブラウザーへ返さない。
    if (
      typeof data !== 'object' ||
      data === null ||
      !('message' in data) ||
      data.message !== null ||
      !('result' in data) ||
      typeof data.result !== 'object' ||
      data.result === null ||
      JSON.stringify(data).includes(JSON.stringify(key).slice(1, -1))
    ) {
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
      if (!success) return error(429, 'RATE_LIMITED', { 'Retry-After': '10' })
    } catch {
      return error(503, 'SERVICE_UNAVAILABLE')
    }

    if (url.pathname !== prefecturesPath && url.pathname !== populationPath) {
      return error(404, 'NOT_FOUND')
    }
    if (request.method !== 'GET')
      return error(405, 'METHOD_NOT_ALLOWED', { Allow: 'GET' })

    const parameters = [...url.searchParams]
    if (url.pathname === prefecturesPath) {
      if (parameters.length !== 0) return error(400, 'INVALID_REQUEST')
    } else {
      const code = url.searchParams.get('prefCode') ?? ''
      if (
        parameters.length !== 1 ||
        parameters[0]?.[0] !== 'prefCode' ||
        !/^(?:[1-9]|[1-3][0-9]|4[0-7])$/.test(code)
      ) {
        return error(400, 'INVALID_REQUEST')
      }
      // 許可済みの値からqueryを再構築し、入力URLを直接転送しない。
      url.search = new URLSearchParams({ prefCode: code }).toString()
    }

    const key = env.YUMEMI_API_KEY
    if (!key?.trim()) return error(503, 'SERVICE_UNAVAILABLE')
    return proxy(url, key)
  },
}

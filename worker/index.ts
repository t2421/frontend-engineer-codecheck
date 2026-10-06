// API中継は未実装。画面はWorkers Static Assetsが配信する。
interface Env {
  API_RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/api/')) {
      // 本番ではCloudflareが設定するヘッダーを使う。IPはログに残さない。
      const ip = request.headers.get('CF-Connecting-IP')
      if (!ip) return new Response('Client IP unavailable', { status: 503 })
      const { success } = await env.API_RATE_LIMITER.limit({ key: `ip:${ip}` })
      if (!success) {
        return new Response('Too Many Requests', {
          status: 429,
          headers: { 'Retry-After': '10' },
        })
      }
    }
    return new Response('Not Found', { status: 404 })
  },
}

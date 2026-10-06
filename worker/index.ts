// API中継は未実装。画面はWorkers Static Assetsが配信する。
export default {
  fetch(): Response {
    return new Response('Not Found', { status: 404 })
  },
}

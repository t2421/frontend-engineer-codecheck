export const prefecturesPath = '/api/v1/prefectures'
export const populationPath = '/api/v1/population/composition/perYear'
export const prefectureCount = 47
export const upstreamOrigin =
  'https://frontend-engineer-codecheck-api.mirai.yumemi.io'
export const upstreamTimeoutMs = 10_000
export const retryAfterSeconds = 10
// User-Agentなしの403/HTMLを避け、プロキシ自身を名乗る固定値を送る。
// 比較検証の観測結果はdocs/API_PROXY.mdに記録する。
export const upstreamUserAgent = 'population-viewer-proxy'

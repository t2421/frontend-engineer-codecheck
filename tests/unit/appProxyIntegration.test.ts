import { afterEach, expect, test, vi } from 'vitest'
import worker from '../../worker/index'
import { fetchPrefectures } from '../../src/features/population/prefectureApi'
import { fetchPopulation } from '../../src/features/population/populationApi'
import { prefectureResponse, appPopulationResponse } from '../fixtures/appApi'

afterEach(() => vi.unstubAllGlobals())

test('画面API取得→既存Worker→固定上流の契約が一致する（合成応答）', async () => {
  const requests: Request[] = []
  const env = {
    YUMEMI_API_KEY: 'synthetic-test-only',
    API_RATE_LIMITER: { limit: async () => ({ success: true }) },
  }
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    if (input.startsWith('/api/')) {
      const request = new Request(`https://app.invalid${input}`, {
        ...init,
        headers: { 'CF-Connecting-IP': '192.0.2.1' },
      })
      return worker.fetch(request, env)
    }
    const request = new Request(input, init)
    requests.push(request)
    return Response.json(
      request.url.includes('/prefectures')
        ? prefectureResponse
        : appPopulationResponse(13),
    )
  })
  expect(await fetchPrefectures()).toHaveLength(47)
  const population = await fetchPopulation(13)
  expect(population.categories.total[0]).toEqual({ year: 1960, value: 1300000 })
  expect(population.categories.elder[12]).toEqual({
    year: 2020,
    value: 1342000,
  })
  expect(requests.map((r) => r.url)).toEqual([
    'https://frontend-engineer-codecheck-api.mirai.yumemi.io/api/v1/prefectures',
    'https://frontend-engineer-codecheck-api.mirai.yumemi.io/api/v1/population/composition/perYear?prefCode=13',
  ])
  expect(
    requests.every((r) => r.method === 'GET' && r.redirect === 'manual'),
  ).toBe(true)
})

for (const status of [429, 502, 503, 504]) {
  test(`proxy ${status}を一覧・人口の安全な画面エラーへ変換する`, async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: 'UPSTREAM_ERROR' }, { status }),
        ),
    )
    await expect(fetchPrefectures()).rejects.toThrow(
      '都道府県一覧を取得できませんでした',
    )
    await expect(fetchPopulation(13)).rejects.toThrow(
      '人口データを取得できませんでした',
    )
  })
}

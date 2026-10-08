import { describe, expect, test, vi } from 'vitest'
import worker from '../../worker/index'
import { fetchPrefectures } from '../../src/components/prefectures/prefectureApi'
import { fetchPopulation } from '../../src/components/population/populationApi'
import { prefectureResponse, appPopulationResponse } from '../fixtures/appApi'

const upstreamOrigin = 'https://frontend-engineer-codecheck-api.mirai.yumemi.io'
const env = {
  YUMEMI_API_KEY: 'synthetic-test-only',
  API_RATE_LIMITER: { limit: async () => ({ success: true }) },
}

// 画面からの fetch を Worker に渡し、Worker からの fetch は上流の合成応答で受ける。
function routeThroughWorker() {
  const upstreamRequests: Request[] = []
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    if (input.startsWith('/api/')) {
      const request = new Request(`https://app.invalid${input}`, {
        ...init,
        headers: { 'CF-Connecting-IP': '192.0.2.1' },
      })
      return worker.fetch(request, env)
    }
    const request = new Request(input, init)
    upstreamRequests.push(request)
    return Response.json(
      request.url.includes('/prefectures')
        ? prefectureResponse
        : appPopulationResponse(13),
    )
  })
  return upstreamRequests
}

describe('画面のAPI取得 → Worker → 上流 の契約', () => {
  test('一覧と人口を固定の上流URLへGETで中継し、画面側で解析できる', async () => {
    const upstreamRequests = routeThroughWorker()

    expect(await fetchPrefectures()).toHaveLength(47)
    const population = await fetchPopulation(13)
    expect(population.categories.total[0]).toEqual({
      year: 1960,
      value: 1300000,
    })
    expect(population.categories.elder[12]).toEqual({
      year: 2020,
      value: 1342000,
    })

    expect(upstreamRequests.map((r) => r.url)).toEqual([
      `${upstreamOrigin}/api/v1/prefectures`,
      `${upstreamOrigin}/api/v1/population/composition/perYear?prefCode=13`,
    ])
    expect(upstreamRequests.every((r) => r.method === 'GET')).toBe(true)
    expect(upstreamRequests.every((r) => r.redirect === 'manual')).toBe(true)
  })

  test.each([429, 502, 503, 504])(
    'Workerの %d 応答を画面側の固定文言の失敗にする',
    async (status) => {
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
    },
  )
})

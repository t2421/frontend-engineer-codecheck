import { describe, expect, test, vi } from 'vitest'
import {
  fetchPopulation,
  parsePopulation,
  PopulationDataError,
  POPULATION_FETCH_ERROR,
} from '../../src/components/population/populationApi'
import { populationResponse } from '../fixtures/population'

// 総人口の年別データだけを差し替えた応答を作る。
function withTotalPoints(points: unknown[]) {
  const response = populationResponse()
  const [total, ...others] = response.result.data
  return {
    ...response,
    result: {
      ...response.result,
      data: [{ ...total, data: points }, ...others],
    },
  }
}

describe('parsePopulation', () => {
  test('4区分を年の昇順に並べ、rateは指定された点にだけ残す', () => {
    const response = withTotalPoints([
      { year: 2030, value: 300, rate: 100 },
      { year: 2010, value: 0, rate: 0 },
      { year: 2020, value: 200 },
    ])
    const { boundaryYear, categories } = parsePopulation(response)
    expect(boundaryYear).toBe(2020)
    expect(Object.keys(categories)).toEqual([
      'total',
      'young',
      'working',
      'elder',
    ])
    expect(categories.total).toEqual([
      { year: 2010, value: 0, rate: 0 },
      { year: 2020, value: 200 },
      { year: 2030, value: 300, rate: 100 },
    ])
    expect(categories.young).toEqual([{ year: 2020, value: 101, rate: 20 }])
  })

  test('必要な4区分以外のラベルは無視する', () => {
    const response = populationResponse()
    response.result.data.push({
      label: '未知の人口区分',
      data: [{ year: 2020, value: 999 }],
    })
    expect(parsePopulation(response)).toEqual(
      parsePopulation(populationResponse()),
    )
  })

  test.each([
    { name: 'nullの本文', body: null },
    {
      name: 'messageがエラー',
      body: { ...populationResponse(), message: 'error' },
    },
    {
      name: '区分が空',
      body: { message: null, result: { boundaryYear: 2020, data: [] } },
    },
    {
      name: 'boundaryYearが文字列',
      body: {
        message: null,
        result: { ...populationResponse().result, boundaryYear: '2020' },
      },
    },
    {
      name: '必要な区分の重複',
      body: {
        message: null,
        result: {
          boundaryYear: 2020,
          data: [
            ...populationResponse().result.data,
            populationResponse().result.data[0],
          ],
        },
      },
    },
  ])('不正な応答（$name）を拒否する', ({ body }) => {
    expect(() => parsePopulation(body)).toThrow(PopulationDataError)
  })

  test.each([
    { name: '点がnull', point: null },
    { name: '年が小数', point: { year: 2020.5, value: 100 } },
    { name: '人数が小数', point: { year: 2020, value: 100.5 } },
    { name: '人数が負', point: { year: 2020, value: -1 } },
    { name: 'rateが文字列', point: { year: 2020, value: 100, rate: '20' } },
    { name: 'rateがNaN', point: { year: 2020, value: 100, rate: NaN } },
    { name: 'rateが100超', point: { year: 2020, value: 100, rate: 101 } },
  ])('不正な年別データ（$name）を拒否する', ({ point }) => {
    expect(() => parsePopulation(withTotalPoints([point]))).toThrow(
      PopulationDataError,
    )
  })

  test('同じ区分に同じ年が重複する応答を拒否する', () => {
    const response = withTotalPoints([
      { year: 2020, value: 100 },
      { year: 2020, value: 200 },
    ])
    expect(() => parsePopulation(response)).toThrow(PopulationDataError)
  })

  test('失敗は固定の表示文言と、開発者向けの理由を持つ', () => {
    expect(() => parsePopulation(null)).toThrow(
      expect.objectContaining({
        name: 'PopulationDataError',
        message: POPULATION_FETCH_ERROR,
        reason: expect.stringMatching(/\S/),
      }),
    )
  })
})

describe('fetchPopulation', () => {
  const successFetcher = () =>
    vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(populationResponse())))

  test('県コードを付けた同一オリジンのGETで取得し、15秒でタイムアウトする', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const fetcher = successFetcher()
    const result = await fetchPopulation(13, fetcher)
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/population/composition/perYear?prefCode=13',
      { method: 'GET', signal: expect.any(AbortSignal) },
    )
    expect(timeout).toHaveBeenCalledWith(15000)
    expect(result.categories.working).toEqual([
      { year: 2020, value: 102, rate: 20 },
    ])
  })

  test.each([0, 48, 1.5, NaN])(
    '不正な県コード %s では通信しない',
    async (code) => {
      const fetcher = vi.fn()
      await expect(fetchPopulation(code, fetcher)).rejects.toThrow(
        PopulationDataError,
      )
      expect(fetcher).not.toHaveBeenCalled()
    },
  )

  test.each([
    {
      name: 'HTTP失敗',
      fetcher: () =>
        vi
          .fn()
          .mockResolvedValue(new Response('private details', { status: 503 })),
    },
    {
      name: 'JSONでない本文',
      fetcher: () => vi.fn().mockResolvedValue(new Response('invalid JSON')),
    },
    {
      name: '通信例外',
      fetcher: () => vi.fn().mockRejectedValue(new Error('private details')),
    },
  ])('$name は内部情報を含まない固定文言の失敗にする', async ({ fetcher }) => {
    await expect(fetchPopulation(1, fetcher())).rejects.toThrow(
      POPULATION_FETCH_ERROR,
    )
  })

  test('通信例外は元の例外をcauseに残す', async () => {
    const cause = new Error('private details')
    await expect(
      fetchPopulation(1, vi.fn().mockRejectedValue(cause)),
    ).rejects.toMatchObject({ reason: 'request failed', cause })
  })

  test('解析時のPopulationDataErrorは包み直さずそのまま投げる', async () => {
    const error = new PopulationDataError('synthetic failure')
    await expect(
      fetchPopulation(1, vi.fn().mockRejectedValue(error)),
    ).rejects.toBe(error)
  })
})

import { expect, test, vi } from 'vitest'
import {
  fetchPopulation,
  parsePopulation,
  PopulationDataError,
  POPULATION_FETCH_ERROR,
} from '../../src/components/population/populationApi'
import { populationResponse } from '../fixtures/population'

test('未知の追加ラベルを無視し、必要な4区分だけを返す', () => {
  const response = populationResponse()
  const expected = parsePopulation(response)
  response.result.data.push({
    label: '未知の人口区分',
    data: [{ year: 2020, value: 999 }],
  })
  expect(parsePopulation(response)).toEqual(expected)
  expect(Object.keys(parsePopulation(response).categories)).toEqual([
    'total',
    'young',
    'working',
    'elder',
  ])
})

test('解析失敗は固定表示文言と空でない開発者向け理由を持つ', () => {
  expect(() => parsePopulation(null)).toThrow(PopulationDataError)
  try {
    parsePopulation(null)
  } catch (error) {
    expect(error).toMatchObject({
      name: 'PopulationDataError',
      message: '人口データを取得できませんでした',
      reason: expect.stringMatching(/\S/),
    })
    expect((error as Error).message).toBe(POPULATION_FETCH_ERROR)
  }
})

test('通信失敗は表示文言を固定したまま元の例外をcauseに保持する', async () => {
  const cause = new Error('private upstream details')
  const fetcher = vi.fn().mockRejectedValue(cause)
  const request = fetchPopulation(1, fetcher)
  await expect(request).rejects.toMatchObject({
    name: 'PopulationDataError',
    message: '人口データを取得できませんでした',
    reason: 'request failed',
    cause,
  })
  const error: unknown = await request.catch((error) => error)
  expect((error as Error).cause).toBe(cause)
})

test('既存のPopulationDataErrorは包み直さず同じ例外を返す', async () => {
  const error = new PopulationDataError('synthetic failure')
  await expect(
    fetchPopulation(1, vi.fn().mockRejectedValue(error)),
  ).rejects.toBe(error)
})

test('年を昇順に並べ、率の境界値と未指定時のキー省略を維持する', () => {
  const response = populationResponse()
  response.result.data[0]!.data = [
    { year: 2030, value: 300, rate: 100 },
    { year: 2010, value: 0, rate: 0 },
    { year: 2020, value: 200 },
  ]
  expect(parsePopulation(response).categories.total).toEqual([
    { year: 2010, value: 0, rate: 0 },
    { year: 2020, value: 200 },
    { year: 2030, value: 300, rate: 100 },
  ])
})

test('必要なラベルの重複は追加区分があっても拒否する', () => {
  const response = populationResponse()
  response.result.data.push(response.result.data[0]!)
  expect(() => parsePopulation(response)).toThrow(PopulationDataError)
})

test('同一区分の年重複は拒否する', () => {
  const response = populationResponse()
  response.result.data[0]!.data.push({ year: 2020, value: 200 })
  expect(() => parsePopulation(response)).toThrow(PopulationDataError)
})

test.each([
  null,
  { year: 2020.5, value: 100 },
  { year: 2020, value: 100.5 },
  { year: 2020, value: 100, rate: '20' },
  { year: 2020, value: 100, rate: NaN },
  { year: 2020, value: 100, rate: 101 },
])('年別データの不正な型や範囲を拒否する %#', (point) => {
  const response = populationResponse()
  const body = {
    ...response,
    result: {
      ...response.result,
      data: response.result.data.map((series, index) =>
        index === 0 ? { ...series, data: [point] } : series,
      ),
    },
  }
  expect(() => parsePopulation(body)).toThrow(PopulationDataError)
})

test('全区分を県単位の同一オリジンGETから取得する', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(populationResponse())))
  const result = await fetchPopulation(1, fetcher)
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    '/api/v1/population/composition/perYear?prefCode=1',
    { method: 'GET', signal: expect.any(AbortSignal) },
  )
  expect(result.categories.working).toEqual([
    { year: 2020, value: 102, rate: 20 },
  ])
  expect(result.boundaryYear).toBe(2020)
})

test.each([0, 48, 1.5, NaN])('不正県コード%sでは通信しない', async (code) => {
  const fetcher = vi.fn()
  await expect(fetchPopulation(code, fetcher)).rejects.toThrow()
  expect(fetcher).not.toHaveBeenCalled()
})

test.each([
  null,
  { message: 'error', result: populationResponse().result },
  { message: null, result: { boundaryYear: 2020, data: [] } },
  {
    message: null,
    result: { ...populationResponse().result, boundaryYear: '2020' },
  },
  {
    message: null,
    result: {
      boundaryYear: 2020,
      data: populationResponse().result.data.map((s) => ({
        ...s,
        data: [{ year: 2020, value: -1 }],
      })),
    },
  },
  {
    message: null,
    result: {
      boundaryYear: 2020,
      data: Array(4).fill(populationResponse().result.data[0]),
    },
  },
])('不正な応答を受け入れない %#', (body) => {
  expect(() => parsePopulation(body)).toThrow()
})

test('HTTP失敗・JSON不正・通信失敗は安全なエラーにする', async () => {
  for (const fetcher of [
    vi
      .fn()
      .mockResolvedValue(
        new Response('private upstream details', { status: 503 }),
      ),
    vi.fn().mockResolvedValue(new Response('invalid JSON')),
    vi.fn().mockRejectedValue(new Error('private upstream details')),
  ]) {
    await expect(fetchPopulation(1, fetcher)).rejects.toThrow(
      '人口データを取得できませんでした',
    )
  }
})

test('人口取得にも15秒のタイムアウトを設け、GET以外の情報を送らない', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(populationResponse())))
  try {
    await fetchPopulation(13, fetcher)
    expect(timeout).toHaveBeenCalledWith(15000)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/population/composition/perYear?prefCode=13',
      {
        method: 'GET',
        signal: expect.any(AbortSignal),
      },
    )
  } finally {
    timeout.mockRestore()
  }
})

import { expect, test, vi } from 'vitest'
import {
  fetchPopulation,
  parsePopulation,
} from '../../src/features/population/populationApi'
import { populationResponse } from '../fixtures/population'

test('全区分を県単位の同一オリジンGETから取得する', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(populationResponse())))
  const result = await fetchPopulation(1, fetcher)
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    '/api/v1/population/composition/perYear?prefCode=1',
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

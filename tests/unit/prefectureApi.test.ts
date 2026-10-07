import { afterEach, expect, test, vi } from 'vitest'
import {
  fetchPrefectures,
  parsePrefectures,
} from '../../src/features/population/prefectureApi'
const result = [
  { prefCode: 13, prefName: '東京都' },
  { prefCode: 1, prefName: '北海道' },
]
afterEach(() => vi.unstubAllGlobals())
test('API順のcode/nameを取得し同一オリジンのGETだけを使う', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ message: null, result })))
  vi.stubGlobal('fetch', fetch)
  expect(await fetchPrefectures()).toEqual(result)
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/prefectures',
    expect.objectContaining({ method: 'GET' }),
  )
})
test.each([
  {},
  { message: 'error', result },
  { message: null, result: [] },
  { message: null, result: [{ prefCode: 0, prefName: '県' }] },
  { message: null, result: [{ prefCode: 48, prefName: '県' }] },
  { message: null, result: [{ prefCode: '1', prefName: '県' }] },
  { message: null, result: [{ prefCode: 1, prefName: ' ' }] },
  { message: null, result: [result[0], result[0]] },
])('不正な一覧を失敗にする %j', (body) => {
  expect(() => parsePrefectures(body)).toThrow(
    '都道府県一覧を取得できませんでした',
  )
})
test.each([
  new Response('private upstream details', { status: 503 }),
  new Response('<html>SPA</html>'),
])('HTTP失敗・未配信HTMLを安全な失敗へ変換', async (response) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
  await expect(fetchPrefectures()).rejects.toThrow(
    '都道府県一覧を取得できませんでした',
  )
})
test('ネットワーク例外を表示に反射しない', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('internal details')),
  )
  await expect(fetchPrefectures()).rejects.toThrow(
    '都道府県一覧を取得できませんでした',
  )
})

test('画面離脱のabortをfetchへ伝え、安全な失敗へ変換する', async () => {
  const controller = new AbortController()
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new Error('abort internals')),
          )
        }),
    ),
  )
  const request = fetchPrefectures(controller.signal)
  controller.abort()
  await expect(request).rejects.toThrow('都道府県一覧を取得できませんでした')
})

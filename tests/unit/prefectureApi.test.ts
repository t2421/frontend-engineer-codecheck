import { describe, expect, test, vi } from 'vitest'
import {
  fetchPrefectures,
  parsePrefectures,
  prefectureFailure,
} from '../../src/components/prefectures/prefectureApi'
import { hokkaido, tokyo } from '../fixtures/prefectures'

const result = [tokyo, hokkaido]

describe('parsePrefectures', () => {
  test('API順のcodeとnameを返す', () => {
    expect(parsePrefectures({ message: null, result })).toEqual(result)
  })

  test.each([
    { name: '空の本文', body: {} },
    { name: 'messageがエラー', body: { message: 'error', result } },
    { name: '一覧が空', body: { message: null, result: [] } },
    {
      name: 'コードが0',
      body: { message: null, result: [{ prefCode: 0, prefName: '県' }] },
    },
    {
      name: 'コードが48',
      body: { message: null, result: [{ prefCode: 48, prefName: '県' }] },
    },
    {
      name: 'コードが文字列',
      body: { message: null, result: [{ prefCode: '1', prefName: '県' }] },
    },
    {
      name: '名前が空白',
      body: { message: null, result: [{ prefCode: 1, prefName: ' ' }] },
    },
    { name: 'コードの重複', body: { message: null, result: [tokyo, tokyo] } },
  ])('不正な一覧（$name）を固定文言の失敗にする', ({ body }) => {
    expect(() => parsePrefectures(body)).toThrow(prefectureFailure)
  })
})

describe('fetchPrefectures', () => {
  test('同一オリジンのGETで取得する', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: null, result })),
      )
    vi.stubGlobal('fetch', fetch)
    expect(await fetchPrefectures()).toEqual(result)
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/prefectures', {
      method: 'GET',
      signal: expect.any(AbortSignal),
    })
  })

  test.each([
    {
      name: 'HTTP失敗',
      fetch: () =>
        vi
          .fn()
          .mockResolvedValue(new Response('private details', { status: 503 })),
    },
    {
      name: 'HTMLの応答',
      fetch: () => vi.fn().mockResolvedValue(new Response('<html>SPA</html>')),
    },
    {
      name: '通信例外',
      fetch: () => vi.fn().mockRejectedValue(new Error('private details')),
    },
  ])('$name は内部情報を含まない固定文言の失敗にする', async ({ fetch }) => {
    vi.stubGlobal('fetch', fetch())
    await expect(fetchPrefectures()).rejects.toThrow(prefectureFailure)
  })

  test('呼び出し元のabortをfetchへ伝え、固定文言の失敗にする', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init: RequestInit) =>
          new Promise((_, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(new Error('abort internals')),
            ),
          ),
      ),
    )
    const controller = new AbortController()
    const request = fetchPrefectures(controller.signal)
    controller.abort()
    await expect(request).rejects.toThrow(prefectureFailure)
  })
})

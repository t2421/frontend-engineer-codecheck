import { effectScope } from 'vue'
import { describe, expect, test, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  usePrefectures,
  type PrefectureLoader,
} from '../../src/composables/usePrefectures'
import { deferred } from '../fixtures/deferred'
import type { Prefecture } from '../../src/components/prefectures/prefectureApi'
import { hokkaido } from '../fixtures/prefectures'

function setup(loader: PrefectureLoader) {
  const scope = effectScope()
  const state = scope.run(() => usePrefectures(loader))
  if (!state) throw new Error('scope.run が値を返しませんでした')
  return { scope, state }
}

describe('usePrefectures', () => {
  test('生成時に一覧を取得し、成功で ready になる', async () => {
    const { state } = setup(vi.fn().mockResolvedValue([hokkaido]))
    expect(state.status.value).toBe('loading')
    await flushPromises()
    expect(state.status.value).toBe('ready')
    expect(state.prefectures.value).toEqual([hokkaido])
  })

  test('失敗で error になり、retry で再取得する', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('internal'))
      .mockResolvedValue([hokkaido])
    const { state } = setup(loader)
    await flushPromises()
    expect(state.status.value).toBe('error')
    await state.retry()
    expect(state.status.value).toBe('ready')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('取得中の retry は重複して取得しない', async () => {
    const pending = deferred<Prefecture[]>()
    const loader = vi.fn(() => pending.promise)
    const { state } = setup(loader)
    void state.retry()
    expect(loader).toHaveBeenCalledTimes(1)
  })

  test('scope 終了で取得を中断し、遅れて届いた成功・失敗や retry を無視する', async () => {
    const pending = deferred<Prefecture[]>()
    let signal: AbortSignal | undefined
    const loader = vi.fn((s?: AbortSignal) => {
      signal = s
      return pending.promise
    })
    const { scope, state } = setup(loader)
    scope.stop()
    expect(signal?.aborted).toBe(true)

    pending.resolve([hokkaido])
    await flushPromises()
    expect(state.prefectures.value).toEqual([])
    expect(state.status.value).toBe('loading')

    await state.retry()
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

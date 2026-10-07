import { effectScope } from 'vue'
import { expect, test, vi } from 'vitest'
import { usePrefectures } from '../../src/features/population/usePrefectures'
const data = [{ prefCode: 1, prefName: '北海道' }]
test('scope終了で中断し遅延成功を反映しない', async () => {
  let resolve!: (value: typeof data) => void
  let signal: AbortSignal | undefined
  const scope = effectScope()
  const state = scope.run(() =>
    usePrefectures((s) => {
      signal = s
      return new Promise((r) => {
        resolve = r
      })
    }),
  )!
  expect(state.status.value).toBe('loading')
  scope.stop()
  expect(signal?.aborted).toBe(true)
  resolve(data)
  await Promise.resolve()
  expect(state.prefectures.value).toEqual([])
})
test('scope終了後の遅延失敗・retryは状態や通信を更新しない', async () => {
  let reject!: (reason: Error) => void
  const loader = vi.fn(
    () =>
      new Promise<typeof data>((_, r) => {
        reject = r
      }),
  )
  const scope = effectScope()
  const state = scope.run(() => usePrefectures(loader))!
  scope.stop()
  reject(new Error('internal'))
  await Promise.resolve()
  await state.retry()
  expect(state.status.value).toBe('loading')
  expect(loader).toHaveBeenCalledTimes(1)
})

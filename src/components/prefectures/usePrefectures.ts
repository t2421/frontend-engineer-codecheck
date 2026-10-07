import { onScopeDispose, readonly, ref } from 'vue'
import { fetchPrefectures, type Prefecture } from './prefectureApi'
export type PrefectureLoader = (
  signal?: AbortSignal,
) => Promise<readonly Prefecture[]>
export function usePrefectures(loader: PrefectureLoader = fetchPrefectures) {
  const prefectures = ref<readonly Prefecture[]>([])
  const status = ref<'loading' | 'error' | 'ready'>('loading')
  let active = true
  let pending = false
  let controller: AbortController | undefined
  async function retry() {
    if (pending || !active) return
    pending = true
    status.value = 'loading'
    controller = new AbortController()
    try {
      const result = await loader(controller.signal)
      if (!active) return
      prefectures.value = result
      status.value = 'ready'
    } catch {
      if (active) status.value = 'error'
    } finally {
      pending = false
    }
  }
  onScopeDispose(() => {
    active = false
    controller?.abort()
  })
  void retry()
  return { prefectures: readonly(prefectures), status: readonly(status), retry }
}

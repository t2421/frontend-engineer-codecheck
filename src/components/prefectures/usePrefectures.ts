import { onScopeDispose, readonly, ref } from 'vue'
import { fetchPrefectures, type Prefecture } from './prefectureApi'
export type PrefectureLoader = (
  signal?: AbortSignal,
) => Promise<readonly Prefecture[]>
export function usePrefectures(loader: PrefectureLoader = fetchPrefectures) {
  const prefectures = ref<readonly Prefecture[]>([])
  const status = ref<'loading' | 'error' | 'ready'>('loading')
  let isScopeActive = true
  let isLoading = false
  let controller: AbortController | undefined
  async function load() {
    if (isLoading || !isScopeActive) return
    isLoading = true
    status.value = 'loading'
    controller = new AbortController()
    try {
      const result = await loader(controller.signal)
      if (!isScopeActive) return
      prefectures.value = result
      status.value = 'ready'
    } catch {
      if (isScopeActive) status.value = 'error'
    } finally {
      isLoading = false
    }
  }
  onScopeDispose(() => {
    isScopeActive = false
    controller?.abort()
  })
  void load()
  return {
    prefectures: readonly(prefectures),
    status: readonly(status),
    retry: load,
  }
}

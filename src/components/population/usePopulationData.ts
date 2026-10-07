import {
  computed,
  onScopeDispose,
  shallowReactive,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue'
import {
  fetchPopulation,
  type PopulationCategory,
  type PopulationComposition,
  type PopulationSeries,
  type SelectedPrefecture,
} from './populationApi'
import type { StatusMessageState } from '../shared/StatusMessage.vue'
export type PopulationStatus = StatusMessageState | 'ready'
export type PopulationLoader = (
  prefCode: number,
) => Promise<PopulationComposition>
type Entry =
  | { status: 'loading' | 'error'; request: symbol }
  | { status: 'ready'; request: symbol; data: PopulationComposition }

export function usePopulationData(
  selected: MaybeRefOrGetter<readonly SelectedPrefecture[]>,
  category: MaybeRefOrGetter<PopulationCategory>,
  loader: PopulationLoader = fetchPopulation,
) {
  const entries = shallowReactive(new Map<number, Entry>())
  // scope 破棄後に届いた応答で reactive state を更新しないため。
  let active = true
  onScopeDispose(() => {
    active = false
  })
  // 同じ prefCode が重複して渡された場合に 1 件にまとめる。
  const prefectures = computed(() => [
    ...new Map(toValue(selected).map((p) => [p.prefCode, p])).values(),
  ])
  async function load(code: number) {
    const request = Symbol()
    entries.set(code, { status: 'loading', request })
    try {
      const data = await loader(code)
      if (active && entries.get(code)?.request === request)
        entries.set(code, { status: 'ready', request, data })
    } catch {
      if (active && entries.get(code)?.request === request)
        entries.set(code, { status: 'error', request })
    }
  }
  watch(
    prefectures,
    (current, previous = []) => {
      const previousCodes = new Set(previous.map((p) => p.prefCode))
      for (const { prefCode } of current) {
        const entry = entries.get(prefCode)
        if (
          !entry ||
          (entry.status === 'error' && !previousCodes.has(prefCode))
        )
          void load(prefCode)
      }
    },
    { immediate: true },
  )
  const status = computed<PopulationStatus>(() => {
    if (!prefectures.value.length) return 'empty'
    if (
      prefectures.value.some((p) => entries.get(p.prefCode)?.status === 'error')
    )
      return 'error'
    if (
      prefectures.value.some(
        (p) => entries.get(p.prefCode)?.status === 'loading',
      )
    )
      return 'loading'
    return 'ready'
  })
  const series = computed<PopulationSeries[]>(() =>
    prefectures.value.flatMap((p) => {
      const entry = entries.get(p.prefCode)
      return entry?.status === 'ready'
        ? [
            {
              ...p,
              boundaryYear: entry.data.boundaryYear,
              data: entry.data.categories[toValue(category)],
            },
          ]
        : []
    }),
  )
  function retry() {
    for (const { prefCode } of prefectures.value)
      if (entries.get(prefCode)?.status === 'error') void load(prefCode)
  }
  return { status, series, retry }
}

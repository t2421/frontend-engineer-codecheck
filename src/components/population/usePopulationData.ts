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
type PopulationEntry =
  | { status: 'loading' | 'error'; requestId: symbol }
  | { status: 'ready'; requestId: symbol; data: PopulationComposition }
type EntryStatus = PopulationEntry['status']

function uniqueByPrefCode(
  prefectures: readonly SelectedPrefecture[],
): SelectedPrefecture[] {
  const byCode = new Map(prefectures.map((p) => [p.prefCode, p]))
  return [...byCode.values()]
}

export function usePopulationData(
  selectedPrefectures: MaybeRefOrGetter<readonly SelectedPrefecture[]>,
  category: MaybeRefOrGetter<PopulationCategory>,
  loader: PopulationLoader = fetchPopulation,
) {
  const populationByPrefCode = shallowReactive(
    new Map<number, PopulationEntry>(),
  )
  // scope 破棄後に届いた応答で reactive state を更新しないため。
  let isScopeActive = true
  onScopeDispose(() => {
    isScopeActive = false
  })
  const uniqueSelectedPrefectures = computed(() =>
    uniqueByPrefCode(toValue(selectedPrefectures)),
  )
  function statusOf(prefCode: number): EntryStatus | undefined {
    return populationByPrefCode.get(prefCode)?.status
  }
  function anySelectedHasStatus(status: EntryStatus): boolean {
    return uniqueSelectedPrefectures.value.some(
      ({ prefCode }) => statusOf(prefCode) === status,
    )
  }
  function isLatestRequest(prefCode: number, requestId: symbol): boolean {
    return (
      isScopeActive &&
      populationByPrefCode.get(prefCode)?.requestId === requestId
    )
  }
  async function loadPopulation(prefCode: number) {
    const requestId = Symbol()
    populationByPrefCode.set(prefCode, { status: 'loading', requestId })
    const entry = await loader(prefCode).then(
      (data): PopulationEntry => ({ status: 'ready', requestId, data }),
      (): PopulationEntry => ({ status: 'error', requestId }),
    )
    if (isLatestRequest(prefCode, requestId))
      populationByPrefCode.set(prefCode, entry)
  }
  watch(
    uniqueSelectedPrefectures,
    (currentPrefectures, previousPrefectures = []) => {
      const previousPrefCodes = new Set(
        previousPrefectures.map((prefecture) => prefecture.prefCode),
      )
      for (const { prefCode } of currentPrefectures) {
        const isNewlySelected = !previousPrefCodes.has(prefCode)
        const isUnloaded = !populationByPrefCode.has(prefCode)
        const retriesFailedSelection =
          statusOf(prefCode) === 'error' && isNewlySelected
        if (isUnloaded || retriesFailedSelection) void loadPopulation(prefCode)
      }
    },
    { immediate: true },
  )
  const status = computed<PopulationStatus>(() => {
    if (!uniqueSelectedPrefectures.value.length) return 'empty'
    if (anySelectedHasStatus('error')) return 'error'
    if (anySelectedHasStatus('loading')) return 'loading'
    return 'ready'
  })
  const series = computed<PopulationSeries[]>(() =>
    uniqueSelectedPrefectures.value.flatMap((prefecture) => {
      const entry = populationByPrefCode.get(prefecture.prefCode)
      if (entry?.status !== 'ready') return []
      return [
        {
          ...prefecture,
          boundaryYear: entry.data.boundaryYear,
          data: entry.data.categories[toValue(category)],
        },
      ]
    }),
  )
  function retry() {
    for (const { prefCode } of uniqueSelectedPrefectures.value)
      if (statusOf(prefCode) === 'error') void loadPopulation(prefCode)
  }
  return { status, series, retry }
}

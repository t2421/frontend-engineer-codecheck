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
  const uniqueSelectedPrefectures = computed(() => [
    ...new Map(
      toValue(selectedPrefectures).map((prefecture) => [
        prefecture.prefCode,
        prefecture,
      ]),
    ).values(),
  ])
  async function loadPopulation(prefCode: number) {
    const requestId = Symbol()
    populationByPrefCode.set(prefCode, { status: 'loading', requestId })
    try {
      const data = await loader(prefCode)
      if (
        isScopeActive &&
        populationByPrefCode.get(prefCode)?.requestId === requestId
      )
        populationByPrefCode.set(prefCode, { status: 'ready', requestId, data })
    } catch {
      if (
        isScopeActive &&
        populationByPrefCode.get(prefCode)?.requestId === requestId
      )
        populationByPrefCode.set(prefCode, { status: 'error', requestId })
    }
  }
  watch(
    uniqueSelectedPrefectures,
    (currentPrefectures, previousPrefectures = []) => {
      const previousPrefCodes = new Set(
        previousPrefectures.map((prefecture) => prefecture.prefCode),
      )
      for (const { prefCode } of currentPrefectures) {
        const entry = populationByPrefCode.get(prefCode)
        const isFailedPrefectureSelectedAgain =
          entry?.status === 'error' && !previousPrefCodes.has(prefCode)
        if (!entry || isFailedPrefectureSelectedAgain) {
          void loadPopulation(prefCode)
        }
      }
    },
    { immediate: true },
  )
  const status = computed<PopulationStatus>(() => {
    if (!uniqueSelectedPrefectures.value.length) return 'empty'
    if (
      uniqueSelectedPrefectures.value.some(
        (prefecture) =>
          populationByPrefCode.get(prefecture.prefCode)?.status === 'error',
      )
    )
      return 'error'
    if (
      uniqueSelectedPrefectures.value.some(
        (prefecture) =>
          populationByPrefCode.get(prefecture.prefCode)?.status === 'loading',
      )
    )
      return 'loading'
    return 'ready'
  })
  const series = computed<PopulationSeries[]>(() =>
    uniqueSelectedPrefectures.value.flatMap((prefecture) => {
      const entry = populationByPrefCode.get(prefecture.prefCode)
      return entry?.status === 'ready'
        ? [
            {
              ...prefecture,
              boundaryYear: entry.data.boundaryYear,
              data: entry.data.categories[toValue(category)],
            },
          ]
        : []
    }),
  )
  function retry() {
    for (const { prefCode } of uniqueSelectedPrefectures.value)
      if (populationByPrefCode.get(prefCode)?.status === 'error')
        void loadPopulation(prefCode)
  }
  return { status, series, retry }
}

import {
  computed,
  onScopeDispose,
  ref,
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
export type PopulationLoader = (
  prefCode: number,
) => Promise<PopulationComposition>
type Entry =
  | { status: 'loading' | 'error'; request: symbol }
  | { status: 'ready'; request: symbol; data: PopulationComposition }

export function usePopulationData(
  selected: MaybeRefOrGetter<readonly SelectedPrefecture[]>,
  loader: PopulationLoader = fetchPopulation,
) {
  const category = ref<PopulationCategory>('total')
  const entries = shallowReactive(new Map<number, Entry>())
  let active = true
  onScopeDispose(() => {
    active = false
  })
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
    (current) => {
      for (const { prefCode } of current)
        if (!entries.has(prefCode)) void load(prefCode)
    },
    { immediate: true },
  )
  const status = computed(() => {
    if (!prefectures.value.length) return 'empty'
    if (
      prefectures.value.some(
        (p) => entries.get(p.prefCode)?.status === 'loading',
      )
    )
      return 'loading'
    if (
      prefectures.value.some((p) => entries.get(p.prefCode)?.status === 'error')
    )
      return 'error'
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
              data: entry.data.categories[category.value],
            },
          ]
        : []
    }),
  )
  function retry() {
    for (const { prefCode } of prefectures.value)
      if (entries.get(prefCode)?.status === 'error') void load(prefCode)
  }
  return { category, status, series, retry }
}

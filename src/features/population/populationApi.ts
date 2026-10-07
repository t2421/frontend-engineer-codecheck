export const populationCategories = [
  { value: 'total', label: '総人口' },
  { value: 'young', label: '年少人口' },
  { value: 'working', label: '生産年齢人口' },
  { value: 'elder', label: '老年人口' },
] as const
export type PopulationCategory = (typeof populationCategories)[number]['value']
export interface PopulationPoint {
  year: number
  value: number
  rate?: number
}
export interface PopulationComposition {
  boundaryYear: number
  categories: Record<PopulationCategory, readonly PopulationPoint[]>
}
export interface SelectedPrefecture {
  prefCode: number
  prefName: string
}
export interface PopulationSeries extends SelectedPrefecture {
  boundaryYear: number
  data: readonly PopulationPoint[]
}
const failure = () => new Error('人口データを取得できませんでした')
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
export function parsePopulation(body: unknown): PopulationComposition {
  if (!record(body) || body.message !== null || !record(body.result))
    throw failure()
  const { boundaryYear, data } = body.result
  if (
    !nonnegativeInteger(boundaryYear) ||
    !Array.isArray(data) ||
    data.length !== 4
  )
    throw failure()
  const categories = {} as PopulationComposition['categories']
  for (const { value, label } of populationCategories) {
    const matches = data.filter(
      (series: unknown) => record(series) && series.label === label,
    )
    const series: unknown = matches[0]
    if (
      matches.length !== 1 ||
      !record(series) ||
      !Array.isArray(series.data) ||
      !series.data.length
    )
      throw failure()
    const years = new Set<number>()
    categories[value] = series.data
      .map((point: unknown) => {
        if (
          !record(point) ||
          !nonnegativeInteger(point.year) ||
          !nonnegativeInteger(point.value) ||
          years.has(point.year)
        )
          throw failure()
        if (
          point.rate !== undefined &&
          (typeof point.rate !== 'number' ||
            !Number.isFinite(point.rate) ||
            point.rate < 0 ||
            point.rate > 100)
        )
          throw failure()
        years.add(point.year)
        return {
          year: point.year,
          value: point.value,
          ...(point.rate === undefined ? {} : { rate: point.rate as number }),
        }
      })
      .sort((a, b) => a.year - b.year)
  }
  return { boundaryYear, categories }
}
export async function fetchPopulation(
  prefCode: number,
  fetcher: typeof fetch = fetch,
): Promise<PopulationComposition> {
  if (!Number.isInteger(prefCode) || prefCode < 1 || prefCode > 47)
    throw failure()
  try {
    const response = await fetcher(
      `/api/v1/population/composition/perYear?prefCode=${prefCode}`,
    )
    if (!response.ok) throw failure()
    return parsePopulation(await response.json())
  } catch {
    throw failure()
  }
}

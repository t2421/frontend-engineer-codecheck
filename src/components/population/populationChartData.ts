import type { ChartData, Point } from 'chart.js'
import type { PopulationSeries } from './populationApi'

// PC以外ではラベルが重ならないよう、実データの両端だけを表示する。
export function yearTicks(
  series: readonly PopulationSeries[],
  endpointsOnly = false,
) {
  const years = [
    ...new Set(series.flatMap((s) => s.data.map((p) => p.year))),
  ].sort((a, b) => a - b)
  if (!endpointsOnly || years.length < 2) return years
  const first = years[0]
  const last = years.at(-1)
  return first === undefined || last === undefined ? years : [first, last]
}

// Assign one fixed color token per prefecture, independent of selection order.
export const seriesColorTokens = Array.from(
  { length: 47 },
  (_, i) => `--color-series-${i + 1}`,
)
export function seriesStyle(prefCode: number) {
  return {
    colorIndex: prefCode - 1,
    borderDash: [],
    pointStyle: 'circle' as const,
  }
}
export function createPopulationChartData(
  series: readonly PopulationSeries[],
  colors: readonly string[],
): ChartData<'line', Point[]> {
  return {
    datasets: series.map((s) => {
      const style = seriesStyle(s.prefCode)
      return {
        label: s.prefName,
        data: s.data.map((p) => ({ x: p.year, y: p.value })),
        borderColor: colors[style.colorIndex],
        backgroundColor: colors[style.colorIndex],
        borderDash: style.borderDash,
        pointStyle: style.pointStyle,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0,
      }
    }),
  }
}

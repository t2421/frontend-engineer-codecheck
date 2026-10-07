import type { ChartData, Point } from 'chart.js'
import type { PopulationSeries } from './populationApi'

export function mobileYearTicks(series: readonly PopulationSeries[]) {
  const years = series.flatMap((s) => s.data.map((p) => p.year))
  const min = Math.min(...years)
  const max = Math.max(...years)
  return [1960, 1980, 2000, 2020].filter((year) => year >= min && year <= max)
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

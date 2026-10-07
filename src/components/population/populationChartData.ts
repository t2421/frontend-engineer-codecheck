import type { ChartData, Point } from 'chart.js'
import type { PopulationSeries } from './populationApi'

// Keep both data endpoints; thin labels only, never the plotted points.
export function yearTicks(
  series: readonly PopulationSeries[],
  width: number,
  labelWidth: number,
) {
  const years = [
    ...new Set(series.flatMap((s) => s.data.map((p) => p.year))),
  ].sort((a, b) => a - b)
  if (years.length < 2) return years
  const first = years[0]!
  const last = years.at(-1)!
  const gap = labelWidth + 16
  const availableWidth = Math.max(0, width - labelWidth)
  const distance = (a: number, b: number) =>
    ((b - a) / (last - first)) * availableWidth
  const ticks = [first]
  for (const year of years.slice(1, -1)) {
    if (distance(ticks.at(-1)!, year) >= gap && distance(year, last) >= gap)
      ticks.push(year)
  }
  ticks.push(last)
  return ticks
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

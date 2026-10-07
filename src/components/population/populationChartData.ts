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
  const gap = labelWidth + (width < 480 ? 32 : 16)
  const availableWidth = Math.max(0, width - labelWidth)
  const distance = (a: number, b: number) =>
    ((b - a) / (last - first)) * availableWidth
  const maxCount = Math.min(
    years.length,
    Math.max(2, Math.floor(availableWidth / gap) + 1),
  )
  for (let count = maxCount; count > 2; count--) {
    const ticks = Array.from(
      { length: count },
      (_, i) => years[Math.round((i * (years.length - 1)) / (count - 1))]!,
    )
    if (ticks.slice(1).every((year, i) => distance(ticks[i]!, year) >= gap))
      return ticks
  }
  return [first, last]
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

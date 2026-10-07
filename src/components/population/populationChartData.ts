import type { ChartData, Point } from 'chart.js'
import type { PopulationSeries } from './populationApi'

// 最終年だけ詰まらないよう、中間幅では末尾の間隔だけを確かめる。
export function yearTicks(
  series: readonly PopulationSeries[],
  viewportWidth = 768,
  plotWidth = Infinity,
  labelWidth = 0,
) {
  const years = [
    ...new Set(series.flatMap((s) => s.data.map((p) => p.year))),
  ].sort((a, b) => a - b)
  if (viewportWidth >= 768 || years.length < 2) return years
  const first = years[0]
  const last = years.at(-1)
  if (first === undefined || last === undefined) return years
  if (viewportWidth < 450) return [first, last]
  const ticks = years.filter((_, i) => i % 2 === 0)
  if (ticks.at(-1) !== last) ticks.push(last)
  const previous = ticks.at(-2)
  if (ticks.length > 2 && previous !== undefined) {
    const gap =
      ((last - previous) / (last - first)) * Math.max(0, plotWidth - labelWidth)
    if (gap < labelWidth + 8) ticks.splice(-2, 1)
  }
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

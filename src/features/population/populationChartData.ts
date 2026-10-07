import type { ChartData, Point } from 'chart.js'
import type { PopulationSeries } from './populationApi'

// The three reference prefectures retain Figma's solid/circle,
// dashed/square and dotted/triangle. All others have a stable combination.
const prefectureOrder = [
  13,
  27,
  1,
  ...Array.from({ length: 47 }, (_, i) => i + 1).filter(
    (code) => ![13, 27, 1].includes(code),
  ),
]
const dashes = [[], [6, 4], [2, 4], [10, 4, 2, 4]]
const markers = ['circle', 'rect', 'triangle', 'rectRot'] as const
export function seriesStyle(prefCode: number) {
  const index = prefectureOrder.indexOf(prefCode)
  const colorIndex = index % 3
  const variant = Math.floor(index / 3) + colorIndex
  return {
    colorIndex,
    borderDash: [...dashes[variant % 4]!],
    pointStyle: markers[(Math.floor(variant / 4) + colorIndex) % 4]!,
    assetIndex: index < 3 ? index : undefined,
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

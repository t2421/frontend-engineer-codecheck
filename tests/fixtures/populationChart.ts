import type { PopulationSeries } from '../../src/features/population/populationApi'
export const series: PopulationSeries[] = [
  {
    prefCode: 13,
    prefName: '東京都',
    boundaryYear: 2020,
    data: [
      { year: 1960, value: 9000000 },
      { year: 2020, value: 14000000 },
    ],
  },
  {
    prefCode: 1,
    prefName: '北海道',
    boundaryYear: 2020,
    data: [
      { year: 1970, value: 5000000 },
      { year: 2020, value: 5200000 },
    ],
  },
]

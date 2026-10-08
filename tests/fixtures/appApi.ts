import { labels } from './population'
import { allPrefectures } from './prefectures'

// 都道府県一覧APIの成功応答（47県）。
export const prefectureResponse = { message: null, result: allPrefectures }

// 人口構成APIの成功応答。値は県コード・区分・年から一意に決まるので、
// 画面に出た数字からどの県・区分の値かを逆算できる。
export const appPopulationResponse = (code: number) => ({
  message: null,
  result: {
    boundaryYear: 2020,
    data: labels.map((label, category) => ({
      label,
      data: Array.from({ length: 13 }, (_, index) => ({
        year: 1960 + index * 5,
        value: code * 100000 + category * 10000 + index * 1000,
      })),
    })),
  },
})

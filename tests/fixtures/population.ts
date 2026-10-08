export const labels = ['総人口', '年少人口', '生産年齢人口', '老年人口']

// 人口構成APIの最小の成功応答。区分ごとに base, base+1, base+2, base+3 の値を1点だけ持つ。
export const populationResponse = (base = 100) => ({
  message: null,
  result: {
    boundaryYear: 2020,
    data: labels.map((label, index) => ({
      label,
      data: [
        { year: 2020, value: base + index, ...(index ? { rate: 20 } : {}) },
      ],
    })),
  },
})

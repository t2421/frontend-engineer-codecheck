export const labels = ['総人口', '年少人口', '生産年齢人口', '老年人口']
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

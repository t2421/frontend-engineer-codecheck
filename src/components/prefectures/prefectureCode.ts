export const PREFECTURE_COUNT = 47

export function isPrefectureCode(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= PREFECTURE_COUNT
  )
}

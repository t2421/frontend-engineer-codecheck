import { expect, test } from 'vitest'
import { sum } from '../fixtures/sum'

test('単体テストで数値を検証できる', () => {
  expect(sum(1, 2)).toBe(3)
})

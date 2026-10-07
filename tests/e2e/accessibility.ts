import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

export const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const scanCounts = new WeakMap<TestInfo, number>()

export async function checkAccessibility(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  // 1テスト内で複数回検査しても結果を上書きしないよう、連番でファイルを分ける。
  const index = (scanCounts.get(testInfo) ?? 0) + 1
  scanCounts.set(testInfo, index)
  const name = `accessibility-${index}.json`
  const path = testInfo.outputPath(name)
  // Save all results (including incomplete) before asserting, even on failure.
  await writeFile(path, JSON.stringify(results, null, 2))
  await testInfo.attach(`axe-results-${index}`, {
    path,
    contentType: 'application/json',
  })
  if (results.incomplete.length > 0) {
    testInfo.annotations.push({
      type: 'manual-review',
      description: `${results.incomplete.length} axe incomplete results: inspect ${name}`,
    })
  }
  expect(results.violations, 'WCAG A/AA violations (see axe-results)').toEqual(
    [],
  )
  return results
}

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

export const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

export async function checkAccessibility(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  const path = testInfo.outputPath('accessibility.json')
  // Save all results (including incomplete) before asserting, even on failure.
  await writeFile(path, JSON.stringify(results, null, 2))
  await testInfo.attach('axe-results', {
    path,
    contentType: 'application/json',
  })
  if (results.incomplete.length > 0) {
    testInfo.annotations.push({
      type: 'manual-review',
      description: `${results.incomplete.length} axe incomplete results: inspect accessibility.json`,
    })
  }
  expect(results.violations, 'WCAG A/AA violations (see axe-results)').toEqual(
    [],
  )
  return results
}

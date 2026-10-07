import type { Page, TestInfo } from '@playwright/test'

export async function captureScreenshot(
  page: Page,
  testInfo: TestInfo,
  filename: string,
  fullPage = false,
) {
  const path = testInfo.outputPath(filename)
  await page.screenshot({ path, fullPage })
  await testInfo.attach(filename, { path, contentType: 'image/png' })
}

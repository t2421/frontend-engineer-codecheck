import type { Locator, Page, TestInfo } from '@playwright/test'

// 検証ではなく記録用のキャプチャ。固定パスではなくテスト出力先へ保存し、レポートに添付する。
export async function captureScreenshot(
  target: Page | Locator,
  testInfo: TestInfo,
  filename: string,
  fullPage = false,
): Promise<void> {
  const path = testInfo.outputPath(filename)
  if ('goto' in target) await target.screenshot({ path, fullPage })
  else await target.screenshot({ path })
  await testInfo.attach(filename, { path, contentType: 'image/png' })
}

import { expect, type Page } from '@playwright/test'

// 横溢れの有無は描画完了まで値が変わるため、1回の評価ではなく再試行付きで確認する。
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
}

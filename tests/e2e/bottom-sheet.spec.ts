import { expect, test } from '@playwright/test'
import { checkAccessibility } from './accessibility'
import { captureScreenshot } from './screenshot'

test.describe('BottomSheet（確認ページ）', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  const expectScrollUnlocked = (page: import('@playwright/test').Page) =>
    expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe('')

  test('初期状態で開いていてもモーダルとして表示し、中身を操作して閉じられる', async ({
    page,
  }) => {
    await page.goto('/tests/preview/bottom-sheet.html?open')
    const dialog = page.getByRole('dialog', {
      name: '確認用シート',
      exact: true,
    })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: '閉じる', exact: true }),
    ).toBeFocused()
    await dialog
      .getByRole('textbox', { name: '名前', exact: true })
      .fill('確認')
    await dialog.getByRole('button', { name: '反映', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expectScrollUnlocked(page)
  })

  test('開いたままシートが除去されても、スクロール固定を解除しフォーカスを戻す', async ({
    page,
  }) => {
    await page.goto('/tests/preview/bottom-sheet.html')
    const trigger = page.getByRole('button', {
      name: 'シートを開く',
      exact: true,
    })
    await trigger.click()
    await page
      .getByRole('button', { name: 'シートを除去', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expectScrollUnlocked(page)
  })

  test('閉じるは secondary、反映は primary の配色で、どちらも44px以上の高さを持つ', async ({
    page,
  }, testInfo) => {
    await page.goto('/tests/preview/bottom-sheet.html')
    await page
      .getByRole('button', { name: 'シートを開く', exact: true })
      .click()
    const close = page.getByRole('button', { name: '閉じる', exact: true })
    const apply = page.getByRole('button', { name: '反映', exact: true })
    await expect(close).toHaveCSS('color', 'rgb(21, 88, 214)')
    await expect(close).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(apply).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(apply).toHaveCSS('background-color', 'rgb(21, 88, 214)')
    for (const button of [close, apply]) {
      const box = await button.boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }
    await checkAccessibility(page, testInfo)
    await captureScreenshot(page, testInfo, 'shared-bottom-sheet.png')
  })
})

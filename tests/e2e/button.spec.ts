import { expect, test } from '@playwright/test'

test.describe('Button（確認ページ）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/preview/button.html')
  })

  test('マウス・Enter・Spaceのそれぞれで1回ずつ通知する', async ({ page }) => {
    const button = page.getByRole('button', { name: '再読み込み', exact: true })
    const count = page.getByLabel('クリック回数')
    await button.click()
    await expect(count).toHaveText('1')
    await button.press('Enter')
    await expect(count).toHaveText('2')
    await button.press('Space')
    await expect(count).toHaveText('3')
    await expect(page.getByLabel('送信回数')).toHaveText('0')
  })

  test('Tab順序から無効ボタンを除外する', async ({ page }) => {
    const button = page.getByRole('button', { name: '再読み込み', exact: true })
    await button.click()
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('button', { name: '送信', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(button).toBeFocused()
  })

  test('無効ボタンは座標クリックでも通知しない', async ({ page }) => {
    const disabled = page.getByRole('button', { name: '無効', exact: true })
    await expect(disabled).toBeDisabled()
    const box = await disabled.boundingBox()
    if (!box) throw new Error('無効ボタンが表示されていません')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByLabel('無効操作回数')).toHaveText('0')
  })

  test('submit はフォームを送信し、reset は入力を初期値へ戻して送信しない', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '送信', exact: true }).click()
    await expect(page.getByLabel('送信回数')).toHaveText('1')
    await page.getByRole('textbox', { name: '入力' }).fill('変更後')
    await page.getByRole('button', { name: 'リセット', exact: true }).click()
    await expect(page.getByRole('textbox', { name: '入力' })).toHaveValue(
      '初期値',
    )
    await expect(page.getByLabel('送信回数')).toHaveText('1')
  })
})

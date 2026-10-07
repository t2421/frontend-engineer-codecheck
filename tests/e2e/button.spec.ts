import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/preview/button.html')
})

test('マウス・Enter・Spaceで一度ずつ通知し、Tabでは無効ボタンを飛ばす', async ({
  page,
}) => {
  const button = page.getByRole('button', { name: '再読み込み' })
  const count = page.getByLabel('クリック回数')
  await button.click()
  await expect(count).toHaveText('1')
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: '送信', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(button).toBeFocused()
  await button.press('Enter')
  await expect(count).toHaveText('2')
  await button.press('Space')
  await expect(count).toHaveText('3')
  await expect(page.getByLabel('送信回数')).toHaveText('0')

  const disabled = page.getByRole('button', { name: '無効' })
  await expect(disabled).toBeDisabled()
  // 実ポインタ操作を無効ボタンの位置へ送る。
  const box = await disabled.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await expect(page.getByLabel('無効操作回数')).toHaveText('0')
})

test('type指定に従ってフォームを送信・リセットする', async ({ page }) => {
  await page.getByRole('button', { name: '送信', exact: true }).click()
  await expect(page.getByLabel('送信回数')).toHaveText('1')
  await page.getByRole('textbox', { name: '入力' }).fill('変更後')
  await page.getByRole('button', { name: 'リセット' }).click()
  await expect(page.getByRole('textbox', { name: '入力' })).toHaveValue(
    '初期値',
  )
  await expect(page.getByLabel('送信回数')).toHaveText('1')
})

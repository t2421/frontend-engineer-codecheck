import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/status-message.html')
})

test('状態の文言を読み上げ領域へ公開し、再試行はキーボードで通知する', async ({
  page,
}) => {
  await expect(page.getByRole('status').first()).toContainText(
    '都道府県を選択すると、人口の推移を確認できます',
  )
  await expect(page.getByRole('status').nth(1)).toContainText(
    '人口データを読み込み中…',
  )
  await expect(page.getByRole('alert')).toHaveCount(2)
  const retry = page.getByRole('button', { name: '再読み込み', exact: true })
  await page.keyboard.press('Tab')
  await expect(retry).toBeFocused()
  await retry.click()
  await expect(page.getByLabel('再試行回数')).toHaveText('1')
  await retry.press('Enter')
  await expect(page.getByLabel('再試行回数')).toHaveText('2')
  await retry.press('Space')
  await expect(page.getByLabel('再試行回数')).toHaveText('3')
  await page.keyboard.press('Tab')
  const listRetry = page.getByRole('button', { name: '一覧を再読み込み' })
  await expect(listRetry).toBeFocused()
  await listRetry.press('Enter')
  await expect(page.getByLabel('再試行回数')).toHaveText('4')
  await expect(listRetry).toBeDisabled()
  const disabledBox = await listRetry.boundingBox()
  expect(disabledBox).not.toBeNull()
  await page.mouse.click(
    disabledBox!.x + disabledBox!.width / 2,
    disabledBox!.y + disabledBox!.height / 2,
  )
  await expect(page.getByLabel('再試行回数')).toHaveText('4')
  await retry.focus()
  await page.keyboard.press('Tab')
  await expect(listRetry).not.toBeFocused()
  await expect(page.getByRole('status').nth(2)).toContainText(
    '一覧を読み込み中…',
  )
  await expect(page.getByRole('alert')).toHaveCount(1)
  // Loading announcements must not be descendants of a busy container.
  expect(
    await page
      .getByRole('status')
      .nth(2)
      .evaluate((element) => element.closest('[aria-busy="true"]') === null),
  ).toBe(true)
})

test('動きを減らす設定でも読み込み文言を残す', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByRole('status').nth(1)).toContainText(
    '人口データを読み込み中…',
  )
  const icon = page.locator('.status-message-loading img')
  expect(
    await icon.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none')
})

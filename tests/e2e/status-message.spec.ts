import { expect, test } from '@playwright/test'

test.describe('StatusMessage（確認ページ）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tests/preview/status-message.html')
  })

  test('状態ごとの文言を status / alert として公開し、再試行後の状態変化を反映する', async ({
    page,
  }) => {
    await expect(page.getByRole('status').first()).toContainText(
      '都道府県を選択すると、人口の推移を確認できます',
    )
    await expect(page.getByRole('status').nth(1)).toContainText(
      '人口データを読み込み中…',
    )
    await expect(page.getByRole('alert')).toHaveCount(2)
    await page.getByRole('button', { name: '一覧を再読み込み' }).press('Enter')
    await expect(page.getByRole('status').nth(2)).toContainText(
      '一覧を読み込み中…',
    )
    await expect(page.getByRole('alert')).toHaveCount(1)
  })

  test('再試行はマウス・Enter・Spaceで通知でき、Tabで順に移動できる', async ({
    page,
  }) => {
    const retry = page.getByRole('button', { name: '再読み込み', exact: true })
    await page.keyboard.press('Tab')
    await expect(retry).toBeFocused()
    await retry.click()
    await retry.press('Enter')
    await retry.press('Space')
    await expect(page.getByLabel('再試行回数')).toHaveText('3')
    await page.keyboard.press('Tab')
    const listRetry = page.getByRole('button', { name: '一覧を再読み込み' })
    await expect(listRetry).toBeFocused()
    await listRetry.press('Enter')
    await expect(page.getByLabel('再試行回数')).toHaveText('4')
  })

  test('無効になった再試行は座標クリックでも通知せず、Tab順序からも外れる', async ({
    page,
  }) => {
    const retry = page.getByRole('button', { name: '再読み込み', exact: true })
    const listRetry = page.getByRole('button', { name: '一覧を再読み込み' })
    await listRetry.press('Enter')
    await expect(listRetry).toBeDisabled()
    const box = await listRetry.boundingBox()
    if (!box) throw new Error('再試行ボタンが表示されていません')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByLabel('再試行回数')).toHaveText('1')
    await retry.focus()
    await page.keyboard.press('Tab')
    await expect(listRetry).not.toBeFocused()
  })

  test('読み込み中の通知は aria-busy 領域の外にある', async ({ page }) => {
    await page.getByRole('button', { name: '一覧を再読み込み' }).press('Enter')
    const outsideBusy = await page
      .getByRole('status')
      .nth(2)
      .evaluate((element) => element.closest('[aria-busy="true"]') === null)
    expect(outsideBusy).toBe(true)
  })

  test('動きを減らす設定ではアイコンのアニメーションを止め、文言は残す', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.getByRole('status').nth(1)).toContainText(
      '人口データを読み込み中…',
    )
    const icon = page.locator('.status-message-loading img')
    expect(
      await icon.evaluate((element) => getComputedStyle(element).animationName),
    ).toBe('none')
  })
})

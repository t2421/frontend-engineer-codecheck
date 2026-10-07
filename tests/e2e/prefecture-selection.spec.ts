import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow } from './layout'
const result = [
  { prefCode: 13, prefName: 'API東京都' },
  { prefCode: 1, prefName: 'API北海道' },
]
test('通常画面: API順の動的一覧、キーボード・連続選択・解除（routeモック）', async ({
  page,
}) => {
  let requests = 0
  await page.route('**/api/v1/prefectures', async (route) => {
    requests++
    expect(route.request().method()).toBe('GET')
    await route.fulfill({ json: { message: null, result } })
  })
  await page.goto('/')
  const inputs = page.getByRole('checkbox')
  await expect(inputs).toHaveCount(2)
  await expect(inputs.nth(0)).toHaveAccessibleName('API東京都')
  await inputs.nth(0).focus()
  await page.keyboard.press('Space')
  await expect(inputs.nth(0)).toBeChecked()
  await page.keyboard.press('Tab')
  await expect(inputs.nth(1)).toBeFocused()
  await page.keyboard.press('Space')
  await expect(inputs.nth(1)).toBeChecked()
  await inputs.nth(0).uncheck()
  await expect(inputs.nth(1)).toBeChecked()
  for (let i = 0; i < 5; i++) {
    await inputs.nth(0).check()
    await inputs.nth(0).uncheck()
  }
  await page.getByRole('button', { name: '選択を解除' }).click()
  await expect(inputs.nth(1)).not.toBeChecked()
  await page.setViewportSize({ width: 390, height: 1000 })
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await page.setViewportSize({ width: 640, height: 1000 })
  await expect(inputs).toHaveCount(2)
  expect(requests).toBe(1)
})
test('通常画面: loading→HTTP失敗→再試行loading→成功（routeモック）', async ({
  page,
}) => {
  let attempt = 0
  let release!: () => void
  await page.route('**/api/v1/prefectures', async (route) => {
    attempt++
    await new Promise<void>((resolve) => {
      release = resolve
    })
    await route.fulfill(
      attempt === 1
        ? { status: 503, json: { error: 'unavailable' } }
        : { json: { message: null, result } },
    )
  })
  await page.goto('/')
  await expect(page.locator('.checkbox-skeleton')).toHaveCount(47)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect.poll(() => Boolean(release)).toBe(true)
  release()
  await expect(page.getByRole('alert')).toContainText(
    '都道府県一覧を取得できませんでした',
  )
  const retry = page.getByRole('button', { name: '再読み込み' })
  await retry.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.checkbox-skeleton')).toHaveCount(47)
  await expect.poll(() => attempt).toBe(2)
  release()
  await expect(page.getByRole('checkbox')).toHaveCount(2)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
for (const width of [1440, 768, 640, 639, 390, 320]) {
  test(`合成fixture ${width}px: 47県・選択通知・開閉・横溢れなし`, async ({
    page,
  }) => {
    let apiRequests = 0
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests++
    })
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/tests/preview/prefecture-selection.html')
    if (width < 640) {
      await expect(page.getByRole('checkbox')).toHaveCount(0)
      const open = page.getByRole('button', { name: '都道府県を選ぶ' })
      await expect(open).toHaveAttribute('aria-expanded', 'false')
      await open.focus()
      await page.keyboard.press('Enter')
      await expect(
        page.getByRole('button', { name: '閉じる', exact: true }),
      ).toHaveAttribute('aria-expanded', 'true')
    }
    await expect(page.getByRole('checkbox')).toHaveCount(47)
    await page.getByRole('checkbox', { name: '北海道', exact: true }).check()
    await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
    await expect(page.getByRole('status', { name: '選択件数' })).toHaveText(
      '2 / 47 選択中',
    )
    await expect(page.getByLabel('選択県')).toContainText('"prefCode":13')
    if (width < 640) {
      await page.getByRole('button', { name: '閉じる', exact: true }).focus()
      await page.keyboard.press('Space')
      await expect(page.getByRole('checkbox')).toHaveCount(0)
      await page.getByRole('button', { name: '都道府県を選ぶ' }).click()
      await expect(
        page.getByRole('checkbox', { name: '東京都', exact: true }),
      ).toBeChecked()
    }
    await expectNoHorizontalOverflow(page)
    expect(apiRequests).toBe(0)
  })
}

test('resize: 閉じたスマホ→640pxは一覧、隠れるフォーカスを可視操作へ移す', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1000 })
  await page.goto('/tests/preview/prefecture-selection.html')
  const tokyo = page.getByRole('checkbox', { name: '東京都', exact: true })
  await tokyo.check()
  await tokyo.focus()
  await page.setViewportSize({ width: 639, height: 1000 })
  const open = page.getByRole('button', { name: '都道府県を選ぶ' })
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(open).toBeFocused()
  await expect(open).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('status', { name: '選択件数' })).toHaveText(
    '1 / 47 選択中',
  )
  await page.keyboard.press('Enter')
  await expect(tokyo).toBeChecked()
  await tokyo.focus()
  await page.setViewportSize({ width: 768, height: 1000 })
  await expect(tokyo).toBeFocused()
  await page.setViewportSize({ width: 320, height: 1000 })
  await expect(tokyo).toBeFocused()
  await expect(
    page.getByRole('button', { name: '閉じる', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: '閉じる', exact: true }).focus()
  await page.keyboard.press('Space')
  await page.setViewportSize({ width: 640, height: 1000 })
  await expect(page.getByRole('checkbox')).toHaveCount(47)
  await expect(page.getByRole('checkbox').first()).toBeFocused()
  await expect(tokyo).toBeChecked()
  await page.setViewportSize({ width: 390, height: 1000 })
  await expect(open).toBeFocused()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByLabel('選択県')).toContainText('"prefCode":13')
  const outside = page.getByRole('link', { name: '本文へ移動' })
  await outside.focus()
  await page.setViewportSize({ width: 768, height: 1000 })
  await expect(outside).toBeFocused()
  await page.setViewportSize({ width: 320, height: 1000 })
  await expect(outside).toBeFocused()
})

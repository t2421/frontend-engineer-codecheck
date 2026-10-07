import { expect, test } from '@playwright/test'
import { populationResponse } from '../fixtures/population'
const api = '**/api/v1/population/composition/perYear?*'
for (const width of [1440, 768, 390]) {
  test(`${width}px: 選択維持・全区分の値・再利用・キーボード操作（APIモック）`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const requests: string[] = []
    await page.route(api, (route) => {
      requests.push(route.request().url())
      return route.fulfill({ json: populationResponse() })
    })
    await page.goto('/tests/preview/population-data.html?mode=proxy')
    const group = page.getByRole('radiogroup', { name: '人口区分' })
    const total = group.getByRole('radio', { name: '総人口', exact: true })
    await expect(total).toBeChecked()
    await total.focus()
    await page.keyboard.press('ArrowRight')
    await expect(
      group.getByRole('radio', { name: '年少人口', exact: true }),
    ).toBeChecked()
    await expect(page.getByRole('status')).toContainText('都道府県を選択すると')
    expect(requests).toHaveLength(0)
    await page.getByRole('checkbox', { name: '北海道' }).check()
    const output = page.getByLabel('後続表示へのデータ')
    await expect(output).toContainText('"value":101')
    for (const [label, value] of [
      ['総人口', 100],
      ['生産年齢人口', 102],
      ['老年人口', 103],
    ] as const) {
      await group.getByRole('radio', { name: label, exact: true }).check()
      await expect(output).toContainText(`"value":${value}`)
      await expect(page.getByRole('checkbox', { name: '北海道' })).toBeChecked()
    }
    expect(requests).toHaveLength(1)
    expect(new URL(requests[0]!).search).toBe('?prefCode=1')
    await page.getByRole('checkbox', { name: '東京都' }).check()
    await expect(output).toContainText('東京都')
    await page.getByRole('checkbox', { name: '北海道' }).uncheck()
    await expect(output).not.toContainText('北海道')
    await page.getByRole('checkbox', { name: '北海道' }).check()
    await expect(output).toContainText('北海道')
    expect(requests).toHaveLength(2)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
    await page.screenshot({
      path: `test-results/population-data-${width}.png`,
      fullPage: true,
    })
    await page.getByRole('checkbox', { name: '北海道' }).uncheck()
    await page.getByRole('checkbox', { name: '東京都' }).uncheck()
    await expect(
      group.getByRole('radio', { name: '老年人口', exact: true }),
    ).toBeChecked()
    await expect(page.getByRole('status')).toContainText('都道府県を選択すると')
  })
}
test('HTTP失敗から再試行して現在の区分へ復帰（APIモック）', async ({
  page,
}) => {
  let count = 0
  await page.route(api, (route) =>
    ++count === 1
      ? route.fulfill({ status: 503, json: { error: 'SERVICE_UNAVAILABLE' } })
      : route.fulfill({ json: populationResponse() }),
  )
  await page.goto('/tests/preview/population-data.html?mode=proxy')
  await page.getByRole('checkbox', { name: '北海道' }).check()
  await expect(page.getByRole('alert')).toContainText(
    'データを取得できませんでした',
  )
  await page.getByRole('radio', { name: '年少人口', exact: true }).check()
  await page.screenshot({
    path: 'test-results/population-error.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: '再読み込み' }).click()
  await expect(page.getByLabel('後続表示へのデータ')).toContainText(
    '"value":101',
  )
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(count).toBe(2)
})
test('解除後の遅延応答で表示県が復活しない（APIモック）', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(api, async (route) => {
    await gate
    await route.fulfill({ json: populationResponse() })
  })
  await page.goto('/tests/preview/population-data.html?mode=proxy')
  await page.getByRole('checkbox', { name: '北海道' }).check()
  await expect(
    page.getByRole('status').filter({ hasText: '人口データを読み込み中' }),
  ).toContainText('人口データを読み込み中')
  await page.screenshot({
    path: 'test-results/population-loading.png',
    fullPage: true,
  })
  await page.getByRole('checkbox', { name: '北海道' }).uncheck()
  const response = page.waitForResponse((r) =>
    r.url().includes('/api/v1/population/'),
  )
  release()
  await response
  await expect(page.getByLabel('後続表示へのデータ')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('都道府県を選択すると')
  await page.screenshot({
    path: 'test-results/population-empty.png',
    fullPage: true,
  })
})

test('公開用fixtureは合成データで取得・再試行・遅延応答を確認でき、APIへ通信しない', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const requests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      requests.push(request.url())
  })
  await page.goto('/tests/preview/population-data.html')
  await expect(
    page.getByText('合成データによる確認画面です。実APIは使用しません。'),
  ).toBeVisible({ timeout: 3000 })
  await page
    .getByRole('button', { name: '次の取得を失敗させる', exact: true })
    .click()
  await page.getByRole('checkbox', { name: '北海道' }).check()
  await expect(page.getByRole('alert')).toContainText(
    'データを取得できませんでした',
  )
  await page.getByRole('button', { name: '再読み込み', exact: true }).click()
  await expect(page.getByLabel('後続表示へのデータ')).toContainText(
    '"value":100',
  )
  await page.getByRole('radio', { name: '年少人口', exact: true }).check()
  await expect(page.getByLabel('後続表示へのデータ')).toContainText(
    '"value":101',
  )
  await page
    .getByRole('button', { name: '次の取得を遅延させる', exact: true })
    .click()
  await page.getByRole('checkbox', { name: '東京都' }).check()
  await expect(
    page.getByRole('status').filter({ hasText: '人口データを読み込み中' }),
  ).toContainText('人口データを読み込み中')
  await page.getByRole('checkbox', { name: '東京都' }).uncheck()
  await page
    .getByRole('button', { name: '遅延応答を返す', exact: true })
    .click()
  await expect(page.getByLabel('後続表示へのデータ')).not.toContainText(
    '東京都',
  )
  await expect(page.getByLabel('合成データ取得回数')).toHaveText('3')
  expect(requests).toEqual([])
  await page.screenshot({
    path: 'test-results/population-synthetic-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 1000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  )
  await page.screenshot({
    path: 'test-results/population-synthetic-mobile.png',
    fullPage: true,
  })
})

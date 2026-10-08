import { expect, test } from '@playwright/test'
import { prefectureResponse } from '../fixtures/appApi'
import { captureScreenshot } from './screenshot'
import { checkAccessibility } from './accessibility'

for (const width of [320, 390, 639, 640, 768]) {
  test(`${width}pxではスマホの選択を下部に統一し、640px以上は上部の一覧を維持する`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('**/api/v1/prefectures', (route) =>
      route.fulfill({ json: prefectureResponse }),
    )
    await page.goto('/')
    const inline = page.getByRole('region', { name: '都道府県', exact: true })
    const button = page.getByRole('button', {
      name: '都道府県を選択 · 0 選択中',
      exact: true,
    })
    if (width >= 640) {
      await expect(inline).toBeVisible()
      await expect(page.getByRole('checkbox')).toHaveCount(47)
      await expect(button).toBeHidden()
      return
    }
    await expect(inline).toBeHidden()
    await expect(
      page.getByRole('heading', { name: '都道府県', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expect(button).toBeVisible()
    await expect(button).toBeEnabled()
    const description = await page
      .getByText('都道府県と人口の区分を選んで、変化を比べられます。', {
        exact: true,
      })
      .boundingBox()
    const population = await page
      .getByRole('region', { name: '人口推移', exact: true })
      .boundingBox()
    if (!description || !population)
      throw new Error('見出しの説明とグラフ領域が必要です')
    expect(population.y - description.y - description.height).toBeLessThan(40)
    if (width === 390)
      await captureScreenshot(page, testInfo, 'mobile-initial.png')
    await button.click()
    const dialog = page.getByRole('dialog', {
      name: '都道府県を選択',
      exact: true,
    })
    await expect(dialog.getByRole('checkbox')).toHaveCount(47)
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(0)
    await dialog
      .getByRole('button', { name: '0 都道府県をグラフに反映', exact: true })
      .click()
    await expect(dialog).toBeHidden()
    await expect(button).toBeFocused()
    await expect(page.locator('canvas')).toHaveCount(0)
    if (width === 390) await checkAccessibility(page, testInfo)
  })
}

test('PCの選択からスマホにresizeしても下部へフォーカスを移し、確定状態を維持する', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 844 })
  await page.route('**/api/v1/prefectures', (route) =>
    route.fulfill({ json: prefectureResponse }),
  )
  await page.route('**/api/v1/population/**', (route) =>
    route.fulfill({ status: 503, json: { error: 'SERVICE_UNAVAILABLE' } }),
  )
  await page.goto('/')
  const tokyo = page.getByRole('checkbox', { name: '東京都', exact: true })
  await tokyo.check()
  await tokyo.focus()
  await page.setViewportSize({ width: 639, height: 844 })
  const button = page.getByRole('button', {
    name: '都道府県を選択 · 1 選択中',
    exact: true,
  })
  await expect(button).toBeFocused()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await button.click()
  await expect(
    page
      .getByRole('dialog')
      .getByRole('checkbox', { name: '東京都', exact: true }),
  ).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(button).toBeFocused()
  await page.setViewportSize({ width: 640, height: 844 })
  await expect(page.getByRole('checkbox').first()).toBeFocused()
  await expect(tokyo).toBeChecked()
  await expect(button).toBeHidden()
})

test('一覧取得中のシートからPCへresizeしてもスクロールを解除し、可視の選択領域へフォーカスを戻す', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/prefectures', async (route) => {
    await gate
    await route.fulfill({ json: prefectureResponse })
  })
  try {
    await page.goto('/')
    await page
      .getByRole('button', { name: '都道府県を選択 · 0 選択中', exact: true })
      .click()
    await expect(page.getByRole('dialog').getByRole('status')).toContainText(
      '都道府県一覧を読み込んでいます',
    )
    await page.setViewportSize({ width: 640, height: 844 })
    await expect(page.getByRole('dialog')).toBeHidden()
    const inline = page.getByRole('region', { name: '都道府県', exact: true })
    await expect(inline).toBeVisible()
    await expect
      .poll(() => inline.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true)
    await expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe('')
  } finally {
    release()
  }
})

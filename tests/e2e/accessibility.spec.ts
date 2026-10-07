import { expect, test } from '@playwright/test'
import { checkAccessibility } from './accessibility'
import { readFile } from 'node:fs/promises'

test.describe('既存画面と共通部品のWCAG A/AA自動検査', () => {
  const unhandledApiRequests: string[] = []

  test.beforeEach(async ({ page }) => {
    unhandledApiRequests.length = 0
    // Only the implemented prefecture contract is mocked. Never use real upstreams or Secrets.
    await page.route('**/api/**', async (route) => {
      if (new URL(route.request().url()).pathname === '/api/v1/prefectures') {
        await route.fulfill({
          json: {
            message: null,
            result: [{ prefCode: 13, prefName: '東京都' }],
          },
        })
        return
      }
      unhandledApiRequests.push(route.request().url())
      await route.fulfill({ status: 404, json: { message: 'Not implemented' } })
    })
  })

  test.afterEach(() => {
    // New API-connected states must define their response fixtures explicitly.
    expect(
      unhandledApiRequests,
      '未定義のAPI通信が追加されたら状態モックを更新する',
    ).toEqual([])
  })

  for (const width of [1440, 768, 390, 320]) {
    test(`初期画面 ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        '都道府県別の人口推移',
      )
      await expect(
        page.getByRole('region', { name: '都道府県', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('region', { name: '人口推移', exact: true }),
      ).toBeVisible()
      await expect(page.getByRole('status', { name: '選択件数' })).toHaveText(
        '0 / 1 選択中',
      )
      await checkAccessibility(page, testInfo)
    })

    test(`既存スケルトン部品 ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/tests/fixtures/skeleton.html')
      await expect(page.getByRole('status')).toHaveText(
        '都道府県一覧を読み込んでいます…',
      )
      await expect(page.locator('.checkbox-skeleton')).toHaveCount(47)
      await checkAccessibility(page, testInfo)
    })
  }

  for (const width of [1440, 390, 320]) {
    test(`県選択・全解除・開閉 ${width}px（合成fixture）`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/tests/e2e/fixtures/prefecture-selection.html')
      await expect(page.getByRole('status', { name: '選択件数' })).toHaveText(
        '0 / 47 選択中',
      )
      if (width < 640) {
        await checkAccessibility(page, testInfo)
        await page.getByRole('button', { name: '都道府県を選ぶ' }).click()
      }
      await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
      await checkAccessibility(page, testInfo)
      if (width < 640) {
        await page.getByRole('button', { name: '閉じる', exact: true }).click()
        await expect(page.getByRole('checkbox')).toHaveCount(0)
        await checkAccessibility(page, testInfo)
        await page.getByRole('button', { name: '都道府県を選ぶ' }).click()
      }
      await page.getByRole('button', { name: '選択を解除' }).click()
      await expect(page.getByRole('status', { name: '選択件数' })).toHaveText(
        '0 / 47 選択中',
      )
      await checkAccessibility(page, testInfo)
    })
    for (const mode of ['loading', 'error']) {
      test(`県一覧${mode}・復帰 ${width}px（合成fixture）`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 })
        await page.goto(
          `/tests/e2e/fixtures/prefecture-selection.html?mode=${mode}`,
        )
        if (mode === 'loading')
          await expect(page.locator('.checkbox-skeleton')).toHaveCount(47)
        else
          await expect(page.getByRole('alert')).toContainText(
            '都道府県一覧を取得できませんでした',
          )
        await checkAccessibility(page, testInfo)
        await page
          .getByRole('button', {
            name: mode === 'loading' ? '合成応答を返す' : '再読み込み',
          })
          .click()
        await expect(page.getByRole('status', { name: '選択件数' })).toHaveText(
          '0 / 47 選択中',
        )
        await checkAccessibility(page, testInfo)
      })
    }
  }

  for (const state of ['通常・無効', 'hover', 'focus']) {
    test(`Buttonの${state}`, async ({ page }, testInfo) => {
      await page.goto('/tests/fixtures/button.html')
      const button = page.getByRole('button', { name: '再読み込み' })
      await expect(button).toBeVisible()
      await expect(page.getByRole('button', { name: '無効' })).toBeDisabled()
      if (state === 'hover') await button.hover()
      if (state === 'focus') {
        await page.keyboard.press('Tab')
        await expect(button).toBeFocused()
      }
      await checkAccessibility(page, testInfo)
    })
  }
})

// Exercise the same CI assertion with deliberately broken, isolated HTML.
for (const [rule, html] of [
  ['label', '<input>'],
  ['aria-valid-attr-value', '<button aria-expanded="invalid">操作</button>'],
  [
    'color-contrast',
    '<p style="color:#aaa;background:#fff">低コントラストの文字</p>',
  ],
]) {
  test(`検査自体の回帰確認: ${rule}違反で失敗する`, async ({
    page,
  }, testInfo) => {
    await page.setContent(
      `<!doctype html><html lang="ja"><head><title>検査の回帰確認</title></head><body><main>${html}</main></body></html>`,
    )
    await expect(checkAccessibility(page, testInfo)).rejects.toThrow(
      'WCAG A/AA violations',
    )
    const attachment = testInfo.attachments.find(
      (item) => item.name === 'axe-results',
    )
    expect(attachment?.path).toBeTruthy()
    const results = JSON.parse(await readFile(attachment!.path!, 'utf8'))
    expect(results.violations.map((item: { id: string }) => item.id)).toContain(
      rule,
    )
    expect(Array.isArray(results.incomplete)).toBe(true)
  })
}

test('判定不能のコントラストは失敗にせず手動確認結果として保存する', async ({
  page,
}, testInfo) => {
  await page.setContent(
    '<!doctype html><html lang="ja"><head><title>判定不能の検証</title></head><body><main><p style="color:#000;background-image:linear-gradient(#fff,#ddd)">背景の手動確認が必要な文字</p></main></body></html>',
  )
  const results = await checkAccessibility(page, testInfo)
  expect(results.incomplete.map((item) => item.id)).toContain('color-contrast')
  expect(testInfo.annotations.map((item) => item.type)).toContain(
    'manual-review',
  )
  const saved = JSON.parse(
    await readFile(testInfo.outputPath('accessibility.json'), 'utf8'),
  )
  expect(saved.incomplete).toEqual(results.incomplete)
})

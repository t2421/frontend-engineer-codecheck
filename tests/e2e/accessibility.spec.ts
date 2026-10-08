import { expect, test, type Page } from '@playwright/test'
import { checkAccessibility } from './accessibility'
import { readFile } from 'node:fs/promises'
import { expectCanvasDrawn } from './chart'
import {
  categoryRadio,
  clearSelection,
  emptyStatus,
  floatingSelectionButton,
} from './app'

const selectionCount = (page: Page) =>
  page.getByRole('status', { name: '選択件数' })

test.describe('WCAG A/AA の自動検査（axe）', () => {
  const unhandledApiRequests: string[] = []

  test.beforeEach(async ({ page }) => {
    unhandledApiRequests.length = 0
    // 実装済みの一覧APIだけをモックし、それ以外のAPI通信は記録して失敗させる。
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url())
      if (
        pathname === '/api/v1/prefectures' &&
        route.request().method() === 'GET'
      ) {
        await route.fulfill({
          json: {
            message: null,
            result: [{ prefCode: 13, prefName: '検査用東京都' }],
          },
        })
        return
      }
      unhandledApiRequests.push(route.request().url())
      await route.fulfill({ status: 404, json: { message: 'Not implemented' } })
    })
  })

  test.afterEach(() => {
    expect(
      unhandledApiRequests,
      '未定義のAPI通信が増えたらモックを更新する',
    ).toEqual([])
  })

  for (const width of [1440, 768, 390, 320]) {
    test(`${width}px: 初期画面`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        '都道府県別の人口推移',
      )
      await expect(
        page.getByRole('region', { name: '人口推移', exact: true }),
      ).toBeVisible()
      const inline = page.getByRole('region', { name: '都道府県', exact: true })
      const prefecture = page.getByRole('checkbox', { name: '検査用東京都' })
      if (width >= 640) {
        await expect(inline).toBeVisible()
        await expect(selectionCount(page)).toHaveText('0 / 1 選択中')
        await expect(prefecture).toBeVisible()
      } else {
        await expect(inline).toBeHidden()
        await expect(floatingSelectionButton(page)).toBeVisible()
        await expect(prefecture).toHaveCount(0)
      }
      await checkAccessibility(page, testInfo)
    })

    test(`${width}px: グラフの未選択 → 選択 → 区分切替 → 全解除`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1100 })
      await page.goto('/tests/preview/population-chart.html')
      await expect(emptyStatus(page)).toBeVisible()
      await checkAccessibility(page, testInfo)

      for (const name of ['東京都', '大阪府', '北海道'])
        await page.getByRole('checkbox', { name, exact: true }).check()
      await expect(page.locator('canvas')).toBeVisible()
      await expectCanvasDrawn(page)
      await expect(
        page.getByRole('cell', { name: '7,600,000人', exact: true }),
      ).toHaveCount(1)
      await checkAccessibility(page, testInfo)

      await categoryRadio(page, '老年人口').check()
      await expect(page.locator('canvas')).toHaveAttribute(
        'aria-label',
        /老年人口/,
      )
      await checkAccessibility(page, testInfo)

      await clearSelection(page)
      await expect(emptyStatus(page)).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(0)
      await checkAccessibility(page, testInfo)
    })

    test(`${width}px: 一覧のスケルトン部品`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/tests/preview/skeleton.html')
      await expect(page.getByRole('status')).toHaveText(
        '都道府県一覧を読み込んでいます…',
      )
      await expect(page.locator('.checkbox-skeleton')).toHaveCount(47)
      await checkAccessibility(page, testInfo)
    })
  }

  for (const width of [1440, 390, 320]) {
    test(`${width}px: 県の選択・全解除・開閉（合成fixture）`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/tests/preview/prefecture-selection.html')
      await expect(selectionCount(page)).toHaveText('0 / 47 選択中')
      const collapsed = width < 640
      if (collapsed) {
        await checkAccessibility(page, testInfo)
        await page.getByRole('button', { name: '都道府県を選ぶ' }).click()
      }
      await page.getByRole('checkbox', { name: '東京都', exact: true }).check()
      await checkAccessibility(page, testInfo)
      if (collapsed) {
        await page.getByRole('button', { name: '閉じる', exact: true }).click()
        await expect(page.getByRole('checkbox')).toHaveCount(0)
        await checkAccessibility(page, testInfo)
        await page.getByRole('button', { name: '都道府県を選ぶ' }).click()
      }
      await clearSelection(page)
      await expect(selectionCount(page)).toHaveText('0 / 47 選択中')
      await checkAccessibility(page, testInfo)
    })

    for (const mode of ['loading', 'error'] as const) {
      test(`${width}px: 一覧の${mode === 'loading' ? '読み込み中' : '取得失敗'}と復帰（合成fixture）`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 })
        await page.goto(`/tests/preview/prefecture-selection.html?mode=${mode}`)
        if (width < 640)
          await page.getByRole('button', { name: '都道府県を選ぶ' }).click()
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
        await expect(selectionCount(page)).toHaveText('0 / 47 選択中')
        await checkAccessibility(page, testInfo)
      })
    }
  }

  for (const state of ['通常・無効', 'hover', 'focus'] as const) {
    test(`Buttonの${state}状態`, async ({ page }, testInfo) => {
      await page.goto('/tests/preview/button.html')
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

// 検査自体が壊れていないことを、意図的に違反したHTMLで確かめる。
test.describe('axe検査の回帰確認', () => {
  const html = (body: string) =>
    `<!doctype html><html lang="ja"><head><title>検査の回帰確認</title></head><body><main>${body}</main></body></html>`

  for (const [rule, body] of [
    ['label', '<input>'],
    ['aria-valid-attr-value', '<button aria-expanded="invalid">操作</button>'],
    [
      'color-contrast',
      '<p style="color:#aaa;background:#fff">低コントラストの文字</p>',
    ],
  ] as const) {
    test(`${rule} 違反で失敗し、結果JSONを添付する`, async ({
      page,
    }, testInfo) => {
      await page.setContent(html(body))
      await expect(checkAccessibility(page, testInfo)).rejects.toThrow(
        'WCAG A/AA violations',
      )
      const attachment = testInfo.attachments.find(
        (item) => item.name === 'axe-results-1',
      )
      if (!attachment?.path) throw new Error('axe結果が添付されていません')
      const results = JSON.parse(await readFile(attachment.path, 'utf8'))
      expect(
        results.violations.map((item: { id: string }) => item.id),
      ).toContain(rule)
      expect(Array.isArray(results.incomplete)).toBe(true)
    })
  }

  test('判定できないコントラストは失敗にせず、手動確認として記録する', async ({
    page,
  }, testInfo) => {
    await page.setContent(
      html(
        '<p style="color:#000;background-image:linear-gradient(#fff,#ddd)">背景の手動確認が必要な文字</p>',
      ),
    )
    const results = await checkAccessibility(page, testInfo)
    expect(results.incomplete.map((item) => item.id)).toContain(
      'color-contrast',
    )
    expect(testInfo.annotations.map((item) => item.type)).toContain(
      'manual-review',
    )
    const saved = JSON.parse(
      await readFile(testInfo.outputPath('accessibility-1.json'), 'utf8'),
    )
    expect(saved.incomplete).toEqual(results.incomplete)
  })
})

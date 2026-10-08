import type { Page, Route } from '@playwright/test'
import { prefectureResponse, appPopulationResponse } from '../fixtures/appApi'

export const prefecturesApi = '**/api/v1/prefectures'
export const populationApi = '**/api/v1/population/composition/perYear?*'

export const serviceUnavailable = {
  status: 503,
  json: { error: 'SERVICE_UNAVAILABLE' },
}

export const prefCodeOf = (route: Route) =>
  Number(new URL(route.request().url()).searchParams.get('prefCode'))

// 応答を保留し、テスト側の release() で返す。遅延応答や解除後の到着を検証するために使う。
export function gate() {
  let release = () => {}
  const opened = new Promise<void>((resolve) => {
    release = resolve
  })
  return { wait: () => opened, release: () => release() }
}

// 47県の一覧を返す。
export function mockPrefectures(page: Page) {
  return page.route(prefecturesApi, (route) =>
    route.fulfill({ json: prefectureResponse }),
  )
}

// 県コードごとの合成人口を返し、要求された県コードを順に記録する。
export async function mockPopulation(page: Page) {
  const requestedCodes: number[] = []
  await page.route(populationApi, (route) => {
    const code = prefCodeOf(route)
    requestedCodes.push(code)
    return route.fulfill({ json: appPopulationResponse(code) })
  })
  return requestedCodes
}

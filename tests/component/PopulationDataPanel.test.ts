import { describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PopulationDataPanel from '../../src/components/population/PopulationDataPanel.vue'
import {
  parsePopulation,
  type PopulationComposition,
} from '../../src/components/population/populationApi'
import { deferred } from '../fixtures/deferred'
import { populationResponse } from '../fixtures/population'
import { hokkaido, osaka, tokyo } from '../fixtures/prefectures'
import { buttonByLabel, radioByValue } from './queries'

const composition = (base?: number) => parsePopulation(populationResponse(base))
const EMPTY_MESSAGE = '都道府県を選択すると、人口の推移を確認できます'

// slotには県名と2020年の値だけを描き、取得結果が表示へ渡ることを確かめる。
const slot = `<template #default="{ series }">
  <p v-for="entry in series" :key="entry.prefCode" :data-pref-code="entry.prefCode">{{ entry.prefName }}={{ entry.data[0].value }}</p>
</template>`

function mountPanel(
  loader = vi.fn().mockResolvedValue(composition()),
  selectedPrefectures = [hokkaido],
) {
  const wrapper = mount(PopulationDataPanel, {
    props: { selectedPrefectures, loader },
    slots: { default: slot },
  })
  return { wrapper, loader }
}
const shown = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-pref-code]').map((p) => p.text())
const requestedCodes = (loader: ReturnType<typeof vi.fn>) =>
  loader.mock.calls.map((call) => call[0])
const pendingLoader = () => {
  const pending = deferred<PopulationComposition>()
  return { loader: vi.fn(() => pending.promise), ...pending }
}

describe('PopulationDataPanel: 未選択', () => {
  test('総人口を選んだ状態で、県の選択を促す案内を表示する', () => {
    const { wrapper } = mountPanel(undefined, [])
    expect(radioByValue(wrapper, 'total').element.checked).toBe(true)
    expect(wrapper.get('[role="status"]').text()).toContain(EMPTY_MESSAGE)
  })

  test('区分を変えても通信しない', async () => {
    const { wrapper, loader } = mountPanel(undefined, [])
    await radioByValue(wrapper, 'young').setValue()
    await flushPromises()
    expect(loader).not.toHaveBeenCalled()
  })
})

describe('PopulationDataPanel: 取得と区分の切替', () => {
  test('取得中は読み込み中の案内を表示する', () => {
    const { wrapper } = mountPanel(pendingLoader().loader)
    expect(wrapper.get('[role="status"]').text()).toContain('読み込み中')
  })

  test('県ごとに1回取得し、区分の切替は取得済みデータから表示する', async () => {
    const { wrapper, loader } = mountPanel()
    await flushPromises()
    expect(shown(wrapper)).toEqual(['北海道=100'])
    for (const [category, value] of [
      ['young', 101],
      ['working', 102],
      ['elder', 103],
      ['total', 100],
    ] as const) {
      await radioByValue(wrapper, category).setValue()
      expect(shown(wrapper)).toEqual([`北海道=${value}`])
    }
    expect(loader).toHaveBeenCalledTimes(1)
  })

  test('取得中に区分を変えても、到着した応答を現在の区分で表示する', async () => {
    const pending = pendingLoader()
    const { wrapper } = mountPanel(pending.loader)
    await radioByValue(wrapper, 'young').setValue()
    pending.resolve(composition())
    await flushPromises()
    expect(shown(wrapper)).toEqual(['北海道=101'])
  })
})

describe('PopulationDataPanel: 県別キャッシュ', () => {
  test('県を追加すると未取得の県だけを取得し、既存の表示を保つ', async () => {
    const { wrapper, loader } = mountPanel()
    await flushPromises()
    await wrapper.setProps({ selectedPrefectures: [hokkaido, tokyo] })
    await flushPromises()
    expect(requestedCodes(loader)).toEqual([1, 13])
    expect(shown(wrapper)).toEqual(['北海道=100', '東京都=100'])
  })

  test('解除した県は表示から外し、再選択はキャッシュを使って再取得しない', async () => {
    const { wrapper, loader } = mountPanel(undefined, [hokkaido, tokyo])
    await flushPromises()
    await wrapper.setProps({ selectedPrefectures: [tokyo] })
    expect(shown(wrapper)).toEqual(['東京都=100'])
    await wrapper.setProps({ selectedPrefectures: [hokkaido, tokyo] })
    await flushPromises()
    expect(shown(wrapper)).toEqual(['北海道=100', '東京都=100'])
    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('取得中の県を解除して再選択しても、重複して取得しない', async () => {
    const { wrapper, loader } = mountPanel(pendingLoader().loader)
    await wrapper.setProps({ selectedPrefectures: [] })
    await wrapper.setProps({ selectedPrefectures: [hokkaido] })
    expect(loader).toHaveBeenCalledTimes(1)
  })

  test('追加の県を取得中は、既存の県の表示を保ったままコンパクトな案内を出す', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce(composition())
      .mockImplementation(() => new Promise(() => {}))
    const { wrapper } = mountPanel(loader)
    await flushPromises()
    await wrapper.setProps({ selectedPrefectures: [hokkaido, tokyo] })
    expect(shown(wrapper)).toEqual(['北海道=100'])
    expect(wrapper.get('[role="status"]').text()).toContain('読み込み中')
    expect(wrapper.get('.status-message').classes()).toContain(
      'status-message-compact',
    )
  })
})

describe('PopulationDataPanel: 失敗と再試行', () => {
  // 北海道は成功、東京都は1回目だけ失敗し、再試行で base=200 の値を返す。
  const loaderFailingTokyoOnce = () =>
    vi
      .fn()
      .mockResolvedValueOnce(composition())
      .mockRejectedValueOnce(new Error('secret'))
      .mockResolvedValue(composition(200))

  test('失敗の案内に内部情報を出さず、成功した県は表示し続ける', async () => {
    const { wrapper } = mountPanel(loaderFailingTokyoOnce(), [hokkaido, tokyo])
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'データを取得できませんでした',
    )
    expect(wrapper.text()).not.toContain('secret')
    expect(shown(wrapper)).toEqual(['北海道=100'])
  })

  test('失敗後の区分変更では自動で再取得しない', async () => {
    const { wrapper, loader } = mountPanel(loaderFailingTokyoOnce(), [
      hokkaido,
      tokyo,
    ])
    await flushPromises()
    await radioByValue(wrapper, 'elder').setValue()
    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('再読み込みで失敗した県だけを再取得し、現在の区分で表示する', async () => {
    const { wrapper, loader } = mountPanel(loaderFailingTokyoOnce(), [
      hokkaido,
      tokyo,
    ])
    await flushPromises()
    await radioByValue(wrapper, 'elder').setValue()
    await buttonByLabel(wrapper, '再読み込み').trigger('click')
    await flushPromises()
    expect(requestedCodes(loader)).toEqual([1, 13, 13])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(shown(wrapper)).toEqual(['北海道=103', '東京都=203'])
  })

  test('失敗した県を解除して再選択すると再取得する', async () => {
    const { wrapper, loader } = mountPanel(loaderFailingTokyoOnce(), [
      hokkaido,
      tokyo,
    ])
    await flushPromises()
    await wrapper.setProps({ selectedPrefectures: [hokkaido] })
    await wrapper.setProps({ selectedPrefectures: [hokkaido, tokyo] })
    await flushPromises()
    expect(requestedCodes(loader)).toEqual([1, 13, 13])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(shown(wrapper)).toEqual(['北海道=100', '東京都=200'])
  })

  test('別の県を取得中でも失敗の案内と再読み込みを優先して表示する', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce(composition())
      .mockRejectedValueOnce(new Error('internal'))
      .mockImplementation(() => new Promise(() => {}))
    const { wrapper } = mountPanel(loader, [hokkaido, tokyo])
    await flushPromises()
    await wrapper.setProps({ selectedPrefectures: [hokkaido, tokyo, osaka] })
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'データを取得できませんでした',
    )
    await buttonByLabel(wrapper, '再読み込み').trigger('click')
    expect(requestedCodes(loader)).toEqual([1, 13, 27, 13])
  })
})

describe('PopulationDataPanel: 解除後に届いた応答', () => {
  test.each(['resolve', 'reject'] as const)(
    '解除した県の遅れた%sは、県を復活させず案内も出さない',
    async (outcome) => {
      const pending = pendingLoader()
      const { wrapper } = mountPanel(pending.loader, [hokkaido])
      await wrapper.setProps({ selectedPrefectures: [] })
      if (outcome === 'resolve') pending.resolve(composition())
      else pending.reject(new Error('failed'))
      await flushPromises()
      expect(shown(wrapper)).toEqual([])
      expect(wrapper.get('[role="status"]').text()).toContain(EMPTY_MESSAGE)
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    },
  )
})

import { afterEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from '../../src/App.vue'
import PopulationDataPanel from '../../src/components/population/PopulationDataPanel.vue'
import { populationResponse } from '../fixtures/population'
afterEach(() => vi.unstubAllGlobals())
test('県選択をmainの人口区分UIへ渡し、区分変更・全解除でも選択と区分が整合する', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(populationResponse())))
  vi.stubGlobal('fetch', fetch)
  const prefectures = [{ prefCode: 1, prefName: '北海道' }]
  const wrapper = mount(App, {
    props: { prefectureLoader: () => Promise.resolve(prefectures) },
    // Canvas rendering is covered by PopulationChart tests and browser E2E.
    global: { stubs: { PopulationChart: true } },
  })
  try {
    await flushPromises()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await flushPromises()
    expect(
      wrapper.getComponent(PopulationDataPanel).props('selectedPrefectures'),
    ).toEqual(prefectures)
    await wrapper.get('input[value="young"]').setValue()
    expect(wrapper.get('input[type="checkbox"]').element).toHaveProperty(
      'checked',
      true,
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    await wrapper.get('.desktop-clear').trigger('click')
    expect(wrapper.get('input[value="young"]').element).toHaveProperty(
      'checked',
      true,
    )
    expect(wrapper.text()).toContain(
      '都道府県を選択すると、人口の推移を確認できます',
    )
    expect(
      wrapper.getComponent(PopulationDataPanel).props('selectedPrefectures'),
    ).toEqual([])
  } finally {
    wrapper.unmount()
  }
})

test('全体確認用loaderを既存人口パネルへ渡し、選択した県だけ取得する', async () => {
  const { parsePopulation } =
    await import('../../src/components/population/populationApi')
  const populationLoader = vi
    .fn()
    .mockResolvedValue(parsePopulation(populationResponse()))
  const wrapper = mount(App, {
    props: {
      prefectureLoader: () =>
        Promise.resolve([{ prefCode: 13, prefName: '東京都' }]),
      populationLoader,
    },
    global: { stubs: { PopulationChart: true } },
  })
  try {
    await flushPromises()
    expect(populationLoader).not.toHaveBeenCalled()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await flushPromises()
    expect(populationLoader).toHaveBeenCalledExactlyOnceWith(13)
    await wrapper.get('input[value="elder"]').setValue()
    expect(populationLoader).toHaveBeenCalledTimes(1)
  } finally {
    wrapper.unmount()
  }
})

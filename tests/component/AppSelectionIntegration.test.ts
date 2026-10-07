import { afterEach, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from '../../src/App.vue'
import PopulationDataPanel from '../../src/features/population/PopulationDataPanel.vue'
import { populationResponse } from '../fixtures/population'
afterEach(() => vi.unstubAllGlobals())
test('県選択をmainの人口区分UIへ渡し、区分変更・全解除でも選択と区分が整合する', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(populationResponse())))
  vi.stubGlobal('fetch', fetch)
  const prefectures = [{ prefCode: 1, prefName: '北海道' }]
  // Canvas rendering is covered by PopulationChart tests and real-browser E2E.
  const wrapper = mount(App, {
    global: { stubs: { PopulationChart: true } },
    props: { prefectureLoader: () => Promise.resolve(prefectures) },
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

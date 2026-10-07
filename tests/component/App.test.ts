import { expect, test } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from '../../src/App.vue'
import PopulationPage from '../../src/pages/PopulationPage.vue'
import PopulationDataPanel from '../../src/components/population/PopulationDataPanel.vue'
import { parsePopulation } from '../../src/components/population/populationApi'
import { populationResponse } from '../fixtures/population'

test('ページとコンテンツ領域を適切な見出し階層で表示する', () => {
  const wrapper = mount(App)
  try {
    expect(wrapper.get('h1').text()).toBe('都道府県別の人口推移')
    expect(wrapper.findAll('h2').map((heading) => heading.text())).toEqual([
      '都道府県',
      '人口推移',
    ])
    expect(wrapper.findAll('main')).toHaveLength(1)
    for (const section of wrapper.findAll('section')) {
      expect(
        wrapper.get(`#${section.attributes('aria-labelledby')}`).text(),
      ).toBeTruthy()
    }
  } finally {
    wrapper.unmount()
  }
})

test('専用ページが部品を直接組み立て、県選択と区分の正本を持つ', async () => {
  const wrapper = mount(PopulationPage, {
    props: {
      prefectureLoader: async () => [{ prefCode: 13, prefName: '東京都' }],
      populationLoader: async () => parsePopulation(populationResponse()),
    },
    global: { stubs: { PopulationChart: true } },
  })
  try {
    await flushPromises()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await flushPromises()
    await wrapper.get('input[value="young"]').setValue()
    expect(wrapper.getComponent(PopulationDataPanel).props('category')).toBe(
      'young',
    )
    expect(
      wrapper.getComponent(PopulationDataPanel).props('selectedPrefectures'),
    ).toEqual([{ prefCode: 13, prefName: '東京都' }])
    await wrapper.get('.desktop-clear').trigger('click')
    expect(
      wrapper.getComponent(PopulationDataPanel).props('selectedPrefectures'),
    ).toEqual([])
    expect(wrapper.getComponent(PopulationDataPanel).props('category')).toBe(
      'young',
    )
    expect(wrapper.find('.prefectures-space, .population-space').exists()).toBe(
      false,
    )
  } finally {
    wrapper.unmount()
  }
})

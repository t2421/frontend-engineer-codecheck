import { describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PopulationPage from '../../src/pages/PopulationPage.vue'
import { parsePopulation } from '../../src/components/population/populationApi'
import { populationResponse } from '../fixtures/population'
import { hokkaido, tokyo } from '../fixtures/prefectures'
import { buttonByLabel, checkboxByLabel, radioByValue } from './queries'

// Canvas描画はPopulationChartのテストとE2Eで確かめる。ここでは受け取った県名だけを描く。
const ChartStub = {
  props: ['series', 'category'],
  template:
    '<ul aria-label="都道府県の凡例"><li v-for="entry in series" :key="entry.prefCode">{{ entry.prefName }}</li></ul>',
}
const legendNames = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[aria-label="都道府県の凡例"] li').map((li) => li.text())

async function mountPage() {
  const populationLoader = vi
    .fn()
    .mockResolvedValue(parsePopulation(populationResponse()))
  const wrapper = mount(PopulationPage, {
    props: {
      prefectureLoader: async () => [hokkaido, tokyo],
      populationLoader,
    },
    global: { stubs: { PopulationChart: ChartStub } },
  })
  await flushPromises()
  return { wrapper, populationLoader }
}

describe('PopulationPage', () => {
  test('一覧を読み込むまでは人口を取得せず、県を選ぶとその県だけを取得して表示する', async () => {
    const { wrapper, populationLoader } = await mountPage()
    expect(populationLoader).not.toHaveBeenCalled()
    await checkboxByLabel(wrapper, '東京都').setValue(true)
    await flushPromises()
    expect(populationLoader).toHaveBeenCalledExactlyOnceWith(13)
    expect(legendNames(wrapper)).toEqual(['東京都'])
  })

  test('区分を変えても選択県は保ち、人口を再取得しない', async () => {
    const { wrapper, populationLoader } = await mountPage()
    await checkboxByLabel(wrapper, '東京都').setValue(true)
    await flushPromises()
    await radioByValue(wrapper, 'young').setValue()
    expect(checkboxByLabel(wrapper, '東京都').element.checked).toBe(true)
    expect(legendNames(wrapper)).toEqual(['東京都'])
    expect(populationLoader).toHaveBeenCalledTimes(1)
  })

  test('選択を解除すると未選択の案内へ戻り、区分の選択は保つ', async () => {
    const { wrapper } = await mountPage()
    await checkboxByLabel(wrapper, '東京都').setValue(true)
    await flushPromises()
    await radioByValue(wrapper, 'young').setValue()
    await buttonByLabel(wrapper, '選択を解除').trigger('click')
    expect(legendNames(wrapper)).toEqual([])
    expect(wrapper.text()).toContain(
      '都道府県を選択すると、人口の推移を確認できます',
    )
    expect(radioByValue(wrapper, 'young').element.checked).toBe(true)
  })
})

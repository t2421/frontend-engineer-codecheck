import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../../src/App.vue'
import PopulationPage from '../../src/components/PopulationPage.vue'

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

test('後続部品をslotへ配置すると空領域を置き換える', () => {
  const wrapper = mount(PopulationPage, {
    slots: {
      prefectures: '<div>都道府県選択部品</div>',
      population: '<div>人口推移部品</div>',
      'prefecture-actions': '<button>選択を解除</button>',
    },
  })
  try {
    expect(wrapper.get('.prefectures').text()).toContain('都道府県選択部品')
    expect(wrapper.get('.population').text()).toContain('人口推移部品')
    expect(wrapper.get('button').text()).toBe('選択を解除')
    expect(wrapper.find('[aria-hidden]').exists()).toBe(false)
  } finally {
    wrapper.unmount()
  }
})

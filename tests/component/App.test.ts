import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../../src/App.vue'

describe('App', () => {
  test('ページ見出しと、都道府県・人口推移の2つの領域を見出し付きで表示する', () => {
    const wrapper = mount(App)
    expect(wrapper.get('h1').text()).toBe('都道府県別の人口推移')
    expect(wrapper.findAll('h2').map((heading) => heading.text())).toEqual([
      '都道府県',
      '人口推移',
    ])
    expect(wrapper.findAll('main')).toHaveLength(1)
    for (const section of wrapper.findAll('section')) {
      const headingId = section.attributes('aria-labelledby')
      expect(wrapper.get(`#${headingId}`).text()).not.toBe('')
    }
  })
})

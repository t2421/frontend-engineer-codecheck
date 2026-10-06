import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../../src/App.vue'

test('Vueコンポーネントの見出しを表示する', () => {
  const wrapper = mount(App)
  try {
    expect(wrapper.get('h1').text()).toBe('都道府県別人口推移')
  } finally {
    wrapper.unmount()
  }
})

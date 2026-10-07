import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import PageTitle from '../../src/components/shared/PageTitle.vue'

test('ページ名をh1、説明を段落として表示する', () => {
  const wrapper = mount(PageTitle, {
    props: { title: 'ページ名', description: '説明文' },
  })
  try {
    expect(wrapper.get('h1').text()).toBe('ページ名')
    expect(wrapper.get('p').text()).toBe('説明文')
  } finally {
    wrapper.unmount()
  }
})

test('説明のないページでも見出しだけを表示できる', () => {
  const wrapper = mount(PageTitle, { props: { title: 'ページ名' } })
  try {
    expect(wrapper.get('h1').text()).toBe('ページ名')
    expect(wrapper.find('p').exists()).toBe(false)
  } finally {
    wrapper.unmount()
  }
})

import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import PageTitle from '../../src/components/shared/PageTitle.vue'

describe('PageTitle', () => {
  test('ページ名をh1、説明を段落として表示する', () => {
    const wrapper = mount(PageTitle, {
      props: { title: 'ページ名', description: '説明文' },
    })
    expect(wrapper.get('h1').text()).toBe('ページ名')
    expect(wrapper.get('p').text()).toBe('説明文')
  })

  test('説明がなければ見出しだけを表示する', () => {
    const wrapper = mount(PageTitle, { props: { title: 'ページ名' } })
    expect(wrapper.get('h1').text()).toBe('ページ名')
    expect(wrapper.find('p').exists()).toBe(false)
  })
})

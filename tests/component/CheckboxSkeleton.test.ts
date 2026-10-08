import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import CheckboxSkeleton from '../../src/components/shared/CheckboxSkeleton.vue'
import PrefectureSelectorSkeleton from '../../src/components/prefectures/PrefectureSelectorSkeleton.vue'

const interactive =
  'input, button, select, textarea, a[href], [tabindex], [contenteditable="true"]'

describe('CheckboxSkeleton', () => {
  test('装飾だけで、読み上げと操作の対象にならない', () => {
    const wrapper = mount(CheckboxSkeleton)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toBe('')
    expect(wrapper.findAll(interactive)).toHaveLength(0)
  })
})

describe('PrefectureSelectorSkeleton', () => {
  test('読み込み中の案内を1つだけ読み上げ、47枠の装飾を操作不可で表示する', () => {
    const wrapper = mount(PrefectureSelectorSkeleton)
    expect(wrapper.get('h2').text()).toBe('都道府県')
    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(wrapper.get('[role="status"]').text()).toBe(
      '都道府県一覧を読み込んでいます…',
    )
    expect(wrapper.findAllComponents(CheckboxSkeleton)).toHaveLength(47)
    expect(wrapper.findAll(interactive)).toHaveLength(0)
    expect(wrapper.text()).toContain('読み込み後に都道府県を選べます')
  })
})

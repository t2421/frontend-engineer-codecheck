import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import CheckboxSkeleton from '../../src/components/shared/CheckboxSkeleton.vue'
import PrefectureSelectorSkeleton from '../../src/components/prefectures/PrefectureSelectorSkeleton.vue'

const interactive =
  'input, button, select, textarea, a[href], [tabindex], [contenteditable="true"]'

test('装飾プレースホルダーは読み上げと操作の対象にならない', async () => {
  const wrapper = mount(CheckboxSkeleton)
  try {
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toBe('')
    expect(wrapper.findAll(interactive)).toHaveLength(0)
    await wrapper.trigger('click')
    await wrapper.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  } finally {
    wrapper.unmount()
  }
})

test('一覧の読み込みを一度通知し、47枠を装飾として表示する', () => {
  const wrapper = mount(PrefectureSelectorSkeleton)
  try {
    expect(wrapper.get('h2').text()).toBe('都道府県')
    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(wrapper.get('[role="status"]').text()).toBe(
      '都道府県一覧を読み込んでいます…',
    )
    expect(wrapper.findAllComponents(CheckboxSkeleton)).toHaveLength(47)
    expect(
      wrapper
        .findAllComponents(CheckboxSkeleton)
        .every((item) => item.attributes('aria-hidden') === 'true'),
    ).toBe(true)
    expect(wrapper.findAll(interactive)).toHaveLength(0)
    expect(wrapper.text()).toContain('読み込み後に都道府県を選べます')
    expect(wrapper.text()).not.toContain('選択済み')
  } finally {
    wrapper.unmount()
  }
})

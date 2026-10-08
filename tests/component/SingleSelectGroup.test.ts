import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import SingleSelectGroup from '../../src/components/shared/SingleSelectGroup.vue'
import { radioByValue } from './queries'

const options = [
  { value: 'first', label: '最初の選択肢' },
  { value: 'second', label: '次の選択肢' },
  { value: 'third', label: '別の選択肢' },
]
const checkedValues = (wrapper: ReturnType<typeof mount>) =>
  wrapper
    .findAll<HTMLInputElement>('input:checked')
    .map((radio) => radio.element.value)

describe('SingleSelectGroup', () => {
  test('グループ名と選択肢をradiogroupとして表示し、指定した値だけを選択状態にする', () => {
    const wrapper = mount(SingleSelectGroup, {
      props: { options, modelValue: 'second', label: '表示対象' },
    })
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe(
      '表示対象',
    )
    expect(wrapper.findAll('label').map((label) => label.text())).toEqual(
      options.map((option) => option.label),
    )
    expect(checkedValues(wrapper)).toEqual(['second'])
  })

  test('選択の変更を1回通知し、同じ値の再選択は通知しない', async () => {
    const Host = defineComponent({
      components: { SingleSelectGroup },
      setup: () => ({ options, selected: ref('second') }),
      template:
        '<SingleSelectGroup v-model="selected" :options="options" label="表示対象" />',
    })
    const wrapper = mount(Host)
    const group = wrapper.getComponent(SingleSelectGroup)
    await radioByValue(wrapper, 'third').setValue()
    expect(group.emitted('update:modelValue')).toEqual([['third']])
    expect(checkedValues(wrapper)).toEqual(['third'])
    await radioByValue(wrapper, 'third').setValue()
    expect(group.emitted('update:modelValue')).toHaveLength(1)
  })

  test('親からの値の変更は反映するが、通知は出さない', async () => {
    const wrapper = mount(SingleSelectGroup, {
      props: { options, modelValue: 'second', label: '表示対象' },
    })
    await wrapper.setProps({ modelValue: 'first' })
    expect(checkedValues(wrapper)).toEqual(['first'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  test('数値の選択肢は文字列に変えずに通知する', async () => {
    const wrapper = mount(SingleSelectGroup, {
      props: {
        options: [
          { value: 1, label: '一' },
          { value: 2, label: '二' },
        ],
        modelValue: 1,
        label: '数値',
      },
    })
    await radioByValue(wrapper, '2').setValue()
    expect(wrapper.emitted('update:modelValue')).toEqual([[2]])
  })

  test('複数のグループはradioのnameを共有しない', () => {
    const wrapper = mount(
      defineComponent({
        components: { SingleSelectGroup },
        setup: () => ({ options }),
        template: `<div>
          <SingleSelectGroup model-value="first" :options="options" label="一組目" />
          <SingleSelectGroup model-value="second" :options="options" label="二組目" />
        </div>`,
      }),
    )
    const [first, second] = wrapper.findAllComponents(SingleSelectGroup)
    if (!first || !second) throw new Error('2つのグループが必要です')
    const namesOf = (group: typeof first) =>
      new Set(group.findAll('input').map((radio) => radio.attributes('name')))
    expect(namesOf(first).size).toBe(1)
    expect(namesOf(second).size).toBe(1)
    expect(namesOf(first)).not.toEqual(namesOf(second))
  })
})

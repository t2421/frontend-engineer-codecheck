import { afterEach, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import SingleSelectGroup from '../../src/shared/ui/SingleSelectGroup.vue'

const options = [
  { value: 'first', label: '最初の選択肢' },
  { value: 'second', label: '次の選択肢' },
  { value: 'third', label: '別の選択肢' },
]
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

function render(props = {}) {
  const wrapper = mount(SingleSelectGroup, {
    props: { options, modelValue: 'second', label: '表示対象', ...props },
  })
  wrappers.push(wrapper)
  return wrapper
}

test('任意の選択肢と指定した一つの選択値を表示する', () => {
  const wrapper = render()
  expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe(
    '表示対象',
  )
  expect(wrapper.findAll('label').map((label) => label.text())).toEqual(
    options.map((option) => option.label),
  )
  expect(
    wrapper
      .findAll<HTMLInputElement>('input:checked')
      .map((radio) => radio.element.value),
  ).toEqual(['second'])
})

test('選択変更を一度通知し、v-modelで単一選択を更新する', async () => {
  const host = defineComponent({
    components: { SingleSelectGroup },
    setup: () => ({ options, selected: ref('second') }),
    template:
      '<SingleSelectGroup v-model="selected" :options="options" label="表示対象" />',
  })
  const wrapper = mount(host)
  wrappers.push(wrapper)
  const group = wrapper.getComponent(SingleSelectGroup)
  await wrapper.get('input[value="third"]').setValue()
  expect(group.emitted('update:modelValue')).toEqual([['third']])
  expect(wrapper.findAll('input:checked')).toHaveLength(1)
  expect(
    wrapper.get<HTMLInputElement>('input[value="third"]').element.checked,
  ).toBe(true)
  await wrapper.get('input[value="third"]').setValue()
  expect(group.emitted('update:modelValue')).toHaveLength(1)
})

test('親の選択値変更を反映する', async () => {
  const wrapper = render()
  await wrapper.setProps({ modelValue: 'first' })
  expect(
    wrapper
      .findAll<HTMLInputElement>('input:checked')
      .map((radio) => radio.element.value),
  ).toEqual(['first'])
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
})

test('数値の選択値を文字列に変換せず通知する', async () => {
  const wrapper = render({
    options: [
      { value: 1, label: '一' },
      { value: 2, label: '二' },
    ],
    modelValue: 1,
  })
  await wrapper.get('input[value="2"]').setValue()
  expect(wrapper.emitted('update:modelValue')).toEqual([[2]])
})

test('複数のグループはradioの名前を共有しない', () => {
  const wrapper = mount(
    defineComponent({
      components: { SingleSelectGroup },
      setup: () => ({ options }),
      template:
        '<div><SingleSelectGroup model-value="first" :options="options" label="一組目" /><SingleSelectGroup model-value="second" :options="options" label="二組目" /></div>',
    }),
  )
  wrappers.push(wrapper)
  const [first, second] = wrapper.findAllComponents(SingleSelectGroup)
  const firstNames = first
    .findAll('input')
    .map((radio) => radio.attributes('name'))
  expect(new Set(firstNames).size).toBe(1)
  expect(firstNames[0]).toBeTruthy()
  expect(second.get('input').attributes('name')).not.toBe(firstNames[0])
})

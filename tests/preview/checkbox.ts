import { createApp, defineComponent, h, ref } from 'vue'
import Checkbox from '../../src/components/shared/Checkbox.vue'
import '../../src/base.css'

createApp(
  defineComponent({
    setup() {
      const selected = ref(false)
      const changes = ref(0)
      return () =>
        h('main', [
          h('h1', '共通チェックボックスの確認'),
          h(
            'p',
            'ラベルクリック、TabとSpaceで操作できます。無効な項目は変更されません。',
          ),
          h(Checkbox, {
            label: '任意の項目',
            modelValue: selected.value,
            'onUpdate:modelValue': (value: boolean) => (selected.value = value),
            onChange: () => changes.value++,
          }),
          h(Checkbox, {
            label: '無効な項目',
            modelValue: false,
            disabled: true,
          }),
          h(Checkbox, {
            label: '選択済みの無効項目',
            modelValue: true,
            disabled: true,
          }),
          h('p', [
            '変更回数: ',
            h('output', { 'aria-label': '変更回数' }, String(changes.value)),
          ]),
          h('button', '次の操作'),
        ])
    },
  }),
).mount('#app')

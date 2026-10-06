import { createApp, defineComponent, h, ref } from 'vue'
import Checkbox from '../../src/shared/ui/Checkbox.vue'
import '../../src/base.css'

createApp(
  defineComponent({
    setup() {
      const selected = ref(false)
      const changes = ref(0)
      return () =>
        h('main', [
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
          h('output', { 'aria-label': '変更回数' }, String(changes.value)),
          h('button', '次の操作'),
        ])
    },
  }),
).mount('#app')

import { createApp, defineComponent, h, ref } from 'vue'
import Button from '../../src/components/shared/Button.vue'
import '../../src/base.css'

createApp(
  defineComponent({
    setup() {
      const clicks = ref(0)
      const disabledClicks = ref(0)
      const submissions = ref(0)
      return () =>
        h(
          'form',
          {
            style: {
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              padding: '16px',
              alignItems: 'center',
            },
            onSubmit: (event: SubmitEvent) => {
              event.preventDefault()
              submissions.value++
            },
          },
          [
            h(Button, { label: '再読み込み', onClick: () => clicks.value++ }),
            h(Button, {
              label: '無効',
              disabled: true,
              onClick: () => disabledClicks.value++,
            }),
            h(Button, { label: '送信', type: 'submit' }),
            h(Button, { label: 'リセット', type: 'reset' }),
            h('input', { 'aria-label': '入力', value: '初期値' }),
            h('output', { 'aria-label': 'クリック回数' }, String(clicks.value)),
            h(
              'output',
              { 'aria-label': '無効操作回数' },
              String(disabledClicks.value),
            ),
            h(
              'output',
              { 'aria-label': '送信回数' },
              String(submissions.value),
            ),
          ],
        )
    },
  }),
).mount('#app')

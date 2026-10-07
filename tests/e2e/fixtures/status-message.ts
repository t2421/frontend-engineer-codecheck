import { createApp, defineComponent, h, ref } from 'vue'
import StatusMessage from '../../../src/shared/ui/StatusMessage.vue'
import Button from '../../../src/shared/ui/Button.vue'
import '../../../src/base.css'

// Retry decisions remain with the caller; the action slot composes the shared Button.
createApp(
  defineComponent({
    setup() {
      const retries = ref(0)
      const state = ref<'error' | 'loading'>('error')
      return () =>
        h('div', [
          h('h1', '状態メッセージ'),
          h('div', { class: 'examples' }, [
            h(StatusMessage, {
              state: 'empty',
              title: '都道府県を選択すると、人口の推移を確認できます',
              description:
                '比較したい都道府県にチェックを入れると、人口の推移を表示します。',
            }),
            h(StatusMessage, {
              state: 'loading',
              title: '人口データを読み込み中…',
              description: 'しばらくお待ちください。',
            }),
            h(
              StatusMessage,
              {
                state: 'error',
                title: '人口データを取得できませんでした',
                description: '接続を確認して、もう一度お試しください。',
              },
              {
                action: () =>
                  h(Button, {
                    label: '再読み込み',
                    onClick: () => retries.value++,
                  }),
              },
            ),
            h(
              StatusMessage,
              {
                state: state.value,
                title:
                  state.value === 'error'
                    ? '都道府県一覧を取得できませんでした'
                    : '一覧を読み込み中…',
                description: '接続を確認して、一覧を再読み込みしてください。',
              },
              {
                action: () =>
                  h(Button, {
                    label: '一覧を再読み込み',
                    disabled: state.value === 'loading',
                    onClick: () => {
                      retries.value++
                      state.value = 'loading'
                    },
                  }),
              },
            ),
          ]),
          h('output', { 'aria-label': '再試行回数' }, String(retries.value)),
        ])
    },
  }),
).mount('#app')

<script setup lang="ts">
import { ref } from 'vue'
import FixtureLayout from './FixtureLayout.vue'
import PrefectureSelectionPanel from '../../src/components/prefectures/PrefectureSelectionPanel.vue'
import Button from '../../src/components/shared/Button.vue'
import type { Prefecture } from '../../src/components/prefectures/prefectureApi'
const selectedPrefectures = ref<Prefecture[]>([])
const names =
  '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(
    ' ',
  )
const data = names.map((prefName, index) => ({ prefCode: index + 1, prefName }))
const mode = new globalThis.URLSearchParams(globalThis.location.search).get(
  'mode',
)
let release: (() => void) | undefined
let attempt = 0
const syntheticLoader = () => {
  attempt++
  if (mode === 'error' && attempt === 1)
    return Promise.reject(new Error('合成失敗'))
  if (mode === 'loading' && attempt === 1)
    return new Promise<Prefecture[]>((resolve) => {
      release = () => resolve(data)
    })
  return Promise.resolve(data)
}
</script>
<template>
  <p>確認用の合成データです。実API検証ではありません。</p>
  <Button
    v-if="mode === 'loading'"
    label="合成応答を返す"
    @click="release?.()"
  />
  <FixtureLayout>
    <template #prefecture-content
      ><PrefectureSelectionPanel
        v-model="selectedPrefectures"
        :loader="syntheticLoader"
        heading-id="prefectures-title"
    /></template>
    <template #population
      ><output aria-label="選択県">{{
        JSON.stringify(selectedPrefectures)
      }}</output></template
    >
  </FixtureLayout>
</template>

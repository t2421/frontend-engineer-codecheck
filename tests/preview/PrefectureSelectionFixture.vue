<script setup lang="ts">
import { ref } from 'vue'
import FixtureLayout from './FixtureLayout.vue'
import PrefectureSelectionPanel from '../../src/components/prefectures/PrefectureSelectionPanel.vue'
import Button from '../../src/components/shared/Button.vue'
import type { Prefecture } from '../../src/components/prefectures/prefectureApi'
import { allPrefectures } from '../fixtures/prefectures'
const selectedPrefectures = ref<Prefecture[]>([])
const data = allPrefectures
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

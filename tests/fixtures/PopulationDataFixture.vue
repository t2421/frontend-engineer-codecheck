<script setup lang="ts">
import { computed, ref } from 'vue'
import PopulationPage from '../../src/components/PopulationPage.vue'
import PopulationDataPanel from '../../src/features/population/PopulationDataPanel.vue'
import Button from '../../src/shared/ui/Button.vue'
import { parsePopulation } from '../../src/features/population/populationApi'
import { populationResponse } from './population'
const selected = ref<number[]>([])
const prefectures = [
  { prefCode: 1, prefName: '北海道' },
  { prefCode: 13, prefName: '東京都' },
]
const selectedPrefectures = computed(() =>
  prefectures.filter((p) => selected.value.includes(p.prefCode)),
)
// Proxy mode is only for Playwright route mocks. Published previews use synthetic data.
const proxyMode =
  new globalThis.URLSearchParams(globalThis.location.search).get('mode') ===
  'proxy'
const failNext = ref(false)
const delayNext = ref(false)
const requestCount = ref(0)
const delayedResponses = ref<(() => void)[]>([])
async function syntheticLoader(prefCode: number) {
  requestCount.value++
  if (failNext.value) {
    failNext.value = false
    throw new Error('Synthetic failure')
  }
  if (delayNext.value) {
    delayNext.value = false
    await new Promise<void>((resolve) => {
      delayedResponses.value.push(resolve)
    })
  }
  return parsePopulation(populationResponse(prefCode === 1 ? 100 : 200))
}
function releaseResponses() {
  delayedResponses.value.splice(0).forEach((resolve) => resolve())
}
</script>
<template>
  <PopulationPage>
    <template #prefectures>
      <p>Issue #25検証用の選択入力（#24の実装ではありません）</p>
      <template v-if="!proxyMode">
        <p>合成データによる確認画面です。実APIは使用しません。</p>
        <div class="fixture-actions">
          <Button
            label="次の取得を失敗させる"
            :disabled="failNext"
            @click="failNext = true"
          />
          <Button
            label="次の取得を遅延させる"
            :disabled="delayNext"
            @click="delayNext = true"
          />
          <Button
            v-if="delayedResponses.length"
            label="遅延応答を返す"
            @click="releaseResponses"
          />
        </div>
        <p>
          合成データ取得回数:
          <output aria-label="合成データ取得回数">{{ requestCount }}</output>
        </p>
      </template>
      <p v-else>Playwright APIモック検証モード</p>
      <label v-for="prefecture in prefectures" :key="prefecture.prefCode"
        ><input
          v-model="selected"
          type="checkbox"
          :value="prefecture.prefCode"
        />{{ prefecture.prefName }}</label
      >
    </template>
    <template #population>
      <PopulationDataPanel
        :selected-prefectures="selectedPrefectures"
        :loader="proxyMode ? undefined : syntheticLoader"
      >
        <template #default="{ series, category }">
          <output aria-label="後続表示へのデータ"
            >{{ category }}:{{ JSON.stringify(series) }}</output
          >
        </template>
      </PopulationDataPanel>
    </template>
  </PopulationPage>
</template>
<style scoped>
.fixture-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}
output {
  overflow-wrap: anywhere;
}
label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-8);
  min-height: 44px;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PopulationPage from '../../src/components/PopulationPage.vue'
import PopulationDataPanel from '../../src/features/population/PopulationDataPanel.vue'
const selected = ref<number[]>([])
const prefectures = [
  { prefCode: 1, prefName: '北海道' },
  { prefCode: 13, prefName: '東京都' },
]
const selectedPrefectures = computed(() =>
  prefectures.filter((p) => selected.value.includes(p.prefCode)),
)
</script>
<template>
  <PopulationPage>
    <template #prefectures>
      <p>Issue #25検証用の選択入力（#24の実装ではありません）</p>
      <label v-for="prefecture in prefectures" :key="prefecture.prefCode"
        ><input
          v-model="selected"
          type="checkbox"
          :value="prefecture.prefCode"
        />{{ prefecture.prefName }}</label
      >
    </template>
    <template #population>
      <PopulationDataPanel :selected-prefectures="selectedPrefectures">
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

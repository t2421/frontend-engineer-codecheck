<script setup lang="ts">
import { ref } from 'vue'
import PopulationPage from './components/PopulationPage.vue'
import PrefectureSelectionPanel from './features/population/PrefectureSelectionPanel.vue'
import PopulationDataPanel from './features/population/PopulationDataPanel.vue'
import type { PrefectureLoader } from './features/population/usePrefectures'
import type { Prefecture } from './features/population/prefectureApi'
defineProps<{ prefectureLoader?: PrefectureLoader }>()
const selectedPrefectures = ref<Prefecture[]>([])
defineSlots<{
  population(props: { selectedPrefectures: readonly Prefecture[] }): unknown
}>()
</script>
<template>
  <PopulationPage>
    <template #prefecture-content>
      <PrefectureSelectionPanel
        v-model="selectedPrefectures"
        :loader="prefectureLoader"
        heading-id="prefectures-title"
      />
    </template>
    <template #population>
      <slot name="population" :selected-prefectures="selectedPrefectures">
        <PopulationDataPanel :selected-prefectures="selectedPrefectures" />
      </slot>
    </template>
  </PopulationPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PopulationPage from './pages/PopulationPage.vue'
import PrefectureSelectionPanel from './components/prefectures/PrefectureSelectionPanel.vue'
import PopulationDataPanel from './components/population/PopulationDataPanel.vue'
import type { PrefectureLoader } from './components/prefectures/usePrefectures'
import type { PopulationLoader } from './components/population/usePopulationData'
import type { Prefecture } from './components/prefectures/prefectureApi'
defineProps<{
  prefectureLoader?: PrefectureLoader
  populationLoader?: PopulationLoader
}>()
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
        <PopulationDataPanel
          :selected-prefectures="selectedPrefectures"
          :loader="populationLoader"
        />
      </slot>
    </template>
  </PopulationPage>
</template>

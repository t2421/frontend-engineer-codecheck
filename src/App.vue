<script setup lang="ts">
import PopulationPage from './pages/PopulationPage.vue'
import type { PrefectureLoader } from './components/prefectures/usePrefectures'
import type { PopulationLoader } from './components/population/usePopulationData'
defineProps<{
  prefectureLoader?: PrefectureLoader
  populationLoader?: PopulationLoader
}>()
</script>
<template>
  <PopulationPage
    :prefecture-loader="prefectureLoader"
    :population-loader="populationLoader"
  />
</template>

<script setup lang="ts">
import PopulationPage from './components/PopulationPage.vue'
import PopulationDataPanel from './features/population/PopulationDataPanel.vue'
import type { SelectedPrefecture } from './features/population/populationApi'
// #24 supplies this selection when its prefecture UI is integrated.
withDefaults(
  defineProps<{ selectedPrefectures?: readonly SelectedPrefecture[] }>(),
  { selectedPrefectures: () => [] },
)
</script>

<template>
  <PopulationPage>
    <template #population>
      <PopulationDataPanel :selected-prefectures="selectedPrefectures" />
    </template>
  </PopulationPage>
</template>

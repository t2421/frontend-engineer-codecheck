import { createApp } from 'vue'
import PopulationPage from '../../src/pages/PopulationPage.vue'
import { parsePopulation } from '../../src/components/population/populationApi'
import { appPopulationResponse, prefectureResponse } from '../fixtures/appApi'
import '../../src/styles/base.css'
createApp(PopulationPage, {
  prefectureLoader: async () => prefectureResponse.result,
  populationLoader: async (code: number) =>
    parsePopulation(appPopulationResponse(code)),
}).mount('#app')

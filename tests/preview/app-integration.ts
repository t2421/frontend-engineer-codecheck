import { createApp } from 'vue'
import App from '../../src/App.vue'
import { parsePopulation } from '../../src/components/population/populationApi'
import { appPopulationResponse, prefectureResponse } from '../fixtures/appApi'
import '../../src/base.css'
createApp(App, {
  prefectureLoader: async () => prefectureResponse.result,
  populationLoader: async (code: number) =>
    parsePopulation(appPopulationResponse(code)),
}).mount('#app')

<script setup lang="ts">
import { computed, ref } from 'vue'
import FixtureLayout from './FixtureLayout.vue'
import PopulationDataPanel from '../../src/components/population/PopulationDataPanel.vue'
import Checkbox from '../../src/components/shared/Checkbox.vue'
import Button from '../../src/components/shared/Button.vue'
import { type PopulationComposition } from '../../src/components/population/populationApi'
import { prefectureNames } from '../fixtures/prefectures'

const selected = ref<number[]>([])
const visible = ref(true)
const names = prefectureNames
// Three Figma reference series first. This is a synthetic review fixture,
// not #24's API-driven prefecture selector.
const codes = [
  13,
  27,
  1,
  ...names.map((_, i) => i + 1).filter((c) => ![13, 27, 1].includes(c)),
]
const prefectures = codes.map((prefCode) => ({
  prefCode,
  prefName: names[prefCode - 1]!,
}))
const selectedPrefectures = computed(() =>
  prefectures.filter((p) => selected.value.includes(p.prefCode)),
)
const factors = [1, 0.12, 0.6, 0.28]
// Additional synthetic year sequences verify that axis labels never resample data.
const yearMode = new globalThis.URLSearchParams(globalThis.location.search).get(
  'years',
)
const fixtureYears =
  yearMode === 'five-year'
    ? Array.from({ length: 13 }, (_, i) => 1960 + i * 5)
    : yearMode === 'annual'
      ? Array.from({ length: 61 }, (_, i) => 1960 + i)
      : yearMode === 'partial'
        ? [1970, 1975, 1980, 1985, 1990]
        : yearMode === 'gap'
          ? [2005, 2010, 2015]
          : yearMode === 'single'
            ? [2024]
            : yearMode === 'two'
              ? [1963, 2057]
              : yearMode === 'irregular'
                ? [1963, 1964, 1979, 2020, 2057]
                : undefined
async function loader(prefCode: number): Promise<PopulationComposition> {
  const values =
    prefCode === 13
      ? [760, 980, 1140, 1230, 1330, 1410, 1430]
      : prefCode === 27
        ? [660, 740, 830, 860, 880, 900, 890]
        : prefCode === 1
          ? [480, 520, 560, 580, 560, 550, 520]
          : [200, 240, 260, 250, 270, 280, 260].map((v) => v + prefCode)
  const years =
    yearMode === 'changing'
      ? prefCode === 13
        ? [1963, 1964, 1979, 2020, 2057]
        : [1951, 1985, 2073]
      : fixtureYears
  const points = years
    ? years.map((year, i) => ({
        year,
        value: values[0]! * 10000 + i * 10000,
      }))
    : values.map((v, j) => ({ year: 1960 + j * 10, value: v * 10000 }))
  return {
    boundaryYear: 2020,
    categories: {
      total: points,
      young: (yearMode === 'changing' ? points.slice(1, -1) : points).map(
        (p) => ({
          year: p.year,
          value: Math.round(p.value * factors[1]!),
        }),
      ),
      working: points.map((p) => ({
        year: p.year,
        value: Math.round(p.value * factors[2]!),
      })),
      elder: points.map((p) => ({
        year: p.year,
        value: Math.round(p.value * factors[3]!),
      })),
    },
  }
}
function select(code: number, checked: boolean) {
  selected.value = checked
    ? [...selected.value, code]
    : selected.value.filter((c) => c !== code)
}
</script>
<template>
  <FixtureLayout>
    <template #prefecture-actions>
      <Button label="選択を解除" @click="selected = []" />
      <Button label="全47県を選択" @click="selected = codes" />
      <Button label="グラフ領域の表示を切替" @click="visible = !visible" />
    </template>
    <template #prefectures>
      <p>Issue #26 描画確認用の合成データです。実APIは使用しません。</p>
      <fieldset class="fixture-prefectures">
        <legend>都道府県の選択（描画検証用）</legend>
        <Checkbox
          v-for="p in prefectures"
          :key="p.prefCode"
          :label="p.prefName"
          :model-value="selected.includes(p.prefCode)"
          @update:model-value="select(p.prefCode, $event)"
        />
      </fieldset>
    </template>
    <template #population>
      <PopulationDataPanel
        v-if="visible"
        :selected-prefectures="selectedPrefectures"
        :loader="loader"
      />
    </template>
  </FixtureLayout>
</template>
<style scoped>
.fixture-prefectures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(136px, 1fr));
  border: 0;
  margin: 0;
  padding: 0;
}
.fixture-prefectures legend {
  padding: var(--space-0);
  margin-bottom: var(--space-8);
}
</style>

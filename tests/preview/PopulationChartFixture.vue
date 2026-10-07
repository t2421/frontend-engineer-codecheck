<script setup lang="ts">
import { computed, ref } from 'vue'
import FixtureLayout from './FixtureLayout.vue'
import PopulationDataPanel from '../../src/components/population/PopulationDataPanel.vue'
import Checkbox from '../../src/components/shared/Checkbox.vue'
import Button from '../../src/components/shared/Button.vue'
import { type PopulationComposition } from '../../src/components/population/populationApi'

const selected = ref<number[]>([])
const visible = ref(true)
const names = [
  '北海道',
  '青森県',
  '岩手県',
  '宮城県',
  '秋田県',
  '山形県',
  '福島県',
  '茨城県',
  '栃木県',
  '群馬県',
  '埼玉県',
  '千葉県',
  '東京都',
  '神奈川県',
  '新潟県',
  '富山県',
  '石川県',
  '福井県',
  '山梨県',
  '長野県',
  '岐阜県',
  '静岡県',
  '愛知県',
  '三重県',
  '滋賀県',
  '京都府',
  '大阪府',
  '兵庫県',
  '奈良県',
  '和歌山県',
  '鳥取県',
  '島根県',
  '岡山県',
  '広島県',
  '山口県',
  '徳島県',
  '香川県',
  '愛媛県',
  '高知県',
  '福岡県',
  '佐賀県',
  '長崎県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
  '沖縄県',
]
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
  const points = fixtureYears
    ? fixtureYears.map((year, i) => ({
        year,
        value: values[0]! * 10000 + i * 10000,
      }))
    : values.map((v, j) => ({ year: 1960 + j * 10, value: v * 10000 }))
  return {
    boundaryYear: 2020,
    categories: {
      total: points,
      young: points.map((p) => ({
        year: p.year,
        value: Math.round(p.value * factors[1]!),
      })),
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

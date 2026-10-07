<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import PageTitle from '../components/shared/PageTitle.vue'
import PrefectureSelectionPanel from '../components/prefectures/PrefectureSelectionPanel.vue'
import PopulationDataPanel from '../components/population/PopulationDataPanel.vue'
import type { PrefectureLoader } from '../components/prefectures/usePrefectures'
import type { PopulationLoader } from '../components/population/usePopulationData'
import type { Prefecture } from '../components/prefectures/prefectureApi'
import type { PopulationCategory } from '../components/population/populationApi'
import populationMark from '../assets/population-mark.svg'
import { useFloatingSelection } from '../components/prefectures/useFloatingSelection'
defineProps<{
  prefectureLoader?: PrefectureLoader
  populationLoader?: PopulationLoader
}>()
const selectedPrefectures = ref<Prefecture[]>([])
const category = ref<PopulationCategory>('total')
const controlHeight = ref<number>()
const selector = useTemplateRef<HTMLElement>('selector')
const population = useTemplateRef<HTMLElement>('population')
const {
  visible: floating,
  isMobile,
  scrollSpace,
} = useFloatingSelection(selector, population)
</script>

<template>
  <a class="skip-link" href="#main-content">本文へ移動</a>
  <header class="app-header">
    <div class="header-content">
      <img
        class="brand-mark"
        :src="populationMark"
        alt=""
        width="24"
        height="24"
      />
      <p class="brand">人口推移ビューア</p>
      <p class="header-description">都道府県別データ</p>
    </div>
  </header>

  <main
    id="main-content"
    class="main-content"
    tabindex="-1"
    :style="{
      '--graph-scroll-space': `${scrollSpace}px`,
      '--floating-control-height': controlHeight
        ? `${controlHeight}px`
        : undefined,
    }"
  >
    <PageTitle
      title="都道府県別の人口推移"
      description="都道府県と人口の区分を選んで、変化を比べられます。"
    />

    <section
      ref="selector"
      class="content-area prefectures"
      aria-labelledby="prefectures-title"
    >
      <PrefectureSelectionPanel
        v-model="selectedPrefectures"
        :loader="prefectureLoader"
        :floating="floating"
        :is-mobile="isMobile"
        heading-id="prefectures-title"
        @control-height="controlHeight = $event"
      />
    </section>

    <section
      ref="population"
      class="content-area population"
      aria-labelledby="population-title"
    >
      <div class="population-heading">
        <h2 id="population-title" class="section-title">人口推移</h2>
        <p class="population-description">選択した都道府県を同じ区分で比較</p>
      </div>
      <PopulationDataPanel
        v-model:category="category"
        :selected-prefectures="selectedPrefectures"
        :loader="populationLoader"
      />
    </section>
  </main>
</template>

<style scoped>
.app-header {
  background-color: var(--color-bg-surface);
  border-bottom: var(--stroke-1) solid var(--color-border-default);
}

.header-content,
.main-content {
  width: 100%;
  max-width: 1440px;
  margin-inline: auto;
  padding-inline: var(--space-80);
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  min-height: 64px;
}

.brand-mark {
  flex-shrink: 0;
}

.brand {
  font: var(--font-label);
}

.header-description {
  margin-inline-start: auto;
  font: var(--font-caption);
  color: var(--color-text-secondary);
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-24);
  padding-block: var(--space-40);
}

.section-title {
  font: var(--font-section);
}

.content-area {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--space-24);
  background-color: var(--color-bg-surface);
  border: var(--stroke-1) solid var(--color-border-default);
  border-radius: var(--radius-12);
}

.prefectures {
  gap: var(--space-16);
}

.population {
  gap: var(--space-20);
}

.population-heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.population-description {
  font: var(--font-caption);
  color: var(--color-text-secondary);
}

.skip-link {
  position: absolute;
  z-index: 1;
  top: var(--space-12);
  left: var(--space-16);
  padding: var(--space-8) var(--space-12);
  color: var(--color-action-default);
  background-color: var(--color-bg-surface);
  border-radius: var(--radius-4);
  transform: translateY(-200%);
}

.skip-link:focus {
  transform: translateY(0);
}

@media (width < 1024px) {
  .header-content,
  .main-content {
    padding-inline: var(--space-32);
  }

  .main-content {
    padding-block: var(--space-32);
  }
}

@media (width < 640px) {
  .header-content,
  .main-content {
    padding-inline: var(--space-16);
  }

  .main-content {
    padding-block: var(--space-16);

    /* 初回の計測前もFigmaの52pxボタンと上下余白・safe-areaを確保する。 */
    --floating-control-height: calc(
      52px + var(--space-24) + env(safe-area-inset-bottom)
    );

    /* 短いグラフも選択欄を画面外へ送れ、文字拡大時も軸を固定操作と重ねない余白。 */
    padding-block-end: calc(
      max(
        var(--graph-scroll-space) - var(--space-20),
        var(--floating-control-height) + var(--space-16)
      )
    );
  }

  .header-description {
    display: none;
  }

  .content-area {
    padding: var(--space-16);
  }
}
</style>

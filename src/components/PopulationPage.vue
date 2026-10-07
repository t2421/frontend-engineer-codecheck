<script setup lang="ts">
import populationMark from '../assets/population-mark.svg'
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

  <main id="main-content" class="main-content" tabindex="-1">
    <div class="page-introduction">
      <h1 class="page-title">都道府県別の人口推移</h1>
      <p class="page-description">
        都道府県と人口の区分を選んで、変化を比べられます。
      </p>
    </div>

    <section
      class="content-area prefectures"
      aria-labelledby="prefectures-title"
    >
      <slot name="prefecture-content">
        <div class="prefectures-heading">
          <h2 id="prefectures-title" class="section-title">都道府県</h2>
          <slot name="prefecture-actions" />
        </div>
        <p class="prefectures-description">
          比較したい都道府県を選択（複数選択可）
        </p>
        <slot name="prefectures">
          <div class="prefectures-space" aria-hidden="true" />
        </slot>
      </slot>
    </section>

    <section class="content-area population" aria-labelledby="population-title">
      <div class="population-heading">
        <h2 id="population-title" class="section-title">人口推移</h2>
        <p class="population-description">選択した都道府県を同じ区分で比較</p>
      </div>
      <slot name="population">
        <div class="population-space" aria-hidden="true" />
      </slot>
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

.page-introduction {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.page-title {
  font: var(--font-title);
}

.section-title {
  font: var(--font-section);
}

.page-description,
.prefectures-description,
.population-description {
  color: var(--color-text-secondary);
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

.prefectures-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-12);
  min-height: 44px;
}

/* Empty slots reserve the reference layout until feature content is supplied. */
.prefectures-space {
  min-height: 284px;
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
}

.population-space {
  min-height: 400px;
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

  .prefectures-space {
    min-height: 572px;
  }
}

@media (width < 640px) {
  .header-content,
  .main-content {
    padding-inline: var(--space-16);
  }

  .main-content {
    padding-block: var(--space-16);
  }

  .header-description {
    display: none;
  }

  .page-title {
    font: var(--font-title-mobile);
  }

  .content-area {
    padding: var(--space-16);
  }

  .prefectures-heading {
    min-height: var(--line-height-section);
  }

  .prefectures-space {
    min-height: 44px;
  }

  .population-space {
    min-height: 320px;
  }
}
</style>

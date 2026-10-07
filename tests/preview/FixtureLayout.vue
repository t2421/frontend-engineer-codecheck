<script setup lang="ts">
import PageTitle from '../../src/components/shared/PageTitle.vue'
</script>
<template>
  <a class="skip-link" href="#fixture-content">本文へ移動</a>
  <main id="fixture-content" class="fixture-layout" tabindex="-1">
    <PageTitle title="都道府県別の人口推移" />
    <section aria-labelledby="prefectures-title">
      <slot name="prefecture-content">
        <div class="fixture-heading">
          <h2 id="prefectures-title">都道府県</h2>
          <slot name="prefecture-actions" />
        </div>
        <slot name="prefectures" />
      </slot>
    </section>
    <section class="population" aria-labelledby="population-title">
      <h2 id="population-title">人口推移</h2>
      <slot name="population" />
    </section>
  </main>
</template>
<style scoped>
.skip-link {
  position: absolute;
  top: var(--space-12);
  left: var(--space-16);
  padding: var(--space-8);
  color: var(--color-action-default);
  background: var(--color-bg-surface);
  transform: translateY(-200%);
}
.skip-link:focus {
  transform: translateY(0);
}

.fixture-layout {
  max-width: 1440px;
  margin-inline: auto;
  padding: var(--space-40) var(--space-80);
  display: grid;
  gap: var(--space-24);
}
section {
  min-width: 0;
  padding: var(--space-24);
  background: var(--color-bg-surface);
  border: var(--stroke-1) solid var(--color-border-default);
  border-radius: var(--radius-12);
  display: grid;
  gap: var(--space-16);
}
h2 {
  font: var(--font-section);
}
.fixture-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-12);
}
@media (width < 1024px) {
  .fixture-layout {
    padding-inline: var(--space-32);
  }
}
@media (width < 640px) {
  .fixture-layout {
    padding: var(--space-16);
  }
  section {
    padding: var(--space-16);
  }
}
</style>

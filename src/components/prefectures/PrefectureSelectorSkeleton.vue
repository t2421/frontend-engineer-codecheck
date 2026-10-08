<script setup lang="ts">
import CheckboxSkeleton from '../shared/CheckboxSkeleton.vue'
import { PREFECTURE_COUNT } from './prefectureCode'
</script>

<template>
  <div class="prefecture-skeleton">
    <section class="prefecture-skeleton-panel" aria-label="都道府県">
      <header class="prefecture-skeleton-header">
        <h2>都道府県</h2>
        <span class="prefecture-skeleton-badge" aria-hidden="true"
          >読み込み中</span
        >
      </header>
      <p role="status">都道府県一覧を読み込んでいます…</p>
      <div class="prefecture-skeleton-grid" aria-hidden="true">
        <CheckboxSkeleton v-for="item in PREFECTURE_COUNT" :key="item" />
      </div>
      <p class="prefecture-skeleton-footer">読み込み後に都道府県を選べます</p>
    </section>
  </div>
</template>

<style scoped>
.prefecture-skeleton {
  container-type: inline-size;
}

.prefecture-skeleton-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  padding: var(--space-16);
  color: var(--color-text-secondary);
  background: var(--color-bg-surface);
  border: var(--stroke-1) solid var(--color-border-default);
  border-radius: var(--radius-12);
}

.prefecture-skeleton-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-12);
  align-items: center;
  min-height: 30px;
}

.prefecture-skeleton-header h2 {
  font: var(--font-section);
  color: var(--color-text-primary);
}

.prefecture-skeleton-badge {
  padding: var(--space-4);
  font: var(--font-small-label);
  background: var(--color-bg-canvas);
  border-radius: var(--radius-4);
}

.prefecture-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.prefecture-skeleton-grid > * {
  width: 100%;
}

.prefecture-skeleton-footer {
  display: flex;
  align-items: center;
  min-height: 44px;
  font: var(--font-caption);
}

@container (min-width: 334px) {
  .prefecture-skeleton-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container (min-width: 600px) {
  .prefecture-skeleton-panel {
    padding: var(--space-24);
  }

  .prefecture-skeleton-header {
    min-height: 44px;
  }

  .prefecture-skeleton-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: var(--space-8);
  }

  .prefecture-skeleton-footer {
    display: none;
  }
}

@container (min-width: 1100px) {
  .prefecture-skeleton-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}
</style>

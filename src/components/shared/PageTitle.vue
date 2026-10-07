<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>
<template>
  <div class="page-introduction">
    <h1 class="page-title">{{ title }}</h1>
    <p v-if="description" class="page-description">{{ description }}</p>
  </div>
</template>
<style scoped>
.page-introduction {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.page-title {
  font: var(--font-title);
}

.page-description {
  color: var(--color-text-secondary);
}

@media (width < 640px) {
  .page-title {
    font: var(--font-title-mobile);
  }
}
</style>

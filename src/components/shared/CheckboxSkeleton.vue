<template>
  <div class="checkbox-skeleton" aria-hidden="true">
    <span class="checkbox-skeleton-control" />
    <span class="checkbox-skeleton-label" />
  </div>
</template>

<style scoped>
.checkbox-skeleton {
  display: inline-flex;
  gap: var(--space-8);
  align-items: center;
  width: 136px;
  min-width: 0;
  height: 44px;
  padding: var(--space-8);
}

.checkbox-skeleton-control,
.checkbox-skeleton-label {
  background: var(--color-disabled-bg);
  border-radius: var(--radius-4);
}

.checkbox-skeleton-control {
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
}

.checkbox-skeleton-label {
  width: 56px;
  min-width: 0;
  height: 12px;
}
</style>

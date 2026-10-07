<script lang="ts">
export type StatusMessageState = 'empty' | 'loading' | 'error'
</script>

<script setup lang="ts">
import emptyIcon from './assets/status-empty.svg'
import loadingIcon from './assets/status-loading.svg'
import errorIcon from './assets/status-error.svg'

withDefaults(
  defineProps<{
    state: StatusMessageState
    title: string
    description?: string
    compact?: boolean
    headingLevel?: 2 | 3 | 4 | 5 | 6
  }>(),
  { description: undefined, headingLevel: 3, compact: false },
)

const icons = { empty: emptyIcon, loading: loadingIcon, error: errorIcon }
</script>

<template>
  <div class="status-message-container">
    <div
      class="status-message"
      :class="[
        `status-message-${state}`,
        { 'status-message-compact': compact },
      ]"
      :aria-busy="state === 'loading'"
    >
      <div class="status-message-symbol" aria-hidden="true">
        <img :src="icons[state]" alt="" class="status-message-icon" />
      </div>
      <div class="status-message-copy">
        <component :is="`h${headingLevel}`" class="status-message-title">
          {{ title }}
        </component>
        <p v-if="description" class="status-message-description">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.action" class="status-message-action">
        <slot name="action" />
      </div>
    </div>
    <!-- The announcer stays outside the busy region so loading can be announced. -->
    <div
      class="status-message-announcement"
      :role="state === 'error' ? 'alert' : 'status'"
      :aria-live="state === 'error' ? 'assertive' : 'polite'"
      aria-atomic="true"
    >
      <span>{{ title }}</span
      ><span v-if="description">{{ description }}</span>
    </div>
  </div>
</template>

<style scoped>
.status-message-container {
  position: relative;
  width: 100%;
  min-width: 0;
}

.status-message-announcement {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.status-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-16);
  width: 100%;
  min-width: 0;
  min-height: 300px;
  padding: var(--space-24);
  text-align: center;
  background-color: var(--color-bg-surface);
}

.status-message-symbol {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-12);
  background-color: var(--color-bg-canvas);
}

.status-message-error .status-message-symbol {
  background-color: var(--color-status-error-bg);
}

.status-message-icon {
  display: block;
  flex: none;
}

.status-message-loading .status-message-icon {
  animation: status-message-spin 1s linear infinite;
}

.status-message-copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  width: 100%;
  max-width: 278px;
  overflow-wrap: anywhere;
}

.status-message-title {
  font: var(--font-label);
  color: var(--color-text-primary);
}

.status-message-error .status-message-title {
  color: var(--color-status-error);
}

.status-message-description {
  font: var(--font-body);
  color: var(--color-text-secondary);
}

.status-message-action {
  max-width: 100%;
}

.status-message-compact {
  flex-flow: row wrap;
  gap: var(--space-12);
  min-height: 0;
  padding: var(--space-12);
  text-align: start;
}

.status-message-compact .status-message-symbol {
  width: 32px;
  height: 32px;
}

.status-message-compact .status-message-copy {
  flex: 1 1 12rem;
  min-width: 0;
  max-width: none;
}

@keyframes status-message-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-message-loading .status-message-icon {
    animation: none;
  }
}
</style>

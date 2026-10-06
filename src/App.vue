<script setup lang="ts">
const title: string = '都道府県別人口推移'
</script>

<template>
  <main>
    <h1>{{ title }}</h1>
    <p>都道府県ごとの人口の推移を比較するアプリです。</p>
  </main>
</template>

<style scoped>
main {
  max-width: 64rem;
  margin-inline: auto;
  padding: clamp(1.5rem, 5vw, 4rem);
}

h1 {
  margin-bottom: var(--space-8);
  font: var(--font-title);
}

p {
  color: var(--color-text-secondary);
}
</style>

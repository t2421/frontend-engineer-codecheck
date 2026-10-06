<script setup lang="ts">
const title: string = '都道府県別人口推移'
</script>

<template>
  <main>
    <h1>{{ title }}</h1>
    <p>都道府県ごとの人口の推移を比較するアプリです。</p>
  </main>
</template>

<style>
:root {
  font-family: system-ui, sans-serif;
  color: #1f2937;
  background: #f8fafc;
}

body {
  margin: 0;
}

main {
  max-width: 64rem;
  margin-inline: auto;
  padding: clamp(1.5rem, 5vw, 4rem);
}

h1 {
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  line-height: 1.4;
}

p {
  line-height: 1.8;
}
</style>

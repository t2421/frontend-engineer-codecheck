import { readdir, mkdir, writeFile } from 'node:fs/promises'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'

const fixtureDirectory = 'tests/e2e/fixtures'
const fixtures = (await readdir(fixtureDirectory).catch(() => []))
  .filter((file) => /^[a-z0-9-]+\.html$/.test(file))
  .sort()
const input = fixtures.length
  ? fixtures.map((file) => `${fixtureDirectory}/${file}`)
  : ['index.html']
await build({
  configFile: false,
  plugins: [vue()],
  build: { outDir: 'dist-review', rollupOptions: { input } },
})
if (fixtures.length) {
  await mkdir('dist-review', { recursive: true })
  await writeFile(
    'dist-review/index.html',
    `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UI Preview</title><h1>UI Preview</h1><p>公開されたUI確認用ページです。</p><ul>${fixtures.map((file) => `<li><a href="/${fixtureDirectory}/${file}">${file.slice(0, -5)}</a></li>`).join('')}</ul></html>`,
  )
}

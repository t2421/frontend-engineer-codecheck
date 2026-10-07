import process from 'node:process'
import { readdir, mkdir, writeFile, copyFile } from 'node:fs/promises'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'

const fixtureDirectory = 'tests/e2e/fixtures'
const fixtures = (await readdir(fixtureDirectory).catch(() => []))
  .filter((file) => /^[a-z0-9-]+\.html$/.test(file))
  .sort()
const input = [
  'index.html',
  ...fixtures.map((file) => `${fixtureDirectory}/${file}`),
]
await build({
  configFile: false,
  plugins: [vue()],
  build: { outDir: 'dist-review', rollupOptions: { input } },
})
// Keep the application available even when / is the fixture listing.
await mkdir('dist-review/app', { recursive: true })
await copyFile('dist-review/index.html', 'dist-review/app/index.html')
const sha = process.env.REVIEW_SHA
if (sha) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid review SHA')
  await mkdir(`dist-review/performance/${sha}`, { recursive: true })
  await copyFile(
    'dist-review/index.html',
    `dist-review/performance/${sha}/index.html`,
  )
}
if (fixtures.length) {
  await mkdir('dist-review', { recursive: true })
  await writeFile(
    'dist-review/index.html',
    `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UI Preview</title><h1>UI Preview</h1><p>公開されたUI確認用ページです。</p><p><a href="/app/">アプリ本体</a></p><ul>${fixtures.map((file) => `<li><a href="/${fixtureDirectory}/${file}">${file.slice(0, -5)}</a></li>`).join('')}</ul></html>`,
  )
}

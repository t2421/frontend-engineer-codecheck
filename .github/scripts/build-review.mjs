import process from 'node:process'
import { mkdir, copyFile } from 'node:fs/promises'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'

await build({
  configFile: false,
  plugins: [vue()],
  build: { outDir: 'dist-review', rollupOptions: { input: ['index.html'] } },
})
// Preserve the application URL used by Preview links.
await mkdir('dist-review/app', { recursive: true })
await copyFile('dist-review/index.html', 'dist-review/app/index.html')
const isHeadSha = (value) => /^[a-f0-9]{40}$/.test(value)
const sha = process.env.REVIEW_SHA
if (sha) {
  if (!isHeadSha(sha)) throw new Error('Invalid review SHA')
  await mkdir(`dist-review/performance/${sha}`, { recursive: true })
  await copyFile(
    'dist-review/index.html',
    `dist-review/performance/${sha}/index.html`,
  )
}

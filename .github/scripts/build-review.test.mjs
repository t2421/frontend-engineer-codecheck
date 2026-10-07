import { test } from 'node:test'
import process from 'node:process'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath, URL } from 'node:url'

test('Previewはアプリだけを公開し、テスト用HTMLと一覧を含めない', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'review-app-only-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const sha = 'a'.repeat(40)
  const app = '<!doctype html><html><body>Application preview</body></html>'
  await writeFile(join(directory, 'index.html'), app)
  await mkdir(join(directory, 'tests/preview'), { recursive: true })
  await writeFile(
    join(directory, 'tests/preview/button.html'),
    '<!doctype html><html><body>Test-only button</body></html>',
  )
  await promisify(execFile)(
    process.execPath,
    [fileURLToPath(new URL('./build-review.mjs', import.meta.url))],
    { cwd: directory, env: { ...process.env, REVIEW_SHA: sha } },
  )
  for (const path of [
    'index.html',
    'app/index.html',
    `performance/${sha}/index.html`,
  ]) {
    const html = await readFile(join(directory, 'dist-review', path), 'utf8')
    assert.match(html, /Application preview/)
    assert.doesNotMatch(html, /tests\/preview|Test-only button/)
  }
  await assert.rejects(
    readFile(join(directory, 'dist-review/tests/preview/button.html')),
    { code: 'ENOENT' },
  )
})

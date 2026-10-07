import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  collectionConfig,
  summarize,
  renderComment,
  canUpdate,
  rateMetric,
  evaluateProfile,
} from './review-performance.mjs'

const url = 'https://preview.example/performance/' + 'a'.repeat(40) + '/'
const report = (lcp, cls, tbt) => ({
  requestedUrl: url,
  finalDisplayedUrl: url,
  fetchTime: '2026-10-07T00:00:00Z',
  lighthouseVersion: '12.6.1',
  environment: { hostUserAgent: 'Chrome/123' },
  configSettings: { formFactor: 'mobile' },
  audits: Object.fromEntries(
    [
      'largest-contentful-paint',
      'cumulative-layout-shift',
      'total-blocking-time',
    ].map((key, i) => [key, { numericValue: [lcp, cls, tbt][i] }]),
  ),
})
test('explicit URL, three runs, separate desktop/mobile conditions and cold cache', () => {
  for (const profile of ['desktop', 'mobile']) {
    const config = collectionConfig(url, profile)
    assert.deepEqual(config.ci.collect.url, [url])
    assert.equal(config.ci.collect.numberOfRuns, 3)
    assert.equal(config.ci.collect.settings.formFactor, profile)
    assert.equal(config.ci.collect.settings.emulatedUserAgent, true)
    assert.equal(config.ci.collect.settings.disableStorageReset, false)
    assert.equal(config.ci.collect.staticDistDir, undefined)
    assert.equal(config.ci.assert, undefined)
  }
  assert.throws(() => collectionConfig('https://preview.example/', 'mobile'))
})
test('independent medians; incomplete, runtime errors, invalid metrics and wrong URLs fail closed', () => {
  const reports = [
    report(3000, 0.3, 30),
    report(1000, 0.1, 90),
    report(2000, 0.2, 60),
  ]
  assert.deepEqual(summarize(reports, url).metrics, {
    lcp: 2000,
    cls: 0.2,
    tbt: 60,
  })
  for (const invalid of [
    reports.slice(1),
    [...reports, reports[0]],
    [{ ...reports[0], runtimeError: { code: 'FAILED' } }, ...reports.slice(1)],
    [report(NaN, 0, 0), ...reports.slice(1)],
    [
      { ...reports[0], finalDisplayedUrl: 'https://preview.example/' },
      ...reports.slice(1),
    ],
  ]) {
    assert.throws(() => summarize(invalid, url))
  }
})
test('only current open same-repo head updates; comment preserves dedicated identity and limitations', () => {
  const sha = 'a'.repeat(40)
  const pr = { state: 'open', head: { sha, repo: { full_name: 'owner/repo' } } }
  assert.equal(canUpdate(pr, sha, 'owner/repo'), true)
  assert.equal(canUpdate(pr, 'b'.repeat(40), 'owner/repo'), false)
  assert.equal(canUpdate({ ...pr, state: 'closed' }, sha, 'owner/repo'), false)
  assert.equal(canUpdate(pr, sha, 'another/repo'), false)
  const comment = renderComment(
    { sha, url, measuredAt: 'now', profiles: {} },
    'https://github.com/owner/repo/actions/runs/1',
  )
  assert.match(comment, /<!-- pr-preview-performance -->/)
  assert.match(comment, /未計測/)
  assert.match(comment, /INP/)
  assert.doesNotMatch(comment, /cloudflare-pr-preview/)
})

// Exercise the actual comment CLI with a local gh stub; no GitHub requests or writes.
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const script = resolve('.github/scripts/review-performance.mjs')
async function runComment({
  stale = false,
  race = false,
  existing = true,
  missing = false,
  wrongSha = false,
  preview = false,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'review-comment-test-'))
  const sha = 'a'.repeat(40)
  await mkdir(join(directory, 'performance-results'))
  if (!missing)
    await writeFile(
      join(directory, 'performance-results/summary.json'),
      JSON.stringify({
        sha: wrongSha ? 'b'.repeat(40) : sha,
        url,
        profiles: {
          desktop: summarize(
            [report(1000, 0, 0), report(2000, 0, 0), report(3000, 0, 0)],
            url,
          ),
        },
      }),
    )
  const stateFile = join(directory, 'state.json')
  await writeFile(
    stateFile,
    JSON.stringify({ reads: 0, writes: [], stale, race, existing }),
  )
  await writeFile(
    join(directory, 'gh'),
    `#!${process.execPath}
const fs = require('node:fs');
const state = JSON.parse(fs.readFileSync(process.env.STUB_STATE));
const args = process.argv.slice(2);
if (args.includes('--method')) {
  state.writes.push({ args, data: JSON.parse(fs.readFileSync(0, 'utf8')) });
  console.log('{}');
} else if (args.includes('--slurp')) {
  console.log(JSON.stringify([[{id: 99, user: {login: 'github-actions[bot]'}, body: '<!-- cloudflare-pr-preview --> existing preview'}, ...(state.existing ? [{id: 42, user: {login: 'github-actions[bot]'}, body: '<!-- pr-preview-performance --> old'}] : [])]]));
} else {
  state.reads++;
  console.log(JSON.stringify({state: 'open', head: {sha: state.stale || state.race && state.reads > 1 ? 'b'.repeat(40) : 'a'.repeat(40), repo: {full_name: 'owner/repo'}}}));
}
fs.writeFileSync(process.env.STUB_STATE, JSON.stringify(state));
`,
    { mode: 0o755 },
  )
  const run = spawnSync(process.execPath, [script, 'comment'], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      STUB_STATE: stateFile,
      GH_REPO: 'owner/repo',
      PR_NUMBER: '49',
      HEAD_SHA: sha,
      PREVIEW_URL: url,
      GITHUB_RUN_ID: '123',
      GITHUB_SERVER_URL: 'https://github.com',
      PUBLISH_RESULT: preview ? 'success' : 'failure',
      PREVIEW_BASE_URL: preview ? 'https://preview.example' : '',
    },
  })
  assert.equal(run.status, 0, run.stderr)
  return JSON.parse(await readFile(stateFile, 'utf8'))
}

test('comment CLI updates only dedicated bot comment, and creates once when absent', async () => {
  const updated = await runComment()
  assert.equal(updated.writes.length, 1)
  assert.ok(updated.writes[0].args.includes('PATCH'))
  assert.ok(
    updated.writes[0].args.includes('repos/owner/repo/issues/comments/42'),
  )
  assert.match(updated.writes[0].data.body, /2.00 s/)
  const created = await runComment({ existing: false })
  assert.equal(created.writes.length, 1)
  assert.ok(created.writes[0].args.includes('POST'))
  assert.ok(
    created.writes[0].args.includes('repos/owner/repo/issues/49/comments'),
  )
})

test('existing Preview comment moves to the write-only comment job and retains its marker', async () => {
  const updated = await runComment({ preview: true })
  assert.equal(updated.writes.length, 2)
  assert.ok(
    updated.writes[1].args.includes('repos/owner/repo/issues/comments/99'),
  )
  assert.match(updated.writes[1].data.body, /^<!-- cloudflare-pr-preview -->/)
})

test('comment CLI skips stale head including a head change just before update', async () => {
  assert.equal((await runComment({ stale: true })).writes.length, 0)
  const raced = await runComment({ race: true })
  assert.equal(raced.reads, 2)
  assert.equal(raced.writes.length, 0)
})

test('missing artifact and failed publish explicitly remain unmeasured', async () => {
  assert.match(
    (await runComment({ missing: true })).writes[0].data.body,
    /未計測/,
  )
  assert.doesNotMatch(
    (await runComment({ wrongSha: true })).writes[0].data.body,
    /2.00 s/,
  )
  const directory = await mkdtemp(join(tmpdir(), 'review-collect-test-'))
  await mkdir(join(directory, 'performance-results'))
  await writeFile(join(directory, 'performance-results/old-report.json'), '{}')
  const run = spawnSync(process.execPath, [script, 'collect'], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      PUBLISH_RESULT: 'failure',
      HEAD_SHA: 'a'.repeat(40),
      PREVIEW_URL: '',
    },
  })
  assert.equal(run.status, 0, run.stderr)
  await assert.rejects(
    readFile(join(directory, 'performance-results/old-report.json')),
  )
  const summary = JSON.parse(
    await readFile(join(directory, 'performance-results/summary.json'), 'utf8'),
  )
  for (const profile of ['desktop', 'mobile'])
    assert.deepEqual(summary.profiles[profile], {
      status: 'unmeasured',
      reason: 'preview-unavailable',
    })
})

import { createRequire } from 'node:module'
import { dirname } from 'node:path'

test('LHCI dependency updates retain YAML config, argparse CLI, UUID and browser/proxy APIs', async () => {
  const rootRequire = createRequire(import.meta.url)
  const cliRequire = createRequire(
    rootRequire.resolve('@lhci/cli/package.json'),
  )
  const utilsRequire = createRequire(
    cliRequire.resolve('@lhci/utils/package.json'),
  )
  const directory = await mkdtemp(join(tmpdir(), 'lhci-compatibility-'))
  const configPath = join(directory, 'lighthouserc.yaml')
  await writeFile(
    configPath,
    'ci:\n  collect:\n    url:\n      - https://preview.example/app/\n    numberOfRuns: 3\n',
  )
  const config = cliRequire(
    '@lhci/utils/src/lighthouserc.js',
  ).loadAndParseRcFile(configPath)
  assert.deepEqual(config.url, ['https://preview.example/app/'])
  assert.equal(config.numberOfRuns, 3)
  const yamlCli = join(
    dirname(utilsRequire.resolve('js-yaml')),
    'bin/js-yaml.js',
  )
  const parsed = spawnSync(process.execPath, [yamlCli, '--compact'], {
    encoding: 'utf8',
    input: 'name: compatibility\n',
  })
  assert.equal(parsed.status, 0, parsed.stderr)
  assert.deepEqual(JSON.parse(parsed.stdout), { name: 'compatibility' })
  assert.match(
    cliRequire('uuid').v4(),
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  )
  const { ProxyAgent } = cliRequire('proxy-agent')
  const agent = new ProxyAgent()
  agent.destroy()
  const lighthouseRequire = createRequire(cliRequire.resolve('lighthouse'))
  assert.equal(typeof lighthouseRequire('puppeteer-core').connect, 'function')
})

const measured = (lcp = 1000, cls = 0, tbt = 0) => ({
  status: 'measured',
  runs: 3,
  metrics: { lcp, cls, tbt },
})

test('official reference boundaries use raw medians and device-specific TBT', () => {
  for (const [metric, profile, good, poor] of [
    ['lcp', 'desktop', 2500, 4000],
    ['lcp', 'mobile', 2500, 4000],
    ['cls', 'desktop', 0.1, 0.25],
    ['cls', 'mobile', 0.1, 0.25],
    ['tbt', 'desktop', 150, 350],
    ['tbt', 'mobile', 200, 600],
  ]) {
    assert.equal(rateMetric(metric, 0, profile), '良好')
    assert.equal(rateMetric(metric, good - 0.000001, profile), '良好')
    assert.equal(rateMetric(metric, good, profile), '良好')
    assert.equal(rateMetric(metric, good + 0.000001, profile), '改善が必要')
    assert.equal(rateMetric(metric, poor - 0.000001, profile), '改善が必要')
    assert.equal(rateMetric(metric, poor, profile), '改善が必要')
    assert.equal(rateMetric(metric, poor + 0.000001, profile), '不良')
    for (const invalid of [undefined, null, NaN, Infinity, -1, '0'])
      assert.equal(rateMetric(metric, invalid, profile), '判定不可')
  }
  assert.equal(rateMetric('tbt', 175, 'desktop'), '改善が必要')
  assert.equal(rateMetric('tbt', 175, 'mobile'), '良好')
})

test('profile reference rating uses the worst metric; missing or failed data cannot be good', () => {
  assert.equal(evaluateProfile(measured(), 'desktop').rating, '良好')
  assert.equal(
    evaluateProfile(measured(2600, 0, 0), 'mobile').rating,
    '改善が必要',
  )
  assert.equal(evaluateProfile(measured(2600, 0.3, 0), 'mobile').rating, '不良')
  for (const invalid of [
    undefined,
    { ...measured(), status: 'unmeasured' },
    { ...measured(), runs: 2 },
    { ...measured(), metrics: { lcp: 1000, cls: 0 } },
    measured(NaN),
    measured(1000, -1),
    measured(1000, 0, null),
  ]) {
    assert.equal(evaluateProfile(invalid, 'desktop').rating, '判定不可')
  }
})

test('summary and rows preserve a one-sided failure, evidence and next checks', () => {
  const comment = renderComment(
    {
      sha: 'a'.repeat(40),
      url,
      measuredAt: 'now',
      profiles: {
        desktop: measured(),
        mobile: { status: 'unmeasured', reason: 'collection-failed' },
      },
    },
    'https://github.com/owner/repo/actions/runs/1',
  )
  assert.match(comment, /結果サマリー: PC 良好／モバイル 判定不可/)
  assert.match(comment, /\| モバイル \| 判定不可 \| 未計測（判定不可）/)
  assert.match(comment, /計測エラー・不完全レポート/)
  assert.match(comment, /次に確認:.*再計測/)
  assert.match(comment, /実ユーザーの合否やアプリ全体の品質保証/)
  assert.match(comment, /TBTはCore Web VitalでもINP実測値でもありません/)
  assert.match(comment, /mergeブロックはありません/)
  const degraded = renderComment(
    {
      sha: 'a'.repeat(40),
      url,
      profiles: {
        desktop: measured(5000, 0.3, 400),
        mobile: measured(3000, 0.2, 300),
      },
    },
    'https://github.com/owner/repo/actions/runs/1',
  )
  assert.match(degraded, /結果サマリー: PC 不良／モバイル 改善が必要/)
  for (const clue of ['LCP要素', 'レイアウト変動', '長時間タスク'])
    assert.ok(degraded.includes(clue))
})

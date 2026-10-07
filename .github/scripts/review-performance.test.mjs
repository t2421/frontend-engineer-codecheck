import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import {
  collectionConfig,
  summarize,
  renderComment,
  canUpdate,
  rateMetric,
  evaluateProfile,
  serializeSummary,
  parseSummary,
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
test('only current open same-repo head updates; comment preserves dedicated identity and SHA', () => {
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
  assert.ok(comment.includes(sha))
  assert.match(comment, /PREVIEW_PERFORMANCE.md/)
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
  const summary = JSON.stringify({
    sha: wrongSha ? 'b'.repeat(40) : sha,
    url,
    profiles: {
      desktop: summarize(
        [report(1000, 0, 0), report(2000, 0, 0), report(3000, 0, 0)],
        url,
      ),
    },
  })
  // An old local file must never replace missing job output.
  await writeFile(join(directory, 'performance-results/summary.json'), summary)
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
      PERFORMANCE_SUMMARY: missing ? '' : summary,
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

test('missing summary output and failed publish explicitly remain unmeasured', async () => {
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
      GITHUB_OUTPUT: join(directory, 'job-output'),
    },
  })
  assert.equal(run.status, 0, run.stderr)
  await assert.rejects(
    readFile(join(directory, 'performance-results/old-report.json')),
  )
  const summary = JSON.parse(
    await readFile(join(directory, 'performance-results/summary.json'), 'utf8'),
  )
  const jobOutput = await readFile(join(directory, 'job-output'), 'utf8')
  assert.equal(jobOutput, `summary=${JSON.stringify(summary)}\n`)
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

test('concise summary preserves values, icon labels and a one-sided failure', () => {
  const comment = renderComment(
    {
      sha: 'a'.repeat(40),
      profiles: {
        desktop: measured(),
        mobile: { status: 'unmeasured', reason: 'collection-failed' },
      },
    },
    'https://github.com/owner/repo/actions/runs/1',
  )
  assert.ok(
    comment.includes(
      '| PC | 🟢 良好 | 1.00 s（🟢 良好） | 0.000（🟢 良好） | 0 ms（🟢 良好） | 3/3 |',
    ),
  )
  assert.ok(
    comment.includes(
      '| モバイル | ⚪ 判定不可 | — | — | — | 未計測（収集失敗） |',
    ),
  )
  assert.doesNotMatch(
    comment,
    /根拠|次に確認|INP|LCP要素|RTT|run 1|artifact|mergeブロック/,
  )
  assert.equal(comment.split('](https:').length - 1, 1)
  assert.ok(comment.length < 650)
  assert.ok(
    comment.includes(
      '[計測・判定の説明](https://github.com/owner/repo/blob/main/docs/PREVIEW_PERFORMANCE.md)',
    ),
  )
  const degraded = renderComment(
    {
      sha: 'a'.repeat(40),
      profiles: {
        desktop: measured(5000, 0.3, 400),
        mobile: measured(3000, 0.2, 300),
      },
    },
    'https://github.com/owner/repo/actions/runs/1',
  )
  assert.ok(degraded.includes('| PC | 🔴 不良'))
  assert.ok(degraded.includes('| モバイル | 🟡 改善が必要'))
  assert.ok(degraded.includes('5.00 s（🔴 不良）'))
  assert.ok(degraded.includes('300 ms（🟡 改善が必要）'))
})

test('missing, incomplete and invalid data show neutral judgment unavailable', () => {
  for (const data of [
    undefined,
    { status: 'unmeasured', reason: 'preview-unavailable' },
    { status: 'unmeasured', reason: 'collection-failed' },
    { ...measured(), runs: 2 },
    { ...measured(), metrics: { lcp: 1000, cls: 0 } },
    measured(NaN),
  ]) {
    const comment = renderComment(
      { sha: 'a'.repeat(40), profiles: { desktop: data } },
      'https://github.com/owner/repo/actions/runs/1',
    )
    assert.match(comment, /⚪ 判定不可/)
    assert.match(comment, /未計測/)
    assert.doesNotMatch(comment, /🟢|🟡|🔴|良好|不良|改善が必要/)
  }
})

test('rendered boundary judgments retain raw medians and device-specific TBT', async () => {
  for (const [profile, good, improve] of [
    ['desktop', 150, 350],
    ['mobile', 200, 600],
  ]) {
    for (const [value, expected] of [
      [good, '🟢 良好'],
      [good + 0.000001, '🟡 改善が必要'],
      [improve, '🟡 改善が必要'],
      [improve + 0.000001, '🔴 不良'],
    ]) {
      const comment = renderComment(
        {
          sha: 'a'.repeat(40),
          profiles: { [profile]: measured(1000, 0, value) },
        },
        'https://github.com/owner/repo/actions/runs/1',
      )
      const row = comment
        .split('\n')
        .find((line) =>
          line.startsWith(profile === 'desktop' ? '| PC |' : '| モバイル |'),
        )
      assert.ok(row.includes(expected), row)
    }
  }
  const doc = await readFile(resolve('docs/PREVIEW_PERFORMANCE.md'), 'utf8')
  assert.match(doc, /INP.*実測/)
  assert.match(doc, /#36/)
  assert.match(doc, /artifact.*保存しません/)
})

test('bounded output allows only metrics and sanitized run metadata; invalid transport fails closed', () => {
  const sha = 'a'.repeat(40)
  const condition = {
    measuredAt: '2026-10-07T00:00:00Z',
    lighthouse: '12.6.1',
    browser: 'Mozilla Chrome/123.4 $(touch /tmp/untrusted)',
    settings: { secret: 'discard' },
  }
  const result = {
    sha,
    url,
    measuredAt: condition.measuredAt,
    profiles: {
      desktop: {
        ...measured(),
        conditions: Array(10).fill(condition),
        injected: 'discard',
      },
    },
  }
  const encoded = serializeSummary(result)
  assert.ok(Buffer.byteLength(encoded) < 16384)
  assert.equal(encoded.includes('\n'), false)
  assert.doesNotMatch(encoded, /discard|touch|secret|injected/)
  const parsed = parseSummary(encoded, sha, url)
  assert.equal(parsed.profiles.desktop.conditions.length, 3)
  assert.equal(parsed.profiles.desktop.conditions[0].browser, 'Chrome/123.4')
  assert.equal(parsed.profiles.desktop.conditions[0].lighthouse, '12.6.1')
  assert.equal(parsed.profiles.mobile.status, 'unmeasured')
  for (const invalid of [
    '',
    '{',
    ' '.repeat(16385),
    'null',
    JSON.stringify({ ...result, sha: 'b'.repeat(40) }),
    JSON.stringify({ ...result, url: url + 'wrong' }),
  ]) {
    assert.equal(parseSummary(invalid, sha, url), null)
  }
  assert.throws(
    () => serializeSummary({ ...result, url: 'x'.repeat(16385) }),
    /size limit/,
  )
  result.profiles.desktop.conditions = [
    { measuredAt: 'bad', lighthouse: '12.6.1\n$(command)', browser: 'bad' },
  ]
  const sanitized = parseSummary(serializeSummary(result), sha, url)
  assert.deepEqual(sanitized.profiles.desktop.conditions[0], {
    measuredAt: '不明',
    lighthouse: '不明',
    browser: '不明',
  })
  const comment = renderComment(
    parsed,
    'https://github.com/owner/repo/actions/runs/1',
  )
  assert.doesNotMatch(comment, /Lighthouse|artifact|touch|command|secret/)
  assert.match(comment, /🟢 良好/)
  assert.doesNotMatch(comment, /artifacts\//)
})

test('workflow keeps bounded env transport and least privilege without performance artifact storage', async () => {
  const rootRequire = createRequire(import.meta.url)
  const cliRequire = createRequire(
    rootRequire.resolve('@lhci/cli/package.json'),
  )
  const utilsRequire = createRequire(
    cliRequire.resolve('@lhci/utils/package.json'),
  )
  const workflow = utilsRequire('js-yaml').safeLoad(
    await readFile('.github/workflows/review-publish.yml', 'utf8'),
  )
  const { measure, 'performance-comment': comment, publish } = workflow.jobs
  assert.deepEqual(measure.permissions, { contents: 'read' })
  assert.deepEqual(comment.permissions, {
    contents: 'read',
    'pull-requests': 'write',
  })
  assert.equal(measure.outputs.summary, '${{ steps.collect.outputs.summary }}')
  assert.equal(
    measure.steps.find((step) => step.id === 'collect').run,
    'node .github/scripts/review-performance.mjs collect',
  )
  const update = comment.steps.find((step) => step.env?.PERFORMANCE_SUMMARY)
  assert.equal(
    update.env.PERFORMANCE_SUMMARY,
    '${{ needs.measure.outputs.summary }}',
  )
  assert.equal(
    update.run,
    'node .github/scripts/review-performance.mjs comment',
  )
  for (const job of [measure, comment]) {
    for (const step of job.steps) {
      assert.doesNotMatch(step.uses ?? '', /(?:upload|download)-artifact/)
      assert.doesNotMatch(step.run ?? '', /gh run download|\$\{\{/)
      assert.equal(step.env?.CLOUDFLARE_API_TOKEN, undefined)
    }
  }
  assert.equal(publish.permissions.actions, 'read')
  assert.ok(
    publish.steps.some((step) => /gh run download/.test(step.run ?? '')),
  )
  const build = await readFile('.github/workflows/review-build.yml', 'utf8')
  const checks = await readFile('.github/workflows/checks.yml', 'utf8')
  assert.match(build, /actions\/upload-artifact/)
  assert.match(checks, /actions\/upload-artifact/)
})

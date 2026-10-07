import { mkdir, readdir, readFile, writeFile, cp, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { pathToFileURL, URL } from 'node:url'
import process from 'node:process'

export const marker = '<!-- pr-preview-performance -->'
const profiles = ['desktop', 'mobile']
const audits = {
  lcp: 'largest-contentful-paint',
  cls: 'cumulative-layout-shift',
  tbt: 'total-blocking-time',
}

export function collectionConfig(url, profile) {
  const target = new URL(url)
  if (
    !['https:', 'http:'].includes(target.protocol) ||
    target.pathname === '/' ||
    !profiles.includes(profile)
  )
    throw new Error('Explicit app URL and profile required')
  const desktop = profile === 'desktop'
  return {
    ci: {
      collect: {
        url: [url],
        numberOfRuns: 3,
        settings: {
          onlyCategories: ['performance'],
          formFactor: profile,
          emulatedUserAgent: true,
          screenEmulation: {
            mobile: !desktop,
            width: desktop ? 1350 : 412,
            height: desktop ? 940 : 823,
            deviceScaleFactor: desktop ? 1 : 1.75,
            disabled: false,
          },
          throttlingMethod: 'simulate',
          throttling: {
            rttMs: desktop ? 40 : 150,
            throughputKbps: desktop ? 10240 : 1638.4,
            cpuSlowdownMultiplier: desktop ? 1 : 4,
          },
          disableStorageReset: false,
          chromeFlags: '--headless --no-sandbox',
        },
      },
    },
  }
}

export function summarize(reports, url) {
  if (reports.length !== 3) throw new Error('Expected exactly three reports')
  for (const report of reports) {
    const final = report.finalDisplayedUrl ?? report.finalUrl
    if (report.runtimeError || report.requestedUrl !== url || final !== url)
      throw new Error('Runtime error or target URL mismatch')
    for (const audit of Object.values(audits)) {
      const value = report.audits?.[audit]?.numericValue
      if (!Number.isFinite(value) || value < 0)
        throw new Error('Missing or invalid metric')
    }
  }
  return {
    status: 'measured',
    runs: reports.length,
    metrics: Object.fromEntries(
      Object.entries(audits).map(([key, audit]) => [
        key,
        reports
          .map((r) => r.audits[audit].numericValue)
          .sort((a, b) => a - b)[1],
      ]),
    ),
    conditions: reports.map((r) => ({
      measuredAt: r.fetchTime,
      lighthouse: r.lighthouseVersion,
      browser: r.environment?.hostUserAgent,
      settings: r.configSettings,
    })),
  }
}

export function canUpdate(pr, sha, repo) {
  return (
    pr.state === 'open' &&
    pr.head?.sha === sha &&
    pr.head.repo?.full_name === repo
  )
}

export function renderComment(result, runUrl) {
  const rows = profiles.map((profile) => {
    const data = result.profiles?.[profile]
    const m = data?.metrics
    return data?.status === 'measured' &&
      data.runs === 3 &&
      ['lcp', 'cls', 'tbt'].every(
        (key) => Number.isFinite(m?.[key]) && m[key] >= 0,
      )
      ? `| ${profile === 'desktop' ? 'PC' : 'モバイル'} | ${(m.lcp / 1000).toFixed(2)} s | ${m.cls.toFixed(3)} | ${Math.round(m.tbt)} ms | 3/3 |`
      : `| ${profile === 'desktop' ? 'PC' : 'モバイル'} | 未計測 | 未計測 | 未計測 | ${data?.reason === 'collection-failed' ? '計測エラー・不完全レポート' : '公開失敗・job未完了・レポートなし'} |`
  })
  return `${marker}
### Preview 性能（参考）
静的UIのラボ計測。性能閾値によるmergeブロックはありません。

対象commit: \`${result.sha}\`
対象URL: ${result.url || '未公開'}
集計日時: ${result.measuredAt}

| 条件 | LCP中央値 | CLS中央値 | TBT中央値 | 計測回数／状態 |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

PC: 1350×940、RTT 40 ms / 10240 Kbps / CPU 1倍。モバイル: 412×823、RTT 150 ms / 1638.4 Kbps / CPU 4倍。通信・CPUはsimulate、各runでストレージ・キャッシュをリセット。
[HTML・JSONレポート／再現条件・ブラウザーとLighthouseの版](${runUrl}) の \`review-performance\` artifactを参照。
TBTはINPの実測値ではありません。通常LHCIでは操作時INP・実API待ちの完全検証はできません。最終評価は #36 で実施します。
`
}

async function collect() {
  const {
    PREVIEW_URL: url,
    HEAD_SHA: sha,
    PUBLISH_RESULT: publish,
  } = process.env
  const output = 'performance-results'
  // A rerun must never aggregate reports left by an earlier collection.
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  const result = {
    sha,
    url: url || '',
    measuredAt: new Date().toISOString(),
    profiles: {},
  }
  for (const profile of profiles) {
    result.profiles[profile] = {
      status: 'unmeasured',
      reason: 'preview-unavailable',
    }
    if (publish !== 'success' || !url) continue
    try {
      const config = collectionConfig(url, profile)
      const configPath = `${output}/${profile}-config.json`
      await writeFile(configPath, JSON.stringify(config, null, 2))
      const run = spawnSync(
        'pnpm',
        ['exec', 'lhci', 'collect', `--config=${configPath}`],
        { encoding: 'utf8', timeout: 240_000 },
      )
      await writeFile(
        `${output}/${profile}-collect.log`,
        `${run.stdout ?? ''}\n${run.stderr ?? ''}\n${run.error?.message ?? ''}`,
      )
      await cp('.lighthouseci', `${output}/${profile}`, {
        recursive: true,
      }).catch(() => {})
      if (run.status !== 0) throw new Error('LHCI collect failed')
      const files = (await readdir(`${output}/${profile}`)).filter((file) =>
        /^lhr-.*\.json$/.test(file),
      )
      const reports = await Promise.all(
        files.map(async (file) =>
          JSON.parse(await readFile(`${output}/${profile}/${file}`, 'utf8')),
        ),
      )
      result.profiles[profile] = summarize(reports, url)
    } catch (error) {
      result.profiles[profile] = {
        status: 'unmeasured',
        reason: 'collection-failed',
      }
      await writeFile(`${output}/${profile}-error.txt`, String(error))
    }
  }
  await writeFile(`${output}/summary.json`, JSON.stringify(result, null, 2))
}

// Trusted default-branch script only. Artifact reports are data, never commands/Markdown.
async function comment() {
  const {
    GH_REPO: repo,
    PR_NUMBER: number,
    HEAD_SHA: sha,
    PREVIEW_URL: url,
    GITHUB_RUN_ID: run,
    GITHUB_SERVER_URL: server,
  } = process.env
  if (!/^[a-f0-9]{40}$/.test(sha) || !/^\d+$/.test(number))
    throw new Error('Invalid PR identity')
  const gh = (args, input) => {
    const response = spawnSync('gh', args, { encoding: 'utf8', input })
    if (response.status !== 0) throw new Error(response.stderr)
    return response.stdout
  }
  const current = () =>
    canUpdate(
      JSON.parse(gh(['api', `repos/${repo}/pulls/${number}`])),
      sha,
      repo,
    )
  if (!current()) return
  let result = {
    sha,
    url: url || '',
    measuredAt: new Date().toISOString(),
    profiles: {},
  }
  try {
    const saved = JSON.parse(
      await readFile('performance-results/summary.json', 'utf8'),
    )
    if (saved.sha === sha && saved.url === (url || ''))
      result = { ...result, profiles: saved.profiles }
  } catch {
    /* Missing artifact is explicitly unmeasured. */
  }
  const body = renderComment(result, `${server}/${repo}/actions/runs/${run}`)
  const pages = JSON.parse(
    gh([
      'api',
      '--paginate',
      '--slurp',
      `repos/${repo}/issues/${number}/comments`,
    ]),
  )
  const upsert = (commentMarker, commentBody) => {
    const existing = pages
      .flat()
      .find(
        (c) =>
          c.user?.login === 'github-actions[bot]' &&
          c.body?.startsWith(commentMarker),
      )
    // Recheck immediately before each mutation, including the existing Preview comment.
    if (!current()) return
    gh(
      [
        'api',
        '--method',
        existing ? 'PATCH' : 'POST',
        existing
          ? `repos/${repo}/issues/comments/${existing.id}`
          : `repos/${repo}/issues/${number}/comments`,
        '--input',
        '-',
      ],
      JSON.stringify({ body: commentBody }),
    )
  }
  upsert(marker, body)
  if (
    process.env.PUBLISH_RESULT === 'success' &&
    process.env.PREVIEW_BASE_URL
  ) {
    upsert(
      '<!-- cloudflare-pr-preview -->',
      `<!-- cloudflare-pr-preview -->
Cloudflare UI Preview: ${process.env.PREVIEW_BASE_URL}

対象commit: \`${sha}\`

URLを知っている方が閲覧できます。本番API・Secretは使用しません。
`,
    )
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv[2] === 'collect') await collect()
  else if (process.argv[2] === 'comment') await comment()
  else throw new Error('Use collect or comment')
}

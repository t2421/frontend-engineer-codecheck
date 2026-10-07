import { Buffer } from 'node:buffer'
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  appendFile,
  rm,
} from 'node:fs/promises'
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

const ratingLabels = ['良好', '改善が必要', '不良']
const metricLabels = { lcp: 'LCP', cls: 'CLS', tbt: 'TBT' }
const nextChecks = {
  lcp: 'LCP要素・TTFB・画像/CSSの読み込み',
  cls: 'レイアウト変動・画像の領域確保・フォント',
  tbt: 'DevToolsの長時間タスク・JS実行',
}

// Reference labels for lab medians, never CI assertions or field CWV pass/fail.
export function rateMetric(metric, value, profile) {
  if (!profiles.includes(profile) || !Number.isFinite(value) || value < 0)
    return '判定不可'
  const limits = {
    lcp: [2500, 4000],
    cls: [0.1, 0.25],
    tbt: profile === 'desktop' ? [150, 350] : [200, 600],
  }[metric]
  if (!limits) return '判定不可'
  return value <= limits[0]
    ? '良好'
    : value <= limits[1]
      ? '改善が必要'
      : '不良'
}

export function evaluateProfile(data, profile) {
  const valid =
    profiles.includes(profile) &&
    data?.status === 'measured' &&
    data.runs === 3 &&
    Object.keys(audits).every(
      (key) => Number.isFinite(data.metrics?.[key]) && data.metrics[key] >= 0,
    )
  if (!valid)
    return {
      valid: false,
      rating: '判定不可',
      evidence:
        data?.reason === 'collection-failed'
          ? '未計測（計測エラー・不完全レポート）'
          : '未計測（公開失敗・job未完了・指標欠損・レポートなし）',
      next: 'Preview公開・Actionsログ・対象URL・レポート完了を確認して再計測',
    }
  const ratings = Object.fromEntries(
    Object.keys(audits).map((key) => [
      key,
      rateMetric(key, data.metrics[key], profile),
    ]),
  )
  const rating =
    ratingLabels[
      Math.max(
        ...Object.values(ratings).map((label) => ratingLabels.indexOf(label)),
      )
    ]
  const affected = Object.keys(audits).filter((key) => ratings[key] !== '良好')
  return {
    valid: true,
    rating,
    ratings,
    evidence: affected.length
      ? `${affected.map((key) => metricLabels[key]).join('・')}が良好範囲を超過`
      : '3指標とも良好範囲',
    next: affected.length
      ? affected.map((key) => nextChecks[key]).join('、')
      : '#36で操作時INP・本番API待ちを確認',
  }
}

// Only a small allowlisted JSON value crosses the read-only measurement / write boundary.
const maxSummaryBytes = 16 * 1024
function safeTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : '不明'
}
function compactConditions(conditions) {
  return (Array.isArray(conditions) ? conditions.slice(0, 3) : []).map(
    (condition) => ({
      measuredAt: safeTime(condition?.measuredAt),
      lighthouse:
        typeof condition?.lighthouse === 'string' &&
        /^\d{1,3}\.\d{1,3}\.\d{1,3}(?:[-+][A-Za-z0-9.-]{1,24})?$/.test(
          condition.lighthouse,
        )
          ? condition.lighthouse
          : '不明',
      browser:
        typeof condition?.browser === 'string'
          ? (condition.browser.match(
              /\b(?:HeadlessChrome|Chrome|Chromium)\/[0-9.]{1,40}/,
            )?.[0] ?? '不明')
          : '不明',
    }),
  )
}
function compactSummary(result) {
  return {
    sha: result.sha,
    url: result.url,
    measuredAt: safeTime(result.measuredAt),
    profiles: Object.fromEntries(
      profiles.map((profile) => {
        const data = result.profiles?.[profile]
        return [
          profile,
          evaluateProfile(data, profile).valid
            ? {
                status: 'measured',
                runs: 3,
                metrics: Object.fromEntries(
                  Object.keys(audits).map((key) => [key, data.metrics[key]]),
                ),
                conditions: compactConditions(data.conditions),
              }
            : {
                status: 'unmeasured',
                reason: ['collection-failed', 'preview-unavailable'].includes(
                  data?.reason,
                )
                  ? data.reason
                  : 'invalid-summary',
              },
        ]
      }),
    ),
  }
}
export function serializeSummary(result) {
  const summary = JSON.stringify(compactSummary(result))
  if (Buffer.byteLength(summary, 'utf8') > maxSummaryBytes)
    throw new Error('Summary exceeds size limit')
  return summary
}
export function parseSummary(value, sha, url) {
  if (
    typeof value !== 'string' ||
    !value ||
    Buffer.byteLength(value, 'utf8') > maxSummaryBytes
  )
    return null
  try {
    const result = JSON.parse(value)
    if (result?.sha !== sha || result?.url !== url) return null
    return compactSummary(result)
  } catch {
    return null
  }
}

function ratingBadge(rating) {
  const icon = { 良好: '🟢', 改善が必要: '🟡', 不良: '🔴' }[rating] ?? '⚪'
  return `${icon} ${rating}`
}

export function renderComment(result, runUrl) {
  const rows = profiles.map((profile) => {
    const label = profile === 'desktop' ? 'PC' : 'モバイル'
    const data = result.profiles?.[profile]
    const assessment = evaluateProfile(data, profile)
    if (!assessment.valid) {
      const reason =
        data?.reason === 'collection-failed'
          ? '収集失敗'
          : data?.reason === 'preview-unavailable'
            ? 'Preview未公開'
            : 'サマリー欠損・不正'
      return `| ${label} | ⚪ 判定不可 | — | — | — | 未計測（${reason}） |`
    }
    const m = data.metrics
    return `| ${label} | ${ratingBadge(assessment.rating)} | ${(m.lcp / 1000).toFixed(2)} s（${ratingBadge(assessment.ratings.lcp)}） | ${m.cls.toFixed(3)}（${ratingBadge(assessment.ratings.cls)}） | ${Math.round(m.tbt)} ms（${ratingBadge(assessment.ratings.tbt)}） | 3/3 |`
  })
  const documentationUrl = runUrl.replace(
    /\/actions\/runs\/[^/]+$/,
    '/blob/main/docs/PREVIEW_PERFORMANCE.md',
  )
  return `${marker}
### Preview 性能（参考）

| 条件 | 総合 | LCP中央値 | CLS中央値 | TBT中央値 | 計測 |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

対象SHA: \`${result.sha}\` · [計測・判定の説明](${documentationUrl})
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
      if (run.status !== 0) throw new Error('LHCI collect failed')
      const files = (await readdir('.lighthouseci')).filter((file) =>
        /^lhr-.*\.json$/.test(file),
      )
      const reports = await Promise.all(
        files.map(async (file) =>
          JSON.parse(await readFile(`.lighthouseci/${file}`, 'utf8')),
        ),
      )
      result.profiles[profile] = summarize(reports, url)
    } catch (error) {
      result.profiles[profile] = {
        status: 'unmeasured',
        reason: 'collection-failed',
      }
      process.stderr.write(`${profile}: ${String(error)}\n`)
      await writeFile(`${output}/${profile}-error.txt`, String(error))
    }
  }
  const summary = serializeSummary(result)
  await writeFile(`${output}/summary.json`, summary)
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `summary=${summary}\n`)
}

// Trusted default-branch script only. Job output JSON is data, never commands/Markdown.
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
  const result = parseSummary(
    process.env.PERFORMANCE_SUMMARY,
    sha,
    url || '',
  ) ?? {
    sha,
    url: url || '',
    measuredAt: new Date().toISOString(),
    profiles: {},
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

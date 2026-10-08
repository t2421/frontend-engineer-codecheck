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
const previewMarker = '<!-- cloudflare-pr-preview -->'
const profiles = ['desktop', 'mobile']
const audits = {
  lcp: 'largest-contentful-paint',
  cls: 'cumulative-layout-shift',
  tbt: 'total-blocking-time',
}
const metricKeys = Object.keys(audits)
const expectedRuns = 3
const unknown = '不明'
const undeterminable = '判定不可'

const isHeadSha = (value) => /^[a-f0-9]{40}$/.test(value)
const isPrNumber = (value) => /^\d+$/.test(value)
const isValidMetric = (value) => Number.isFinite(value) && value >= 0

// Lighthouse CIのデバイス条件。PCは有線相当、モバイルは4G相当の既定値に合わせる。
const screenEmulations = {
  desktop: {
    mobile: false,
    width: 1350,
    height: 940,
    deviceScaleFactor: 1,
    disabled: false,
  },
  mobile: {
    mobile: true,
    width: 412,
    height: 823,
    deviceScaleFactor: 1.75,
    disabled: false,
  },
}
const throttlings = {
  desktop: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 },
  mobile: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
}

function isExplicitAppUrl(target) {
  return (
    ['https:', 'http:'].includes(target.protocol) && target.pathname !== '/'
  )
}

export function collectionConfig(url, profile) {
  const target = new URL(url)
  if (!isExplicitAppUrl(target) || !profiles.includes(profile))
    throw new Error('Explicit app URL and profile required')
  return {
    ci: {
      collect: {
        url: [url],
        numberOfRuns: expectedRuns,
        settings: {
          onlyCategories: ['performance'],
          formFactor: profile,
          emulatedUserAgent: true,
          screenEmulation: screenEmulations[profile],
          throttlingMethod: 'simulate',
          throttling: throttlings[profile],
          disableStorageReset: false,
          chromeFlags: '--headless --no-sandbox',
        },
      },
    },
  }
}

function assertReportMatches(report, url) {
  const finalUrl = report.finalDisplayedUrl ?? report.finalUrl
  if (report.runtimeError || report.requestedUrl !== url || finalUrl !== url)
    throw new Error('Runtime error or target URL mismatch')
  for (const audit of Object.values(audits)) {
    if (!isValidMetric(report.audits?.[audit]?.numericValue))
      throw new Error('Missing or invalid metric')
  }
}

function median(values) {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
}

export function summarize(reports, url) {
  if (reports.length !== expectedRuns)
    throw new Error('Expected exactly three reports')
  for (const report of reports) assertReportMatches(report, url)
  return {
    status: 'measured',
    runs: reports.length,
    metrics: Object.fromEntries(
      Object.entries(audits).map(([key, audit]) => [
        key,
        median(reports.map((report) => report.audits[audit].numericValue)),
      ]),
    ),
    conditions: reports.map((report) => ({
      measuredAt: report.fetchTime,
      lighthouse: report.lighthouseVersion,
      browser: report.environment?.hostUserAgent,
      settings: report.configSettings,
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

function ratingLimits(metric, profile) {
  const limits = {
    lcp: [2500, 4000],
    cls: [0.1, 0.25],
    tbt: profile === 'desktop' ? [150, 350] : [200, 600],
  }
  return limits[metric]
}

// Reference labels for lab medians, never CI assertions or field CWV pass/fail.
export function rateMetric(metric, value, profile) {
  if (!profiles.includes(profile) || !isValidMetric(value))
    return undeterminable
  const limits = ratingLimits(metric, profile)
  if (!limits) return undeterminable
  const [goodLimit, needsWorkLimit] = limits
  if (value <= goodLimit) return '良好'
  if (value <= needsWorkLimit) return '改善が必要'
  return '不良'
}

function isMeasuredSummary(data, profile) {
  return (
    profiles.includes(profile) &&
    data?.status === 'measured' &&
    data.runs === expectedRuns &&
    metricKeys.every((key) => isValidMetric(data.metrics?.[key]))
  )
}

function worstRating(ratings) {
  const worstIndex = Math.max(
    ...Object.values(ratings).map((label) => ratingLabels.indexOf(label)),
  )
  return ratingLabels[worstIndex]
}

function unmeasuredAssessment(data) {
  const evidence =
    data?.reason === 'collection-failed'
      ? '未計測（計測エラー・不完全レポート）'
      : '未計測（公開失敗・job未完了・指標欠損・レポートなし）'
  return {
    valid: false,
    rating: undeterminable,
    evidence,
    next: 'Preview公開・Actionsログ・対象URL・レポート完了を確認して再計測',
  }
}

export function evaluateProfile(data, profile) {
  if (!isMeasuredSummary(data, profile)) return unmeasuredAssessment(data)
  const ratings = Object.fromEntries(
    metricKeys.map((key) => [key, rateMetric(key, data.metrics[key], profile)]),
  )
  const affected = metricKeys.filter((key) => ratings[key] !== '良好')
  const hasAffected = affected.length > 0
  return {
    valid: true,
    rating: worstRating(ratings),
    ratings,
    evidence: hasAffected
      ? `${affected.map((key) => metricLabels[key]).join('・')}が良好範囲を超過`
      : '3指標とも良好範囲',
    next: hasAffected
      ? affected.map((key) => nextChecks[key]).join('、')
      : '#36で操作時INP・本番API待ちを確認',
  }
}

// Only a small allowlisted JSON value crosses the read-only measurement / write boundary.
const maxSummaryBytes = 16 * 1024
const unmeasuredReasons = new Set(['collection-failed', 'preview-unavailable'])

function safeTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : unknown
}
function safeLighthouseVersion(value) {
  const isSemver =
    typeof value === 'string' &&
    /^\d{1,3}\.\d{1,3}\.\d{1,3}(?:[-+][A-Za-z0-9.-]{1,24})?$/.test(value)
  return isSemver ? value : unknown
}
function safeBrowser(value) {
  if (typeof value !== 'string') return unknown
  const chromeVersion = value.match(
    /\b(?:HeadlessChrome|Chrome|Chromium)\/[0-9.]{1,40}/,
  )
  return chromeVersion?.[0] ?? unknown
}
function compactConditions(conditions) {
  const first = Array.isArray(conditions)
    ? conditions.slice(0, expectedRuns)
    : []
  return first.map((condition) => ({
    measuredAt: safeTime(condition?.measuredAt),
    lighthouse: safeLighthouseVersion(condition?.lighthouse),
    browser: safeBrowser(condition?.browser),
  }))
}
function compactProfile(data, profile) {
  if (!evaluateProfile(data, profile).valid) {
    const reason = unmeasuredReasons.has(data?.reason)
      ? data.reason
      : 'invalid-summary'
    return { status: 'unmeasured', reason }
  }
  return {
    status: 'measured',
    runs: expectedRuns,
    metrics: Object.fromEntries(
      metricKeys.map((key) => [key, data.metrics[key]]),
    ),
    conditions: compactConditions(data.conditions),
  }
}
function compactSummary(result) {
  return {
    sha: result.sha,
    url: result.url,
    measuredAt: safeTime(result.measuredAt),
    profiles: Object.fromEntries(
      profiles.map((profile) => [
        profile,
        compactProfile(result.profiles?.[profile], profile),
      ]),
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
  const isSmallString =
    typeof value === 'string' &&
    value !== '' &&
    Buffer.byteLength(value, 'utf8') <= maxSummaryBytes
  if (!isSmallString) return null
  try {
    const result = JSON.parse(value)
    if (result?.sha !== sha || result?.url !== url) return null
    return compactSummary(result)
  } catch {
    return null
  }
}

const ratingIcons = { 良好: '🟢', 改善が必要: '🟡', 不良: '🔴' }
function ratingBadge(rating) {
  return `${ratingIcons[rating] ?? '⚪'} ${rating}`
}

const profileLabels = { desktop: 'PC', mobile: 'モバイル' }
const unmeasuredReasonLabels = {
  'collection-failed': '収集失敗',
  'preview-unavailable': 'Preview未公開',
}
function unmeasuredRow(label, data) {
  const reason = unmeasuredReasonLabels[data?.reason] ?? 'サマリー欠損・不正'
  return `| ${label} | ⚪ ${undeterminable} | — | — | — | 未計測（${reason}） |`
}
function measuredRow(label, metrics, assessment) {
  const lcp = `${(metrics.lcp / 1000).toFixed(2)} s（${ratingBadge(assessment.ratings.lcp)}）`
  const cls = `${metrics.cls.toFixed(3)}（${ratingBadge(assessment.ratings.cls)}）`
  const tbt = `${Math.round(metrics.tbt)} ms（${ratingBadge(assessment.ratings.tbt)}）`
  return `| ${label} | ${ratingBadge(assessment.rating)} | ${lcp} | ${cls} | ${tbt} | ${expectedRuns}/${expectedRuns} |`
}

export function renderComment(result, runUrl) {
  const rows = profiles.map((profile) => {
    const label = profileLabels[profile]
    const data = result.profiles?.[profile]
    const assessment = evaluateProfile(data, profile)
    return assessment.valid
      ? measuredRow(label, data.metrics, assessment)
      : unmeasuredRow(label, data)
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

async function readLighthouseReports() {
  const files = (await readdir('.lighthouseci')).filter((file) =>
    /^lhr-.*\.json$/.test(file),
  )
  return Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(`.lighthouseci/${file}`, 'utf8')),
    ),
  )
}

async function collectProfile(url, profile, output) {
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
  return summarize(await readLighthouseReports(), url)
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
  const isPreviewPublished = publish === 'success' && Boolean(url)
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
    if (!isPreviewPublished) continue
    try {
      result.profiles[profile] = await collectProfile(url, profile, output)
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

function gh(args, input) {
  const response = spawnSync('gh', args, { encoding: 'utf8', input })
  if (response.status !== 0) throw new Error(response.stderr)
  return response.stdout
}

function previewComment(baseUrl, sha) {
  return `${previewMarker}
Cloudflare UI Preview: ${baseUrl}

対象commit: \`${sha}\`

URLを知っている方が閲覧できます。公開済み本番APIを使用し、利用枠を消費します。PreviewにSecretは渡しません。PR内のバックエンド変更は検証対象外です。
`
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
  if (!isHeadSha(sha) || !isPrNumber(number))
    throw new Error('Invalid PR identity')
  const isStillCurrent = () =>
    canUpdate(
      JSON.parse(gh(['api', `repos/${repo}/pulls/${number}`])),
      sha,
      repo,
    )
  if (!isStillCurrent()) return
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
  const findBotComment = (commentMarker) =>
    pages
      .flat()
      .find(
        (existing) =>
          existing.user?.login === 'github-actions[bot]' &&
          existing.body?.startsWith(commentMarker),
      )
  const upsert = (commentMarker, commentBody) => {
    const existing = findBotComment(commentMarker)
    // Recheck immediately before each mutation, including the existing Preview comment.
    if (!isStillCurrent()) return
    const [method, endpoint] = existing
      ? ['PATCH', `repos/${repo}/issues/comments/${existing.id}`]
      : ['POST', `repos/${repo}/issues/${number}/comments`]
    gh(
      ['api', '--method', method, endpoint, '--input', '-'],
      JSON.stringify({ body: commentBody }),
    )
  }
  upsert(marker, body)
  const isPreviewPublished =
    process.env.PUBLISH_RESULT === 'success' && process.env.PREVIEW_BASE_URL
  if (isPreviewPublished)
    upsert(previewMarker, previewComment(process.env.PREVIEW_BASE_URL, sha))
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv[2] === 'collect') await collect()
  else if (process.argv[2] === 'comment') await comment()
  else throw new Error('Use collect or comment')
}

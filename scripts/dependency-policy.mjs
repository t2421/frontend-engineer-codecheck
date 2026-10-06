import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const expectedConfig = Object.freeze({
  'ignore-scripts': 'true', 'min-release-age': '7', 'allow-git': 'none',
  'save-exact': 'true', registry: 'https://registry.npmjs.org/', 'strict-ssl': 'true',
});
const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const exactVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const packageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const entries = value => object(value) ? Object.entries(value) : [];
const canonical = value => JSON.stringify(entries(value).sort(([a], [b]) => a.localeCompare(b)));
export const nameFromPath = path => path.split('node_modules/').at(-1);
const validIntegrity = value => typeof value === 'string' && /^sha512-[A-Za-z0-9+/]{86}==$/.test(value) && Buffer.from(value.slice(7), 'base64').length === 64;
function validSource(name, version, source) {
  try {
    const url = new URL(source);
    const base = name.split('/').at(-1);
    return url.origin === 'https://registry.npmjs.org' && !url.username && !url.password && !url.search && !url.hash &&
      source === `https://registry.npmjs.org/${name}/-/${base}-${version}.tgz`;
  } catch { return false; }
}

export function checkPolicy({ manifest, lock, config, bootstrap = false }) {
  const errors = [];
  for (const [key, value] of Object.entries(expectedConfig)) {
    if (String(config?.[key]) !== value) errors.push(`npm設定 ${key} が必須値と一致しません`);
  }
  if (config && 'allow-scripts' in config) errors.push('allow-scripts はnpm 11.13.0では非対応です');
  if (!object(manifest)) return [...errors, 'package.json が不正です'];
  if (manifest.private !== true) errors.push('package.json は private=true が必要です');
  for (const key of ['overrides', 'workspaces', 'bundledDependencies', 'bundleDependencies', 'resolutions']) {
    if (key in manifest) errors.push(`${key} はこの単一パッケージ方針では未対応です`);
  }
  for (const section of sections) {
    if (section in manifest && !object(manifest[section])) errors.push(`${section} が不正です`);
    for (const [name, version] of entries(manifest[section])) {
      if (!packageName.test(name) || typeof version !== 'string' || !exactVersion.test(version)) errors.push(`${section}: ${name} は完全なregistry versionが必要です`);
    }
  }
  const hasDependencies = sections.some(section => entries(manifest[section]).length);
  if (lock === undefined) {
    if (!bootstrap) errors.push('package-lock.json が必要です（通常検査）');
    else if (hasDependencies) errors.push('bootstrapは依存ゼロ・lock未作成の場合のみ利用できます');
    return errors;
  }
  if (lock?.lockfileVersion !== 3 || !object(lock.packages) || !object(lock.packages[''])) return [...errors, 'lockfileVersion=3 と packages/root が必要です'];
  const root = lock.packages[''];
  for (const section of sections) {
    if (section in root && !object(root[section])) errors.push(`lock root の ${section} が不正です`);
    if (canonical(manifest[section]) !== canonical(root[section])) errors.push(`lock root の ${section} がpackage.jsonと一致しません`);
    for (const [name, version] of entries(manifest[section])) {
      if (lock.packages[`node_modules/${name}`]?.version !== version) errors.push(`lock: ${name} のversionまたはentryが一致しません`);
    }
  }
  for (const [path, entry] of entries(lock.packages)) {
    if (!path) continue;
    const name = nameFromPath(path);
    if (!/^(?:node_modules\/(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*\/)*node_modules\/(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(path) || !packageName.test(name) || !object(entry)) {
      errors.push(`${path}: 不正なlock entry`); continue;
    }
    if ('name' in entry && entry.name !== name) errors.push(`${path}: nameとlock pathが一致しません（aliasは禁止）`);
    if (entry.link) errors.push(`${path}: link依存は禁止です`);
    if (!exactVersion.test(entry.version ?? '')) errors.push(`${path}: versionが不正です`);
    if (!validSource(name, entry.version, entry.resolved)) errors.push(`${path}: 許可外または不正な取得先です`);
    if (!validIntegrity(entry.integrity)) errors.push(`${path}: sha512 integrity が必要です`);
    if (entry.inBundle || entry.bundled) errors.push(`${path}: bundled依存は未対応です`);
    for (const section of sections) {
      if (section in entry && !object(entry[section])) errors.push(`${path}: ${section} が不正です`);
      for (const [dep, spec] of entries(entry[section])) {
        if (!packageName.test(dep) || typeof spec !== 'string' || /(?:[:/@]|\b(?:git|https?|file|workspace)\b)/i.test(spec)) errors.push(`${path}: ${dep} に許可外の依存指定があります`);
      }
    }
  }
  return errors;
}

export async function registryMetadata(name) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`registry HTTP ${response.status}`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 32 * 1024 * 1024) throw new Error('registry response too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function checkAges(lock, { now = new Date(), loadMetadata = registryMetadata } = {}) {
  const errors = []; const cache = new Map();
  if (lock?.lockfileVersion !== 3 || !object(lock.packages) || !object(lock.packages[''])) return ['年齢検査には有効なlockfile v3が必要です'];
  if (!Number.isFinite(now.getTime())) return ['検査時計が不正です'];
  for (const [path, entry] of entries(lock?.packages)) {
    if (!path) continue;
    const name = nameFromPath(path);
    try {
      if (!cache.has(name)) cache.set(name, Promise.resolve().then(() => loadMetadata(name)));
      const metadata = await cache.get(name);
      const published = metadata?.time?.[entry.version];
      let time = typeof published === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(published) ? Date.parse(published) : NaN;
      if (Number.isFinite(time)) {
        const normalized = published.includes('.') ? published.replace(/\.(\d{1,3})Z$/, (_, digits) => `.${digits.padEnd(3, '0')}Z`) : published.replace('Z', '.000Z');
        if (new Date(time).toISOString() !== normalized) time = NaN;
      }
      if (metadata?.name !== name || !Number.isFinite(time)) errors.push(`${name}@${entry.version}: 公開日時を確認できません`);
      else if (now.getTime() - time < 7 * 86400000) errors.push(`${name}@${entry.version}: 公開から7日未満です`);
    } catch { errors.push(`${name}@${entry.version}: registry公開日時の取得に失敗しました`); }
  }
  return errors;
}

export function parseConfig(text) {
  const config = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || /^[;#]/.test(line.trim())) continue;
    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    if (separator < 1 || key in config || !(key in expectedConfig)) throw new Error('.npmrcには重複・未許可の設定があります');
    config[key] = line.slice(separator + 1).trim();
  }
  return config;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--bootstrap') || args.length > 1) throw new Error('usage: node scripts/dependency-policy.mjs [--bootstrap]');
  if (process.versions.node !== '24.16.0') throw new Error('Node 24.16.0を使用してください');
  try {
    await access('npm-shrinkwrap.json');
    console.error('npm-shrinkwrap.jsonは禁止です。npmが優先する別lockで検査を回避できます');
    process.exitCode = 1; return;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const config = parseConfig(await readFile('.npmrc', 'utf8'));
  const npmCli = resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
  const version = spawnSync(process.execPath, [npmCli, '--version'], { encoding: 'utf8' });
  if (version.status !== 0 || version.stdout.trim() !== '11.13.0') throw new Error('npm 11.13.0を使用してください');
  const effective = spawnSync(process.execPath, [npmCli, 'config', 'get', ...Object.keys(expectedConfig), 'before'], { encoding: 'utf8' });
  if (effective.status !== 0) throw new Error('npm実効設定を確認できません');
  const actual = Object.fromEntries(effective.stdout.trim().split('\n').map(line => {
    const separator = line.indexOf('='); return [line.slice(0, separator), line.slice(separator + 1)];
  }));
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  let lock;
  try { lock = JSON.parse(await readFile('package-lock.json', 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const errors = [
    ...checkPolicy({ manifest, lock, config, bootstrap: args.includes('--bootstrap') }),
    ...Object.keys(expectedConfig).filter(key => key !== 'min-release-age' && actual[key] !== expectedConfig[key]).map(key => `npm実効設定 ${key} が必須値と一致しません`),
    ...(!Number.isFinite(Date.parse(actual.before)) || Math.abs(Date.now() - Date.parse(actual.before) - 7 * 86400000) > 30_000 ? ['npm実効設定 min-release-age（beforeへの変換）が7日と一致しません'] : []),
  ];
  if (!errors.length && lock) errors.push(...await checkAges(lock));
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(lock ? '依存方針・全lock entryの公開7日経過を確認しました' : 'bootstrap確認成功（依存ゼロ・lock未作成。署名/脆弱性/実依存は未検査）');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('検査に失敗しました。入力ファイル・Node/npm・ネットワークを確認してください'); process.exitCode = 1; });
}

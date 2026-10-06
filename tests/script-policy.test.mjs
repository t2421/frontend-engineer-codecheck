import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseConfig, expectedConfig } from '../scripts/dependency-policy.mjs';

const npmCli = resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
test('プロジェクト.npmrcは必須設定のみ、重複・未許可キーを拒否', async () => {
  const config = await readFile(new URL('../.npmrc', import.meta.url), 'utf8');
  assert.deepEqual(parseConfig(config), expectedConfig);
  assert.throws(() => parseConfig(`${config}\nignore-scripts=false`));
  assert.throws(() => parseConfig(`${config}\nallow-scripts=fixture`));
});
test('無害なlocal fixtureのnpm ciはinstall lifecycleを実行しない', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dependency-policy-'));
  try {
    const marker = 'marker.txt';
    // このfixtureだけの明示コマンドで実行可能なことを確認。外部コード・依存はゼロ。
    const command = `node -e "require('node:fs').writeFileSync('${marker}', 'executed')"`;
    const manifest = { name: 'script-fixture', version: '1.0.0', private: true, scripts: Object.fromEntries(['preinstall', 'install', 'postinstall', 'prepare', 'marker'].map(key => [key, command])) };
    await writeFile(join(cwd, 'package.json'), JSON.stringify(manifest));
    await writeFile(join(cwd, 'package-lock.json'), JSON.stringify({ name: manifest.name, version: manifest.version, lockfileVersion: 3, packages: { '': { name: manifest.name, version: manifest.version, hasInstallScript: true } } }));
    await writeFile(join(cwd, '.npmrc'), await readFile(new URL('../.npmrc', import.meta.url), 'utf8'));
    const env = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, HOME: cwd, TMPDIR: tmpdir(), npm_config_cache: join(cwd, 'cache'), npm_config_update_notifier: 'false' };
    const run = args => spawnSync(process.execPath, [npmCli, ...args], { cwd, env, encoding: 'utf8', timeout: 20_000 });
    assert.equal(run(['--version']).stdout.trim(), '11.13.0');
    const control = run(['run', 'marker']); assert.equal(control.status, 0, control.stderr);
    assert.equal(await readFile(join(cwd, marker), 'utf8'), 'executed');
    await rm(join(cwd, marker));
    const install = run(['ci', '--offline', '--audit=false', '--fund=false']);
    assert.equal(install.status, 0, install.stderr);
    await assert.rejects(access(join(cwd, marker)), { code: 'ENOENT' });
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
test('CLIはbootstrap成功、通常lock欠落と環境変数による防御無効化を拒否', () => {
  const cwd = resolve(dirname(new URL(import.meta.url).pathname), '..');
  const script = join(cwd, 'scripts/dependency-policy.mjs');
  const env = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, HOME: tmpdir(), TMPDIR: tmpdir(), npm_config_update_notifier: 'false' };
  const run = (args, extra = {}) => spawnSync(process.execPath, [script, ...args], { cwd, env: { ...env, ...extra }, encoding: 'utf8', timeout: 20_000 });
  assert.equal(run(['--bootstrap']).status, 0);
  const strict = run([]); assert.equal(strict.status, 1); assert.match(strict.stderr, /package-lock/);
  for (const extra of [{ npm_config_ignore_scripts: 'false' }, { npm_config_min_release_age: '0' }, { npm_config_allow_git: 'all' }, { npm_config_strict_ssl: 'false' }, { npm_config_registry: 'https://example.test/' }, { npm_config_min_release_age: '6' }, { npm_config_before: '2020-01-01' }]) {
    const result = run(['--bootstrap'], extra); assert.equal(result.status, 1); assert.match(result.stderr, /npm実効設定|検査に失敗/);
  }
});
test('npm優先のshrinkwrapによる別lockへの切替を拒否', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dependency-policy-shrinkwrap-'));
  try {
    for (const name of ['.npmrc', 'package.json']) await writeFile(join(cwd, name), await readFile(new URL(`../${name}`, import.meta.url)));
    await writeFile(join(cwd, 'npm-shrinkwrap.json'), '{}');
    const result = spawnSync(process.execPath, [new URL('../scripts/dependency-policy.mjs', import.meta.url).pathname, '--bootstrap'], {
      cwd, env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, HOME: cwd, TMPDIR: tmpdir(), npm_config_update_notifier: 'false' }, encoding: 'utf8', timeout: 20_000,
    });
    assert.equal(result.status, 1); assert.match(result.stderr, /shrinkwrap/);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test('CLIは別Node実体とpackageManager/環境のversion偽装に依存しない', async t => {
  const cwd = resolve(dirname(new URL(import.meta.url).pathname), '..');
  const script = join(cwd, 'scripts/dependency-policy.mjs');
  const oldNode = '/Users/taiga/.nvm/versions/node/v22.14.0/bin/node';
  // 対象Macで既に存在するNodeのみ使用。別環境ではこの負例だけをskip。
  try { await access(oldNode); } catch { t.skip('既存の別Node実体がない環境'); return; }
  const result = spawnSync(oldNode, [script, '--bootstrap'], { cwd, env: { PATH: '/usr/bin:/bin', HOME: tmpdir(), npm_config_user_agent: 'npm/11.13.0 node/v24.16.0' }, encoding: 'utf8' });
  assert.equal(result.status, 1);
});

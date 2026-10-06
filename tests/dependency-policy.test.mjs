import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPolicy, checkAges, registryMetadata } from '../scripts/dependency-policy.mjs';

const config = { 'ignore-scripts': 'true', 'min-release-age': '7', 'allow-git': 'none', 'save-exact': 'true', registry: 'https://registry.npmjs.org/', 'strict-ssl': 'true' };
const integrity = `sha512-${Buffer.alloc(64).toString('base64')}`;
const now = new Date('2026-10-06T12:00:00Z');
function fixture() {
  const manifest = { name: 'fixture', version: '1.0.0', private: true, dependencies: { alpha: '1.2.3' } };
  const lock = { lockfileVersion: 3, packages: { '': { name: 'fixture', version: '1.0.0', dependencies: { alpha: '1.2.3' } }, 'node_modules/alpha': { version: '1.2.3', resolved: 'https://registry.npmjs.org/alpha/-/alpha-1.2.3.tgz', integrity } } };
  return { manifest, lock, config };
}
function denied(input, pattern) { assert.match(checkPolicy(input).join('\n'), pattern); }

test('registry固定・完全version・sha512のlockを受理', () => assert.deepEqual(checkPolicy(fixture()), []));
test('通常モードはlock欠落を拒否、bootstrapは依存ゼロのみ許可', () => {
  denied({ ...fixture(), lock: undefined }, /lock/);
  denied({ ...fixture(), lock: undefined, bootstrap: true }, /依存/);
  assert.deepEqual(checkPolicy({ manifest: { private: true }, config, bootstrap: true }), []);
});
test('設定の無効化と非対応allow-scriptsを拒否', () => {
  for (const [key, value] of Object.entries(config)) denied({ ...fixture(), config: { ...config, [key]: value === 'true' ? 'false' : 'wrong' } }, new RegExp(key));
  denied({ ...fixture(), config: { ...config, 'allow-scripts': 'alpha' } }, /allow-scripts/);
});
test('直接依存のrange・Git・URL・alias・fileを拒否', () => {
  for (const spec of ['^1.2.3', 'latest', 'git+https://github.com/example/repo', 'https://example.test/a.tgz', 'npm:other@1.2.3', 'file:../a']) {
    const input = fixture(); input.manifest.dependencies.alpha = spec; denied(input, /alpha/);
  }
});
test('rootの依存不一致とmissing top-level entryを拒否', () => {
  const input = fixture(); input.lock.packages[''].dependencies.alpha = '1.2.4'; denied(input, /root/);
  const absent = fixture(); delete absent.lock.packages['node_modules/alpha']; denied(absent, /alpha/);
});
test('推移・optionalを含む全lock entryの出所を確認', () => {
  for (const resolved of ['git+https://github.com/example/repo', 'https://example.test/b.tgz', 'http://registry.npmjs.org/b/-/b-1.0.0.tgz', 'https://registry.npmjs.org.evil.test/b.tgz', 'https://user@registry.npmjs.org/b/-/b-1.0.0.tgz', 'https://registry.npmjs.org/b/-/b-1.0.0.tgz?x=1', 'https://registry.npmjs.org/wrong/-/b-1.0.0.tgz']) {
    const input = fixture(); input.lock.packages['node_modules/alpha/node_modules/b'] = { version: '1.0.0', optional: true, resolved, integrity }; denied(input, /node_modules\/b/);
  }
});
test('integrity欠落・sha1・無効sha512・link・旧lockを拒否', () => {
  for (const value of [undefined, 'sha1-abc', 'sha512-abc']) { const input = fixture(); input.lock.packages['node_modules/alpha'].integrity = value; denied(input, /integrity/); }
  const link = fixture(); link.lock.packages['node_modules/alpha'].link = true; denied(link, /link/);
  denied({ ...fixture(), lock: { lockfileVersion: 1 } }, /lockfileVersion/);
});
test('scoped packagesの公式tarballを受理', () => {
  const input = fixture(); input.lock.packages['node_modules/@scope/b'] = { version: '1.0.0', resolved: 'https://registry.npmjs.org/@scope/b/-/b-1.0.0.tgz', integrity }; assert.deepEqual(checkPolicy(input), []);
});
test('overrides・workspaces・bundled dependenciesはfail closed', () => {
  for (const key of ['overrides', 'workspaces', 'bundledDependencies']) { const input = fixture(); input.manifest[key] = {}; denied(input, new RegExp(key)); }
});
test('公開7日前の境界を受理、7日未満はlock内推移依存でも拒否', async () => {
  const input = fixture(); input.lock.packages['node_modules/b'] = { version: '1.0.0', resolved: 'https://registry.npmjs.org/b/-/b-1.0.0.tgz', integrity };
  const metadata = { alpha: { name: 'alpha', time: { '1.2.3': '2026-09-29T12:00:00Z' } }, b: { name: 'b', time: { '1.0.0': '2026-09-29T12:00:00.001Z' } } };
  const errors = await checkAges(input.lock, { now, loadMetadata: async name => metadata[name] }); assert.match(errors.join('\n'), /b@1.0.0.*7日/); assert.equal(errors.length, 1);
});
test('公開日時欠落・不正日時・取得失敗をfail closed', async () => {
  for (const metadata of [{}, { name: 'alpha', time: { '1.2.3': 'invalid' } }, { name: 'wrong', time: { '1.2.3': '2020-01-01' } }]) assert.ok((await checkAges(fixture().lock, { now, loadMetadata: async () => metadata })).length);
  assert.ok((await checkAges(fixture().lock, { now, loadMetadata: async () => { throw new Error('offline'); } })).length);
});
test('bootstrapフラグでも存在するlockの取得先を検査', () => {
  const input = fixture(); input.lock.packages['node_modules/alpha'].resolved = 'https://example.test/alpha.tgz'; denied({ ...input, bootstrap: true }, /取得先/);
});
test('同名のnested entryも各versionの日時を確認、metadata取得は共有', async () => {
  const input = fixture(); input.lock.packages['node_modules/other/node_modules/alpha'] = { ...input.lock.packages['node_modules/alpha'], version: '2.0.0' };
  let calls = 0;
  const errors = await checkAges(input.lock, { now, loadMetadata: async () => { calls++; return { name: 'alpha', time: { '1.2.3': '2020-01-01T00:00:00Z', '2.0.0': '2026-10-06T00:00:00Z' } }; } });
  assert.equal(calls, 1); assert.match(errors.join('\n'), /alpha@2.0.0.*7日/);
});
test('lock entryの別名・root/推移依存の不正な型を拒否', () => {
  const alias = fixture(); alias.lock.packages['node_modules/alpha'].name = 'other'; denied(alias, /name/);
  const root = { manifest: { private: true }, config, lock: { lockfileVersion: 3, packages: { '': { dependencies: [] } } } }; denied(root, /root.*dependencies/);
  const nested = fixture(); nested.lock.packages['node_modules/alpha'].dependencies = []; denied(nested, /dependencies/);
});
test('年齢検査単体も不正lockと実在しない日付を拒否', async () => {
  for (const lock of [undefined, {}, { lockfileVersion: 2, packages: {} }]) assert.ok((await checkAges(lock, { now })).length);
  const errors = await checkAges(fixture().lock, { now, loadMetadata: async () => ({ name: 'alpha', time: { '1.2.3': '2026-02-30T00:00:00Z' } }) }); assert.match(errors.join('\n'), /公開日時/);
});
test('scoped name/version/tarballの不一致・userinfo/hash/escapeを拒否', () => {
  for (const resolved of ['https://registry.npmjs.org/@other/b/-/b-1.0.0.tgz', 'https://registry.npmjs.org/@scope/b/-/b-2.0.0.tgz', 'https://user:password@registry.npmjs.org/@scope/b/-/b-1.0.0.tgz', 'https://registry.npmjs.org/@scope/b/-/b-1.0.0.tgz#x', 'https://registry.npmjs.org/@scope%2fb/-/b-1.0.0.tgz']) {
    const input = fixture(); input.lock.packages['node_modules/@scope/b'] = { version: '1.0.0', resolved, integrity }; denied(input, /@scope\/b.*取得先/);
  }
});
test('dev/optional/peer直接依存もbootstrapを回避できずnested integrityを検査', () => {
  for (const section of ['devDependencies', 'optionalDependencies', 'peerDependencies']) denied({ manifest: { private: true, [section]: { alpha: '1.2.3' } }, config, bootstrap: true }, /依存ゼロ/);
  const input = fixture(); input.lock.packages['node_modules/alpha/node_modules/b'] = { version: '1.0.0', resolved: 'https://registry.npmjs.org/b/-/b-1.0.0.tgz' }; denied(input, /node_modules\/b.*integrity/);
});

test('metadataは公式host・scoped URLだけを要求しredirect errorを指定', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://registry.npmjs.org/%40scope%2Fb');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ name: '@scope/b', time: {} }));
  });
  assert.equal((await registryMetadata('@scope/b')).name, '@scope/b');
});
test('HTTP redirect/取得失敗/不正JSONを年齢検査で拒否、ネットワークなし', async t => {
  for (const response of [new Response('', { status: 302, headers: { location: 'https://example.test/' } }), new Response('', { status: 500 }), new Response('invalid JSON')]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => response);
    const errors = await checkAges(fixture().lock, { now }); assert.match(errors.join('\n'), /取得に失敗/);
    mock.mock.restore();
  }
});

# frontend-engineer-codecheck

Vue 3 / Vite / TypeScript の最小起動環境です。
依存導入前に[pnpmの短い運用手順](./docs/DEPENDENCY_SECURITY.md)を確認してください。

## ローカル起動

Node **24.16.0** と pnpm **12.8.1** を用意し、プロジェクトのルートで実行します。pnpm の実体を作業 shell の PATH に追加するか、以下の `pnpm` をその絶対パスに置き換えてください。global の Corepack/Yarn 設定を変更する必要はありません。

```sh
nvm use
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

表示された localhost URL を開きます。`src/App.vue` を編集すると HMR で画面が更新されます。停止は Ctrl+C です。

```sh
pnpm build
pnpm preview
pnpm audit --audit-level=high
```

## 確認範囲と残課題

2026-10-06、Mac arm64 / Node 24.16.0 / pnpm 12.8.1 で、scripts 無効の frozen-lockfile 導入、別ディレクトリでの再現導入、Chrome の画面表示・HMR、Vite build を確認しました。

推移依存 source-map-js を1.2.2へ更新し、監査は既知の脆弱性0件でした。[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) の修正を優先するため、ユーザー承認でこの版だけ7日待機の例外にしています。ダウンロードしたパッケージに、脆弱性を修正するコードが含まれていることを確認しました。全体の7日待機とscripts無効は維持しています。

**2026年10月7日23:08:10（JST）以降**は公開から7日が経つため、待機期間の例外設定を削除できます。`pnpm-workspace.yaml` の `minimumReleaseAgeExclude` を削除した後、frozen installと監査を再確認してください。更新後も別ディレクトリのfrozen install、Chrome表示・HMR、buildを再確認しました。他の依存版は変更していません。

テスト基盤は #15、品質チェックは #16、Cloudflare の公式 Vite plugin・workerd の互換性と実行環境の手順整備は #17 で扱います。現時点の build は Vite の静的成果物を生成します。

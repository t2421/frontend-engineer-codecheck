# Workersのローカルセットアップ

この手順は#15のテスト環境と#16の品質環境を前提とします。Node 24.16.0 / pnpm 12.8.1 / Git / Google Chromeが必要です。pnpmの用意は[依存導入手順](./DEPENDENCY_SECURITY.md)を参照し、作業shellのPATHで利用できる状態にしてください。

## 新規チェックアウトから実行

```sh
git clone https://github.com/t2421/frontend-engineer-codecheck.git
cd frontend-engineer-codecheck
# 未マージの場合は、この変更を含むレビュー対象ブランチをcheckoutする。
nvm use
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

表示されたURLをChromeで開き、`src/App.vue`の編集でHMRを確認します。Ctrl+Cで停止してから次を実行します。既存Chromeを使うためPlaywright用ブラウザの追加ダウンロードは不要です。

```sh
pnpm test
pnpm test:e2e
pnpm check
pnpm build
pnpm preview
```

プレビューはビルド済みWorkerとStatic Assetsをローカルworkerdで実行します。画面は`dist/client`、Workerは`dist/population_viewer`に出力します。API中継は未実装で、`/api/*`は404です。SPAの深いURLはindex.htmlへフォールバックします。停止はCtrl+Cです。

Cloudflareへのログイン・秘密値・実デプロイは不要です。これらとCIはこの変更の対象外です。ポートが使用中なら`pnpm dev --port 5176 --strictPort`や`pnpm preview --port 4175 --strictPort`を指定します。Chromeテストは5175番を専用使用し、既存serverを再利用しません。

## 互換性と検証

公式Cloudflare Vite plugin 1.62.1 / Wrangler 4.143.1 / workerd 1.20260926.1を使用します。2026-10-06、Mac arm64でinstall scriptsを無効のまま、frozen install、全テスト、全品質チェック、Worker＋画面build、Chromeでのプレビューを確認しました。画面と深いSPA URLは200、未実装APIは404でした。新規ローカルcloneに未コミットの#16・#17差分を適用して手順を再現し、lockが変わらないことも確認しました。Chromeで開発時のHMR更新と復元を確認し、画面のtimeOriginが変わらずリロードされていないことを確認しました。

## 監査の是正と残課題

2026-10-07（JST）、公式registryの公開日時と依存指定を確認し、7日待機を過ぎたplugin 1.62.1 / Wrangler 4.143.1へ通常更新しました。Miniflare 5.20260926.1-alphaがundici 7.29.1を指定し、以前のundici 7.29.0に関する10件を解消します。直接依存は完全version、scripts停止、全体7日待機を維持します。

再監査では[sharpのGHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)（High）も検出しました。Miniflareはsharp 0.35.4を固定しており、最新公開Miniflareも同じ版を指定しています。公式修正版0.35.5は2026-09-27公開で7日経過済みです。`pnpm-workspace.yaml`で`miniflare@5.20260926.1-alpha>sharp`だけ0.35.5へ限定更新しています。Miniflareの通常更新が修正版を指定したら、このoverrideを削除して再検証してください。

[Stylelint経由のbraces High 1件](./QUALITY_CHECKS.md)は未解消で、監査合格は未達です。採用済みStylelintの維持と監査合格を両立する公開済みの通常更新は、現時点で確認できません。ユーザーはStylelintを維持し、このHigh 1件を既知のリスクとしてPRに明記して進めることを承認しました。audit ignore・監査閾値の緩和・検査無効化はありません。品質・テスト・buildの成功と監査未合格を区別してください。

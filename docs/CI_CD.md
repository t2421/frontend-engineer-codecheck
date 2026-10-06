# CI/CD

Issue #12のローカル実装です。#17のWorkers環境（PR #31）が前提です。GitHub Actions実行・production environment設定・Cloudflare認証設定・実デプロイは未実施で、Issue #12の公開先動作確認は未完了です。

## PRチェック

`Checks`はPRの作成・更新・再開、mainへのpush、手動実行で動きます。PRではGitHub標準のマージ結果を検査します。

- `Quality, tests and build`: frozen install、ESLint・Stylelint・Prettier・vue-tsc、Vitest、Google ChromeのPlaywright、Worker＋画面build、Wranglerのdry-run。
- `Dependency audit (braces exception recorded)`: 全依存を標準`pnpm audit`で確認します。承認済み例外のGHSA・管理者・見直し日と標準テキスト出力をログに表示し、失敗時もartifactに保存します。pnpmの終了コードをそのまま反映します。

承認済みの[braces High 1件](./QUALITY_CHECKS.md)だけをpnpm標準の[`audit.ignore`](https://pnpm.io/cli/audit#auditignore)に指定します。標準テキスト出力は、検出した問題を例外として扱った旨と`1 ignored: 1 high`を表示します。GHSAと理由・管理者・見直し日は設定と下記運用記録に残します。独自checkerやJSON加工は使わず、判定はpnpm自身の終了コードです。閾値変更・continue-on-error・`--ignore-registry-errors`は使いません。新しい指摘や監査通信失敗はCI失敗です。脆弱性自体は未解消であり、例外付きの監査成功として扱います。

例外の理由は、通常の依存更新で解消できないbracesを含むStylelintを維持し、固定lintパターンに限定して既知リスクを受容するユーザー承認です。管理責任者はrepo管理者`t2421`、見直し日は**2026-10-14**。修正版または依存経路の解消後に例外を削除し再監査します。任意パターンを受け付ける変更時にも再評価します。

Nodeは`.nvmrc`の24.16.0、pnpmは公式Linux x64版12.8.1と公式配布SHA-256を固定しています。全jobはubuntu-24.04、外部Actionsは公式releaseの完全commit SHAです。共通setupはfrozen installのみを行い、既存7日待機・scripts停止・sharp限定override・source-map-js限定例外を変更しません。pnpmの更新時は共通setupのURLとSHAも更新してください。

PRチェックにdeploy秘密情報を渡しません。権限はcontents:read、checkoutの認証保持は無効、依存キャッシュは使用しません。PlaywrightはCIでtest.onlyを拒否し、失敗traceとHTML reportを7日間artifactに保存します。

## デプロイの準備

設定する前にデプロイ実行の承認が必要です。この変更ではアカウントや認証情報を操作していません。

1. GitHubで`production` environmentを用意し、deploy可能branchをmainに制限します。利用プランが対応する場合はrequired reviewersも設定します。
2. [Cloudflare公式手順](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)に従い、対象アカウントに限定したWorkersデプロイ用API tokenを用意します。今回使わないZone・KV・R2等の権限を付けず、Workers Scripts:Editと対象アカウント情報の読取に必要な権限へ絞ります。追加bindingや独自domainを導入した場合は必要な権限を別途確認します。
3. productionのenvironment secretsに`CLOUDFLARE_API_TOKEN`と`CLOUDFLARE_ACCOUNT_ID`を登録します。値はrepo、ログ、artifactに書きません。人口APIキーはこのdeploy tokenとは別のWorker Secretとして管理し、この変更では設定しません。

API tokenとaccount IDはdeploy stepだけに渡します。install・build・testは秘密情報を参照しません。

## 実行と確認

Actions → `Deploy production` → Run workflowで**main**を選びます。他のbranchを選ぶとjobはskipします。自動deployやPR preview deployはありません。

同じcommitでChecksを再実行し、品質と監査の両方が成功した場合だけproduction deployへ進みます。WorkerとStatic Assetsをbuildし、`pnpm exec wrangler deploy --config dist/population_viewer/wrangler.json`で配備します。並行deployは直列化します。

**braces 1件だけの承認済み例外を適用し、品質と監査の両jobをdeploy条件として維持します。** 別の脆弱性や監査通信失敗が発生するとdeployは停止します。このローカル変更は実deployの承認・実行を含みません。

認証設定と実行の承認後、Wrangler出力の公開URLで初期画面・深いSPA URL・実装済みAPIを確認します。現段階の未実装`/api/*`は404が正常です。独自domainやworkers.devの公開設定もこの変更では操作していません。

## 再実行と失敗時

Actionsの対象runを開き、`Re-run failed jobs`または`Re-run all jobs`で同じcommitを再検証できます。新しい修正を確認する場合はPRへpushし、新しいrunを使います。productionを最新mainから再配備する場合はRun workflowを改めて実行します。

- install失敗: lock不整合、7日待機、registry通信を確認します。待機設定やscripts停止をCIだけで解除しません。
- 品質・テスト失敗: stepの指摘を修正し、ローカルの`pnpm check`、`pnpm test`、`pnpm test:e2e`で再現します。Chrome失敗は`playwright-failure`のreport・traceを確認します。
- audit失敗: `dependency-audit`のテキストログで指摘と通信エラーを確認します。既知bracesは標準の`ignored`表示として記録し、それ以外の指摘や通信失敗ではjobが失敗します。
- build・dry-run失敗: 同じNode・pnpmで`pnpm build`後、上記Wranglerコマンドに`--dry-run`を付けて確認します。dry-runは実配備ではありません。
- deploy失敗: production承認状態、Secrets名、対象account、token権限、Wranglerログを確認します。秘密値をログへ出して切り分けません。

構成の安全性は[GitHub公式指針](https://docs.github.com/en/actions/reference/security/secure-use)を参照しています。

## ローカル検証

2026-10-07（JST）、独立worktree、Mac arm64、Node 24.16.0 / pnpm 12.8.1で以下を確認しました。

- actionlint 1.7.12、全YAMLのparse、共通setupのbash構文、Prettierとgit diff検査が成功。
- frozen install、品質4種、単体・部品2件、CIモードのChrome1件、Worker＋画面build、Wrangler dry-runが成功。
- Chromeの期待値を一時的に誤らせると終了コード1になり、trace.zipとHTML reportが生成されました。元へ戻すと終了コード0になりました。
- CIモードで一時的なtest.onlyは拒否され、終了コード1になりました。検証用の変更は復元済みです。
- 例外追加前の全依存監査はbraces High 1件のみで終了コード1。例外追加後は標準監査の終了コード0を確認しました。依存lockは変更していません。
- CI用pnpm Linux x64配布の公式SHA-256一致と、展開後のpnpm実体のパスを確認しました。

GitHub-hosted Ubuntu上の実workflowは未実行です。実deploy、公開先動作確認、production environmentとSecretsの設定も未実施です。

### 承認済み例外の再検証

2026-10-07（JST）、native pnpm 12.8.1 / Node 24.16.0で標準`pnpm audit`を実registryに対して実行し、終了コード0と「All found vulnerabilities were already reviewed and decided to be ignored」「1 ignored: 1 high」を確認しました。これはGHSA-vfj7-8cjw-p6xmの承認済み例外による成功で、braces Highは未解消です。

一時ディレクトリのlockfileコピーとローカルregistryでpnpm標準コマンドを直接検証しました。既知bracesだけは終了コード0、新規GHSAの追加は終了コード1、registryの503も終了コード1です。検証用の架空指摘・server・checkerはrepoに追加していません。全品質チェック、actionlint、git diff検査を実施し、lockfileは変更前と同じSHA-256です。前節のbuild・Chrome等は既存検証結果で、この簡略化では再実行していません。

この記録はローカル検証の結果です。GitHub Actions上の実workflowはPRで確認します。別途承認されたcanonicalrepo mainの初回手動公開には、このCI差分を含めていません。

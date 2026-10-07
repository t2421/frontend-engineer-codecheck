# PRのUI確認用Preview

PRごとに `pr-番号` の固定URLを作り、push後に同じbotコメントを更新します。
fixtureがあるPRは確認ページ一覧、ないPRはアプリのUIを表示します。
確認ページは専用ビルドだけに含まれ、本番の `pnpm build` には追加されません。
URLを知っている人は閲覧できます。機密情報を確認ページに含めないでください。

| タイミング                     | 処理                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| 同一repoのPR作成・push・再open | `Review assets` がSecretなしでVue UIをビルド                                          |
| ビルド成功                     | main側の `Publish review` が成果物だけをCloudflare Previewへ公開し、URLコメントを更新 |
| PR close・merge                | base側のコードで、そのPRのPreviewを削除                                               |

fork PRは公開対象外です。公開jobはPRコードをcheckout・実行せず、API・Secret・本番リソースbindingを設定しません。
PreviewのBase設定も `--ignore-base-config` で無視します。

## 導入と未完了の前提

このworkflowをmainへmerge後に有効になります。既存PRは次のpushで実行されます。
GitHub Secretsの登録は別タスクです。2026-10-06時点では未設定なので、CIからの自動公開・更新・削除は未検証です。

必要なrepository Secretsは `CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_API_TOKEN`。
accountは `81a92c0f86da67baab9e5ee38d840493`、Workerは `population-viewer`。
tokenはこのWorkerへのEditor権限を持つものを本人が用意します。値をIssueやログへ貼りません。
本番deployは別のPR #34にあるmain限定の手動workflowを使います。

失敗時は該当Actionsのログを確認して再実行してください。古いcommitやclosed PRのビルド結果は公開しません。
PR close時の削除が失敗した場合、同じcleanup jobを再実行するか、本人が `pnpm exec wrangler preview delete --config wrangler.review.jsonc --name pr-番号 --skip-confirmation` を実行します。

[Cloudflare Previews](https://developers.cloudflare.com/workers/previews/)・[公式Actions例](https://developers.cloudflare.com/workers/previews/examples/)

## Previewの参考性能計測（Issue #49）

公開後、Secret・PR書込権限のない `measure` jobでLighthouse CIをPC／モバイル各3回実行します。
`/` のfixture一覧は対象外です。ビルドはアプリ本体を `/app/` と `/performance/<PR head SHA>/` に含め、計測には後者の明示URLを使います。
新しい公開で古いSHAのパスが消えた場合は失敗扱いにし、別commitの画面を計測しません。

LCP・CLS・TBTは各指標の中央値。閾値assertは設定せず、初期はmergeをブロックしない参考表示です。
公開失敗、job未完了、レポート不足、Lighthouse runtime error、URL不一致、無効な数値は「未計測」と理由を表示します。
`review-performance` Actions artifact（7日間）に各runのHTML・JSON、設定、収集ログ、集計JSONを保存します。
ブラウザー／Lighthouseの版・実測時刻・実際の設定は集計JSONの `conditions` と元レポートで確認できます。
PCは1350×940・RTT 40 ms・10240 Kbps・CPU 1倍、モバイルは412×823・RTT 150 ms・1638.4 Kbps・CPU 4倍。
通信／CPUはsimulate、各runでストレージ・キャッシュをリセットします。

コメント専用jobはmainのスクリプトでJSONをデータとして読むだけで、依存installやPRコードを実行しません。
対象PRがopen・同一repo・最新head SHA一致であることをコメント一覧取得前と更新直前に照合します。
専用マーカー `<!-- pr-preview-performance -->` のbotコメント一件を更新し、既存のPreview URLコメントを保持します。

静的UIのラボ値なのでTBTをINP実測値として扱いません。実API待ちや操作時INPの完全検証はできません。
本番ビルド／API、選択・解除・区分切替・グラフ更新時のINP、改善前後比較は引き続き #36 で最終評価します。
追加サーバーやLHCI外部storageは使いません。

ローカル再現（Node／pnpmはDEPENDENCY_SECURITY.mdの固定版）：

```sh
pnpm test:review
REVIEW_SHA=0000000000000000000000000000000000000000 node .github/scripts/build-review.mjs
# 別terminalで静的配信（ローカル確認用のみ）
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist-review
PUBLISH_RESULT=success HEAD_SHA=0000000000000000000000000000000000000000 PREVIEW_URL=http://127.0.0.1:4173/performance/0000000000000000000000000000000000000000/ node .github/scripts/review-performance.mjs collect
```

Lighthouse CIは公式npm registryの `@lhci/cli@0.15.1` を固定し、既存pnpmの7日年齢制約・install scripts停止を維持します。
設定項目は [LHCI公式configuration](https://googlechrome.github.io/lighthouse-ci/docs/configuration.html)を参照。
CIでの公開・実計測・コメント更新はmainにworkflowが入ってから検証する別操作です。

### LHCIの依存監査と互換性

LHCIは `@lhci/cli@0.15.1`、Lighthouseは `12.6.1` のままです。
公式npm registryの固定versionへ限定overrideし、年齢制約・scripts停止・既存braces例外を維持しています。
2026-10-07の全severity監査は未承認の脆弱性0件、既存のbraces High 1件のみignore（終了コード0）です。
新しいaudit例外やignore設定は追加していません。`pnpm peers check` も警告なしです。

初期追加時の経路と解消方法：

| advisory / severity                                                                                                                                            | 初期の依存経路                                                                                    | 修正版・対応                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv)、[GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3) / High各1件 | @lhci/cli →（@lhci/utils →）Lighthouse → puppeteer-core → @puppeteer/browsers → extract-zip@2.0.1 | extract-zip自体に公開済み修正版なし。browser helperを公式3.2.3へ更新し、extract-zipの依存経路を除去。      |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) / Moderate                                                                            | @lhci/cli → uuid@8.3.2                                                                            | 修正版11.1.1へ更新。CommonJSとLHCIが使用するv4 APIを維持。                                                 |
| [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) / Moderate                                                                            | @lhci/cli → @lhci/utils → js-yaml@3.15.2 → argparse@1.0.10 → sprintf-js@1.0.3                     | sprintf-js自体に公開済み修正版なし。argparseを公式2.0.1へ更新し、依存経路を除去。js-yamlのsafeLoadは維持。 |
| [GHSA-ph9p-34f9-6g65](https://github.com/advisories/GHSA-ph9p-34f9-6g65)、[GHSA-7c78-jf6q-g5cm](https://github.com/advisories/GHSA-7c78-jf6q-g5cm) / High      | @lhci/cli → tmp、@lhci/cli → inquirer → external-editor → tmp                                     | 型混同問題も修正されたtmp@0.2.7へ固定。LowのGHSA-52f5-9888-hmc6も解消。                                    |
| [GHSA-c475-qrg2-pj4r](https://github.com/advisories/GHSA-c475-qrg2-pj4r) / High                                                                                | @lhci/cli／browser helper → proxy-agent → pac-proxy-agent → get-uri → basic-ftp@5.3.1             | basic-ftpの修正版6.2.1へ固定。                                                                             |

browser helper v3のoptional peerに合わせ、LHCIのproxy-agentも公式8.0.1へ更新しました。
Node 24.16.0のESM対応を使います。overrideはupstreamの宣言rangeをまたぐため、LHCI／Puppeteerの通常更新時には必要性を見直してください。
Lighthouse CIを他の計測ツールへ置き換えたり、独自の依存shim・package patchを作ったりしていません。
YAML設定のsafeLoad、argparseの既存CLI、UUID v4、ProxyAgentとPuppeteerの公開APIを互換性テストで確認します。

Chromeは既存Playwrightの `install --with-deps chrome` で導入したシステムChromeをLHCIが検出・起動します。
LighthouseはそのブラウザーへPuppeteerで接続し、Puppeteerのブラウザーダウンロードは使用しません。
PC／モバイル各3回の実計測とHTML／JSON生成で、依存更新後も収集が動くことを確認します。

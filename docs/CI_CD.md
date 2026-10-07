# CI/CD

## workflowの役割

| workflow / ファイル                                                     | トリガー                                    | 役割                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Checks** / `checks.yml`                                               | PR、main push、手動、workflow呼出し         | lint・整形・型・unit・Chrome/axe・build・Wrangler dry-run・全severity監査。公開しない                |
| **Review assets** / `review-build.yml`                                  | 同一repoのPR作成・push・reopen              | Secretなしでアプリの静的UIをbuildし、review-assetsを3日保存                                          |
| **Publish review** / `review-publish.yml`                               | Review assets成功、同一repo PRのclose/merge | 最新open PRの成果物をPreview公開・URL/参考性能コメント更新。close/merge時に削除                      |
| **Deploy production** / `deploy.yml`                                    | mainを選ぶ手動実行                          | 同じcommitのChecks成功後、production environmentから本番へ公開                                       |
| **Diagnose Cloudflare metadata** / `cloudflare-metadata-diagnostic.yml` | mainを選ぶ手動実行                          | production SecretsでCloudflare metadataをGET診断。build・deploy・Secret変更・上流API呼出しは行わない |

ファイルは`.github/workflows/`にあります。Checksの共通setupは固定Node/pnpmでfrozen installします。PRコードのbuild/testには公開Secretsを渡しません。[監査例外](./DEPENDENCY_SECURITY.md)以外の指摘と通信失敗はChecksを失敗させ、本番公開を止めます。

## PR Preview

Previewはアプリ全体の静的UI専用で、Worker/API・Secrets・本番bindingは含めません。`tests/preview/`の部品ページも公開しません。URLを知っている人は閲覧できるため機密情報を含めないでください。実API成功の確認には本番またはローカルWorkerを使用します。

`build-review.mjs`はUIを`/`・`/app/`・`/performance/<head SHA>/`へ出力します。publish jobはmain側コードで成果物をデータとして扱い、PRコードをcheckout・実行しません。`--ignore-base-config`でPreview Base設定も無視します。fork PR・古いhead・closed PRの成果物は公開しません。

PRごとの`pr-番号`URLとbotコメントを更新します。公開前にSHA別HTMLを確認し、公開後は同じSHA URLだけを最大10回・全体45秒で到達確認します。200 HTML以外は失敗とし、別commitへfallbackしません。close時削除が失敗した場合はcleanup jobを再実行するか、対象を確認して次を実行します。

```sh
pnpm exec wrangler preview delete --config wrangler.review.jsonc --name pr-番号 --skip-confirmation
```

[Cloudflare Previews](https://developers.cloudflare.com/workers/previews/)を参照してください。

### 参考性能

Secret・PR書込権限のないmeasure jobでLighthouse CIをPC/mobile各3回実行し、LCP・CLS・TBTの中央値、条件、SHA、版、時刻、失敗状態を専用コメントへ記録します。計測結果を受け取るコメントjobはmainコードで検証済みJSONを読み、PRコードを実行しません。HTML/JSONの性能レポートはrunnerの一時ファイルで、artifactには保存しません。

PCは1350×940 / RTT 40ms / 10240Kbps / CPU 1倍、mobileは412×823 / RTT 150ms / 1638.4Kbps / CPU 4倍。通信・CPUはsimulate、各runでcache/storageをリセットします。

| 指標                                                                                              | 良好   | 改善が必要  | 不良   |
| ------------------------------------------------------------------------------------------------- | ------ | ----------- | ------ |
| [LCP](https://web.dev/articles/lcp)                                                               | ≤2.5秒 | >2.5〜4秒   | >4秒   |
| [CLS](https://web.dev/articles/cls)                                                               | ≤0.1   | >0.1〜0.25  | >0.25  |
| [TBT PC](https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time) | ≤150ms | >150〜350ms | >350ms |
| TBT mobile                                                                                        | ≤200ms | >200〜600ms | >600ms |

3指標の最も厳しい区分を参考表示します。欠損・失敗・3回未完了は判定不可です。閾値assertやmergeブロックはなく、静的UIのラボ値を実ユーザー評価・操作時INP・実API待ちの確認と区別します。[LHCI設定](https://googlechrome.github.io/lighthouse-ci/docs/configuration.html)を参照してください。

ローカルでは`pnpm test:review`でCIスクリプトを検証できます。UI buildは次のとおりです（必要に応じて`REVIEW_SHA`に40桁の対象SHAを指定）。

```sh
node .github/scripts/build-review.mjs
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist-review
```

## 本番公開

[環境とSecrets](./CLOUDFLARE_ENVIRONMENT.md)を設定し、GitHub **Actions → Deploy production → Run workflow**で**main**を選びます。同じcommitのChecksが成功し、productionの保護設定による承認を満たすと公開します。main以外はskipし、必須Secrets不足は公開前に停止します。PR Preview公開と本番deployは別操作です。

公開後は画面・深いSPA URL・同一オリジンGET 2本を確認します。実応答で47県・複数県・4区分の年/人口値を照合し、失敗/retry・Rate Limit・静的UIへの影響を確認してください。モック・dry-run・UI Preview成功だけでは実API確認を完了としません。

## 失敗の確認

Actionsの失敗stepとartifactを確認します。ChecksはChrome実行時のHTML・axe JSON・失敗traceを`playwright-results`、監査ログを`dependency-audit`として成功・失敗とも7日保存します。修正pushで再チェック、同じcommitの再実行は**Re-run failed jobs / Re-run all jobs**を使います。本番再公開はmainから手動実行します。

Wranglerのmetadata読取に失敗した場合は**Diagnose Cloudflare metadata**をmainから実行します。serviceから環境を解決し、bindings・routes・domains・subdomain・environment・schedulesを固定Cloudflare originへGETします。redirect拒否・各要求10秒timeout。出力は分類・HTTP status・安全な整数error codeのみで、URL・header・本文・秘密値は保存しません。status 0はHTTP応答なし等、非zero終了は読取失敗です。一般的なWranglerエラーだけで権限不足と決めず、失敗した分類をもとに必要な修正を確認します。

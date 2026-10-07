# Cloudflare環境（Issue #27）

対象はaccount `81a92c0f86da67baab9e5ee38d840493` のWorker `population-viewer`です。
本番URLは <https://population-viewer.t2421-loop.workers.dev>。
2026-10-07（JST）にdashboardでWorkers Freeを確認しました。プランや課金は変更していません。

## どのworkflowを使うか

| 用途                            | workflow                                     | 操作・動作                                                                   |
| ------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| 品質・テスト・公開用buildの確認 | **Checks**                                   | PR更新で実行。dry-runまでで公開しない                                        |
| mainの本番公開                  | **Deploy production**                        | Actionsからmainを選んで手動実行。Checks成功とproductionの承認・Secretsが前提 |
| PRのUI確認                      | **Review assets → Publish review**（PR #43） | 同一repoのPR更新で専用UIビルド後、固定URLのコメントを更新。close/mergeで削除 |

本番手順は[CI/CD](./CI_CD.md)が管理します。Previewのworkflow・専用build・設定は[PR #43](https://github.com/t2421/frontend-engineer-codecheck/pull/43)が管理し、この変更には複製しません。#43が未mergeの場合は先にmergeします。このPRはmain向けなので、#43のbranch削除でbaseを失いません。

Previewは `wrangler.review.jsonc` による静的UI専用です。Worker/APIをビルドせず、binding・Secretを設定せず、Preview Base設定も無視します。`wrangler.jsonc` の本番設定やRate LimitをPreview設定へ移しません。確認用fixtureは本番buildに追加されません。

PR #39の[確認ページ](https://pr-39-population-viewer.t2421-loop.workers.dev/tests/e2e/fixtures/single-select)は既存OAuthで単発公開済みです。URLを知っている方が閲覧できます。本番trafficは変更していません。

## IP単位200回／10秒

`wrangler.jsonc` の `API_RATE_LIMITER` はnamespace `27001`、limit `200`、period `10`です。
`worker/index.ts` は `/api/*` にCloudflareの `CF-Connecting-IP` を使い、両API共通のIPキーで制限します。拒否時は429と `Retry-After: 10`、IP不明時は503です。IPをログへ出しません。

許可後は[APIプロキシ](./API_PROXY.md)が指定のGET 2本を中継します。実行時の`YUMEMI_API_KEY`が未設定なら503です。静的UIは制限対象外です。
[公式binding仕様](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)の制限はCloudflare拠点ごとの近似値です。共有回線では複数利用者が同じIPになるため、公開承認後に実際の利用への影響を確認します。同じnamespaceを他Workerで使うとカウンタが共有されます。

Workers Freeは[公式limits](https://developers.cloudflare.com/workers/platform/limits/)上、Worker実行100,000 requests/day、CPU 10 ms/request、subrequests 50/request、同時外部接続6、メモリ128 MBです。[Static Assets要求は無料・無制限](https://developers.cloudflare.com/workers/platform/pricing/)ですが、`/api/*` はWorker実行枠を使います。このRate Limitは日次枠や上流APIの割当量を保証しません。

## Secrets設定は別タスク

2026-10-07（JST）確認時点でGitHub repository Secretsは未設定です。token作成・Secrets入力・environment保護設定は今回行いません。既存OAuthをCIへ転用せず、秘密値をチャット・repo・ログへ貼りません。

| 設定場所                          | 本人が設定する名前                              | 使うworkflow                  |
| --------------------------------- | ----------------------------------------------- | ----------------------------- |
| GitHub **production environment** | `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` | Deploy production             |
| GitHub **repository Secrets**     | `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` | Publish reviewの公開・削除job |

account IDは冒頭の値です。tokenは対象Worker `population-viewer` のEditorに限定し、[公式roles](https://developers.cloudflare.com/workers/authorization/workers/)に従います。不要なAdmin・DNS・KV・R2・Billing権限を付けません。必要な有効期間とproductionのmain制限・reviewerを別タスクで決めます。

人口API用Worker Secret `YUMEMI_API_KEY`は公開用tokenとは別です。[利用手順と検証範囲](./API_PROXY.md)を参照してください。値の設定は別作業で、未設定でも静的配信とbuildを可能にするため `secrets.required` は追加していません。[Secretの設定は即時公開を伴う場合があります](https://developers.cloudflare.com/workers/configuration/secrets/)。

## 完了条件と残件

ローカルの品質・型・unit tests、build、Wrangler dry-runとPRのChecksが成功したら実装検証完了です。dry-runで `API_RATE_LIMITER (200 requests/10s)` を確認します。

自動公開の運用完了には、#43のmerge、別タスクのSecrets設定、PR更新によるPreview公開・同じコメント更新・close時削除の検証が必要です。現在はCI自動公開の検証未達です。

**Rate Limitの本番公開は保留中です。** このPRのmergeやChecks成功だけでは公開しません。別途承認されたmainのDeploy production実行後に、本番の許可・429応答・静的UIへの影響を確認します。近似カウンタの本番負荷試験と実API疎通は未確認です。API proxyのローカル実装・検証は[Issue #45の記録](./API_PROXY.md)を参照してください。

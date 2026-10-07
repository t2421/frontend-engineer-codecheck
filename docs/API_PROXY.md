# APIプロキシ（Issue #45）

## 画面側との契約

[指定API公式仕様](https://github.com/yumemi-inc/frontend-engineer-codecheck/blob/main/docs/api.md)を2026-10-06（UTC）に確認した。画面側は同一オリジンの次のGETを使う。ブラウザーにAPIキーを設定しない。

| メソッド・パス                                          | 許可するquery                             | 固定上流パス                                        |
| ------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| `GET /api/v1/prefectures`                               | なし                                      | `/api/v1/prefectures`                               |
| `GET /api/v1/population/composition/perYear?prefCode=1` | `prefCode`だけ、必須・1〜47の正規十進表記 | `/api/v1/population/composition/perYear?prefCode=1` |

上流originは `https://frontend-engineer-codecheck-api.mirai.yumemi.io` に固定する。`prefCode`の重複、0・48・先頭ゼロ・小数・空白、未知のquery（`cityCode`・`url`など）、未知のパス・末尾スラッシュを拒否する。任意URLは受け付けない。人口queryは検証済みの値から組み直す。

成功時は200と公式のJSON envelope `{ "message": null, "result": ... }`を返す。一覧の`prefCode`・`prefName`、人口の`boundaryYear`・`data`・`label`・年別の`year`・`value`・区分の`rate`を維持する。業務データの詳しい型検証は画面側の取得処理で行う。プロキシはJSON envelopeを検証し、上流エラーenvelopeとSecretを含む応答を拒否する。

応答は`application/json`、`Cache-Control: no-store`。失敗時は `{ "error": "固定コード" }` と次のstatusを返し、上流の本文・ヘッダー・例外を返さない。

| status | error                 | 補足                                                                                  |
| ------ | --------------------- | ------------------------------------------------------------------------------------- |
| 400    | `INVALID_REQUEST`     | 許可外・不正query                                                                     |
| 404    | `NOT_FOUND`           | APIパスが未知                                                                         |
| 405    | `METHOD_NOT_ALLOWED`  | GET以外、`Allow: GET`                                                                 |
| 429    | `RATE_LIMITED`        | `Retry-After: 10`、上流を呼ばない                                                     |
| 503    | `SERVICE_UNAVAILABLE` | Secret・Cloudflare IP不足、Rate Limit bindingの失敗                                   |
| 502    | `UPSTREAM_ERROR`      | 上流の非2xx（403・429・redirect含む）・通信失敗・不正JSON・エラーenvelope・Secret反射 |
| 504    | `UPSTREAM_TIMEOUT`    | 上流の接続と本文読取を合わせて10秒                                                    |

既存`API_RATE_LIMITER`の両API共通`ip:<CF-Connecting-IP>`キーと200回/10秒の設定を使用する。`X-Forwarded-For`を信頼しない。guardを先に適用するため、制限超過時はパス・メソッド・queryの検証結果より429が優先される。静的配信は既存Static Assets設定が担当し、API以外はRate Limitを呼ばない。

## Worker Secretの別作業への引継ぎ

必要な名前は **`YUMEMI_API_KEY`**。Workerの実行時`env`だけから読む。上流リクエストにはこの値を`X-API-KEY`として付け、加えてプロキシ自身を名乗る固定の`User-Agent: population-viewer-proxy`を送る。User-Agentの有無による応答差は下の比較検証に記録する。ブラウザーのAuthorization・Cookie・X-API-KEYなどは転送しない。上流redirectは追わず、秘密値を別ホストへ送らない。キー・IP・上流例外をログに出さない。

本番Worker `population-viewer`への値の登録・更新は、別作業の承認済み手順で行う。Wranglerの対話入力で `pnpm exec wrangler secret put YUMEMI_API_KEY` を使う場合、Secret操作が即時公開を伴う可能性を[公式手順](https://developers.cloudflare.com/workers/configuration/secrets/)と[環境文書](./CLOUDFLARE_ENVIRONMENT.md)で確認する。値をコマンド引数・チャット・repoへ貼らない。今回このコマンドは実行していない。

ローカルの実API確認が別途承認された場合、gitignore対象の`.dev.vars`へ本人がこの名前を設定し、`pnpm dev`を起動して同一オリジンのGETを確認する。`VITE_*`や`wrangler.jsonc`のvarsへ入れない。UI専用PR PreviewにはSecret/APIを追加しない。設定がなくてもbuildは可能で、APIは503になる。

## 検証記録と残件

PR #44はマージ済み。2026-10-06（UTC）に取得したmain `2867e3ca76f26af3c0a67704d090052811cdc2b5`はそのmerge `75c43ff`を含む。環境設定を重複実装せず、wrangler設定・依存・lockfile・セキュリティ設定を維持した。

Vitestのモックで、公式サンプルの一覧と人口JSON、1・47の県コード、固定転送先・Secretだけの送信、正常・不正要求・上流失敗・本文を含むタイムアウト・Secret不足・制限超過・Rate Limit失敗・秘密値反射（JSON escape含む）を確認した。人口fixtureは公式サンプルに2区分を補い、4区分と`rate`の保持も確認した。これらは実上流との疎通を証明しない。

**初回実装時は実API疎通と実データの契約確認が未検証**だった。この独立worktreeには本人が提供した実行時Secretがなく、値の探索・表示・登録は行っていない。公開API仕様との契約照合とモック検証を、実API検証と区別する。初回実装ではSecret登録、認証権限作成、公開deploy、実Cloudflareでの近似Rate Limit負荷確認を別作業に残した。

ローカル検証結果: Node 24.16.0 / native pnpm 12.8.1。先行テスト44件は実装前41失敗・3成功、その後の追加を含むWorkerテスト45件、全Vitest 56件、Chrome E2E 7件が成功。`pnpm check`（ESLint・Stylelint・Prettier・vue-tsc）、`pnpm build`、Wrangler deploy `--dry-run`、`git diff --check`が成功した。dry-runは`API_RATE_LIMITER (200 requests/10s)`を確認し、公開していない。Corepackによる子コマンド解決の不調はnative pnpmのディレクトリを作業shellのPATH先頭に置いて回避した。Wranglerログは`WRANGLER_LOG_PATH`で一時ディレクトリへ出力した。

ビルド済みWorkerのローカルpreviewでは、`/`と深いSPAパスが200、GET 2本がSecret未設定の503、不正県コードが400、未知APIが404を確認した。配信bundleにテストのダミーSecret・ブラウザー認証fixtureが含まれないことも確認した。ローカルserverは停止済み。実Cloudflareのカウンタ精度・実上流通信はこの検証に含まれない。

### User-Agent比較検証（2026-10-07）

以下は本人から共有された実測結果であり、この修正を準備したエージェントによる独立した上流直接検証ではない。Secret値は取得・表示・登録していない。

| 環境・要求                                                               | 観測結果                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------- |
| curl、キーなし、既定User-Agent                                           | 403 / text/plain、x-amzn-requestidあり               |
| curl、キーなし、User-Agent削除                                           | 403 / HTML、server: CloudFront、x-amzn-requestidなし |
| curl、キーあり、既定User-Agent                                           | 200 / JSON                                           |
| curl、キーあり、User-Agent削除                                           | 403 / HTML                                           |
| curl、キーあり、User-Agent: population-viewer-proxy                      | 200 / JSON                                           |
| workerd local/remote、同一リクエスト内でUser-Agentなし／固定値ありを比較 | 403 / HTML → 200 / JSON                              |
| workerd local/remote、キーなし、固定User-Agentあり                       | 403 / text/plain                                     |

Accept削除・HTTP/1.1への変更では結果に差がなかったとの報告。修正後のWorkerで両APIが200、都道府県47件、不正県コード48が400、未知APIが404となったとの報告も受けた。これらの応答差は固定User-Agentを送る根拠となるが、上流の具体的なWAF設定や拒否処理の内部順序までは確定しない。モックテストと本人による実測を区別し、本番反映後は公開WorkerへのキーなしGETで再確認する。

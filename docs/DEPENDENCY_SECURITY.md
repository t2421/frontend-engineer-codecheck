# 依存パッケージのサプライチェーン対策

[Issue #19](https://github.com/t2421/frontend-engineer-codecheck/issues/19) の基盤。依存導入より先に適用する。完全な攻撃防止は保証しない。

## 前提とプロジェクト設定

Node **24.16.0** / npm **11.13.0**を使用する。`.nvmrc`・`engines`・`packageManager`と検査CLIで固定する。`engines`単体には強制力がないため、検査CLIのバージョン確認を必須とする。既存nvmで `nvm use` し、`node --version` / `npm --version` を確認する。ホーム・OSの設定は変更しない。

| `.npmrc` | 意味 |
| --- | --- |
| `ignore-scripts=true` | install lifecycleを停止。明示的な`npm run`・`npm test`は実行されるが、pre/postは実行されない |
| `min-release-age=7` | 新たに解決するversionは公開から7日以上経過したものに限定。単位は日 |
| `allow-git=none` | Git依存の取得を禁止 |
| `save-exact=true` | 直接依存の指定を完全versionで保存 |
| `registry=https://registry.npmjs.org/` | 公式npm registryを利用 |
| `strict-ssl=true` | TLS証明書を検証 |

これらは使用中のnpmの同梱設定定義で対応を確認した。`allow-scripts`は非対応なので使わない。npm 11.13.0は`min-release-age`を起動時に相対日数から`before`の日時へ変換するため、`npm config get min-release-age`は`null`になる。検査CLIは実効`before`が検査時刻の7日前であることを確認する（プロセス時間・秒丸めの許容30秒）。`.npmrc`の内容とnpm実効設定を両方検査し、環境変数で主要設定を無効化した場合も拒否する。

## 初期状態の確認

現在はアプリ未初期化・依存ゼロ・lockfile未作成。package.jsonにはセキュリティコマンドだけを置く。

```sh
node --test tests/*.test.mjs
node scripts/dependency-policy.mjs --bootstrap
```

bootstrapは**依存ゼロかつlock未作成の場合だけ**未作成を許す。lockが存在すれば同じ取得先・integrity・年齢検査を行う。通常コマンド`node scripts/dependency-policy.mjs`はlock未作成をエラーにする。bootstrapを通常CIの代替にしない。テスト用metadataを通常CLIへ渡す抜け道は用意していない。

## #14で実依存を初めて追加するとき

1. 依存の必要性・名前・公式リポジトリ・ライセンス・メンテナを確認し、完全versionを選ぶ。不要なwrapper・追加のmockライブラリは導入しない。テンプレート生成を含む`npx` / `npm create` / `npm exec`は第三者コードの実行になるため、未確認の`latest`を実行しない。必要な雛形は確認済みソースから作成する。
2. package.jsonへ確認済みの完全versionを記述。秘密情報のない作業環境で、`npm install --package-lock-only --ignore-scripts`によりlockだけを生成する。`.npmrc`を変更せず、第三者コードはまだ実行しない。
3. `node scripts/dependency-policy.mjs`を実行する。package.jsonの直接依存を固定versionか確認し、lock rootとの整合性を検査する。npmが優先する`npm-shrinkwrap.json`は拒否し、検査対象のpackage-lockから切り替えられないようにする。lockfile v3の全entry（推移・optional・nested・OS別を含む）の公式tarball URL・sha512 integrityを確認する。lock entryにnameが記録されていればpath由来のpackage名との一致も確認し、依存欄の不正な型は拒否する。Git・任意URL・alias・file・link・bundle・workspace・overridesはこの単一パッケージの基盤では拒否する。
4. 同じ検査で公式registryのmetadataを直接取得し、**lockの各name/version**の公開日時と現在時刻を比較する。7日未満・日時欠落・不正・取得失敗は拒否する。`npm ci`で既存lockを使うだけではこの年齢制約を保証しないため、必ず先に独立検査する。7日ちょうどは許可。7日待機は悪意のないことの証明ではない。
5. 成功後に`npm ci --ignore-scripts`。ロックファイルをコミット対象にし、以後の再現導入は`npm ci`を使う。manifestとの不一致・missing dependency等の解決整合性はnpm ciも検証する。
6. 続けて`npm audit signatures`、`npm audit --audit-level=low`を実行し、終了コードと結果・実行日・Node/npm・対象lockのGit revisionをレビュー記録へ残す。警告・検証対象外・失敗を成功として扱わない。依存コードを実行するdev/build/testはその後、秘密情報なしで行う。

年齢検査はnpm公式registryへHTTPSでmetadataのみを取得する。tarballやコードは実行しない。metadataのredirectは拒否、通信timeoutは15秒、応答上限32MiB、同名metadataは1回の検査内で共有する。ネットワーク・時計が信頼できない場合は止めて原因を解消する。fixtureの時計を実検査の時計として使わない。

取得先は公式tarballのname/version対応まで制限する。npm ciによるtarball取得のHTTP redirect自体を検査器が制御するものではない（npmの通信処理に委ねる）。metadata取得でのredirect拒否とは区別する。integrityは取得物がlockに記録されたハッシュと一致するための情報であり、作者や内容の安全性の証明ではない。`npm audit signatures`はregistry署名・提供されるprovenanceの整合性を検証するが、コードの安全性を保証しない。`npm audit`は既知の脆弱性を調べるもので、未知の攻撃・未登録の悪意あるパッケージを網羅しない。結果不明のときに防御設定を下げたり`npm audit fix --force`で未確認のversionへ更新したりしない。

## 例外の扱い

一括の`ignore-scripts=false`や7日制約の無言の解除は禁止。現時点の検査器に例外allowlistはない。必要な例外が判明したら、まず次をPRまたはIssueに記録してユーザーの承認を得てから、狭い例外処理とテストを別途実装する。設定を変えるだけでは検査を通過しない。

- 対象package名・固定version・lock integrityと、変更が必要な制約
- 必要な理由、代替案、実行するコード／コマンドと取得物の確認内容
- 7日制約の例外なら公開日時、採用を急ぐ理由、署名・脆弱性確認
- 秘密情報を渡さない隔離環境での実行範囲、影響、検証結果
- 承認者・承認日時・対象PR、期限と解除条件
- 例外の取り消し方法、通常設定に戻した再検査結果

Vite・workerd等がスクリプト停止状態で起動できるかは#14以降で確認する。必要になった場合も全依存のスクリプトを解禁せず、固定対象・確認済み処理のみ扱う。この互換性確認を#19の基盤完成条件には含めない。

## #12へ引き継ぐCI方針

CIへの組み込みは#12で行う。PR検査は`pull_request`を使い、最小`permissions: contents: read`。checkoutの認証情報を残さない（`persist-credentials: false`）、Actionsは確認済みcommit SHAに固定する。`pull_request_target`でPR由来コードを実行しない。

PR検査jobはNode/npm固定 → 標準fixtureテスト → **bootstrapなし**の方針・公開日時検査 → script禁止のnpm ci → 署名・脆弱性確認 → test/buildの順とする。依存未導入の初期段階は基盤fixtureテストとbootstrap確認だけのjobを明示し、#14でlock生成後に通常検査へ切り替える。通常CIでlock欠落を自動bootstrap扱いにはしない。

依存コードが動くjobへCloudflare token・API key・その他deploy credentialsを渡さない。公開registryのみであればnpm tokenも不要。deployはレビュー済みmainへのpushから別job/environmentに限定し、承認と必要最小権限を設ける。検査jobで生成した静的成果物を渡し、deploy秘密情報を持つjobでnpm install/build/testを再実行しない。deploy CLI等の実行にも信頼済み固定ツールを使う。artifact内のファイルもPR由来の実行コードとして扱い、秘密jobで実行しない。

## 検証記録（#19）

2026-10-06、Mac arm64、Node 24.16.0 / npm 11.13.0。初回REDは拒否処理未実装のstubに対して11件中9件が意図したassertionで失敗、2件成功。実装後、設定・URL・integrity・lock・7日境界の検査はGREEN。shrinkwrap切替の追加テストも先にRED（本来拒否すべきところ成功）を確認してから、検出・拒否を実装しGREENにした。

追加の無害fixtureは一時ディレクトリ内だけでmarker.txtを書く。依存ゼロ・offlineのnpm ciを実行し、preinstall/install/postinstall/prepareがmarkerを生成しないことを確認する。明示的なfixtureコマンドではmarkerが生成されるため、無効なfixtureによる見かけの成功を防いでいる。外部パッケージを取得せず、攻撃パッケージ・実際の秘密情報は使わない。repoへの依存installはしていない。

- 標準テスト：24件成功（取得先、設定、lock経由年齢、固定時計、失敗時拒否、実npmのscript禁止、CLI環境変数上書き拒否、shrinkwrapによる切替拒否、scoped name/version対応、metadata redirect拒否、別Node実体拒否等）。
- bootstrap：成功。通常検査：lock未作成により意図どおり失敗。
- **署名audit・脆弱性audit：未実行／判定なし**。現時点は依存・lock・node_modulesがないため。#14で実依存導入後、上記手順で実行して結果を追記する。「脆弱性ゼロ」「署名確認済み」とは扱わない。
- 実registryへの年齢検査・Vite/workerd起動・CI実行：未実施。fixtureで検査基盤を確認、実依存・CIは#14／#12に引き継ぐ。

## 完了条件との対応と範囲

| #19の完了条件 | 現状と確認方法 |
| --- | --- |
| 設定・無害fixtureでscript停止／年齢／取得先を確認 | 実装済み。実npm offline marker、固定時計、URL・metadata stubで検証 |
| lock経由の回避を防ぐ | 全entryを検査。bootstrap制限、shrinkwrap拒否、integrity／ageのnested検査も確認 |
| 署名・脆弱性結果と例外手順を記録 | 未実行・判定なしと理由を記録。実施・失敗時対応・例外承認手順は整備済み |
| CIの秘密分離方針を記録 | 最小read権限・PRとdeployの分離を記録。workflowへの実装・実行は#12 |

#19の「依存導入前の対策基盤」の実装・fixture検証は完了。実依存の署名・脆弱性が確認済みという意味にはしない。実依存audit結果・スクリプト停止互換性は#14以降、CIでの実効性は#12の実装後に確認する。最終レビューでは別名／不正な型／年齢検査単体の不正lockを先にREDで再現し、修正後にGREENを確認した。実在しない日付も拒否する。

## 参照

- [npm config](https://docs.npmjs.com/cli/v11/using-npm/config/)
- [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/)
- [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/)
- [registry署名の検証](https://docs.npmjs.com/verifying-registry-signatures/)
- [GitHub Actionsの安全な利用](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)

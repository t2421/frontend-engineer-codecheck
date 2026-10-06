# 品質チェック

```sh
pnpm lint
pnpm lint:styles
pnpm format:check
pnpm typecheck
# 上の4種類をまとめて実行
pnpm check
```

ESLintはTypeScriptとVueのessential規則、StylelintはVue内styleとCSS、Prettierは整形、vue-tscはSFC・TypeScript・テスト・設定の型を検査します。`pnpm format`で整形できます。既存ADR・Design・PRDは別作業の文書として整形対象から除外しています。

## 検証

2026-10-06、Mac arm64 / Node 24.16.0 / pnpm 12.8.1で、一時Vueファイルの未使用変数、v-forのkey不足とv-if併用、不正なCSS色、整形違反、stringへのnumber代入を各チェックが検出しました。違反を削除した後は全品質チェックと単体・部品・Chromeテスト、buildが成功しました。

typescript-eslint 8.71.0の対応範囲は`>=4.8.4 <6.1.0`です。既存TypeScript 7.0.2ではvue-tscが必要とする`typescript/lib/tsc`の解決が`ERR_PACKAGE_PATH_NOT_EXPORTED`になりました。このため公開7日経過済みの6.0.3へ揃え、手書きのVue型スタブを除いて実際のSFC型を検査しています。

## 監査で未解消のリスク

Stylelintのmicromatch・fast-glob・globby経由でbraces 3.0.3が入ります。[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)（High）は深く入れ子になった波括弧パターンで処理が停止する問題です。公開済み修正版はありません。複数の依存経路がありますが、同じHigh 1件です。

2026-10-07（JST）の再確認でも、bracesの最新公開版は3.0.3、micromatchは4.0.8、fast-globは3.3.3です。Stylelint 17.16.0もこれらを依存に含むため、通常の親依存更新では解消できません。17.16.0は既存の7日待機にも未適合なので導入していません。

開発時やCIで細工されたパターンを処理すると停止するリスクが残ります。公開するアプリには含まれません。本構成のlintパターンは固定した`src/**/*.vue`・`src/**/*.css`です。このリスクと監査未合格を確認したうえで、ユーザーはStylelintを維持し、High 1件を既知のリスクとして明記して進めることを承認しました。任意パターンを受け付ける機能を追加する場合は再評価してください。公式修正版が公開されたら依存更新と監査を再確認します。

CI導入時のユーザー承認により、pnpm標準の`audit.ignore`で`GHSA-vfj7-8cjw-p6xm`だけを例外にしています。理由は通常更新で解消できないStylelint経由のbracesを維持し、固定lintパターンに限定してリスクを受容するためです。管理責任者はrepo管理者`t2421`、見直し日は**2026-10-14**。修正版・依存経路を再確認し、解消後は例外を削除します。

脆弱性は未解消です。CIは標準`pnpm audit`の終了コードをそのまま使い、例外のGHSAと標準テキスト出力（`1 ignored: 1 high`）をログ・artifactに保存します。独自checkerは使用しません。[CI監査](./CI_CD.md)は新しい指摘・通信失敗で失敗します。重大度閾値の緩和や検査無効化はありません。7日待機・scripts停止・既承認のsource-map-js限定例外は維持しています。

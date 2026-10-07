# 依存管理

Node **24.16.0** / pnpm **12.8.1**を`.nvmrc`・package.jsonで固定します。pnpmは[公式配布](https://github.com/pnpm/pnpm/releases/tag/v12.8.1)を取得し、配布物のchecksumを確認して作業shellのPATHで使います。

## 導入・更新

`pnpm-workspace.yaml`はinstall scripts停止、公開から7日（10080分）の待機、公開日時欠落時の拒否、直接依存の完全version保存を設定しています。registry・TLSは標準設定です。

1. package名・必要性・version・取得元を確認し、`pnpm add <package>@<version>`で追加します。Git・任意URL依存や未確認の`pnpm dlx/create`は外部コードの実行・取得を伴います。
2. package.json・lockfile・overrideの差分を確認し、再現導入は`pnpm install --frozen-lockfile`を使います。
3. `pnpm audit`、品質・テスト・build・ライセンスを確認します。CIも全severityを監査します。
4. scriptsや待機期間の例外が必要なら、対象版・理由・確認内容・承認・解除条件を記録して限定適用します。

`ignoreScripts`でも明示的なbuild/testやpnpmfile hookはコードを実行します。`blockExoticSubdeps`は直接Git/URL依存の全面拒否ではありません。監査成功は未知の攻撃がない保証ではなく、例外付き成功は脆弱性解消とは区別します。PRの導入・build/testにはdeploy Secretsを渡しません。

## 維持・見直しが必要な設定

| 設定                                            | 理由・解除条件                                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minimumReleaseAgeExclude: source-map-js@1.2.2` | 脆弱性修正優先の承認済み限定例外。2026-10-07 23:08:10 JST以降は7日経過するため削除可能。削除時にfrozen install・監査を再確認                                           |
| `miniflare@5.20260926.1-alpha>sharp: 0.35.5`    | [sharp High修正](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)。親依存が修正版を指定したらoverrideを削除して再検証                                                |
| LHCI関連の限定override                          | tmp・basic-ftp・browser helper・uuid・proxy-agent・argparseの修正・互換性維持。正本はpnpm-workspace.yaml。親依存更新時に不要なoverrideを解除して監査・性能計測を再検証 |
| `audit.ignore: GHSA-vfj7-8cjw-p6xm`             | Stylelint経由のbraces Highに対する承認済み例外。管理者`t2421`、見直し日**2026-10-14**                                                                                  |

[bracesの問題](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)は細工された入れ子の波括弧パターンによる処理停止です。lintの固定パターン`src/**/*.vue`・`src/**/*.css`に限定してリスクを受容しています。開発・CIにはリスクが残り、アプリ配信物には含まれません。任意パターンを受け付ける変更時は再評価し、修正版・依存経路を見直して解消後に例外を削除します。ほかの指摘と監査通信失敗はCI・本番公開を止めます。

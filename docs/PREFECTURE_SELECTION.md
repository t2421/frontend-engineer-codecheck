# 都道府県選択（Issue #24）

## 範囲と依存

最新main `def3165332b6c4e869fb5b6cf7cfb3407d9d9143`から、独立worktree `task-14/implementation`、branch `feat/issue-24-prefecture-selection`で実装した。元checkoutと別作業の`task-11/implementation`には変更していない。push・PR作成・公開・ローカルcommitは行っていない。

[Issue #24](https://github.com/t2421/frontend-engineer-codecheck/issues/24)、PRD・ADR・DESIGN・DESIGN_LINKSを確認した。適用されるAGENTS.mdとrepo固有の`.agents/skills`は元repo・worktreeに見つからなかった。ホームの`.agents/skills`にあるfrontend-patterns・tdd-workflow・verification-loopを読み取り確認し、実装・テストツールは既存ADRのVue/Vitest/Playwrightを維持した。数値のコードカバレッジは未測定。共通部品のPR #46（Checkbox）、#41（CheckboxSkeleton）、#40（StatusMessage）、#37（Button）はすべてmergedでmainに存在する。

[PR #48](https://github.com/t2421/frontend-engineer-codecheck/pull/48)はopen/draft。確認時head `bf4b1588b4001c6cdd3cc58d2c8afe022ca31958`のAPI_PROXY.mdと、同一オリジン`GET /api/v1/prefectures`、成功envelope `{ message: null, result: [{ prefCode, prefName }] }`を照合した。WorkerとSecretの設定はこの作業の対象外。

[PR #47](https://github.com/t2421/frontend-engineer-codecheck/pull/47)もopen/draft。読み取り参照した`PopulationDataPanel`の`selectedPrefectures` propsと同じcode/name構造を渡す。人口取得とグラフは実装していない。

## 変更

- `prefectureApi.ts`: 固定の同一オリジンGET。HTTP・JSON・envelope・1〜47の整数code・非空name・code重複・空一覧を検証。返却順を維持し、内部のエラー本文や例外は表示へ反射しない。本文読取を含む15秒timeoutと画面離脱のabortを使用。
- `usePrefectures.ts`: 初回loading、error、retry、ready。取得中の再試行は重複させず、scope終了後の遅延応答を反映しない。
- `PrefectureSelector.vue`: 共通CheckboxからAPI順に動的生成。親のcode集合を受け、複数選択・個別解除・全解除を通知。fieldset/legend、選択件数のstatus、モバイルの初回展開・開閉・選択維持。
- `PrefectureSelectionPanel.vue`: 共通CheckboxSkeleton 47個、共通StatusMessageとaction slotのButton、一覧を切り替える。選択した県のcode/nameをv-modelで親へ返す。
- `App.vue`: 選択県の正本を保持し、PopulationPageへ接続。population scoped slotから`selectedPrefectures`を渡し、後続で`PopulationDataPanel :selected-prefectures="selectedPrefectures"`を接続できる。
- `PopulationPage.vue`: 既存slotを維持し、選択欄の見出し・件数・解除操作をまとめて置ける`prefecture-content` slotを追加。
- `tests/e2e/fixtures/prefecture-selection.html`: 公開reviewの既存規約に合わせた合成データfixture。既定は47件、`?mode=loading`は手動解放、`?mode=error`は一度失敗して再試行で復帰。実APIを呼ばず、通常buildには含めない。出力JSONと合成操作はfixtureだけに存在する。

## デザインと画面確認

Figma `I5QdPGt1iIXNqda6KQG1r2` / `7:591`をfigma-design-to-codeスキルで参照した。8列のPC、4列の中間幅、3列の390px、2列の320px。API順、44px操作領域、選択件数、モバイル開閉を確認した。

共通部品の既存check SVGは選択欄で20×20px、error SVGは失敗案内で24×24px、すべて読み込み成功。新しい画像資産は追加していない。Figmaの選択欄操作はsecondary Buttonだが、mainの共通Buttonはprimaryのみのため既存primaryを再利用した。共通Buttonのvariant追加と既存フォントの配信方法はこの変更に含めない。

[PC](./screenshots/issue-24/synthetic-desktop.png)・[タブレット](./screenshots/issue-24/synthetic-tablet.png)・[スマートフォン](./screenshots/issue-24/synthetic-mobile.png)・[320px](./screenshots/issue-24/synthetic-narrow.png)・[モバイル閉じた状態](./screenshots/issue-24/synthetic-mobile-collapsed.png)・[loading](./screenshots/issue-24/synthetic-loading.png)・[error](./screenshots/issue-24/synthetic-error.png)。いずれも合成データのローカルChrome記録。

## 検証結果（2026-10-07 UTC）

Node 24.16.0 / native pnpm 12.8.1 / Google Chrome 154.0.8037.98を使用。native pnpmのディレクトリを作業shellのPATH先頭に置いた。frozen-lockfileで既存340 packageを再利用し、package.json・lockfile・サプライチェーン設定に差分なし。

- TDD: 一覧取得・選択・loading/error/retryの先行テスト2 suiteが未実装importで失敗し、実装後に成功。追加のabort・scope終了・47県全選択も検証。
- Vitest: 11 file / 53 test成功。API順・応答検証・複数選択・個別/全解除・連続操作・loading/error/retry・重複取得防止・離脱後の遅延成功/失敗・47県全選択と46県維持。
- Chrome E2E: 19 test成功（今回追加6件）。通常AppのrouteモックでGET・API順・Tab/Space・連続操作・HTTP失敗・Enter再試行・loading復帰。合成fixtureでは全47件と選択県通知、1440/768/390/320pxの表示、モバイル開閉、横溢れなし、API通信ゼロ。
- `pnpm check`: ESLint・Stylelint・Prettier・vue-tsc成功。
- `pnpm build`、`node .github/scripts/build-review.mjs`: 通常Worker/clientとreview fixtureのbuild成功。公開はしていない。生成したdist-reviewは既存ESLint対象に入るため、build確認後に削除してcheckを再実行した。lint設定は変更していない。
- `pnpm audit --audit-level=high`: 承認済みHigh 1件の除外のみ。監査設定は変更していない。
- `git diff --check`成功。Worker・wrangler設定・依存・lockfile・サプライチェーン方針に差分なし。

[verification.json](./screenshots/issue-24/verification.json)にChrome version、画面幅、SVG描画、モックなしAPI応答を記録した。

## 実APIの残件

モックなしのローカルGETは**404・text/plain・非JSON**。現mainのWorkerはプロキシ未実装であり、通常Appはこの応答を取得失敗として表示した。これを実API成功とは扱わない。PR #48の統合と利用可能な認証環境が整った後に、実データで一覧表示とキーボード操作を確認する必要がある。

確認用のローカルserverは停止済み。Secret値の探索・読取・出力・設定はしていない。合成fixture、Playwright routeモック、HTTP契約の照合は実上流疎通を証明しない。

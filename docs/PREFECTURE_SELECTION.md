# 都道府県選択（Issue #24）

## 範囲と依存

当初main `def3165332b6c4e869fb5b6cf7cfb3407d9d9143`から、独立worktree `task-14/implementation`、branch `feat/issue-24-prefecture-selection`で実装した。PR #53 merge後のスマホ初期closed変更は`feat/issue-24-mobile-collapsed`の追加draft PRとして扱う。元checkoutと別作業の`task-11/implementation`には変更していない。初回はローカル検証まで実施。その後ユーザー承認に沿い、日本語commit・push・main向けdraft PRを作成する。本番公開・mergeは行わない。最新main `66c58d4`（PR #47・#48・#50・#51・#52・#53 merge済み）を取り込み、Appの選択県を既存PopulationDataPanelに接続した。

[Issue #24](https://github.com/t2421/frontend-engineer-codecheck/issues/24)、PRD・ADR・DESIGN・DESIGN_LINKSを確認した。適用されるAGENTS.mdとrepo固有の`.agents/skills`は元repo・worktreeに見つからなかった。ホームの`.agents/skills`にあるfrontend-patterns・tdd-workflow・verification-loopを読み取り確認し、実装・テストツールは既存ADRのVue/Vitest/Playwrightを維持した。数値のコードカバレッジは未測定。共通部品のPR #46（Checkbox）、#41（CheckboxSkeleton）、#40（StatusMessage）、#37（Button）はすべてmergedでmainに存在する。

[PR #48](https://github.com/t2421/frontend-engineer-codecheck/pull/48)はmerged。API_PROXY.mdと、同一オリジン`GET /api/v1/prefectures`、成功envelope `{ message: null, result: [{ prefCode, prefName }] }`を照合した。WorkerとSecretの設定はこの作業の対象外。

[PR #47](https://github.com/t2421/frontend-engineer-codecheck/pull/47)は最新mainでmerged。`PopulationDataPanel`の`selectedPrefectures` propsと同じcode/name構造を渡す。人口取得とグラフは実装していない。

## 変更

- `prefectureApi.ts`: 固定の同一オリジンGET。HTTP・JSON・envelope・1〜47の整数code・非空name・code重複・空一覧を検証。返却順を維持し、内部のエラー本文や例外は表示へ反射しない。本文読取を含む15秒timeoutと画面離脱のabortを使用。
- `usePrefectures.ts`: 初回loading、error、retry、ready。取得中の再試行は重複させず、scope終了後の遅延応答を反映しない。
- `PrefectureSelector.vue`: 共通CheckboxからAPI順に動的生成。親のcode集合を受け、複数選択・個別解除・全解除を通知。fieldset/legend、選択件数のstatus、モバイルの初期closed・開閉・選択維持。
- `PrefectureSelectionPanel.vue`: 共通CheckboxSkeleton 47個、共通StatusMessageとaction slotのButton、一覧を切り替える。選択した県のcode/nameをv-modelで親へ返す。
- `App.vue`: 選択県の正本を保持し、PopulationPageへ接続。population scoped slotから`selectedPrefectures`を渡し、後続で`PopulationDataPanel :selected-prefectures="selectedPrefectures"`を既定で接続した。
- `PopulationPage.vue`: 既存slotを維持し、選択欄の見出し・件数・解除操作をまとめて置ける`prefecture-content` slotを追加。
- `tests/e2e/fixtures/prefecture-selection.html`: 公開reviewの既存規約に合わせた合成データfixture。既定は47件、`?mode=loading`は手動解放、`?mode=error`は一度失敗して再試行で復帰。実APIを呼ばず、通常buildには含めない。出力JSONと合成操作はfixtureだけに存在する。

## デザインと画面確認

Figma `I5QdPGt1iIXNqda6KQG1r2` / `7:591`をfigma-design-to-codeスキルで参照した。8列のPC、4列の中間幅、3列の390px、2列の320px。640px未満の初期状態はユーザーの追加指示に沿いclosedへ変更。API順、44px操作領域、選択件数、モバイル開閉を確認した。

共通部品の既存check SVGは選択欄で20×20px、error SVGは失敗案内で24×24px、すべて読み込み成功。新しい画像資産は追加していない。Figmaの選択欄操作はsecondary Buttonだが、mainの共通Buttonはprimaryのみのため既存primaryを再利用した。共通Buttonのvariant追加と既存フォントの配信方法はこの変更に含めない。

[PC](./screenshots/issue-24/synthetic-desktop.png)・[タブレット](./screenshots/issue-24/synthetic-tablet.png)・[スマートフォン](./screenshots/issue-24/synthetic-mobile.png)・[320px](./screenshots/issue-24/synthetic-narrow.png)・[モバイル閉じた状態](./screenshots/issue-24/synthetic-mobile-collapsed.png)・[loading](./screenshots/issue-24/synthetic-loading.png)・[error](./screenshots/issue-24/synthetic-error.png)。変更後はいずれも合成データのローカルChrome記録。[変更前PC](./screenshots/issue-24/before-main-desktop.png)・[変更前スマートフォン](./screenshots/issue-24/before-main-mobile.png)は最新main 23e7cb4のAppを変更せずにローカル表示した。

## 検証結果（2026-10-07 UTC）

Node 24.16.0 / native pnpm 12.8.1 / Google Chrome 154.0.8037.98を使用。native pnpmのディレクトリを作業shellのPATH先頭に置いた。最新mainの依存をfrozen-lockfileで導入。package.json・lockfile・サプライチェーン設定には最新mainに対する独自の差分なし。

- TDD: 一覧取得・選択・loading/error/retryの先行テスト2 suiteが未実装importで失敗し、実装後に成功。追加のabort・scope終了・47県全選択も検証。
- Vitest: 17 file / 151 test成功。review用Node test13件も成功。API順・応答検証・複数選択・個別/全解除・連続操作・loading/error/retry・重複取得防止・離脱後の遅延成功/失敗・47県全選択と46県維持。
- Chrome E2E: 79 test成功（一覧選択関連9件、アクセシビリティ検査44件）。通常AppのrouteモックでGET・API順・Tab/Space・連続操作・HTTP失敗・Enter再試行・loading復帰。合成fixtureでは全47件と選択県通知、1440/768/640/639/390/320pxの表示、モバイル初期closed・開閉、横溢れなし、API通信ゼロ。
- `pnpm check`: ESLint・Stylelint・Prettier・vue-tsc成功。
- `pnpm build`、`node .github/scripts/build-review.mjs`: 通常Worker/clientとreview fixtureのbuild成功。承認に沿いPR previewへ反映する。生成したdist-reviewは既存ESLint対象に入るため、build確認後に削除してcheckを再実行した。lint設定は変更していない。
- `pnpm audit --audit-level=high`: 承認済みHigh 1件の除外のみ。監査設定は変更していない。
- `git diff --check`成功。Worker・wrangler設定・依存・lockfile・サプライチェーン方針に差分なし。

[verification.json](./screenshots/issue-24/verification.json)にChrome version、画面幅、SVG描画、モックなしAPI応答を記録した。

## 実APIの残件

初回検証時のモックなしローカルGETは**404・text/plain・非JSON**であり、成功とは扱っていない。現在はPR #48のプロキシがmainへ統合済みだが、利用可能な認証環境での実上流疎通は未確認。実データで一覧表示とキーボード操作を確認する必要がある。

確認用のローカルserverは停止済み。Secret値の探索・読取・出力・設定はしていない。合成fixture、Playwright routeモック、HTTP契約の照合は実上流疎通を証明しない。

## スマホ初期closedへの追加変更

追加変更のpushとdraft PR作成はユーザー承認済み。PR #53は既にmerge済みのため別branchから作成する。日本語commitで初期closed変更と最新main統合を記録し、PR本文・CI・公開previewを更新する。

- 640px未満は初期closed、640px以上は常に一覧表示。スマホでの手動開閉状態は幅変更をまたいで保持する。
- `matchMedia`の同じ判定で表示と`aria-expanded`を同期。Enter/Spaceで開閉し、閉じた一覧のcheckboxはTab・アクセシビリティツリーから外れる。
- 幅変更でフォーカス中の操作が隠れる場合だけ、スマホの開閉ボタンまたはPCの先頭checkboxへフォーカスを移す。表示中の県や一覧外のフォーカスを奪わない。
- 選択県・選択件数を保持。一覧GETはresizeでも1回で、取得処理・Worker・Secret・依存は変更していない。
- TDD: 初期closedの部品テスト1件、Chromeの639/390/320px・resizeの4件が変更前に失敗し、変更後に成功。
- 最新main統合後はVitest151件・review用Node test13件、Chrome全79件。API未接続を前提にしたアクセシビリティ検査4件の失敗を確認してから、定義済み一覧APIの固定モックへ更新。県選択・全解除・開閉・loading/error/retryのaxe検査を追加し、既存の違反判定・除外なし方針を維持。
- [スマホ初期closed](./screenshots/issue-24/synthetic-mobile.png)・[展開後](./screenshots/issue-24/synthetic-mobile-expanded.png)・[選択して閉じた状態](./screenshots/issue-24/synthetic-mobile-collapsed.png)・[320px初期closed](./screenshots/issue-24/synthetic-narrow.png)を更新。いずれも合成データのローカルChrome。
- [追加検証記録](./screenshots/issue-24/mobile-initial-collapsed-verification.json)。API通信ゼロ、横溢れなし、check SVG 20×20pxの描画を確認。

最新mainのグラフ統合に伴い、Appの選択・区分接続テストではPopulationChartをstub化した。canvas描画は既存PopulationChartテストと実ブラウザE2Eで検査し、選択県props・取得回数・区分維持の検証は残す。

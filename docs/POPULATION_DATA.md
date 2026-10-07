# 人口区分と人口データ（Issue #25）

## 実装と境界

人口区分は総人口・年少人口・生産年齢人口・老年人口。初期値は総人口で、区分変更は親の県選択を変更しない。

- `PopulationDataPanel`へ`selectedPrefectures: readonly { prefCode: number; prefName: string }[]`を渡す。`App`も同じ任意propsを受け取り、未指定時は空配列。
- `usePopulationData`は現在の県選択を入力として、区分・取得状態・県別キャッシュを管理する。選択県は複製・変更せず、表示データは現在の選択からcomputedで導出する。
- `PopulationDataPanel`のdefault slotへ`{ series, category, status }`を渡す。`series`は`{ prefCode, prefName, boundaryYear, data: { year, value, rate? }[] }[]`。年は昇順、人数は元の整数値。グラフ描画・万人換算は後続処理の責務。
- 未取得県を県単位で一度取得し、全4区分を画面滞在中に保持する。取得中の再選択でも重複要求せず、区分切替・取得済み県の再選択はキャッシュを使う。
- 県未選択時は通信せず、PRDの選択案内を表示。全解除でも区分は維持する。
- 共通`StatusMessage`へ未選択・読み込み・失敗の状態と文言を渡し、`role=status/alert`で通知する。再試行アクションには共通`Button`をaction slot経由で渡す。再読み込みは現在の選択県のうち失敗した県だけを再取得する。成功済みデータは保持し、追加取得中や失敗時も後続slotへ渡す。
- 解除後の応答はキャッシュだけを更新し、選択県を書き換えない。要求IDとscope終了チェックで古い要求や破棄後の取得状態更新を防ぐ。UIには現在の選択県の状態だけを反映する。

取得関数はテスト用に`loader`を注入できる。実装コードは同一オリジンのAPIだけを利用し、依存追加・永続化はしない。

## 依存機能

初回main `2867e3c`から独立worktreeを作成した。現在はPR40・PR39マージ済みmain `def3165`を取り込んでいる。リポジトリ内にAGENTS.md・関連.agents/skillsはなかった。

**#7 / PR39はマージ済み**（main `def3165332b6c4e869fb5b6cf7cfb3407d9d9143`）。`SingleSelectGroup.vue`はmainの共通部品をそのまま使用し、mainとの差分はない。初回にPR39から無変更で取り込んだ依存差分は解消済み。

**#8 / PR40はマージ済み**（main `75aea1d`）。未選択・読み込み・失敗はmainの共通`StatusMessage`を使い、action slotへ共通`Button`を渡す。共通部品自体は変更しない。

**#24は未実装**。都道府県一覧取得・一覧UIは作成していない。Appのpropsと、`tests/preview/population-data.html`の検証専用2県入力で独立検証する。#24側の選択配列をこの入力へ接続する作業が残る。検証用チェックボックス・JSON出力はアプリ配信物に含まれない。

**#45は別タスクでローカル実装済み**。Workerには変更を加えていない。#45の記録と、下記パス・成功時envelope・失敗時HTTP statusの整合を確認した。

## API契約

[指定APIの公式仕様](https://github.com/yumemi-inc/frontend-engineer-codecheck/blob/main/docs/api.md)を参照。

`GET /api/v1/population/composition/perYear?prefCode=1`を同一オリジンに要求する。コードは1〜47の整数。`prefCode`以外のqueryや認証ヘッダーは送らない。画面側にAPIキー・VITE用Secret設定は不要。

成功時は`{ message: null, result: { boundaryYear: number, data: [{ label: string, data: [{ year: number, value: number, rate?: number }] }] } }`。ラベルで全4区分を対応付ける。全4ラベルがそれぞれ1件、空でない年別データ、整数の年・非負整数の人数、年重複なし、任意のrateは有限の0〜100を検証する。不正JSON・envelope・HTTP失敗・通信失敗は安全な固定文言の失敗へ変換し、応答本文や内部例外は画面へ出さない。

#45の400/404/405/429/503/502/504は画面で共通の失敗・手動再試行として扱う。実キー設定・探索・値の表示・上流への直接通信は今回の作業に含めていない。

## 検証結果

2026-10-06 UTC、Node 24.16.0 / native pnpm 12.8.1。固定lockfile・既存の依存セキュリティ設定を維持し、キャッシュからofflineで導入した。

- TDD: 取得処理と画面部品が存在しない状態で新規2 suiteの失敗を確認し、実装後にVitest 32件（既存14・追加18）成功。
- `pnpm check`: ESLint・Stylelint・Prettier・vue-tsc成功。
- `pnpm test:e2e`: Google Chrome 12件（既存7・追加5）成功。1440/768/390pxで4区分、キーボード、県選択維持、追加県取得、再利用、全解除時の区分維持、横溢れなしを確認。HTTP失敗からの再試行と解除後の遅延応答も成功。
- キャプチャの目視確認: [PC](./screenshots/issue-25/desktop.png)、[タブレット](./screenshots/issue-25/tablet.png)、[スマートフォン](./screenshots/issue-25/mobile.png)、[未選択](./screenshots/issue-25/empty.png)、[読み込み](./screenshots/issue-25/loading.png)、[失敗](./screenshots/issue-25/error.png)。状態アイコンは共通StatusMessageが持つFigma提供SVGを使用する。単一選択はPC横並び・スマートフォン2列。
- #45とのローカル結合: 別worktreeのWorkerを読み取りimportした一時Vitestテスト3件成功。合成Secret・mock上流・Node/jsdom上のWorker関数呼び出しで、UI→取得関数→Worker→上流の4区分保持・キャッシュ、上流403の安全な失敗表示→再試行成功、解除後の遅延成功による非復活を確認。実workerd/ブラウザ経由の結合・実API通信ではない。一時テストはrepo外のtask-11へ検証記録として移し、他worktreeは編集していない。
- `pnpm build`: Worker・client成功。
- `pnpm audit --audit-level=high`: 既存の承認済みHigh 1件除外を適用した結果で成功。除外・依存・lockfileは変更していない。
- `git diff --check`: 成功。初回検証はローカル実装まで行い、その後の承認に基づきcommit・push・draft PR作成へ進める。merge・手動デプロイは対象外。

**ブラウザの人口API検証はPlaywright routeによるモック**。本worktreeのWorkerはmainの未実装proxyのままで、#45のWorker関数とのモック結合は上記のとおり成功したが、実workerd/ブラウザ経由の結合・実APIキー設定との疎通は未検証。実APIの全4区分データとの契約確認は、別作業でSecretを設定した後に残る。VoiceOverによる音声読み上げも未確認。

## 共通StatusMessageへの置換（2026-10-07 UTC、ローカル検証）

PR40はmain `75aea1d85a04482a18610963133a6b5860ca1dc2`へマージ済み。このmainをPR47のブランチへ競合なく取り込んだ（merge commit・追加pushは未実施）。`PopulationDataPanel`の独自状態マークアップ・CSS・3アイコンを削除し、共通`StatusMessage`のstate/title/descriptionを使用する。失敗時のaction slotへ既存の共通`Button`を渡し、通信・県選択・キャッシュ・再試行ロジックは変更しない。読み上げ領域は共通部品のbusy領域の外に配置される。

追加した部品結合テストの未置換時失敗を確認後に実装し、全Vitest **47件**、Chrome E2E **16件**、`pnpm check`（lint・styles・format・typecheck）、Worker/client build、`git diff --check`が成功。選択維持・取得再利用・失敗からの再試行・解除後遅延応答の既存テストも成功した。未選択・読み込み・失敗のキャプチャを共通部品表示で更新し、目視確認した。この置換直後の検証時点ではcommit・push・Preview更新を行わず、結果を共有した。

## 承認済みPR更新と確認fixture

確認ページのentryを`tests/preview/population-data.html`へ移し、既存Review assetsの公開対象へ揃えた。公開ページは合成データを注入し、実APIへ通信せず、県選択・区分切替・キャッシュ・取得回数、次の取得の失敗/再試行・遅延応答を操作できる。画面にも合成データである旨を明記する。後続データのJSON出力は確認fixtureだけの表示。

`?mode=proxy`はPlaywright routeのAPIモック検証専用。既存の5件はこのモードで取得関数・HTTP失敗・遅延応答を検証し、追加1件は既定の合成データモードで失敗・再試行・遅延応答とAPI通信ゼロを検証する。どちらも実API疎通を証明しない。

最新main `def3165`との整合後、Vitest **52件**・Chrome **19件**・check・通常buildが成功。review buildで人口確認ページが成果物に含まれることも確認した。依存・lockfile・Worker・共通部品に#25固有の差分はない。承認に基づき日本語commit・pushと既存workflowによるPreview更新へ進める。本番公開・PRmergeは行わない。

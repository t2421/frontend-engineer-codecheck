# アクセシビリティ検査と実装ルール

[Issue #35](https://github.com/t2421/frontend-engineer-codecheck/issues/35)のうち、PRごとの自動検査を`pnpm test:e2e`で実行する。WCAG 2.2の適用可能なA・AA達成基準を参考にするが、自動検査の成功だけで準拠とは判定しない。

## 今回の対象

| 対象                                             | 表示完了の確認                     | 検査状態                     |
| ------------------------------------------------ | ---------------------------------- | ---------------------------- |
| 初期画面                                         | h1と都道府県・人口推移の領域が表示 | 1440 / 768 / 390 / 320px     |
| 既存PrefectureSelectorSkeleton・CheckboxSkeleton | statusの文言と47枠                 | 同じ4幅の部品fixture         |
| 共通Button                                       | ラベル付きボタンの表示・無効状態   | 通常・hover・キーボードfocus |

スケルトンは既存部品の独立fixtureで検査し、アプリの通信中状態を実装したものではない。初期画面は都道府県APIの契約に沿った固定モックで取得完了を待つ。県選択・全解除・スマホ開閉・一覧loading/error/retryは合成fixtureで1440/390/320pxを検査する。最新mainの人口グラフfixtureに対するempty・selected・elder・table・clearedの検査も維持する。実上流通信は自動検査の対象外。既存のスキップリンクとButtonのEnter / Space / Tab操作テストを維持する。

## 判定と成果物

`tests/e2e/accessibility.ts`の共通関数でページ全体をaxe検査する。タグは`wcag2a`・`wcag2aa`・`wcag21a`・`wcag21aa`・`wcag22aa`。ラベル・ARIA・コントラストなど自動検出可能な`violations`が1件でもあればテストとCIを失敗させる。ルール・要素の除外や既知違反の無条件許容は設けない。

判定前に全結果を各テストの`test-results/**/accessibility.json`へ保存し、HTMLレポートへ`axe-results`として添付する。`incomplete`は違反ゼロと同一視せず、`manual-review`注記とJSONを確認する。PRにルールID・対象要素・手動確認方法・結果・残件を記録する。判定不能自体ではCIを失敗させない。

Checksの`playwright-results`成果物にJSON、HTMLレポート、失敗時traceを成功・失敗とも7日間保存する。ブラウザstep未実行・run取消時は保存対象外。ローカルでHTMLを見るには`pnpm test:e2e --reporter=list,html`、続いて`pnpm exec playwright show-report`を使う。

検査自体の回帰テストは隔離HTMLにラベル欠落・不正ARIA値・低コントラストを意図的に置き、同じ判定関数が失敗して該当ルールをJSONへ残すことを確認する。そのJSONの違反は検査機構の確認用であり、アプリの違反とは区別する。

## 機能を追加するとき

`tests/e2e/accessibility.spec.ts`へ状態別ケースを追加する。`page.route('**/api/**')`で実API通信を遮断し、`GET /api/v1/prefectures`の成功envelopeを固定モックで返す。未定義のAPI通信はガードで失敗させる。新しいAPI接続時は、実装したパス・レスポンス形式に対応するモックを追加する。未定のAPI契約をここで先に決めない。

- 未選択・全解除: 県一覧と案内の表示を待って検査する。
- 一覧／人口loading: route応答を保留し、status表示後に検査する。固定時間のsleepに依存しない。
- error・再試行: routeで失敗と成功を返し、エラー表示・再試行後の表示それぞれを待って検査する。
- 選択後・区分切替・グラフ: モックデータの県名・区分と描画完了を確認して検査する。表やテキストなどの代替情報もページに含める。

ネイティブHTMLのbutton・input・label・見出し・ランドマークを優先し、ARIAは不足する意味や状態の補完に使う。ラベルと選択状態を関連付け、不要なlive通知・focus移動を避ける。色だけに県や系列の識別を依存させない。各機能を追加したPRで対応する操作・focusの回帰テストも追加する。

## PRで残す手動確認

- [ ] 自動検査の対象状態・各画面幅・成果物と`incomplete`の確認結果
- [ ] キーボードだけで主要操作を行えること、focus順序・可視性・閉じ込めの有無
- [ ] スクリーンリーダーでラベル・選択状態・loading／error通知を理解でき、重複通知がないこと
- [ ] 拡大・リフロー・各画面幅で内容と操作が失われないこと
- [ ] グラフの県・系列・年・人口値を色やマウスだけに頼らず理解できること
- [ ] 未実装・未確認・残る問題の影響と対応方針

読み上げの自然さ、focusの使いやすさ、グラフ内容理解は自動検査だけでは確かめられない。今回のCI実装はIssue #35全体の手動確認を完了させるものではない。

参考: [Playwright公式](https://playwright.dev/docs/accessibility-testing)、[axe公式API・タグ・結果](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md)。依存はMPL-2.0の`@axe-core/playwright` 4.13.0（2026-08-11公開）とaxe-core 4.13.0を導入し、[pnpm方針](./DEPENDENCY_SECURITY.md)の7日待機・scripts停止・固定versionを維持する。

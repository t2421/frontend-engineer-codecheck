# チェックボックス用スケルトン

Issue #9 の部品実装。`src/shared/ui/CheckboxSkeleton.vue` は操作要素を持たない装飾、`src/features/population/PrefectureSelectorSkeleton.vue` は47枠と読み込み通知を持つ一覧用部品。API取得、実チェックボックス生成、Appへの組み込みは含めない。親が初回読み込み中に表示し、成功・失敗時には対応する表示へ差し替える。

## デザインと依存

最新mainの `05c8718`（PR #33 マージ済み）から作成。`src/base.css` の色・余白・角丸・文字トークンを参照し、追加依存はない。Figmaの `color-skeleton-base` は既存 `color-disabled-bg` と同値の #e8edf2 のため、既存トークンを利用する。

Figma MCPで以下の実値と画像を確認した。

- [装飾部品 16:1392](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=16-1392)：幅136px、高さ44px、paddingとgap 8px、control 20px、label 56×12px、角丸4px。
- [PC一覧 16:1395](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=16-1395)：1280×432px、8列、列間8px、行間4px、padding 24px。
- [モバイル一覧 16:1549](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=16-1549)：358×942px、3列、gap 4px、padding 16px、44pxの下部案内領域。
- [タブレット 31:1655](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=31-1655)：一覧は4列・44px行。

Issue #6 は並行実装中。別worktreeの共通Checkboxの高さ44px、control 20px、padding/gap 8px、標準幅136pxとの整合を確認したが、ファイルの取り込みはしていない。Issue #6 マージ後に組み合わせる際も、一覧側が列幅を指定する。

ブレークポイントはFigma未指定。部品の配置幅に追従するcontainer queryで334 / 600 / 1100pxを選び、2 / 3 / 4 / 8列に切り替える。列幅は可変で、Figmaのcontent領域が境界を含まないことによる約1pxの差はbox-sizingを維持する。固定のパネル高さは設けず、文字の折返しにも追従する。既存フォント宣言を使用し、配信方法は変更していない。

## アクセシビリティ

装飾部品とgridは `aria-hidden="true"`。input、button、tabindex、操作イベントを持たない。読み込み文言に `role="status"` を1つ置き、バッジの重複読み上げを避ける。初期表示時の読み上げは支援技術によって異なるため、可視テキストも常に表示する。アニメーションは採用せず、通常・reduced motionとも静止する。

## 検証

Node 24.16.0、指定native pnpm 12.8.1、Chrome 154.0.8037.98で確認。

- TDD：部品未実装時の失敗後、表示・47枠・読み込み通知・非操作性の部品テスト2件が成功。既存を含むVitestは4件成功。
- `pnpm check`、`pnpm build`、既存Chrome E2E 1件を実行。
- 一時Vueページで1440 / 768 / 390 / 320pxの見た目、横溢れなし、47枠と44px行を確認。PCパネル432px、モバイルパネル942px。Tabは一覧の前後のボタン間を直接移動。
- Chromeのアクセシビリティツリーは見出し・読み込みstatus・モバイル下部案内だけを表示。reduced motionを有効にしてanimation 0件を確認。

一時ページと検証スクリプトは削除し、CSS数値をなぞる専用E2Eは追加しない。通常build・既存E2Eは最小Appを対象とし、未組み込みの部品はVitestと一時Chromeページで別途確認した。API連携後の表示切替検証は親機能の実装時に行う。既承認のbraces High 1件は今回の変更対象外。

# 共通ステータスメッセージ

`src/shared/ui/StatusMessage.vue`は通信や人口の業務判断を持たない表示部品。`state`（`empty | loading | error`）と`title`を必須、`description`を任意で受け取る。見出しは既定h3で、`headingLevel`（2〜6）を親の見出し階層に合わせて指定する。文言を部品に固定せず、一覧取得失敗にも同じ部品を使う。

任意の操作は`action` slotへ渡す。呼び出し元が共通Buttonの`click`を受けて再試行し、文言・状態・操作可否を更新する。StatusMessage自体は操作イベントを重複発火しない。API、選択保持、成功後の一覧／グラフ表示は呼び出し元の責務。

```vue
<StatusMessage
  state="error"
  title="都道府県一覧を取得できませんでした"
  description="接続を確認して、一覧を再読み込みしてください。"
  :heading-level="2"
>
  <template #action>
    <Button label="再読み込み" @click="retry" />
  </template>
</StatusMessage>
```

## 表示とアクセシビリティ

[状態一覧](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=8-879)と[状態部品](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=6-295)のdesign context／画像を参照。色・文字・余白・角丸はPR #33の共通トークンを使用する。3つのSVGはFigmaの提供資産を変更せずローカル保存した。幅は親に追従し、300pxは最小高さとするため、狭い幅や文字サイズ変更でも内容を切り捨てない。

見える見出し・説明と、非表示の読み上げ領域を備える。未選択／読み込みは`role="status"`（polite）、失敗は`role="alert"`（assertive）、全体の文言をatomicに通知する。表示部分は読み込み中`aria-busy="true"`。読み上げ領域はその外側に置くため、読み込み案内自体がbusyによって保留されない（[WAI-ARIAのaria-busy](https://www.w3.org/TR/wai-aria-1.2/#aria-busy)）。操作slotは読み上げ領域に含めず、アイコンは装飾として隠す。状態変更時も部品を維持してpropsを更新する。読み込みアイコンは回転し、`prefers-reduced-motion: reduce`では停止する。

既存データへの追加読み込みでグラフを保持する判断は親が担う。Figmaの部分失敗注記から独自の再試行方式を追加しない。

## 検証

Node 24.16.0／native pnpm 12.8.1、最新main（05c8718、PR #33反映）を使用。依存追加なし。AGENTS.md／リポジトリ固有skillは見つからなかった。

- TDD: 空の実装で部品テスト6件の失敗を確認後、状態表示4例・状態更新・slotの操作通知6件が成功。既存分を含むVitestは8件成功。
- `pnpm check`のlint・styles・format・types、`pnpm build`成功。
- Chrome E2Eは既存分を含む3件成功。Tab／Enter／Space、親の再試行通知とloadingへの更新、操作無効化、読み上げ領域の文言／役割、reduced motionを確認。
- Chromeの1440／768／390／320pxで各状態を目視。アイコン描画、文字の折返し、横溢れなし、フォーカスリングとアクセシビリティツリーを確認。実際のスクリーンリーダーによる音声読み上げは未確認。

PR #37反映後のmain（2867e3c）を取り込み、検証fixtureの再試行2操作と部品テストのaction slotは共通Buttonを使用する。fixtureの独自ボタンCSSは削除した。StatusMessage本体のslot設計と通信処理を持たない責務は維持する。

置換後の検証：check（lint・styles・format・types）、Vitest 20件、Chrome E2E 9件、build成功。StatusMessageと共通Buttonの組み合わせで、マウスクリック・Tab／Enter／Space・disabled時のクリック通知抑止とTabスキップを確認した。

自動Previewの既存ビルド対象に合わせ、状態確認fixtureは`tests/e2e/fixtures/status-message.html`へ配置する。通常の本番buildには含めない。

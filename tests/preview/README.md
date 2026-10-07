# UI 確認ページ

このディレクトリの `*.html` は `.github/scripts/build-review.mjs` により PR Preview に公開されます。通常の production build には含まれません。

HTML と、そのページだけが使う entry / Vue を同じ場所に置きます。共通の合成テストデータは `tests/fixtures/` に置きます。

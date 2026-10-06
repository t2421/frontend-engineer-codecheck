# デザインリンク一覧

要求の正本は [PRD.md](./PRD.md)。以下は画面・状態・部品を確認するための参照先であり、新しい要件を追加するものではありません。

## 画面

| 参照先 | 確認する内容 |
| --- | --- |
| [PC（1440px）](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-64) | 一覧・グラフの配置 |
| [タブレット（768px）](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=31-1655) | 中間幅での配置 |
| [スマートフォン（390px）](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-65) | 狭い幅での閲覧・操作 |
| [スマートフォン・都道府県展開](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=2-66) | 都道府県選択エリアの展開表示 |

## 状態

| 参照先 | 確認する内容 |
| --- | --- |
| [初期表示](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=31-1366) | 都道府県未選択・総人口、選択案内 |
| [都道府県一覧の読み込み](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=17-860) | 操作できないスケルトン表示 |
| [未選択・人口読み込み・一覧／人口取得失敗](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=8-879) | 状態表示と再試行 |
| [4人口区分と選択維持](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=31-2290) | 区分切替時の表示と都道府県選択の維持 |

## 共通部品

| 参照先 | 確認する内容 |
| --- | --- |
| [共通操作部品](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=4-169) | 操作部品の見た目と状態 |
| [都道府県選択部品](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=7-591) | 選択部品の見た目と状態 |
| [グラフ状態部品](https://www.figma.com/design/I5QdPGt1iIXNqda6KQG1r2?node-id=6-295) | グラフ領域の状態ごとの表示 |

## 実装時の参照メモ

- 初期表示は県未選択・総人口。区分変更時は県選択を維持し、全解除時は人口区分を維持して、グラフ領域に「都道府県を選択すると、人口の推移を確認できます」を表示します。
- 一覧読み込み中のスケルトンは操作不可。取得失敗は再試行でき、成功後は対応する一覧またはグラフに戻ります。
- 各画面幅に応じて配置を調整し、固定寸法の画面を縮小するだけにしません。実装後は実APIとGoogle Chrome最新版で値・操作・各画面幅の表示を検証します。

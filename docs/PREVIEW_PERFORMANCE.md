# Preview性能の見方

PRコメントはPC・モバイル各3回のLCP／CLS／TBT中央値と参考判定を表示します。
🟢 良好／🟡 改善が必要／🔴 不良は文字ラベルを併記し、総合は3指標の最も厳しい区分です。
判定は丸め前の値を使います。公開・計測失敗、欠損、3回未完了は⚪ 判定不可で、不良や良好に置き換えません。

| 指標                                                                                               | 良好   | 改善が必要  | 不良   |
| -------------------------------------------------------------------------------------------------- | ------ | ----------- | ------ |
| [LCP](https://web.dev/articles/lcp)                                                                | ≤2.5秒 | >2.5〜4秒   | >4秒   |
| [CLS](https://web.dev/articles/cls)                                                                | ≤0.1   | >0.1〜0.25  | >0.25  |
| [TBT](https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time)・PC | ≤150ms | >150〜350ms | >350ms |
| TBT・モバイル                                                                                      | ≤200ms | >200〜600ms | >600ms |

静的UIのラボ参考値です。実ユーザーの75パーセンタイルの合否やアプリ全体の品質保証を示しません。
TBTはCore Web VitalでもINPの実測値でもなく、操作時INP・実API待ちの最終評価は #36 に残ります。性能閾値によるmergeブロックはありません。

対象はコメントのSHAに対応する `/performance/<SHA>/` のアプリ本体で、`/` や旧SHAへfallbackしません。
PCは1350×940・RTT 40ms・10240Kbps・CPU 1倍、モバイルは412×823・RTT 150ms・1638.4Kbps・CPU 4倍。
通信／CPUはsimulate、各runでストレージ・キャッシュをリセットします。
日時・ブラウザー／Lighthouse版・対象URLと失敗ログはActions「Publish review」の計測・コメントjobで確認できます。
性能HTML／JSONはartifactに保存しません。SHA一致を確認し、専用マーカーの同じコメントを更新します。

# userscript通知からMatch結果まで

```mermaid
sequenceDiagram
    actor Participant
    participant Web as Custom Contest browser
    participant AtCoder
    participant Script as Tampermonkey userscript
    participant Server as Next.js server
    participant DB as PostgreSQL

    Web->>Server: 一回限りの接続キーを発行
    Server-->>Web: 5分有効の接続キー
    Web->>AtCoder: fragment付きURLを開く
    Script->>Script: fragmentから接続キーを読みURLから消す
    Script->>Server: 接続キーを交換
    Server-->>Script: Participant・Room限定token

    loop 直近15秒以内のhealth確認
        Script->>AtCoder: login ID・判定確認先を確認
        Script->>Server: heartbeat + health
        Server-->>Script: active Match・対象問題
    end

    Participant->>AtCoder: 対象問題を提出
    Script->>AtCoder: 対象提出の状態を確認
    Script->>Server: Pending submission
    Server->>Server: token・Participant・Match・問題・時刻を検査

    AtCoder-->>Script: 最終判定
    Script->>Script: ACKまで送信queueへ保持
    Script->>Server: Submission evidence
    Server->>Server: schema検査・重複排除・時刻検査

    alt 最初に受理した有効AC
        Server->>Server: 勝者を即時確定
        Server->>DB: Match結果・提出履歴を保存
    else AC以外の確定判定
        Server->>Server: 履歴とmiss回数を更新
    else 勝敗確定後の有効な遅着
        Server->>DB: 遅着として履歴へ追加
        Note over Server: 勝者は変更しない
    else evidence不一致
        Server-->>Script: 拒否理由
        Server-->>Web: 本人向けの修正案
    end
    Server-->>Script: ACK

    alt 時間切れ時にPendingなし
        Server->>DB: DRAWを保存
    else Pendingあり
        Server-->>Web: 最終判定を確認中
        alt 全て非AC
            Server->>DB: DRAWを保存
        else 5分以内に確認不能
            Server->>DB: 原因付きVOIDを保存し、戦績対象外にする
        end
    end
```

## 信頼境界

- ソースコード本文、コード長、別問題の提出は送信・保存しない。
- userscriptは改造可能なため、結果は「userscript確認・カジュアル対戦」と表示する。
- Fake提出はLANデモ、開発、自動テストだけで有効にし、公開版では受付経路ごと無効にする。

## AtCoderへのaccess頻度

- Custom Contestへのheartbeatは5秒間隔。これはLAN内の自前serverへ送る。
- AtCoderの判定確認先への到達確認はcacheし、最大15秒に1回とする。
- active Matchの提出一覧は5秒間隔の単一loopで確認する。heartbeatから同じ取得を重複実行しない。
- Pendingから確定への変化も次の提出一覧HTMLで確認し、同じ周期にstatus JSONを追加取得しない。同じpollが完了する前に次のpollを開始しない。
- AtCoder取得失敗時は10、20、40、最大60秒へbackoffし、`401`、`403`、`429`では直ちに60秒へ延ばす。成功した場合だけ通常間隔へ戻す。
- 最大頻度は参考実装と同じ5秒に1回以下だが、取得対象は提出一覧HTMLであり、公式公開APIではない。公開・多人数化前に`docs/security/external-service-usage.md`を再確認する。
- Userscriptの実行対象は接続専用のAtCoderトップタブだけとする。問題・提出タブには起動せず、タブ数でpoll数が増えないようにする。
- 初回接続と再接続成功のAtCoder上の通知は4秒で消し、再送・接続・判定確認の障害中だけ継続表示する。

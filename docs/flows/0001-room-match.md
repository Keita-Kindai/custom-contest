# Room作成から再戦まで

```mermaid
sequenceDiagram
    actor Host
    actor Invitee
    participant HostWeb as Host browser
    participant InviteeWeb as Invitee browser
    participant Server as Next.js server
    participant DB as PostgreSQL

    Host->>HostWeb: 条件を入力してRoom作成
    HostWeb->>Server: Room作成
    Server-->>HostWeb: Room ID・招待URL・participant key
    Invitee->>InviteeWeb: 招待URLを開く
    InviteeWeb->>Server: Room参加
    Server-->>InviteeWeb: participant key・Room snapshot

    loop 1秒間隔
        HostWeb->>Server: 最新snapshot取得
        InviteeWeb->>Server: 最新snapshot取得
        Server-->>HostWeb: snapshot + revision
        Server-->>InviteeWeb: snapshot + revision
    end

    HostWeb->>Server: READY
    InviteeWeb->>Server: READY
    Server-->>HostWeb: 開始可能
    Host->>HostWeb: 開始する
    HostWeb->>Server: Match開始要求
    Server->>Server: Host権限・両者READY・userscript接続を再検査
    Server-->>HostWeb: countdown + startsAt
    Server-->>InviteeWeb: countdown + startsAt

    alt どちらかがSTART前に中止
        HostWeb->>Server: 準備に戻る
        Server->>Server: 両者READY解除
        Server-->>HostWeb: waiting snapshot
        Server-->>InviteeWeb: waiting snapshot
    else START時刻へ到達
        HostWeb->>Server: 問題取得
        InviteeWeb->>Server: 問題取得
        Server-->>HostWeb: 対象問題・deadlineAt
        Server-->>InviteeWeb: 対象問題・deadlineAt
        Note over HostWeb,InviteeWeb: live snapshot受信後もSTARTを0.8秒表示<br/>serverの開始時刻・deadlineは変更しない
    end

    Note over HostWeb,InviteeWeb: 一時切断でもMatchとタイマーは停止しない

    Server->>DB: 完了Matchを保存
    Server-->>HostWeb: 結果snapshot
    Server-->>InviteeWeb: 結果snapshot

    HostWeb->>Server: 再戦を申し込む
    InviteeWeb->>Server: 再戦を承認
    Server->>Server: 同条件で新Match・問題再抽選
    Server-->>HostWeb: waiting snapshot
    Server-->>InviteeWeb: waiting snapshot
```

## 失敗時の補足

- snapshot取得が3秒失敗した画面は共有操作を無効にし、復旧後に最新snapshot全体を取得する。
- 古いrevisionの応答は新しい状態を上書きしない。
- Inviteeの明示的退出は席を解放し、ホストの明示的終了はRoomを閉じる。
- Waiting中はホストも確認モーダルからInviteeの席を解放できる。Countdown開始後と対戦中は実行できない。
- 対戦中ではなく両者無接続のRoomは30分後に閉じる。
- `3 → 2 → 1 → START`の後は、問題・制限時間のserver上の開始を遅らせず、clientのSTART表示だけ0.8秒保持する。

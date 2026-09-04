# ADR-0002: 日曜デモのRoom同期方式

- Status: Accepted
- Date: 2026-09-03
- Owners: User / Codex / Claude Code

## Context

2026-09-06のLANデモで、2つの独立したブラウザーへ同じRoom状態を届ける必要がある。現時点ではNext.js以外のサーバー依存がなく、`apps/realtime` にも実装はない。AtCoderの判定取得は約5秒間隔であり、対戦画面に1秒未満のpush配信が必須とは限らない。

## Decision drivers

- 2人の画面が1秒程度で同じ状態へ揃う
- LAN上の起動ポートと接続設定を増やさない
- 日曜までの実装、切断復旧、検証範囲を小さくする
- 将来push配信へ移行できる契約を保つ

## Options

### Option A: Next.js HTTP APIを1秒間隔でpolling

- WebとAPIを同じプロセス・ポートで起動する
- 追加依存なしでRoom snapshotを定期取得する
- 最大約1秒の表示遅延と定期的なHTTP要求を受け入れる

### Option B: 別NodeプロセスとSocket.IO

- Room単位のpush配信、自動再接続、ackなどを利用する
- 依存追加、別ポート、CORS、Origin検査、複数プロセスの起動が必要になる

### Option C: 標準WebSocket

- 通信規格を直接使い依存を抑えられる
- 再接続、Room振り分け、ack、snapshot再取得を独自実装する範囲が増える

## Decision

Option Aを採用する。通常時は1秒間隔で取得し、一度の失敗は再試行、3秒以上の失敗で再接続表示と共有操作の無効化を行う。復旧時は最新のRoom snapshot全体を取得する。

## Consequences

- 日曜デモでは`apps/realtime`を実装しない
- 対戦画面は1秒間隔で最新のRoom snapshotを取得する
- デモ時は単一Nodeプロセスの`next start`を使い、開発中のhot reloadによるインメモリ状態消失をデモから除外する
- クライアントは受信した時刻を加算せず、サーバーの基準時刻から表示用タイマーを計算する
- 問題はSTART前にクライアントへ配信せず、START時刻以降に取得する。初期段階ではLAN上の数百ミリ秒程度の表示差を許容する
- push配信へ移行しても、再接続時のsnapshot取得を残す

## Verification

- LAN上の2ブラウザーで、一方の操作がもう一方へ2回のpolling以内に反映される
- 一時的な取得失敗後、最新snapshotだけで同じ状態へ復帰できる
- 3秒以上取得できない場合に共有操作が無効となり、復旧時に最新snapshotへ置き換わる
- 古い応答が新しい状態を上書きしない
- デモ起動手順がWeb/APIの1ポートで完結する

## Revisit triggers

- 1秒未満の表示反映が体験上必要になる
- polling負荷が許容できない同時Room数になる
- 公開環境の複数プロセスでRoom状態を配信する
- 観戦や3人以上のContest modeを追加する

## Evidence

- `docs/product/mvp.md`
- `apps/realtime/README.md`
- `docs/security/dependency-policy.md`
- `design_handoff_ac_duel_bo1/README.md`

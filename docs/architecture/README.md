# Architecture

この場所は決定済みの全体像だけを説明します。決定理由は `docs/decisions/`、時系列は `docs/flows/` に置きます。

## 確定している基盤

- TypeScript
- Next.js App Router
- PostgreSQL
- Zodによる外部境界のruntime validation
- pnpm workspaceのmonorepo

## BO1 MVPで確定した構成

- Web UI、通常HTTP API、Roomの正本は単一のNext.js Nodeプロセスに置く
- 対戦画面はRoom snapshotを1秒間隔で取得し、復旧時はsnapshot全体へ同期する
- activeなRoomとMatchはプロセス内、完了したMatchはPostgreSQLへ保存する
- `apps/realtime`の専用Socket.IO / WebSocketサービスは初期段階では作らない
- AtCoder userscriptは検知結果をSubmission evidenceとして送り、サーバーが検査して結果を確定する
- 完了Matchと提出履歴は、Next.js server側からDrizzleと`pg`でPostgreSQLへ保存する
- HostとInviteeのブラウザーはDBへ直接接続しない
- ruleとAPIはVitest、2人のbrowser flowはPlaywright Chromium、実AtCoder連携は手動リハーサルで検証する

実装済みHTTP endpointは [`http-api.md`](http-api.md) を参照します。

## 再検討時にADRが必要な境界

- 専用realtime serviceまたは複数server processへの移行
- AtCoder提出のserver側独立検証
- browser extension込みE2Eまたはpixel単位のvisual regression

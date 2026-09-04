# Architecture Decision Records

## 作成単位

一つのADRでは、一つの境界または一つの代替可能な技術判断だけを扱います。

## 状態

- Proposed: Grilling中
- Accepted: 実装してよい
- Superseded: 新しいADRへ置換済み

## 最初にGrillする順序

1. `0001-mvp-boundary.md`: Fake ACを含む最初の縦切り
2. `0002-realtime-transport.md`: HTTP polling、Socket.IO、WebSocket
3. `0003-room-authority.md`: Room状態の正本、ブラウザーの責任、永続化
4. `0004-submission-evidence.md`: userscript通知契約、検証、再送、信頼境界
5. `0005-database-access.md`: Drizzle、Prisma、直接SQLと結果保持
6. `0006-test-strategy.md`: Vitest、Playwright、実AtCoder手動確認の境界

`0000-template.md` を複製し、根拠となる測定、公式文書、再検討条件を残します。

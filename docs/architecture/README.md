# Architecture

この場所は決定済みの全体像だけを説明します。決定理由は `docs/decisions/`、時系列は `docs/flows/` に置きます。

## 確定している基盤

- TypeScript
- Next.js App Router
- PostgreSQL
- Zodによる外部境界のruntime validation
- pnpm workspaceのmonorepo

## ADRが必要な境界

- Webプロセスとリアルタイムプロセスの分離
- Socket.IOまたは標準WebSocket
- FastifyまたはNext.js Route Handlers / Node HTTP
- DrizzleまたはPrisma
- Room状態の正本と永続化タイミング
- userscript通知の真正性、重複排除、順序
- テストランナーとブラウザE2E

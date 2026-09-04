# 2026-09-03 invite-only BO1 frontend progress

> 2026-09-04追記: この文書はfrontend単独preview時点の履歴です。backend接続、実DB保存、2ブラウザーE2Eまで完了した現在の状態は`2026-09-04-claude-takeover-complete.md`を参照してください。

## Goal

Claude Codeがbackendを並行実装できる間に、2026-09-06の友人デモで必要な主要画面と操作をNext.js上へ作る。

## Implemented

- `/`: Room作成、Room ID参加、開発用AtCoder ID、local直近Matchの空状態
- `/battle/new`: BO1、10/20/30分、ABC C/D、Difficulty目安400〜1200のRoom設定
- `/battle/join`: 6桁Room IDの正規化、貼り付け、入力不足時のdisabled
- `/battle/r/[roomId]`: Waiting、READY、host開始、3–2–1、live HUD、問題リンク、自分と相手の判定表示、Fake判定、勝敗overlay、Forfeit確認modal
- `/battle/m/[matchId]`: 限定公開結果、両者比較、カジュアル対戦表示、再戦導線
- 横幅1024px未満: PCで開く案内へ切替
- design tokens: `apps/web/tokens.css`
- Hallmark preflight/history: `.hallmark/preflight.json`, `.hallmark/log.json`

## Frontend-only boundary

`apps/web/src/app/_components/battle-room.tsx`のstateとtimerは、画面操作を確認するためのlocal previewである。勝敗の正本ではない。backend統合時は次を置き換える。

- localの`view`、READY、在室、接続、残り時間、提出履歴 → 1秒ごとのRoom snapshot
- `setView`等の共有state変更 → serverへintentを送るAPI call
- `fakeSubmission` → development/test限定Fake evidence endpoint
- 固定のproblem/result → snapshotまたは保存済みMatch response
- 固定の`Litms`/`friend_demo` → participant response

UIが勝敗を確定しているように見えるlocal codeはpreview限定であり、production接続時にserver result以外から`decided`へ遷移させない。

## Verification

- `./apps/web/node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json`: pass
- `./node_modules/.bin/eslint src/app`（`apps/web`で実行）: pass
- `./node_modules/.bin/next build`（`apps/web`で実行）: pass
- `git diff --check`: pass
- production buildで5 routesを確認: `/`, `/battle/new`, `/battle/join`, `/battle/r/[roomId]`, `/battle/m/[matchId]`

## Environment notes

- shellはNode 22.12.0で、repository指定はNode 24.19.0。
- `corepack pnpm`はregistry参照がnetwork制限で失敗したため、既存の各binaryを直接実行した。
- sandboxがlocal portのlistenを`EPERM`で拒否したため、ブラウザーによるvisual確認は未実施。production compileと静的なresponsive/accessibility reviewまで完了。

## Recommended next action

1. Claude Codeが`packages/contracts`からbackendを実装する。
2. Claudeのhandoffにあるsnapshot schemaへ`battle-room.tsx`を接続する。
3. Node 24.19.0で`pnpm check`と`pnpm test:e2e`を実行する。
4. 1024×768、1280×800、1440×900で主要状態を撮影し、文字切れとfoldを確認する。
5. 2台の端末と`Litms`・許可済み友人だけで実userscriptを手動確認する。

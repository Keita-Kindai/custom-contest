# Claude Code prompt — invite-only BO1 backend

## 推奨する起動方法

repository rootでClaude Codeを起動し、この文書の「コピー用prompt」をそのまま渡す。

```sh
claude --permission-mode acceptEdits
```

project設定の`.claude/settings.json`も`acceptEdits`を既定にしている。これはworkspace内の編集を自動承認し、検査用の`pnpm` commandだけを事前許可する。`bypassPermissions`はcontainerやVM専用の危険なmodeなので無効化している。

依存追加、外部network、DB起動などで許可が必要になり実行できない場合は、その場で待たない。ほかの実装を進め、最後に「実行できなかったcommand」「理由」「ユーザーが帰宅後に行う1手」をhandoffへ残す。

## コピー用prompt

あなたはCustom Contestのバックエンド担当です。2026-09-06に、同一LAN上の2台のChrome/Edgeから、AtCoderの実提出を使ってinvite-only BO1を完走できる縦切りを作ってください。私は外出中なので、通常のworkspace編集について確認待ちにせず進めてください。許可が必要で実行できない操作は回避し、安全にできる別作業を続け、最後にblockerとして記録してください。

最初に次を順番どおり読んでください。

1. `AGENTS.md`
2. `CLAUDE.md`
3. `CONTEXT.md`
4. `docs/product/mvp.md`
5. `docs/ai/working-agreement.md`
6. `docs/decisions/0001-mvp-boundary.md`〜`0006-test-strategy.md`
7. `docs/flows/0001-room-match.md`〜`0005-problem-selection.md`
8. `docs/design/open-questions.md`
9. `docs/ai/handoffs/2026-09-03-invite-only-bo1-grilling.md`

役割境界は厳守してください。

- あなたの担当: `packages/contracts`のZod schema、必要なら`packages/domain`、Next.js Route Handlerとserver module、process内Room/Match state、Drizzle + pg + SQL migration、固定問題JSON、`apps/userscript`、backend/unit/API test。
- Codexの担当: `apps/web/src/app`のpage、表示component、CSS、browser内だけのUI操作。既にfrontend実装が進んでいるため、page/component/CSSを全面書換えしないでください。
- shared boundary: API/eventを変える前に必ず`packages/contracts`を先に更新してください。frontendへ必要な変更は契約schemaと短い接続手順に留め、UI変更が必要ならhandoffへ書いてCodexへ返してください。
- 同じファイルに変更が見える場合は他agentの作業です。上書き、reset、checkout、cleanをしないでください。

実装順は次です。

1. contractsとdomain rule: Room作成・参加、participant key、READY、host start、countdown、START、Submission evidence、先着AC、Pending、timeout、DRAW/VOID、Forfeit、rematch。
2. Next.js server: 単一processを正本にするRoom storeと、1秒polling用snapshot API。browserからのintentを検査してstate変更し、browser自身には勝敗を決めさせない。
3. Fake evidence: `development`、`test`または明示したdemo設定だけで有効。公開productionではroute自体を拒否する。
4. userscript: Tampermonkey用。5分・一回限りのURL fragment接続keyをparticipant/Room限定tokenへ交換し、fragmentを消す。15秒heartbeat、AtCoder login ID一致、提出一覧DOMからPending/確定判定を検知、ACKまでoutbox再送、submission ID重複排除、Match+5分で破棄。
5. problem fixture: AtCoder Problems由来のABC C/D、Difficulty目安400〜1200。sourceとgeneratedAtを保存し、runtime外部APIなし。Room内でpool消化まで重複なし。seedと選択問題をMatchへ保存。
6. persistence: PostgreSQL 18、Drizzle + `pg`、review可能な連番SQL migration。完了Match/VOID/Submissionを90日保存。DB停止中もlive Match継続、5秒ごと保存retry、保存までrematch不可。
7. test: Vitestでstate/API、Playwright Chromiumの2 contextでFake evidenceによるcore flow。実AtCoder提出は自動化しない。

重要なルールです。

- 勝者は、serverが最初に受理した有効ACのparticipant。同秒でもDRAWにせず、後着ACで結果を変更しない。
- WA/TLE等にpenaltyなし。提出回数とmiss回数だけを表示用に保持。
- 制限時間時にPendingなしならDRAW。Pendingありなら最大5分待ち、全部非ACならDRAW、未解決ならVOID。
- 一時切断でtimerを止めず、自動不戦敗にしない。明示Forfeitだけが不戦敗。
- 問題はSTART前にsnapshotへ含めない。
- snapshot取得失敗3秒でfrontendが共有操作を止められる情報を返し、復旧時はfull snapshotを返す。
- source code本文とcode長は取得、送信、保存しない。
- 実データ確認は`Litms`またはその場で明示許可された友人だけ。無関係な第三者の提出をfixture代わりにしない。
- AtCoderのDOM selectorは変わり得るため、解析をpure functionとfixtureに分離し、selector不一致を「判定を確認できません」と復旧案付きで返す。
- 新しいdependencyは`docs/security/dependency-policy.md`に従い、`docs/security/dependency-inventory.md`を更新する。

frontend接続用に最後に次を残してください。

- endpoint一覧（method/path/request/response/error）
- snapshot schemaと状態遷移表
- browserが保存するparticipant keyの扱い
- pollingとretryの擬似code
- Codexが差し替えるmock箇所のファイル名
- `pnpm check`と実行できたtest結果
- 未実行項目と、ユーザーが帰宅後に行うcommand

完了時は`docs/ai/handoffs/YYYY-MM-DD-claude-backend-progress.md`へ実装内容、変更file、検証結果、既知のblockerを記録してください。勝手にcommit、push、deploy、外部serviceへの書込みはしないでください。

## なぜこの設定か

`acceptEdits`は、コード編集のたびに人を待たずに進められる一方、任意のshell commandやnetwork accessまでは無条件に許可しない。外出中の作業に必要な「止まりにくさ」と、local machine上での安全性の中間にある。

`bypassPermissions`はすべての確認を飛ばすため、通常のMac workspaceでは使わない。完全に隔離したcontainer/VMを別に用意した場合だけ候補にする。

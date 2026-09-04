# 2026-09-03 invite-only BO1 Grilling

## Goal

`design_handoff_ac_duel_bo1`と既存docsを深掘りし、2026-09-06に友人とLAN上の2端末で実AtCoder ACを使って遊べる招待制BO1の実装境界を確定する。

## Inputs

- `CONTEXT.md`
- `docs/product/mvp.md`
- `design_handoff_ac_duel_bo1/README.md`
- `design_handoff_ac_duel_bo1/AC Duel 画面設計.dc.html`
- AtCoderResultNotifier 1.0.6の公開scriptとMIT License
- Userが明示したAtCoder検証対象: `Litms`および許可された友人の提出

## Decisions already made

- Invite-only Room、2人、BO1、10/20/30分、ABC C/D、Difficulty目安400〜1200
- Roomは再利用し、結果単位をMatch、1問をRoundと呼ぶ
- 両者READY後、ホストの開始操作で`3 → 2 → 1 → START`
- 単一Next.js serverをRoomの正本とし、画面は1秒HTTP pollingで同期する
- active Room/Matchはmemory、完了Match/VOID/提出履歴はDrizzle + `pg`でPostgreSQLへ90日保存する
- Tampermonkey userscriptを必須とし、一回限りのfragment接続キーを専用tokenへ交換する
- READYには直近15秒以内のAtCoder login、ID一致、判定先access成功を要求する
- serverへ最初に届いた有効ACで即時確定し、同秒DRAW、code長、言語、誤答penaltyは使わない
- 時間内Pending submissionは時間切れ後最大5分待ち、全て非ACならDRAW、確認不能ならVOID
- Fake提出はLAN demo、開発、自動testだけで使い、公開版では無効にする
- Invite-only casual版を早く公開し、server側独立検証、自動Matchmaking、rating/rankingは後続にする
- 日曜はAtCoder Problemsから事前生成した固定JSONを使い、同じRoomで問題を重複させない
- unit/APIはVitest、2人browser flowとscreenshotはPlaywright Chromium、実AtCoderは本人が手動確認する
- visualのpixel一致や細かなanimationより、game成立、状態説明、2人同期を優先する

## Files changed

- glossary: `CONTEXT.md`
- product/design: `docs/product/mvp.md`, `docs/design/open-questions.md`
- architecture and ADR: `docs/architecture/README.md`, `docs/decisions/0001`〜`0006`
- sequence and verification flows: `docs/flows/0001`〜`0005`
- integration notes: `apps/realtime/README.md`, `apps/userscript/README.md`
- process/security: `docs/ai/working-agreement.md`, `docs/security/dependency-inventory.md`

## Verification run

- 各編集後に`git diff --check`を実行し、whitespace errorなし
- Repository codeは未実装のため、`pnpm check`とE2Eは未実行
- PostgreSQL clientは存在するが、`localhost:5432`のserverは現在停止中
- 現在のshellはNode 22.12.0で、repository指定のNode 24.19.0へ実装前に切替が必要
- user所有と判断した`memo.md`、`.memo.md.swp`、既存untracked design handoffは変更・削除していない

## Open questions

- Userによる共有理解の最終確認
- Engineering BrainにCustom ContestをProject登録するかは未確認のため、Project memoryは作成していない

## Recommended next action

Userの最終確認後に`docs/product/mvp.md`をAcceptedへ変更し、`packages/contracts`のZod schemaから実装を開始する。最初にuserscriptから最小APIへ到達するspikeで外部連携を早期確認し、次にdomain rule、Room API、2人E2E、主要UI、PostgreSQL保存の順で縦切りする。

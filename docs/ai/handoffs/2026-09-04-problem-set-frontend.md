# 2026-09-04 問題セット（精進）フロントエンド

## Goal

`design_handoff_ac_duel_bo1/Custom Contest 問題セットUX Phase1.dc.html`の12章以降にある精進用の画面を、PostgreSQLを使わずフロントだけで作る。対戦（AC Duel BO1）の日曜デモを壊さない。

最終形は、精進と対戦が一つのプラットフォームに同居する構成。この作業はその前半にあたる。

## Inputs

- `design_handoff_ac_duel_bo1/Custom Contest 問題セットUX Phase1.dc.html`
- `docs/decisions/0007-problem-set-frontend-boundary.md`
- `docs/design/open-questions.md` の DESIGN-071〜080
- 既存の`apps/web/tokens.css`（primitive層を再利用する）

## Decisions already made

ADR-0007で確定済み。

- primitive共有の2 skin。精進=light + 橙accent、対戦=現行のdark + 緑accentを維持
- 作成ウィザードは13章（Problemsを検索して1問ずつ追加）を正とする。12章の条件生成は採らない
- この段階でPostgreSQLを使わない。repository interfaceの背後をfixtureとブラウザー内保存で満たす
- トップ`/`と対戦側の画面には手を入れない。`/discover`、`/sets/*`、`/library`を独立した入口にする
- Difficulty色は灰・茶・緑・水・青・紫の6段。橙はbrand accentと競合するため使わない。色ドット・数値・色名を必ず併記する

## 触らないファイル

対戦側はCodexの担当で、日曜デモの対象。次を変更しない。

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/_components/app-shell.tsx`
- `apps/web/src/app/_components/battle-room.tsx`
- `apps/web/src/app/_components/match-result.tsx`
- `apps/web/src/app/_components/create-room-form.tsx` / `join-room-form.tsx` / `profile-card.tsx` / `recent-matches.tsx`
- `apps/web/src/app/battle/**`
- `apps/web/src/app/api/**`
- `apps/web/src/server/**`
- `packages/domain/src/room/**`

`apps/web/tokens.css`は既存の変数を消さず、skin用の定義を追加する形でだけ触る。

## 予定している配置

```
apps/web/src/app/
  discover/page.tsx                精explore・検索・フィルター
  sets/new/page.tsx                作成ウィザード（?step=1..5）
  sets/[setId]/page.tsx            セット詳細
  sets/[setId]/edit/page.tsx       ウィザード再利用
  library/page.tsx                 ?tab=created|bookmarked|liked|recent
  _practice/                       精進側のshellとcomponent（対戦側と分ける）
apps/web/src/server/sets/          repository interfaceとfixture実装
packages/contracts/src/problem-set.ts   Zod schema
```

URLの持ち方はデザインの2章に従う。ウィザードは`?step=`、ライブラリは`?tab=`と`?visibility=`で状態を持ち、リロードと戻るで復元できるようにする。

## 予定している順序

1. `packages/contracts`に問題セットのZod schemaを足す
2. skin token（light + 橙、Difficulty 6色）を`tokens.css`へ追加する
3. repository interfaceとfixture実装
4. 検索用の問題fixtureを`scripts/generate-problem-pool.mjs`と同じ方式で生成する（範囲を広げる）
5. Discover
6. セット詳細
7. 作成ウィザード（13章の検索して追加する構成）
8. ライブラリ

## Files changed

（未着手）ADRとopen questionsの記録のみ。

- `docs/decisions/0007-problem-set-frontend-boundary.md`（新規）
- `docs/design/open-questions.md`（DESIGN-071〜080を追加）
- `docs/ai/handoffs/2026-09-04-problem-set-frontend.md`（この文書）

## Verification run

- `git diff --check`: pass
- コード未変更のため`pnpm check`は前回の結果（pass）のまま

## Open questions

DESIGN-074〜080が未解決。認証、限定公開リンクの失効、いいね数の可視範囲、公開停止の主体、複製時の公開範囲、pool統合時期、モバイル対応。

いずれも画面は作れるが、実際の制御はDBと認証の導入まで効かない。UIとして先に作り、挙動はrepository実装側の課題として残す。

## Recommended next action

Userの着手指示を待つ。指示後は上の順序の1から進め、各段階で`pnpm check`と、対戦側E2Eが通ることを確認する。

# 2026-09-04 問題セット（精進）フロントエンド

## Goal

`design_handoff_ac_duel_bo1/Custom Contest 問題セットUX Phase1.dc.html`の12章以降にある精進用の画面を、PostgreSQLを使わずフロントだけで作る。対戦（AC Duel BO1）の日曜デモを壊さない。

最終形は、精進と対戦が一つのプラットフォームに同居する構成。この作業はその前半にあたる。

## Inputs

- `design_handoff_ac_duel_bo1/Custom Contest 問題セットUX Phase1.dc.html`
- `docs/decisions/0007-problem-set-frontend-boundary.md`
- `docs/design/open-questions.md` の DESIGN-071〜082
- 既存の`apps/web/tokens.css`（primitive層を再利用）

## Decisions already made

ADR-0007で確定済み。

- primitive共有の2 skin。精進=light + 橙accent、対戦=現行のdark + 緑accentを維持
- 作成は13章（Problemsを検索して1問ずつ追加）を正とする。条件生成は採らない
- この段階でPostgreSQLを使わない。repository interfaceの背後をfixtureとブラウザー内保存で満たす
- トップ`/`と対戦側の画面には手を入れない
- Difficulty色は灰・茶・緑・水・青・紫の6段。橙はbrand accentと競合するため使わない

## Files changed

新規。

- `packages/contracts/src/problem-set.ts`: 問題セット、カタログ、検索、Difficulty帯のZod schemaと定数
- `packages/domain/src/problem-catalog.ts`: 固定カタログの読み込みと検索（server専用）
- `packages/domain/src/problems/catalog.json`: 生成物。3295問・約470KB
- `scripts/generate-problem-catalog.mjs`: カタログ生成
- `apps/web/src/app/api/problems/search/route.ts`: 検索endpoint
- `apps/web/src/app/_practice/`: shell、CSS、components、repository、fixture、4画面のview
- `apps/web/src/app/discover/`, `library/`, `sets/new/`, `sets/[setId]/`, `sets/[setId]/edit/`: route
- `docs/decisions/0007-problem-set-frontend-boundary.md`

変更。

- `packages/contracts/src/index.ts`, `packages/domain/src/index.ts`: re-export追加
- `apps/web/tokens.css`: `[data-skin="practice"]`のlight skinを**追記**（既存のdark定義は変更なし）
- `docs/design/open-questions.md`: DESIGN-071〜082
- `docs/ai/handoffs/README.md`

対戦側のファイルは変更していない。`git diff --stat`に`page.tsx`、`app-shell.tsx`、`battle-*`、`api/rooms`、`api/userscript`、`server/**`、`domain/src/room/**`が出ないことで確認できる。

## 実装した画面

| URL | 内容 |
| --- | --- |
| `/discover` | 検索・タグ絞り込み・新着・いいね数が多い。検索するとカードから高密度の1行リストへ切替 |
| `/sets/[setId]` | セット詳細。収録問題、いいね、ブックマーク、共有、練習/対戦への入口 |
| `/sets/new` | 作成。Problemsを検索して1問ずつ追加、並び替え、公開範囲、下書き保存 |
| `/sets/[setId]/edit` | 同じ画面を既存セットの初期値で再利用 |
| `/library` | マイページ。作成/ブックマーク/いいね/最近使用の4タブと件数 |
| `GET /api/problems/search` | カタログ検索。`q`、`difficultyMin`、`difficultyMax`、`limit` |

## 設計上の判断

**カタログをserver側に置いた理由**: 3295問で約470KB あり、clientへ丸ごと配ると初期読み込みが重い。Route Handlerで検索し、上位20件だけ返す。DB導入時はこのhandlerの中だけをSQLへ差し替える。

**CSSのclass名を`ps-`で始めた理由**: `globals.css`（対戦側）と`.difficulty`、`.field-label`、`.field-help`、`.section-heading`、`.section-note`が衝突し、実際に詳細画面のDifficulty表示が入力欄のような枠付きで描画された。衝突した5つを`ps-`付きへ改名して解消済み。今後精進側へclassを足すときも`ps-`または`practice-`で始める。

**Difficultyがない問題**: EDPC・典型90・鉄則はratedでないため推定値がない。ABC001など古い回は`is_experimental`。どちらも「—」を出し、セット単位では「目安なし」と表示する。除外はしない。

## Verification run

- `pnpm check`: pass（lint、typecheck、Vitest 9 passed / 2 skipped、next build）
- 2 skipはPostgreSQL integration test。`DATABASE_URL`未設定のため`describe.skipIf`で除外される
- `next build`のroute一覧に`/discover`、`/library`、`/sets/new`、`/sets/[setId]`、`/sets/[setId]/edit`、`/api/problems/search`が出ることを確認
- `git diff --check`: pass
- production buildをChromeで手動確認。Discover、詳細、作成、マイページを1440幅で表示
- 作成フローを通しで確認: タイトル入力 → タグ2つ選択 → 検索結果から3問追加 → 保存 → 詳細へ遷移 → Discoverの新着とマイページの件数へ反映
- いいね・ブックマークがマイページの件数へ反映されることを確認
- 下書きがDiscoverへ出ず、マイページの「作成したセット」にだけ出ることを確認
- console errorなし
- `/`と`/battle/new`が従来どおりdark skinで表示され、精進側のtoken追加による影響がないことを確認

## Open questions

- DESIGN-074〜080: 認証、限定公開リンクの失効、いいね数の可視範囲、公開停止、複製時の公開範囲、pool統合、モバイル対応
- DESIGN-081: 作成をステップ式にするか1画面のままにするか。13章が「ステップ数の最終形は次のラウンドで確定」としている
- DESIGN-082: `is_experimental`のDifficultyを表示するか伏せるか

いずれも画面は動くが、実際の制御はDBと認証の導入まで効かない。

## 既知の制約

- 作成したセットはブラウザーのlocalStorageにだけ残る。別端末・別ブラウザーからは開けない
- 作成者名は`Litms`固定、いいね数はfixtureの値に自分の1票を足した見せかけ
- 公開範囲のUIはあるが、access制御は効かない
- 「このセットで練習する」は無効。練習画面は次のフェーズ
- 並び替えは↑↓ボタン。デザインのドラッグハンドルは表示のみで、drag & dropは未実装

## Recommended next action

1. 画面を見て、2 skinの方向性とカードの密度でよいか判断する
2. DESIGN-081（ステップ数）とDESIGN-074（認証）を決める
3. 決まったらPostgreSQLへの永続化をADRにし、`repository.ts`の実装を差し替える
4. 練習画面（`/practice/[setId]`）を別途設計する

# ADR-0007: 問題セット（精進）フロントエンドの実装境界

- Status: Accepted
- Date: 2026-09-04
- Owners: User / Codex / Claude Code

## Context

`design_handoff_ac_duel_bo1/Custom Contest 問題セットUX Phase1.dc.html` を2026-09-04に受領した。最終形は、精進（問題セットの発見・作成・共有）と対戦（AC Duel BO1）が一つのプラットフォームに同居する構成を目指す。

対戦側は2026-09-06のLANデモへ向けてCodexが実装を進めており、`pnpm check`が通る状態にある。精進側の作業がこのデモを壊してはならない。

一方、2つのデザインは前提が異なる。対戦側の`apps/web/tokens.css`は`color-scheme: dark`固定でaccentが緑（hue 145）だが、精進側のデザインはlight標準・dark同品質でaccentが橙（`#E8823A`、hue 45付近）である。和文フォントもM PLUS 1とZen Kaku Gothic Newで異なる。単純に一方へ寄せると、どちらかのデザイン成果物が参照できなくなる。

## Decision drivers

- 2026-09-06のLANデモに必要な対戦側の動作とvisualを変更しない
- 受領した2つのデザイン成果物を、どちらも実装の参照元として保てる
- PostgreSQLの設計を確定させる前にフロントの構造と導線を検証できる
- 後からDB永続化へ移行するときの変更範囲を1箇所に閉じられる
- 役割分担（Codex: 対戦、Claude Code: 精進）のもとで同じファイルを奪い合わない

## Options

### Option A: 単一skinへ統合する

- 精進側を対戦側のdark + 緑へ寄せるか、対戦側を精進側のlight + 橙へ作り替える
- プラットフォームとしての統一感は最も高い
- どちらを選んでも一方のデザインモックとの照合ができなくなる。後者は高忠実度で実装済みの対戦画面を作り直すことになり、日曜デモに影響する

### Option B: primitive共有・semantic 2 skin

- 余白、モーション、型スケールなどのprimitive層を共有し、パレットとフォントだけをモードで切り替える
- 受領デザインの10章「ゲーム表現を使う場所・使わない場所」が、精進側は静かに、対戦側はゲーム的に、と使い分けを明示している
- 2つのtoken集合を維持する必要がある

### Option C: 別アプリとして分ける

- 精進側を独立したNext.jsアプリにする
- 相互の影響は最小になるが、最終目標である単一プラットフォームから遠ざかり、共通のナビゲーションと認証を二重に持つ

## Decision

Option Bを採用する。あわせて次を確定する。

**1. 見た目は1つのdesign system・2つのskinとする。**
`--space-*`、`--dur-*`、`--ease-*`、`--radius-*`、型スケールをprimitiveとして共有する。`--color-*`と`--font-*`はskinごとに定義し、精進側をlight標準 + 橙accent、対戦側を現行のdark + 緑accentとする。既存の`tokens.css`は変数名がsemanticなため、この分離は既存の対戦画面のCSSを書き換えずに導入できる。

受領デザインの余白scaleは4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64で、既存の`--space-1`〜`--space-16`とほぼ一致する。この層は新規定義せず既存を使う。

**2. 作成ウィザードは13章を正とする。**
条件からの自動生成（12章）ではなく、AtCoder Problems相当の正データを検索し、ヒットした問題を1問ずつ追加していく構成を実装する。12章のモックは配色と密度の参照にとどめる。

**3. 最初の実装はフロントのみとし、PostgreSQLを使わない。**
問題セットの読み書きはrepository interfaceの背後に置き、初期実装をfixtureとブラウザー内保存で満たす。DB移行時の変更をこのinterfaceの実装1箇所へ閉じる。ADR-0005の「ブラウザーはDBへ直接接続しない」は維持し、この段階では永続化そのものを持たない。

**4. トップページ`/`と対戦側の画面には手を入れない。**
精進側は`/discover`、`/sets/*`、`/library`を独立した入口として作る。統合トップとグローバルナビは、日曜デモ成立後に別途決める。

## Consequences

- `apps/web/src/app/_components/app-shell.tsx`は1024px gateと「AC Duel / DEMO INVITE ONLY」を固定で持つため、精進側では使わない。精進側は別のshellを持つ
- 精進側の画面は`page.tsx`、`app-shell.tsx`、`battle-*`を変更しない。対戦側との共有はtoken primitiveのみとする
- 作成ウィザードの検索対象として、既存の`packages/domain/src/problems/abc-cd-400-1200.json`（ABC C/D・Difficulty 400〜1200の196問）では狭すぎる。検索用に範囲を広げた別のfixtureを`scripts/generate-problem-pool.mjs`と同じ方式で生成する
- 対戦側の抽選poolと精進側の検索poolは、当面別のfixtureとして併存する。統合はDB導入時に行う
- Difficulty色は受領デザインの6段（灰・茶・緑・水・青・紫）を新規tokenとして追加する。橙は brand accent と競合するため使わない
- 色だけに依存させず、色ドット・数値・色名の3点を併記する
- ブラウザー内保存は端末内にしか残らない。別端末や別ブラウザーからは同じセットを開けない。この制約はDB導入までのものとして画面に明示する
- 認証を持たないため、作成者表示といいね数は暫定値になる。公開範囲の3段階（公開／限定公開／非公開）はUIとして作るが、実際のaccess制御はDBと認証の導入まで効かない

## Verification

- `pnpm check`が通る
- 精進側の画面を追加した後も、対戦側の既存E2E（`apps/web/e2e/bo1-demo.spec.ts`）が通る
- `git diff`に`page.tsx`、`app-shell.tsx`、`battle-room.tsx`、`match-result.tsx`の変更が含まれない
- 精進側の画面がlight skin、対戦側の画面がdark skinで描画される
- repository interfaceの実装を差し替えるだけで保存先を変更できる（呼び出し側に変更が出ない）

## Amendment 2026-09-06: 色の段、作成画面の構成、公開範囲の決め方

Userレビューを受けて、Acceptedのまま次の4点を差し替える。

**1. Difficultyの色を、AtCoderのrating色そのままの8段へ広げる。**
当初は「橙はbrand accentと競合するため使わない」として、灰・茶・緑・水・青・紫の6段に丸め、2000以上をすべて紫にしていた。しかしAtCoderに紫という段は存在せず、2000以上を1色にまとめると黄・橙・赤の差が消える。利用者はrating色を毎日見ているので、独自の段は読み違いのもとになる。

灰・茶・緑・水・青・黄・橙・赤の8段にし、同じ段を問題のDifficultyと想定者の両方へ使う。橙とaccentの競合は、色そのものを避けるのではなく描き方で避ける。橙の段は塗りつぶさず、枠線と文字色だけのchipとして描くので、塗りつぶしのaccentボタンとは見分けられる。

**2. 数値表示は4桁ぶんの幅を固定する。**
Difficultyは4桁を超えない。`min-width: 4ch`と`tabular-nums`で右寄せに固定し、桁数が変わっても、挑戦状態を切り替えても、隣の列が動かないようにする。

**3. 作成画面は2カラムにし、公開範囲は保存時に選ぶ。**
検索結果の下に「追加済み」を積む構成では、20件の検索結果に押し出されて追加済みが画面外に出る。左に入力と検索、右に追加済みと集計を置く。加えて見出しへ飛ぶnavを上部に置く。

公開範囲のsegmentedを常時表示するのをやめ、「保存する」を押した時点で選ばせる。認証がない現状では公開範囲が実際には効かないため、常時表示すると機能しているように見えてしまう。下書き保存は選ばせず非公開のままにする。

**4. 想定時間の表示をやめ、想定者を足す。**
`estimateMinutes`による想定時間は、Difficultyから機械的に出した値でしかなく、読む人の判断材料にならないため画面から外し、関数ごと削除する。代わりに、作成者が選ぶ想定者（対象のrating色）を`targetBands`として持つ。

**この追記による変更点**

- `DIFFICULTY_BANDS`が6段から8段になり、`--difficulty-purple`が`--difficulty-yellow` / `--difficulty-orange` / `--difficulty-red`へ置き換わる
- 行では色名（灰・茶）を出さない。数値と色ドットで足り、色名は読み上げ用の`aria-label`へ回す。想定者のchipは色名そのものが値なので文字を出す
- 挑戦状態は一覧では印（○ ● ◐）だけにし、文字は凡例へ集約する。形が色とは独立して意味を運ぶので、色だけに依存させない方針は保てる
- `problemSetSchema`に`targetBands`が増え、`estimatedMinutes`が`problemSetSummarySchema`から消える
- 検索APIに`offset`が増え、作成画面がページ送りと一括追加を持つ

## Revisit triggers

- 統合トップとグローバルナビを実装する
- 問題セットをPostgreSQLへ永続化する
- 認証を導入し、作成者・いいね・公開範囲を実データにする
- 対戦側の抽選poolと精進側の検索poolを一つのカタログへ統合する
- モバイル幅を保証対象に含める

## Evidence

- `design_handoff_ac_duel_bo1/Custom Contest 問題セットUX Phase1.dc.html` 8章（パレット）、9章（タイポグラフィ）、10章（ゲーム表現の使い分け）、13章（作成フロー）
- `apps/web/tokens.css`
- `docs/decisions/0005-database-access.md`
- `docs/architecture/http-api.md`

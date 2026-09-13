# ADR-0012: BO3の表し方（Seriesが最大3 Matchを含む）

- Status: Accepted（設計のみ。実装は日曜デモ後）
- Date: 2026-09-05
- Owners: User / Claude Code

## Context

BO3を実装したいという要望が2026-09-05に出た。着手前に、既存の用語と既存のコードが食い違っていることが分かった。

`CONTEXT.md`は「BO1のMatchは1 Round、BO3のMatchは最大3 Roundからなる」と書いており、**MatchがRoundを含む**モデルを宣言している。

一方、コードは逆のモデルで動いている。

- `MatchState`は1問・1結果しか持たない（`packages/domain/src/room/state.ts`）。`roundIndex`はliteral型の`1`で固定されている。
- 完了したMatchは`archivedMatches`と`finishedMatches`へ積まれ、再戦は**新しいMatch**を作る。
- DBの`match_results`は`matchId`をprimary keyとし、1行が1問・1結果を持つ（`apps/web/src/server/db/schema.ts`）。
- 結果URLは`/battle/m/[matchId]`で、1つのmatchIdが1つの勝敗を指す。

つまり「BO3のMatch」は今のコードのどこにも存在しない。どちらのモデルを正とするかを決めないとBO3は書けない。

なお、この決定は2026-09-06のデモには含めない。デモはBO1のままとする。

## Decision drivers

- 2026-09-06のデモで動いている対戦の動作を変えない
- 完了Matchの永続化と限定公開URLの意味を変えない
- 遅着evidenceと保存retry（ADR-0005）の扱いを壊さない
- 用語とコードの食い違いを残さない

## Options

### Option A: Seriesが最大3 Matchを含む

- `Series`という層をMatchの上に足す。1ラウンド = 1 Matchで、それぞれが独自の`matchId`・結果行・結果URLを持つ
- 既存のMatch・永続化・URLの意味は変わらない。既存の再戦の流れがそのままラウンド送りになる
- `CONTEXT.md`のRoundの記述を書き換える必要がある

### Option B: Matchが最大3 Roundを含む

- 用語の宣言どおりになる
- `match_results`をラウンドごとの行かjsonbへ作り替える必要がある。`/battle/m/[matchId]`が1試合ではなく一連の勝負を指すことになり、保存retryと遅着evidenceの経路も書き直しになる
- 変更範囲が、デモが依存している部分と正面から重なる

## Decision

Option Aを採用する。用語のほうを実装に合わせて直す。

**1. Seriesを新しい用語として定義する。**
`CONTEXT.md`へ次を追加する。Series（シリーズ）= 同じRoomで連続して行い、勝敗を通算する一連のMatch。BO1のSeriesは1 Match、BO3のSeriesは最大3 Matchからなる。

**2. Roundの定義を書き換える。**
Round（ラウンド）= Seriesの中で何試合目かを指す位置。1つのRoundは1つのMatchとして実現する。「Matchが複数のRoundを含む」という以前の記述は誤りだったので取り消す。

**3. `MatchState.roundIndex`を`1 | 2 | 3`にする。**
literal型の`1`をやめ、Series内での位置を表す値にする。

**4. `RoomSettings.mode`を`z.enum(["BO1", "BO3"])`にする。**
既定値はBO1。Room作成時にだけ選び、Seriesの途中では変更できない。DBの`mode`列は`varchar(8)`なので`"BO3"`はそのまま入る。

**5. ラウンドの進行は両者の承認による。**
自動では進めない。既存の再戦（request / accept、`rematch`）の経路をSeries内のラウンド送りとして流用し、表示だけ「次のラウンドへ」に変える。自動送りは、片方がまだ結果を読んでいる最中に次を始めてしまう。

**6. 通算のルール。**

- WIN: その席へ1勝。2勝でSeries終了。
- DRAW: 消化したラウンドとして数えるが、どちらの勝ちにもしない。
- VOID: 消化しなかったものとして扱い、ラウンド番号を進めない。同じラウンド番号を別の問題で引き直す。ADR-0004の「VOIDは戦績対象外」と揃える。
- 3ラウンド消化して誰も2勝していない場合（1勝1敗1分けなど）、Series自体を引き分けとする。
- Forfeit: そのラウンドだけでなく、Series全体をその場で相手の勝ちにする。
- 出題済み問題の除外（`usedProblemIds`）はSeries全体にまたがる。現状の実装のままでよい。
- 片方がRoomを退出した場合、Seriesは中断とし、勝者を記録しない。

## Consequences

- 1つのSeriesから複数の`match_results`行が生まれる。Seriesを一覧で見せるには、行をSeries IDで束ねるための列が要る
- `/battle/m/[matchId]`は今までどおり1試合の結果を指す。Series全体の結果URLが要るかは、実装時に別途決める
- 対戦画面へ通算表示（`1 - 0`、「あと1勝」）を足す
- Room作成formへBO1 / BO3の選択を足す
- `mode`がenumになるため、`packages/contracts`のschemaを更新してから実装へ入る
- `apps/web/drizzle/0001_match_results.sql`の`mode varchar(8) NOT NULL CHECK (mode = 'BO1')`がBO3の保存を拒否する。制約を`CHECK (mode IN ('BO1','BO3'))`へ広げるmigrationが要る

## Verification

- BO1の既存E2E（`apps/web/e2e/bo1-demo.spec.ts`）が変更なしで通る
- BO3のSeriesで、2勝した時点で3ラウンド目が始まらない
- ラウンド中のVOIDでラウンド番号が進まず、同じ番号が別問題で引き直される
- ラウンド中のForfeitでSeriesが即座に終わる
- 1勝1敗1分けでSeriesが引き分けになる
- `CONTEXT.md`にMatchがRoundを含むという記述が残っていない

## Revisit triggers

- Seriesの結果を一覧・検索の対象にする
- BO5など3を超える形式を足す
- Series単位の戦績やratingを持つ

## Evidence

- `packages/domain/src/room/state.ts`（`MatchState.roundIndex: 1`、`archivedMatches`、`finishedMatches`）
- `apps/web/src/server/db/schema.ts`、`apps/web/drizzle/0001_match_results.sql`（`match_results`のprimary keyは`matchId`、`mode`はBO1のみ許可）
- `packages/contracts/src/common.ts`（`mode: z.literal("BO1")`）
- `docs/decisions/0004-submission-evidence.md`（VOIDは戦績対象外）
- `docs/decisions/0005-database-access.md`（保存retryと再戦の関係）

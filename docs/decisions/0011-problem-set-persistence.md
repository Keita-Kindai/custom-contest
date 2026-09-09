# ADR-0011: 問題セットの永続化とアカウントの対応づけ

- Status: Proposed
- Date: 2026-09-09
- Owners: User / Claude Code

## Context

問題セットはブラウザーのlocalStorageにしかない（ADR-0007）。端末を変えると開けず、作成者名・いいね数は`fixtures.ts`の暫定値で、公開範囲は表示だけで何も制限していない。

認証はすでに実装済みで、動いていないのはOAuthアプリの登録（環境変数）が未設定だからにすぎない（ADR-0009）。`users` / `accounts` / `sessions` / `verification_tokens`の4 tableと`0002_auth.sql`は用意してある。

足りないのは、**問題セットをアカウントへ結びつけるschema**と、それを読み書きする境界である。このADRはその形を決める。

置き場所（Neon）と公開先はADR-0010で扱う。ここでは扱わない。

### Auth.jsが作る対応づけ

新しいtableを`users`へぶら下げる前に、`users`がどう作られるかを確かめておく。

1. 利用者が「GitHubで続ける」を押し、GitHubで許可してこちらへ戻る。
2. Auth.jsが`accounts`へ1行入れる。`provider = "github"`と`provider_account_id = <GitHubの数値ID>`の組が主キー。
3. 同時に`users`へ1行入れて`id`を発行する。これがこのアプリの中でのユーザーIDになる。
4. `sessions`へsession tokenを1行入れ、cookieをブラウザーへ渡す。以降のrequestは cookie → `sessions` → `users.id` の順に引かれる。

**providerのIDとアプリのユーザーIDは別物**で、`accounts`が翻訳表になっている。同じ人がGitHubとGoogleの両方で入ると、`accounts`は2行、`users`は1行（同じemailなら）。

したがって新しいtableはすべて`users.id`を外部キーに持つ。`accounts`は参照しない。

## Decision drivers

1. 作成したセットが、どの端末からでも同じ内容で開ける。
2. 公開範囲が実際に効く。非公開のセットが他人に見えない。
3. 進み具合の記録がセットの中で閉じる（現在のUIの挙動、DESIGN-108）。
4. Neonの無料枠（1プロジェクト0.5 GB、月100 CU時間）に収まる。
5. Difficultyが更新されたとき、過去に作ったセットにも反映される。
6. `ProblemSetRepository`のinterfaceをできるだけ変えずに、実装だけ差し替える。

## Decision

### 1. ログインを必須にする

セットの作成・編集・削除・いいね・保存・AC記録は、すべてログインした利用者だけが行える。未ログインで見られるのはDiscoverと公開セットの閲覧まで。

保存先が「未ログインならlocalStorage、ログイン後はDB」と二重になる状態を作らない。どのデータがどこにあるかを追う必要がなくなる。

### 2. 作成者名は「ユーザー名」として持つ

`users.display_name`を足す。初回ログイン時にOAuthの表示名（`users.name`）を写し、あとから設定画面で変更できる。AtCoder IDをそこへ入れたい人はそう入れられる。

`users.atcoder_id`は既存のまま残す。自己申告であって身元ではなく（ADR-0009）、作成者名には使わない。使うのは対戦側とuserscriptの照合である。

初回ログイン後にAtCoder IDを尋ねる画面は作らない。

### 3. localStorageのセットは引き継がない

現在localStorageにあるのはデモ用のデータなので、アカウントへは移さない。DESIGN-090をこの内容で閉じる。

### 4. カタログをDBへ入れる

`problems` tableを作り、`packages/domain`が持つ固定JSON（3295問）から流し込む。セットは`problem_id`だけを参照する。

いまはセットごとに問題名・Difficulty・出典を丸ごとコピーしている。この形だと、AtCoder側のDifficultyが更新されても、過去に作ったセットは古い値のままになる。参照にすれば1か所の更新が全セットへ届く（判断軸5）。

3295行はNeonの0.5 GBに対して無視できる大きさで、検索をSQLで書けるようになる。

### 5. タグと想定者は配列列で持つ

`tags text[]`と`target_bands text[]`をGIN indexで引く。どちらも値の集合が固定で（タグ12種、色8段）、属性を持たない。中間tableを2枚足してもJOINが増えるだけで得るものがない。

Zodの`z.array(...)`とそのまま1対1で対応する。

### 6. 進み具合はセットの中で閉じる

`set_problem_status`の主キーを`(user_id, set_id, problem_id)`にする。同じ問題を含む別のセットは別の記録を持つ。セットは一続きの課題なので、どこまで進んだかはセットごとに数える（DESIGN-108）。

### 7. 「使用回数」を廃止する

何を数えているのか説明できない数字なので、列ごと作らない。`packages/contracts`の`useCount`も実装時に外す。いいね数と問題数で足りる。

### 8. 公開範囲を全部効かせる

| 操作 | 誰が |
| --- | --- |
| Discoverの一覧に出る | `visibility = 'public'` かつ `status = 'published'` のセットだけ |
| セット詳細を開く | 本人は常に可。他人は`status = 'published'`かつ`visibility IN ('public','unlisted')`のときだけ |
| 編集・削除 | 本人だけ |
| いいね・保存 | 詳細を開ける人 |

限定公開は`set_id`が推測できないことに依存する。`ps_` + 英数36種10文字なので、組み合わせは約3.7×10^15。総当たりで見つけられる大きさではないが、**URLを渡した相手がさらに転送すれば見られる**。これは「限定公開」の定義そのものであり、欠陥ではない。

### 9. 退会したらセットも消す

`problem_sets.owner_id`を`ON DELETE CASCADE`にする。利用者が「全部消したい」と言ったときに応えられる形を優先する。他人が保存していたセットは見えなくなる。

## Schema

Auth.jsの4 tableは`0002_auth.sql`のまま変えない。以下を`0003_problem_sets.sql`で足す。

```sql
-- 画面に出る名前。初回ログイン時に users.name から写す。
ALTER TABLE users ADD COLUMN display_name varchar(32);

-- AtCoderの問題カタログ。固定JSONから流し込む。
CREATE TABLE problems (
  problem_id     varchar(64) PRIMARY KEY,          -- taskScreenName
  contest_id     varchar(32) NOT NULL,
  problem_index  varchar(8)  NOT NULL,
  title          text        NOT NULL,
  difficulty     integer,                          -- 推定値のない問題はNULL
  source         varchar(32) NOT NULL,             -- 「ABC300 C」「EDPC B」
  tags           text[]      NOT NULL DEFAULT '{}',
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX problems_difficulty_idx ON problems (difficulty);

CREATE TABLE problem_sets (
  set_id        varchar(13) PRIMARY KEY,           -- ps_ + 英数10文字
  owner_id      text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         varchar(60) NOT NULL,
  description   varchar(400) NOT NULL DEFAULT '',
  tags          text[]      NOT NULL DEFAULT '{}',
  target_bands  text[]      NOT NULL DEFAULT '{}',
  visibility    varchar(8)  NOT NULL,
  status        varchar(9)  NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT problem_sets_visibility_check
    CHECK (visibility IN ('public', 'unlisted', 'private')),
  CONSTRAINT problem_sets_status_check
    CHECK (status IN ('draft', 'published')),
  CONSTRAINT problem_sets_tags_max CHECK (cardinality(tags) <= 6),
  CONSTRAINT problem_sets_bands_max CHECK (cardinality(target_bands) <= 8)
);
CREATE INDEX problem_sets_tags_idx  ON problem_sets USING gin (tags);
CREATE INDEX problem_sets_bands_idx ON problem_sets USING gin (target_bands);
-- Discoverの新着・人気
CREATE INDEX problem_sets_discover_idx
  ON problem_sets (visibility, status, updated_at DESC);
-- マイページの「作成したセット」
CREATE INDEX problem_sets_owner_idx ON problem_sets (owner_id, updated_at DESC);

-- セットに入っている問題と、その並び順。
CREATE TABLE problem_set_items (
  set_id     varchar(13) NOT NULL REFERENCES problem_sets(set_id) ON DELETE CASCADE,
  position   integer     NOT NULL,
  problem_id varchar(64) NOT NULL REFERENCES problems(problem_id) ON DELETE RESTRICT,
  PRIMARY KEY (set_id, position),
  CONSTRAINT problem_set_items_unique_problem UNIQUE (set_id, problem_id),
  CONSTRAINT problem_set_items_position_check CHECK (position >= 0)
);

CREATE TABLE problem_set_likes (
  user_id    text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id     varchar(13) NOT NULL REFERENCES problem_sets(set_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);
CREATE INDEX problem_set_likes_set_idx ON problem_set_likes (set_id);

CREATE TABLE problem_set_bookmarks (
  user_id    text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id     varchar(13) NOT NULL REFERENCES problem_sets(set_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);

-- 「最近使用」。開くたびに viewed_at を上書きする。1人1セット1行。
CREATE TABLE problem_set_views (
  user_id   text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id    varchar(13) NOT NULL REFERENCES problem_sets(set_id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);
CREATE INDEX problem_set_views_recent_idx ON problem_set_views (user_id, viewed_at DESC);

-- 挑戦状態。セットの中で閉じる。未着手は行を置かない。
CREATE TABLE set_problem_status (
  user_id    text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id     varchar(13) NOT NULL,
  problem_id varchar(64) NOT NULL,
  status     varchar(21) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id, problem_id),
  CONSTRAINT set_problem_status_value_check
    CHECK (status IN ('solved', 'solved_with_editorial')),
  -- セットから問題を外したら、その記録も消す。
  CONSTRAINT set_problem_status_item_fk
    FOREIGN KEY (set_id, problem_id)
    REFERENCES problem_set_items(set_id, problem_id) ON DELETE CASCADE
);
```

### 制約をDBに置いた理由

- **`CHECK (visibility IN ...)`**: Zodと二重になるが、DBは画面を通らない書き込み（migration、手作業のSQL）にも効く唯一の関門である。
- **`UNIQUE (set_id, problem_id)`**: 同じ問題を1つのセットへ2回入れられない。画面側でも防いでいるが、`set_problem_status`の外部キーがこの一意性を必要とする。
- **`ON DELETE RESTRICT`（`problems`）**: カタログから問題を消すとき、その問題を使っているセットがあれば止める。黙って穴が空くより気づける。
- **50問の上限はDBに置かない**。`cardinality`のようなCHECKでは行数を数えられず、トリガが要る。トリガ1つのために運用が複雑になるので、`problemSetSchema`（`.max(50)`）と保存前の検証で守る。

### `unsolved`の扱い

「未着手」は行を置かないことで表す。3値のうち既定値なので、記録しても容量を使うだけになる。読み出し側は行がなければ`unsolved`として扱う。この扱いは現在のlocalStorage実装と同じである。

## Repositoryとの対応

`ProblemSetRepository`（`apps/web/src/app/_practice/data/repository.ts`）のinterfaceは変えない。実装だけを差し替える。

| method | SQL |
| --- | --- |
| `discover(query)` | `problem_sets`から`visibility='public' AND status='published'`。`tags && $1`、`target_bands && $2`、`title ILIKE $3`で絞り、`sort`で並べる |
| `featured(kind)` | 同じ条件で`updated_at DESC`（new）またはいいね数の多い順（liked）を上位n件 |
| `get(setId)` | `problem_sets` + `problem_set_items` + `problems`をJOINして1件。可視性は呼び出し元のsessionで判定 |
| `save(set)` | `problem_sets`をUPSERTし、`problem_set_items`を入れ替える。1 transactionで行う |
| `remove(setId)` | `problem_sets`から1行DELETE。`items`・`likes`・`bookmarks`・`views`・`status`はCASCADEで消える |
| `library(tab)` | created=`owner_id`、bookmarked=`problem_set_bookmarks`、liked=`problem_set_likes`、recent=`problem_set_views`をJOIN |
| `toggleLike` / `toggleBookmark` | INSERT ... ON CONFLICT DO NOTHING、またはDELETE |
| `markRecent(setId)` | `problem_set_views`へUPSERT（`viewed_at = now()`） |
| `solveStatuses(setId)` | `set_problem_status`を`(user_id, set_id)`で引く |
| `setSolveStatus(...)` | `unsolved`ならDELETE、それ以外はUPSERT |

いいね数は`problem_set_likes`の`COUNT(*)`で出す。非正規化した列は置かない。件数がこの規模のうちはJOIN + GROUP BYで足り、数え直しのずれも起きない。

### 境界が1つ増える

現在の`repository.ts`は`"use client"`で、ブラウザーの中で完結している。DBはserverにしか置けないので、**間にHTTPの境界が要る**。

`/api/problem-sets/...`のRoute Handlerを足し、`repository.ts`はそこへ`fetch`する実装に変える。sessionはserver側で`auth()`から取るので、`owner_id`や`user_id`をclientから受け取らない。これは実装時の作業であり、このADRはschemaだけを決める。

## Consequences

- `packages/contracts`から`useCount`を外す。`problemSetSchema`の必須fieldなので、外すまで型が合わない。
- `authorName`（`atcoderIdSchema`）は`display_name`（最大32文字）へ変わる。AtCoder IDの形式制約（半角英数と`_`、3〜16文字）はもう当てはまらない。
- `fixtures.ts`のseedセットは、DB移行後は`problems`と`problem_sets`のseed SQLへ移すか、開発環境だけの初期データにする。
- Difficultyを参照にした結果、セットの`difficultyRange`は保存値ではなくJOINの集計になる。カタログ更新のたびに変わる。
- カタログのDifficultyを更新する手順が要る。今は固定JSONを差し替えてbuildし直すだけだが、DBへ入れると流し込みscript（`pnpm db:seed-problems`のようなもの）が要る。
- 未ログインではDiscoverの閲覧しかできない。「試しに1つ作ってみる」ができなくなる。
- Neonのscale to zeroにより、5分以上空いたあとの最初の読み込みが数百ミリ秒遅れる（ADR-0010）。

## Verification

- `0003_problem_sets.sql`を空DBへ適用でき、再実行してもschemaが壊れない。
- ログインした利用者がセットを作り、別のブラウザーで同じアカウントへログインすると同じセットが見える。
- 非公開のセットのURLを、別アカウントで開くと404になる。Discoverの一覧にも出ない。
- 限定公開のセットのURLを、別アカウントで開くと見える。Discoverの一覧には出ない。
- 同じ問題を含む2つのセットで、片方をACにしても、もう片方は未着手のまま。
- セットから問題を外すと、その問題のAC記録も消える（`set_problem_status_item_fk`）。
- アカウントを削除すると、そのユーザーのセット・いいね・保存・閲覧・AC記録がすべて消える。
- カタログにない`problem_id`をセットへ入れようとすると、外部キー違反で失敗する。
- 1セットへ51問目を入れようとすると、`problemSetSchema`が保存を止める。
- Neonのusage画面で、1週間運用したあとのstorageが0.5 GBの10%を超えない。

## Revisit triggers

- いいね数のCOUNTがDiscoverの表示を遅くする（非正規化した列を検討する）。
- タグを利用者が自由に作れるようにする（配列列では属性を持てない）。
- AtCoder IDの所有確認を認証と結びつける。
- 未ログインでもセットを作れるようにしたくなる。
- Codeforcesの問題をカタログへ入れる（DESIGN-099。`problem_id`の名前空間が衝突する）。

## Evidence

- `apps/web/src/auth.ts`、`apps/web/src/server/db/auth-schema.ts`、`apps/web/drizzle/0002_auth.sql`
- `apps/web/src/app/_practice/data/repository.ts`（現在のlocalStorage実装とinterface）
- `packages/contracts/src/problem-set.ts`（Zod契約）
- `docs/decisions/0005-database-access.md`（Drizzle + `pg`）
- `docs/decisions/0007-problem-set-frontend-boundary.md`（localStorageに閉じた理由）
- `docs/decisions/0009-deployment-and-auth.md`（Auth.jsとOAuth）
- `docs/decisions/0010-practice-first-deployment-and-database.md`（Neon、精進側の先行公開）

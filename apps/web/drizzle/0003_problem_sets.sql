-- 問題セットの永続化（ADR-0011）。
-- 何度実行しても壊れないように、すべてIF NOT EXISTSで書く。

-- 画面に出る名前。初回ログイン時に users.name（OAuthの表示名）から写す。
-- AtCoder IDは自己申告の別項目として users.atcoder_id に残り、作成者名には使わない。
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name varchar(32);

-- AtCoderの問題カタログ。packages/domain の固定JSONから流し込む。
-- 問題検索はこのtableを読まない（固定JSONを引く）。ここが要るのは、
-- problem_set_items の参照先になることと、セット表示時のJOINのため。
CREATE TABLE IF NOT EXISTS problems (
  problem_id varchar(64) PRIMARY KEY,
  contest_id varchar(32) NOT NULL,
  problem_index varchar(8) NOT NULL,
  title text NOT NULL,
  -- 非公式のDifficulty目安。EDPCや典型90のように推定値がない問題はNULL。
  difficulty integer,
  source varchar(32) NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS problems_difficulty_idx ON problems (difficulty);

CREATE TABLE IF NOT EXISTS problem_sets (
  -- ps_ + 英数36種10文字。限定公開はこのIDの推測しにくさに依存する。
  set_id varchar(13) PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(60) NOT NULL,
  description varchar(400) NOT NULL DEFAULT '',
  -- 事前定義の12種から最大6個。自由入力は受け付けない。
  tags text[] NOT NULL DEFAULT '{}',
  -- 作成者が想定した対象のrating色。押した段だけを持つ。
  target_bands text[] NOT NULL DEFAULT '{}',
  visibility varchar(8) NOT NULL,
  status varchar(9) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT problem_sets_visibility_check
    CHECK (visibility IN ('public', 'unlisted', 'private')),
  CONSTRAINT problem_sets_status_check
    CHECK (status IN ('draft', 'published')),
  CONSTRAINT problem_sets_tags_max CHECK (cardinality(tags) <= 6),
  CONSTRAINT problem_sets_bands_max CHECK (cardinality(target_bands) <= 8)
);

CREATE INDEX IF NOT EXISTS problem_sets_tags_idx ON problem_sets USING gin (tags);
CREATE INDEX IF NOT EXISTS problem_sets_bands_idx ON problem_sets USING gin (target_bands);
-- Discoverの一覧（公開かつ公開済みを新しい順）。
CREATE INDEX IF NOT EXISTS problem_sets_discover_idx
  ON problem_sets (visibility, status, updated_at DESC);
-- マイページの「作成したセット」。
CREATE INDEX IF NOT EXISTS problem_sets_owner_idx ON problem_sets (owner_id, updated_at DESC);

-- セットに入っている問題と、その並び順。
-- 1セット50問の上限はここに置かない。行数のCHECKにはトリガが要るため、
-- packages/contracts の problemSetSchema と保存前の検証で守る。
CREATE TABLE IF NOT EXISTS problem_set_items (
  set_id varchar(13) NOT NULL REFERENCES problem_sets(set_id) ON DELETE CASCADE,
  position integer NOT NULL,
  -- 使われている問題はカタログから消せない。黙って穴が空くより止める。
  problem_id varchar(64) NOT NULL REFERENCES problems(problem_id) ON DELETE RESTRICT,
  PRIMARY KEY (set_id, position),
  -- set_problem_status の複合外部キーがこの一意性を必要とする。
  CONSTRAINT problem_set_items_unique_problem UNIQUE (set_id, problem_id),
  CONSTRAINT problem_set_items_position_check CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS problem_set_items_problem_idx ON problem_set_items (problem_id);

CREATE TABLE IF NOT EXISTS problem_set_likes (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id varchar(13) NOT NULL REFERENCES problem_sets(set_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);

-- いいね数は COUNT(*) で出す。非正規化した列は置かない。
CREATE INDEX IF NOT EXISTS problem_set_likes_set_idx ON problem_set_likes (set_id);

CREATE TABLE IF NOT EXISTS problem_set_bookmarks (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id varchar(13) NOT NULL REFERENCES problem_sets(set_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);

CREATE INDEX IF NOT EXISTS problem_set_bookmarks_set_idx ON problem_set_bookmarks (set_id);

-- 「最近使用」。履歴ではなく最後に開いた時刻だけを持つので、1人1セット1行に収まる。
CREATE TABLE IF NOT EXISTS problem_set_views (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id varchar(13) NOT NULL REFERENCES problem_sets(set_id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);

CREATE INDEX IF NOT EXISTS problem_set_views_recent_idx ON problem_set_views (user_id, viewed_at DESC);

-- 挑戦状態。セットの中で閉じる（DESIGN-108）。
-- 「未着手」は既定値なので行を置かない。読み出し側は行がなければ未着手として扱う。
CREATE TABLE IF NOT EXISTS set_problem_status (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id varchar(13) NOT NULL,
  problem_id varchar(64) NOT NULL,
  status varchar(21) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id, problem_id),
  CONSTRAINT set_problem_status_value_check
    CHECK (status IN ('solved', 'solved_with_editorial')),
  -- セットから問題を外したら、そのセットでの記録も消す。
  CONSTRAINT set_problem_status_item_fk
    FOREIGN KEY (set_id, problem_id)
    REFERENCES problem_set_items(set_id, problem_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS set_problem_status_set_idx ON set_problem_status (user_id, set_id);

INSERT INTO custom_contest_migrations(version)
VALUES ('0003_problem_sets')
ON CONFLICT (version) DO NOTHING;

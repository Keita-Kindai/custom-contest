-- 外部問題リンクとセットごとの任意の色 (ADR-0015)。既存データはAtCoder、色なし。
ALTER TABLE problems ADD COLUMN IF NOT EXISTS origin varchar(8) NOT NULL DEFAULT 'atcoder';
ALTER TABLE problems ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS created_by_user_id text REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE problem_set_items ADD COLUMN IF NOT EXISTS author_band varchar(6);

CREATE UNIQUE INDEX IF NOT EXISTS problems_external_url_unique ON problems (external_url);
CREATE INDEX IF NOT EXISTS problems_external_updated_idx ON problems (origin, updated_at DESC);

DO $$ BEGIN
  ALTER TABLE problems ADD CONSTRAINT problems_origin_check
    CHECK ((origin = 'atcoder' AND external_url IS NULL) OR
           (origin = 'external' AND external_url IS NOT NULL AND difficulty IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE problem_set_items ADD CONSTRAINT problem_set_items_author_band_check
    CHECK (author_band IS NULL OR author_band IN
      ('gray', 'brown', 'green', 'cyan', 'blue', 'yellow', 'orange', 'red'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO custom_contest_migrations(version)
VALUES ('0005_external_problem_links')
ON CONFLICT (version) DO NOTHING;

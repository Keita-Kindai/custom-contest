-- Discoverの一覧をページ送りできるようにする（ADR-0011）。
--
-- いいね数はこれまでCOUNT(*)の相関サブクエリで出していた。既定の並び順が
-- `popular`なので、一覧を開くたびに該当する全行のいいね数を数えてから並べ替えていた。
-- どのindexも使えず、公開セットが増えるぶんだけ重くなる。
--
-- 数える代わりに列へ持ち、いいねの増減をtriggerで反映する。
-- 数え直しはしないので、triggerが唯一の書き手になる。

ALTER TABLE problem_sets ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

-- 既存の行を実際の数で埋める。再実行しても同じ値になる。
UPDATE problem_sets s
SET like_count = (SELECT count(*) FROM problem_set_likes l WHERE l.set_id = s.set_id)
WHERE s.like_count <> (SELECT count(*) FROM problem_set_likes l WHERE l.set_id = s.set_id);

CREATE OR REPLACE FUNCTION problem_sets_sync_like_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE problem_sets SET like_count = like_count + 1 WHERE set_id = NEW.set_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- セットごと消したときはCASCADEで親が先に消えるので、この UPDATE は0行に当たる。
    -- GREATEST は、万一二重に消えても負の数を残さないため。
    UPDATE problem_sets SET like_count = GREATEST(like_count - 1, 0) WHERE set_id = OLD.set_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS problem_set_likes_count_sync ON problem_set_likes;
CREATE TRIGGER problem_set_likes_count_sync
  AFTER INSERT OR DELETE ON problem_set_likes
  FOR EACH ROW EXECUTE FUNCTION problem_sets_sync_like_count();

-- 並び順そのものをindexへ載せる。末尾の set_id は、同じ値が並んだときに
-- ページの境界がぶれないようにするための決着用。カーソルもこの3つ組で進む。
CREATE INDEX IF NOT EXISTS problem_sets_popular_idx
  ON problem_sets (visibility, status, like_count DESC, updated_at DESC, set_id DESC);
CREATE INDEX IF NOT EXISTS problem_sets_recent_idx
  ON problem_sets (visibility, status, updated_at DESC, set_id DESC);

-- `problem_sets_discover_idx` は (visibility, status, updated_at DESC) で、
-- 上の recent index が同じ用途をより広く満たす。
DROP INDEX IF EXISTS problem_sets_discover_idx;

INSERT INTO custom_contest_migrations(version)
VALUES ('0007_problem_set_like_count')
ON CONFLICT (version) DO NOTHING;

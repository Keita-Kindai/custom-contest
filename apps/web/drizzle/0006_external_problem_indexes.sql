-- 外部問題リンクのindexを、実際に投げているqueryへ合わせる（ADR-0015）。

-- 0005が作ったindexは updated_at の順だが、一覧は created_at の降順で並べている。
-- 並び替えの列が違うindexはORDER BYに使えないので、毎回ソートが走っていた。
DROP INDEX IF EXISTS problems_external_updated_idx;
CREATE INDEX IF NOT EXISTS problems_external_created_idx
  ON problems (origin, created_at DESC);

-- 登録のたびに「この人が24時間以内に作った外部問題の数」を数える。
-- 固定カタログの約3,300行を毎回走査しないよう、数える列にindexを置く。
CREATE INDEX IF NOT EXISTS problems_external_author_idx
  ON problems (created_by_user_id, created_at DESC)
  WHERE origin = 'external';

INSERT INTO custom_contest_migrations(version)
VALUES ('0006_external_problem_indexes')
ON CONFLICT (version) DO NOTHING;

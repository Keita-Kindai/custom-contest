-- 問題記号の桁を広げる。
--
-- ABC/ARC/AGCは`A`〜`G`の1文字で収まるが、JOIの問題は`fortune_telling`のように
-- 単語がそのまま入る（現時点の最長は15文字）。varchar(8)のままではseedが失敗する。
ALTER TABLE problems ALTER COLUMN problem_index TYPE varchar(32);

INSERT INTO custom_contest_migrations(version)
VALUES ('0004_widen_problem_index')
ON CONFLICT (version) DO NOTHING;

import { readFile } from "node:fs/promises";
import { Client } from "pg";

/**
 * 問題カタログを`problems` tableへ流し込む（ADR-0011）。
 *
 * カタログの正本は`packages/domain/src/problems/catalog.json`のままで、問題検索もそこを引く。
 * このtableは`problem_set_items.problem_id`の参照先と、セット表示時のJOINのために要る。
 * つまり同じデータが2か所に載るが、DB側の書き手はこのscript1つに限る。
 *
 * deployのたびに走らせる。走らせ忘れると、カタログにある問題を選んだ利用者が
 * 外部キー違反で保存できなくなる。
 *
 * 何度実行しても同じ結果になる。既存の行はUPSERTで上書きし、
 * カタログから消えた問題はDBに残す。セットが参照している可能性があり、
 * `ON DELETE RESTRICT`で消せないため。
 *
 * `migrate.ts`と同じく、workspaceのpackageをimportしない。
 * Nodeのtype strippingは拡張子のないTypeScript importを解決できないため、
 * JSONを直接読む。
 */

type CatalogProblem = {
  problemId: string;
  contestId: string;
  problemIndex: string;
  title: string;
  difficulty: number | null;
  source: string;
  tags: string[];
};

const CATALOG_URL = new URL("../../../packages/domain/src/problems/catalog.json", import.meta.url);

/** 1回のINSERTに載せる件数。3295問をまとめて1文にすると placeholder が2万個を超える。 */
const BATCH_SIZE = 500;
const COLUMNS = 7;

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("DATABASE_URLがありません。apps/web/.env.localを設定してください。");
  process.exitCode = 1;
} else {
  const catalog = JSON.parse(await readFile(CATALOG_URL, "utf8")) as { problems: CatalogProblem[] };
  const problems = catalog.problems;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query("begin");

    for (let start = 0; start < problems.length; start += BATCH_SIZE) {
      const batch = problems.slice(start, start + BATCH_SIZE);
      const values: unknown[] = [];
      const rows = batch.map((problem, index) => {
        const base = index * COLUMNS;
        values.push(
          problem.problemId,
          problem.contestId,
          problem.problemIndex,
          problem.title,
          problem.difficulty,
          problem.source,
          problem.tags,
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
      });

      await client.query(
        `INSERT INTO problems
           (problem_id, contest_id, problem_index, title, difficulty, source, tags)
         VALUES ${rows.join(", ")}
         ON CONFLICT (problem_id) DO UPDATE SET
           contest_id = EXCLUDED.contest_id,
           problem_index = EXCLUDED.problem_index,
           title = EXCLUDED.title,
           difficulty = EXCLUDED.difficulty,
           source = EXCLUDED.source,
           tags = EXCLUDED.tags,
           updated_at = now()`,
        values,
      );
    }

    await client.query("commit");

    const { rows } = await client.query<{ count: string }>("SELECT count(*) FROM problems");
    console.log(`seeded ${problems.length} problems (problems table holds ${rows[0]?.count ?? "?"})`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error instanceof Error ? error.message : "seed failed");
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

/** 適用する順序。同じSQLを再実行しても安全な内容だけを並べる。 */
const MIGRATIONS = [
  "0001_match_results",
  "0002_auth",
  "0003_problem_sets",
  "0004_widen_problem_index",
] as const;

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("DATABASE_URLがありません。apps/web/.env.localを設定してください。");
  process.exitCode = 1;
} else {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    for (const version of MIGRATIONS) {
      const migration = await readFile(resolve(process.cwd(), `drizzle/${version}.sql`), "utf8");
      await client.query("begin");
      await client.query(migration);
      await client.query("commit");
      console.log(`applied ${version}`);
    }
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error instanceof Error ? error.message : "migration failed");
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

// type strippingは拡張子付きの相対importしか解決できないため、`.ts`まで書く。
import { databaseUrl } from "../src/server/db/ssl.ts";

/** 適用する順序。同じSQLを再実行しても安全な内容だけを並べる。 */
const MIGRATIONS = [
  "0001_match_results",
  "0002_auth",
  "0003_problem_sets",
  "0004_widen_problem_index",
  "0005_external_problem_links",
] as const;

// 生のDATABASE_URLを使わない。migrationはDDL権限を持つ唯一の接続なので、
// アプリ本体と同じverify-fullのTLSで繋ぐ。
const connectionString = databaseUrl();
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

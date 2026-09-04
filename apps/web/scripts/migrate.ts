import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("DATABASE_URLがありません。apps/web/.env.localを設定してください。");
  process.exitCode = 1;
} else {
  const client = new Client({ connectionString });
  try {
    const migration = await readFile(resolve(process.cwd(), "drizzle/0001_match_results.sql"), "utf8");
    await client.connect();
    await client.query("begin");
    await client.query(migration);
    await client.query("commit");
    console.log("applied 0001_match_results");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error(error instanceof Error ? error.message : "migration failed");
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

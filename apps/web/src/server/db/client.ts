import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

type DbGlobal = typeof globalThis & {
  __customContestPool?: Pool;
};

function databaseUrl(): string | null {
  const value = process.env.DATABASE_URL?.trim();
  return value ? value : null;
}

export function getPool(): Pool | null {
  const connectionString = databaseUrl();
  if (!connectionString) return null;

  const globalState = globalThis as DbGlobal;
  if (!globalState.__customContestPool) {
    globalState.__customContestPool = new Pool({
      connectionString,
      max: 4,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 30_000,
    });
  }
  return globalState.__customContestPool;
}

export function getDb() {
  const pool = getPool();
  return pool ? drizzle(pool, { schema }) : null;
}

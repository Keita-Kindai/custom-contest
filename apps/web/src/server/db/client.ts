import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as authSchema from "./auth-schema";
import * as practiceSchema from "./practice-schema";
import * as schema from "./schema";

/** queryで使えるようにtableをまとめて渡す。 */
const allTables = { ...schema, ...authSchema, ...practiceSchema };

type DbGlobal = typeof globalThis & {
  __customContestPool?: Pool;
};

/**
 * `sslmode`を`verify-full`へ書き換える。
 *
 * Neonの接続文字列は`sslmode=require`で届く。いまの`pg`はこれを`verify-full`
 * （サーバー証明書とホスト名の両方を検証する）として扱うが、pg 9 /
 * pg-connection-string 3からはlibpqの意味になり、「暗号化はするが検証しない」へ弱まる。
 * その差し替えは中間者攻撃を許すので、いまの強さをこちらで固定しておく。
 *
 * 置き換えるのは`sslmode=`の値だけで、接続文字列の他の部分には触れない。
 * URLとして解析し直すと、passwordのpercent encodingが変わって接続できなくなる場合がある。
 * `sslmode`を持たない接続文字列（ローカルのPostgreSQL）はそのまま返す。
 */
export function pinSslMode(connectionString: string): string {
  return connectionString.replace(/([?&]sslmode=)(prefer|require|verify-ca)\b/i, "$1verify-full");
}

function databaseUrl(): string | null {
  const value = process.env.DATABASE_URL?.trim();
  return value ? pinSslMode(value) : null;
}

export function getPool(): Pool | null {
  const connectionString = databaseUrl();
  if (!connectionString) return null;

  const globalState = globalThis as DbGlobal;
  if (!globalState.__customContestPool) {
    globalState.__customContestPool = new Pool({
      connectionString,
      /*
       * serverlessではinstanceごとにこのpoolができる。1 instanceは1 requestしか扱わず、
       * queryも直列なので1本で足りる。多めに開くとinstanceの数だけ接続が増え、
       * Neonのpooled endpointの上限へ先に当たる。
       * 常駐processで動かす開発環境では、並行するrequestのために少し余裕を持たせる。
       */
      max: process.env.VERCEL ? 1 : 4,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 30_000,
    });
  }
  return globalState.__customContestPool;
}

export function getDb() {
  const pool = getPool();
  return pool ? drizzle(pool, { schema: allTables }) : null;
}

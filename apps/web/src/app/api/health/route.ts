import { healthResponseSchema } from "@custom-contest/contracts";
import { problemPool } from "@custom-contest/domain";

import { databaseHealth } from "@/server/db/matches";
import { jsonResponse } from "@/server/http";
import { fakeEvidenceEnabled } from "@/server/rooms/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 応答は5秒だけCDNへ預ける。
 *
 * この経路は未認証で叩け、1回ごとに`select 1`とmigrationの確認の2 queryを出す。
 * 無制限に通すと、監視用の小さなendpointがそのままDBへの負荷源になる。
 * 5秒なら、落ちているのに200を返し続ける長さにはならない。
 */
const CACHE_HEADERS = { "cache-control": "public, max-age=0, s-maxage=5" };

export async function GET() {
  const database = await databaseHealth();
  const body = healthResponseSchema.parse({
    ok: database.reachable && database.migrated && problemPool.count > 0,
    database,
    fakeEvidenceEnabled: fakeEvidenceEnabled(),
    problemPool: { count: problemPool.count, generatedAt: problemPool.generatedAt },
    serverTime: new Date().toISOString(),
  });
  // 落ちているときはキャッシュしない。復旧を最大5秒隠すことになるため。
  return jsonResponse(body, body.ok ? 200 : 503, body.ok ? CACHE_HEADERS : undefined);
}

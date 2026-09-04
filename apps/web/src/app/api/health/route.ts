import { healthResponseSchema } from "@custom-contest/contracts";
import { problemPool } from "@custom-contest/domain";

import { databaseHealth } from "@/server/db/matches";
import { jsonResponse } from "@/server/http";
import { fakeEvidenceEnabled } from "@/server/rooms/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const database = await databaseHealth();
  const body = healthResponseSchema.parse({
    ok: database.reachable && database.migrated && problemPool.count > 0,
    database,
    fakeEvidenceEnabled: fakeEvidenceEnabled(),
    problemPool: { count: problemPool.count, generatedAt: problemPool.generatedAt },
    serverTime: new Date().toISOString(),
  });
  return jsonResponse(body, body.ok ? 200 : 503);
}

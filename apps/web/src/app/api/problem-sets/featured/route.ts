import { jsonResponse } from "@/server/http";
import { featured } from "@/server/problem-sets/queries";
import { handleQueryError } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 一覧と同じ理由でCDNへ預ける。判断は`/api/problem-sets`のコメントにある。 */
const CACHE_HEADERS = {
  "cache-control": "public, max-age=0, s-maxage=30, stale-while-revalidate=300",
};

/** Discoverの特集2枠。`kind`は新着かいいねの多い順。 */
export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind") === "new" ? "new" : "liked";
  try {
    return jsonResponse(await featured(kind), 200, CACHE_HEADERS);
  } catch (error) {
    return handleQueryError(error);
  }
}

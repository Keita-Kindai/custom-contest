import { jsonResponse } from "@/server/http";
import { publicTagSuggestions } from "@/server/problem-sets/queries";
import { handleQueryError } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 候補は5分だけCDNへ預ける。
 *
 * この経路は未認証で叩け、1回ごとに公開セット全体をunnestしてGROUP BYする。
 * 中身が変わるのは誰かが新しいタグを付けた公開セットを出したときだけなので、
 * 入力のたびに数え直す必要はない。
 */
const CACHE_HEADERS = { "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" };

export async function GET() {
  try {
    return jsonResponse({ tags: await publicTagSuggestions() }, 200, CACHE_HEADERS);
  } catch (error) {
    return handleQueryError(error);
  }
}

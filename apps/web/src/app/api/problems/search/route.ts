import { problemSearchQuerySchema } from "@custom-contest/contracts";
import { searchCatalog } from "@custom-contest/domain";

import { errorResponse, jsonResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * カタログは`packages/domain`の固定JSONで、デプロイのあいだ変わらない。
 * 応答はクエリ文字列だけで決まるので、そのままCDNへ預けられる。
 *
 * 預けないと、1 requestごとに約3,300問をすべて走査することになる。未認証で叩けるため、
 * 現状ここは精進側でいちばん安く計算資源を使わせる経路になっている。
 * カタログが変わるのはdeployのときだけで、deployはCDNのcacheを入れ替える。
 */
const CACHE_HEADERS = {
  "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
};

function optionalInt(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

/**
 * 問題セット作成画面の「Problems を検索して追加」用。
 * カタログは固定JSONで、runtimeに外部APIへ問い合わせない。
 * DB導入時はこのhandlerの中だけをSQLへ差し替える。
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = problemSearchQuerySchema.safeParse({
    q: params.get("q") ?? "",
    difficultyMin: optionalInt(params.get("difficultyMin")),
    difficultyMax: optionalInt(params.get("difficultyMax")),
    limit: optionalInt(params.get("limit")) ?? 20,
    offset: optionalInt(params.get("offset")) ?? 0,
  });
  if (!parsed.success) {
    return errorResponse("invalid_request", "検索条件を確認できませんでした。", null, 400);
  }
  return jsonResponse(searchCatalog(parsed.data), 200, CACHE_HEADERS);
}

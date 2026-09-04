import { problemSearchQuerySchema } from "@custom-contest/contracts";
import { searchCatalog } from "@custom-contest/domain";

import { errorResponse, jsonResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  });
  if (!parsed.success) {
    return errorResponse("invalid_request", "検索条件を確認できませんでした。", null, 400);
  }
  return jsonResponse(searchCatalog(parsed.data));
}

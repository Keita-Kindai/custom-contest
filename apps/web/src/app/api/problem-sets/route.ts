import { discoverQuerySchema, problemSetTagSchema, bandKeySchema, problemSetSortSchema } from "@custom-contest/contracts";

import { errorResponse, jsonResponse } from "@/server/http";
import { handleQueryError } from "@/server/problem-sets/route-helpers";
import { discover } from "@/server/problem-sets/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function optionalInt(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

/** Discoverの一覧。公開かつ公開済みのセットだけを返すので、ログインは要らない。 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = discoverQuerySchema.safeParse({
    q: params.get("q") ?? "",
    tags: params.getAll("tags").filter((tag) => problemSetTagSchema.safeParse(tag).success),
    bands: params.getAll("bands").filter((band) => bandKeySchema.safeParse(band).success),
    sort: problemSetSortSchema.safeParse(params.get("sort")).success ? params.get("sort") : "popular",
    difficultyMin: optionalInt(params.get("difficultyMin")),
    difficultyMax: optionalInt(params.get("difficultyMax")),
  });
  if (!parsed.success) {
    return errorResponse("invalid_request", "検索条件を確認できませんでした。", null, 400);
  }

  try {
    return jsonResponse(await discover(parsed.data));
  } catch (error) {
    return handleQueryError(error);
  }
}

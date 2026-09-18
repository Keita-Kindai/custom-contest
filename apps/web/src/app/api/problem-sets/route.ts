import {
  discoverQuerySchema,
  bandKeySchema,
  problemSetCreateSchema,
  problemSetSortSchema,
} from "@custom-contest/contracts";

import { errorResponse, isErrorResponse, jsonResponse, parseBody } from "@/server/http";
import { handleQueryError, requireViewer } from "@/server/problem-sets/route-helpers";
import { createSet, discover, existingProblemIds, getSet } from "@/server/problem-sets/queries";

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
    tags: params.getAll("tags"),
    bands: params.getAll("bands").filter((band) => bandKeySchema.safeParse(band).success),
    sort: problemSetSortSchema.safeParse(params.get("sort")).success ? params.get("sort") : "popular",
    difficultyMin: optionalInt(params.get("difficultyMin")),
    difficultyMax: optionalInt(params.get("difficultyMax")),
    cursor: params.get("cursor"),
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

/** 新規作成。`setId`はserverが決めるので、bodyには含めない。 */
export async function POST(request: Request) {
  const viewer = await requireViewer();
  if (isErrorResponse(viewer)) return viewer;

  const body = await parseBody(request, problemSetCreateSchema);
  if (isErrorResponse(body)) return body;

  try {
    // カタログにない問題は外部キー違反になる。先に見つけて理由を返す。
    const ids = body.problems.map((problem) => problem.problemId);
    const known = await existingProblemIds(ids);
    if (ids.some((id) => !known.has(id))) {
      return errorResponse(
        "invalid_request",
        "カタログにない問題が含まれています。",
        "画面を再読み込みして、問題を選び直してください。",
        400,
      );
    }

    const setId = await createSet(body, viewer);
    return jsonResponse(await getSet(setId, viewer), 201);
  } catch (error) {
    return handleQueryError(error);
  }
}

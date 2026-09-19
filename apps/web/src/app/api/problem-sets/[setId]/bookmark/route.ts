import { errorResponse, isErrorResponse, jsonResponse } from "@/server/http";
import { getSet, toggleBookmark } from "@/server/problem-sets/queries";
import { handleQueryError, requireWriter } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 保存の付け外し。押すたびに反転する。 */
export async function POST(request: Request, { params }: { params: Promise<{ setId: string }> }) {
  const viewer = await requireWriter(request);
  if (isErrorResponse(viewer)) return viewer;

  const { setId } = await params;
  try {
    if (!(await getSet(setId, viewer))) {
      return errorResponse("set_not_found", "この問題セットは見つかりませんでした。", null, 404);
    }
    return jsonResponse({ bookmarked: await toggleBookmark(setId, viewer) });
  } catch (error) {
    return handleQueryError(error);
  }
}

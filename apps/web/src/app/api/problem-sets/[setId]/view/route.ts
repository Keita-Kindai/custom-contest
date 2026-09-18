import { errorResponse, isErrorResponse, jsonResponse } from "@/server/http";
import { getSet, markRecent } from "@/server/problem-sets/queries";
import { handleQueryError, requireWriter } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 「最近使用」の記録。開いた時刻を上書きする。 */
export async function POST(request: Request, { params }: { params: Promise<{ setId: string }> }) {
  const viewer = await requireWriter(request);
  if (isErrorResponse(viewer)) return viewer;

  const { setId } = await params;
  try {
    if (!(await getSet(setId, viewer))) {
      return errorResponse("set_not_found", "この問題セットは見つかりませんでした。", null, 404);
    }
    await markRecent(setId, viewer);
    return jsonResponse({ ok: true });
  } catch (error) {
    return handleQueryError(error);
  }
}

import { solveStatusUpdateSchema } from "@custom-contest/contracts";

import { errorResponse, isErrorResponse, jsonResponse, parseBody } from "@/server/http";
import { getSet, setSolveStatus, solveStatuses } from "@/server/problem-sets/queries";
import { handleQueryError, requireViewer } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ setId: string }> };

/** このセットの中の挑戦状態。 */
export async function GET(_request: Request, { params }: Params) {
  const viewer = await requireViewer();
  if (isErrorResponse(viewer)) return viewer;

  const { setId } = await params;
  try {
    return jsonResponse(await solveStatuses(setId, viewer));
  } catch (error) {
    return handleQueryError(error);
  }
}

/**
 * 1問の状態を書き換える。
 * セットに入っていない問題は複合外部キーで弾かれるので、ここでは開けるかどうかだけ確かめる。
 */
export async function PUT(request: Request, { params }: Params) {
  const viewer = await requireViewer();
  if (isErrorResponse(viewer)) return viewer;

  const { setId } = await params;
  const body = await parseBody(request, solveStatusUpdateSchema);
  if (isErrorResponse(body)) return body;

  try {
    const set = await getSet(setId, viewer);
    if (!set) return errorResponse("set_not_found", "この問題セットは見つかりませんでした。", null, 404);
    if (!set.problems.some((problem) => problem.problemId === body.problemId)) {
      return errorResponse("invalid_request", "このセットに含まれない問題です。", null, 400);
    }
    return jsonResponse(await setSolveStatus(setId, body.problemId, body.status, viewer));
  } catch (error) {
    return handleQueryError(error);
  }
}

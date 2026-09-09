import { isErrorResponse, jsonResponse } from "@/server/http";
import { allSolveStatuses } from "@/server/problem-sets/queries";
import { handleQueryError, requireViewer } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 全セットぶんの挑戦状態。マイページが進み具合で分けるときに使う。 */
export async function GET() {
  const viewer = await requireViewer();
  if (isErrorResponse(viewer)) return viewer;

  try {
    return jsonResponse(await allSolveStatuses(viewer));
  } catch (error) {
    return handleQueryError(error);
  }
}

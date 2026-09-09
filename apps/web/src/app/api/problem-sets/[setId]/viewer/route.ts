import { isErrorResponse, jsonResponse } from "@/server/http";
import { viewerState } from "@/server/problem-sets/queries";
import { handleQueryError, requireViewer } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** このセットに自分がいいね・保存をしているか。 */
export async function GET(_request: Request, { params }: { params: Promise<{ setId: string }> }) {
  const viewer = await requireViewer();
  if (isErrorResponse(viewer)) return viewer;

  const { setId } = await params;
  try {
    return jsonResponse(await viewerState(setId, viewer));
  } catch (error) {
    return handleQueryError(error);
  }
}

import { isErrorResponse, jsonResponse } from "@/server/http";
import { counts } from "@/server/problem-sets/queries";
import { handleQueryError, requireViewer } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** マイページ上部の件数。 */
export async function GET() {
  const viewer = await requireViewer();
  if (isErrorResponse(viewer)) return viewer;

  try {
    return jsonResponse(await counts(viewer));
  } catch (error) {
    return handleQueryError(error);
  }
}

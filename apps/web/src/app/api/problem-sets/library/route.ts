import { libraryTabSchema } from "@custom-contest/contracts";

import { errorResponse, isErrorResponse, jsonResponse } from "@/server/http";
import { library } from "@/server/problem-sets/queries";
import { handleQueryError, requireViewer } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** マイページ。自分のものしか返さないのでログインが要る。 */
export async function GET(request: Request) {
  const viewer = await requireViewer();
  if (isErrorResponse(viewer)) return viewer;

  const tab = libraryTabSchema.safeParse(new URL(request.url).searchParams.get("tab"));
  if (!tab.success) return errorResponse("invalid_request", "タブを確認できませんでした。", null, 400);

  try {
    return jsonResponse(await library(tab.data, viewer));
  } catch (error) {
    return handleQueryError(error);
  }
}

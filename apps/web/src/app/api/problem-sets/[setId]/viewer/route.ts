import { jsonResponse } from "@/server/http";
import { viewerState } from "@/server/problem-sets/queries";
import { handleQueryError, optionalViewer } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * このセットに対する自分の関係（持ち主か、いいね済みか、保存済みか）。
 * 未ログインでも呼べる。その場合はすべてfalseになる。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  try {
    return jsonResponse(await viewerState(setId, await optionalViewer()));
  } catch (error) {
    return handleQueryError(error);
  }
}

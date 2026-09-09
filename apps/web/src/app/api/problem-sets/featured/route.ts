import { jsonResponse } from "@/server/http";
import { featured } from "@/server/problem-sets/queries";
import { handleQueryError } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Discoverの特集2枠。`kind`は新着かいいねの多い順。 */
export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind") === "new" ? "new" : "liked";
  try {
    return jsonResponse(await featured(kind));
  } catch (error) {
    return handleQueryError(error);
  }
}

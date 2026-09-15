import { jsonResponse } from "@/server/http";
import { publicTagSuggestions } from "@/server/problem-sets/queries";
import { handleQueryError } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonResponse({ tags: await publicTagSuggestions() });
  } catch (error) {
    return handleQueryError(error);
  }
}

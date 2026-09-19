import { externalProblemInputSchema, externalProblemSearchQuerySchema } from "@custom-contest/contracts";

import { errorResponse, isErrorResponse, jsonResponse, parseBody } from "@/server/http";
import { ExternalProblemLimitError, normalizeExternalProblemUrl, registerExternalProblem, searchExternalProblems } from "@/server/problem-sets/external-problems";
import { handleQueryError, requireWriter } from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = externalProblemSearchQuerySchema.safeParse({
    q: params.get("q") ?? "",
    limit: Number(params.get("limit") ?? 10),
    offset: Number(params.get("offset") ?? 0),
  });
  if (!parsed.success) return errorResponse("invalid_request", "検索条件を確認できませんでした。", null, 400);
  try {
    return jsonResponse(await searchExternalProblems(parsed.data));
  } catch (error) {
    return handleQueryError(error);
  }
}

export async function POST(request: Request) {
  const viewer = await requireWriter(request);
  if (isErrorResponse(viewer)) return viewer;
  const body = await parseBody(request, externalProblemInputSchema);
  if (isErrorResponse(body)) return body;
  if (!normalizeExternalProblemUrl(body.url)) {
    return errorResponse("invalid_request", "公開サイトのHTTPS URLを入力してください。", null, 400);
  }
  try {
    return jsonResponse(await registerExternalProblem(body, viewer), 201);
  } catch (error) {
    if (error instanceof ExternalProblemLimitError) {
      return errorResponse("invalid_request", error.message, null, 429, { "retry-after": "86400" });
    }
    return handleQueryError(error);
  }
}

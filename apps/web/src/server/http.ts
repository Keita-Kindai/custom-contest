import { apiErrorSchema, type ApiErrorCode } from "@custom-contest/contracts";

type RuntimeSchema<T> = { parse(value: unknown): T };

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export function jsonResponse(value: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(value, { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  fix: string | null = null,
  status = 400,
  headers?: HeadersInit,
): Response {
  return jsonResponse(apiErrorSchema.parse({ error: { code, message, fix } }), status, headers);
}

export async function parseBody<T>(request: Request, schema: RuntimeSchema<T>): Promise<T | Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return errorResponse("invalid_request", "リクエストが大きすぎます。", null, 413);
  }
  try {
    const text = await request.text();
    if (text.length > 64 * 1024) {
      return errorResponse("invalid_request", "リクエストが大きすぎます。", null, 413);
    }
    return schema.parse(JSON.parse(text));
  } catch {
    return errorResponse(
      "invalid_request",
      "入力内容を確認できませんでした。",
      "画面を再読み込みして、もう一度操作してください。",
      400,
    );
  }
}

export function isErrorResponse<T>(value: T | Response): value is Response {
  return value instanceof Response;
}

export function statusForCode(code: ApiErrorCode): number {
  if (code === "room_not_found" || code === "match_not_found" || code === "set_not_found") return 404;
  if (code === "unauthorized") return 401;
  if (code === "not_a_participant" || code === "forbidden" || code === "not_host") return 403;
  if (code === "storage_unavailable") return 503;
  if (code === "room_full") return 409;
  return 400;
}

export const USERSCRIPT_CORS_HEADERS = {
  "access-control-allow-origin": "https://atcoder.jp",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "600",
};

export function userscriptOptions(): Response {
  return new Response(null, { status: 204, headers: USERSCRIPT_CORS_HEADERS });
}

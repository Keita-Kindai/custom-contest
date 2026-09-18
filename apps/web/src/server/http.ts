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

/**
 * このrequestが自分のサイトから来たかを確かめる。
 *
 * 精進側の書き込みはcookieのsessionで本人を決める。cookieはブラウザーが自動で付けるので、
 * 別のサイトに置かれたformやscriptから書き込みを起こされうる（CSRF）。
 * いまそれを止めているのはAuth.jsの既定の`SameSite=Lax`だけで、防御が1枚しかない。
 *
 * 判定はブラウザーが付けるheaderで行う。どちらもページ側のJavaScriptからは書き換えられない。
 *
 * - `Sec-Fetch-Site`があればそれに従う。`cross-site`と`none`は拒否する。
 * - 無ければ`Origin`とこのserverのhostを比べる。
 * - どちらも無ければ通す。ブラウザーはこれらを必ず付けるので、
 *   両方無いrequestはブラウザーではない。CSRFは「ブラウザーを踏み台にする」攻撃なので、
 *   踏み台になりえない相手をここで止めても、防げるものが増えない。
 *
 * userscriptの経路には付けない。あれはatcoder.jpから来る前提で、cookieではなく
 * tokenで本人を決めているため。
 */
export function requireSameOrigin(request: Request): Response | null {
  const denied = () =>
    errorResponse(
      "forbidden",
      "このリクエストは受け付けられません。",
      "画面を再読み込みして、もう一度操作してください。",
      403,
    );

  const site = request.headers.get("sec-fetch-site");
  if (site) {
    return site === "same-origin" || site === "same-site" ? null : denied();
  }

  const origin = request.headers.get("origin");
  if (!origin) return null;

  // Vercelはproxyの後ろなので、利用者が見ているhostは`x-forwarded-host`に入る。
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return denied();
  try {
    return new URL(origin).host === host ? null : denied();
  } catch {
    return denied();
  }
}

export function isErrorResponse<T>(value: T | Response): value is Response {
  return value instanceof Response;
}

export function statusForCode(code: ApiErrorCode): number {
  if (code === "room_not_found" || code === "match_not_found" || code === "set_not_found") return 404;
  // 「公開していない」は「存在しない」として返す。区別すると、どの機能が眠っているかが分かる。
  if (code === "feature_disabled") return 404;
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

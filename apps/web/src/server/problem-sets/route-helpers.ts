import { auth } from "@/auth";
import { errorResponse } from "@/server/http";

import { DatabaseUnavailableError } from "./queries";

/**
 * 精進側のRoute Handlerが共有する入口（ADR-0011）。
 *
 * `viewerId`はsessionからしか作らない。clientが送ってきた値を持ち主として扱うと、
 * 他人のセットを書き換えられる。
 */

/** ログイン必須の処理。未ログインなら401を返す。 */
export async function requireViewer(): Promise<string | Response> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) {
    return errorResponse("unauthorized", "ログインが必要です。", "画面右上からログインしてください。", 401);
  }
  return id;
}

/** 未ログインでも進める処理。閲覧範囲の判定にだけ使う。 */
export async function optionalViewer(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * DB未設定を503として返す。
 * それ以外の例外は握りつぶさず、そのまま投げてserverのlogへ残す。
 */
export function handleQueryError(error: unknown): Response {
  if (error instanceof DatabaseUnavailableError) {
    return errorResponse(
      "storage_unavailable",
      "データベースに接続できません。",
      "しばらく待ってからもう一度お試しください。",
      503,
    );
  }
  throw error;
}

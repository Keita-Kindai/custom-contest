import { MAX_PROBLEMS_PER_SET, problemSetSchema } from "@custom-contest/contracts";

import { errorResponse, isErrorResponse, jsonResponse, parseBody } from "@/server/http";
import {
  existingProblemIds,
  getSet,
  ownerOf,
  removeSet,
  saveSet,
} from "@/server/problem-sets/queries";
import {
  handleQueryError,
  optionalViewer,
  requireViewer,
} from "@/server/problem-sets/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ setId: string }> };

/**
 * セット1件。可視性の判定はquery側で行う。
 * 「無い」と「見せてよくない」は区別せず、どちらも404を返す。
 * 区別すると、非公開セットの存在をIDの総当たりで確かめられてしまう。
 */
export async function GET(_request: Request, { params }: Params) {
  const { setId } = await params;
  try {
    const set = await getSet(setId, await optionalViewer());
    if (!set) return errorResponse("set_not_found", "この問題セットは見つかりませんでした。", null, 404);
    return jsonResponse(set);
  } catch (error) {
    return handleQueryError(error);
  }
}

/** 作成と更新。持ち主はsessionから決め、bodyの値は使わない。 */
export async function PUT(request: Request, { params }: Params) {
  const viewer = await requireViewer();
  if (isErrorResponse(viewer)) return viewer;

  const { setId } = await params;
  const body = await parseBody(request, problemSetSchema);
  if (isErrorResponse(body)) return body;

  if (body.setId !== setId) {
    return errorResponse("invalid_request", "URLと内容のIDが一致しません。", null, 400);
  }
  if (body.problems.length > MAX_PROBLEMS_PER_SET) {
    return errorResponse(
      "invalid_request",
      `1セットに入れられるのは${MAX_PROBLEMS_PER_SET}問までです。`,
      null,
      400,
    );
  }

  try {
    const owner = await ownerOf(setId);
    // 既にあるセットは持ち主だけが書ける。無いIDは新規作成として通す。
    if (owner !== null && owner !== viewer) {
      return errorResponse("set_not_found", "この問題セットは見つかりませんでした。", null, 404);
    }

    // カタログにない問題は外部キー違反になる。先に見つけて理由を返す。
    const ids = body.problems.map((problem) => problem.problemId);
    const known = await existingProblemIds(ids);
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length > 0) {
      return errorResponse(
        "invalid_request",
        "カタログにない問題が含まれています。",
        "画面を再読み込みして、問題を選び直してください。",
        400,
      );
    }

    await saveSet(body, viewer);
    const saved = await getSet(setId, viewer);
    return jsonResponse(saved);
  } catch (error) {
    return handleQueryError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const viewer = await requireViewer();
  if (isErrorResponse(viewer)) return viewer;

  const { setId } = await params;
  try {
    const owner = await ownerOf(setId);
    if (owner !== viewer) {
      return errorResponse("set_not_found", "この問題セットは見つかりませんでした。", null, 404);
    }
    await removeSet(setId);
    return jsonResponse({ ok: true });
  } catch (error) {
    return handleQueryError(error);
  }
}

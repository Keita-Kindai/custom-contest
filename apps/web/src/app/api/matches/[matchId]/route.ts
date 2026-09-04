import { allMatches } from "@custom-contest/domain";
import { matchIdParamSchema } from "@custom-contest/contracts";

import { loadStoredMatch, storedMatchFromState } from "@/server/db/matches";
import { errorResponse, jsonResponse } from "@/server/http";
import { advanceAndPersist, roomStore } from "@/server/rooms/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const parsed = matchIdParamSchema.safeParse((await params).matchId);
  if (!parsed.success) return errorResponse("match_not_found", "Matchが見つかりません。", null, 404);
  const room = roomStore().findRoomByMatch(parsed.data);
  if (room) {
    await advanceAndPersist(room);
    const match = allMatches(room).find((candidate) => candidate.matchId === parsed.data);
    if (match?.result) return jsonResponse(storedMatchFromState(room, match));
  }
  try {
    const stored = await loadStoredMatch(parsed.data);
    return stored
      ? jsonResponse(stored)
      : errorResponse("match_not_found", "Matchが見つからないか、保存期間が終了しました。", null, 404);
  } catch {
    return errorResponse("storage_unavailable", "保存済みMatchを読み込めません。", "PostgreSQLの起動状態を確認してください。", 503);
  }
}

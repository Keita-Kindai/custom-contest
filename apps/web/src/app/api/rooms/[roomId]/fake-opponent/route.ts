import { addFakeOpponentRequestSchema } from "@custom-contest/contracts";
import { addFakeOpponent } from "@custom-contest/domain";

import { errorResponse, isErrorResponse, parseBody } from "@/server/http";
import { commandFailure, mutationSnapshot, type RoomRouteContext } from "@/server/rooms/route-helpers";
import { accessRoom, commandContext, fakeEvidenceEnabled } from "@/server/rooms/store";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: RoomRouteContext) {
  if (!fakeEvidenceEnabled()) {
    return errorResponse("fake_evidence_disabled", "テスト相手はこのサーバーでは無効です。", null, 404);
  }
  const input = await parseBody(request, addFakeOpponentRequestSchema);
  if (isErrorResponse(input)) return input;
  const { roomId } = await params;
  const access = accessRoom(roomId, input.participantKey);
  if (!access.ok) return mutationSnapshot(request, roomId, input.participantKey);
  const result = addFakeOpponent(access.room, input.participantKey, commandContext());
  if (!result.ok) return commandFailure(result);
  return mutationSnapshot(request, roomId, input.participantKey);
}

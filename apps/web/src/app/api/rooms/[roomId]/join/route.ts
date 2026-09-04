import { joinRoomRequestSchema } from "@custom-contest/contracts";
import { joinRoom, tick } from "@custom-contest/domain";

import { errorResponse, isErrorResponse, jsonResponse, parseBody, statusForCode } from "@/server/http";
import { type RoomRouteContext } from "@/server/rooms/route-helpers";
import { commandContext, roomStore, snapshotFor } from "@/server/rooms/store";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: RoomRouteContext) {
  const input = await parseBody(request, joinRoomRequestSchema);
  if (isErrorResponse(input)) return input;
  const { roomId } = await params;
  const room = roomStore().get(roomId);
  if (!room) return errorResponse("room_not_found", "Roomが見つかりません。", "Room IDを確認してください。", 404);
  const ctx = commandContext();
  tick(room, ctx.now);
  const result = joinRoom(room, input, ctx);
  if (!result.ok) return errorResponse(result.code, result.message, result.fix, statusForCode(result.code));
  return jsonResponse({
    roomId: room.roomId,
    seat: result.participant.seat,
    participantKey: result.participant.participantKey,
    snapshot: await snapshotFor(room, result.participant),
  });
}

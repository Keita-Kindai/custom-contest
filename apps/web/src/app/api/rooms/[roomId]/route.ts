import { errorResponse, jsonResponse, statusForCode } from "@/server/http";
import { participantKeyFrom, type RoomRouteContext } from "@/server/rooms/route-helpers";
import { accessRoom, snapshotFor } from "@/server/rooms/store";
import { requireBattleEnabled } from "@/server/feature-gate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: RoomRouteContext) {
  const gate = requireBattleEnabled();
  if (gate) return gate;
  const { roomId } = await params;
  const access = accessRoom(roomId, participantKeyFrom(request));
  if (!access.ok) return errorResponse(access.code, access.message, access.fix, statusForCode(access.code));
  return jsonResponse({ snapshot: await snapshotFor(access.room, access.participant) });
}

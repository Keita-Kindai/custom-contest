import { issueLinkKeyResponseSchema, participantRequestSchema } from "@custom-contest/contracts";
import { issueLinkKey } from "@custom-contest/domain";

import { isErrorResponse, jsonResponse, parseBody } from "@/server/http";
import { commandFailure, type RoomRouteContext } from "@/server/rooms/route-helpers";
import { accessRoom, commandContext, snapshotFor } from "@/server/rooms/store";

export async function POST(request: Request, { params }: RoomRouteContext) {
  const input = await parseBody(request, participantRequestSchema);
  if (isErrorResponse(input)) return input;
  const { roomId } = await params;
  const access = accessRoom(roomId, input.participantKey);
  if (!access.ok) return commandFailure(access);
  const result = issueLinkKey(access.room, input.participantKey, commandContext());
  if (!result.ok) return commandFailure(result);

  const handoffUrl = new URL("https://atcoder.jp/");
  handoffUrl.hash = `cc-link=${encodeURIComponent(result.linkKey)}`;
  return jsonResponse(
    issueLinkKeyResponseSchema.parse({
      linkKey: result.linkKey,
      expiresAt: new Date(result.expiresAt).toISOString(),
      handoffUrl: handoffUrl.toString(),
      snapshot: await snapshotFor(access.room, access.participant, { touchParticipant: false }),
    }),
  );
}

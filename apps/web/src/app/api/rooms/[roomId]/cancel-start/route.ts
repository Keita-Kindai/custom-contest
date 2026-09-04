import { participantRequestSchema } from "@custom-contest/contracts";
import { cancelStart } from "@custom-contest/domain";

import { isErrorResponse, parseBody } from "@/server/http";
import { commandFailure, mutationSnapshot, type RoomRouteContext } from "@/server/rooms/route-helpers";
import { accessRoom, commandContext } from "@/server/rooms/store";

export async function POST(request: Request, { params }: RoomRouteContext) {
  const input = await parseBody(request, participantRequestSchema);
  if (isErrorResponse(input)) return input;
  const { roomId } = await params;
  const access = accessRoom(roomId, input.participantKey);
  if (!access.ok) return mutationSnapshot(request, roomId, input.participantKey);
  const result = cancelStart(access.room, input.participantKey, commandContext());
  if (!result.ok) return commandFailure(result);
  return mutationSnapshot(request, roomId, input.participantKey);
}

import { problemUnavailableRequestSchema } from "@custom-contest/contracts";
import { reportProblemUnavailable } from "@custom-contest/domain";

import { isErrorResponse, parseBody } from "@/server/http";
import { commandFailure, mutationSnapshot, type RoomRouteContext } from "@/server/rooms/route-helpers";
import { accessRoom, commandContext } from "@/server/rooms/store";

export async function POST(request: Request, { params }: RoomRouteContext) {
  const input = await parseBody(request, problemUnavailableRequestSchema);
  if (isErrorResponse(input)) return input;
  const { roomId } = await params;
  const access = accessRoom(roomId, input.participantKey);
  if (!access.ok) return mutationSnapshot(request, roomId, input.participantKey);
  const result = reportProblemUnavailable(access.room, input.participantKey, input.detail, commandContext());
  if (!result.ok) return commandFailure(result);
  return mutationSnapshot(request, roomId, input.participantKey);
}

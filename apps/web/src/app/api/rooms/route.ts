import { createRoomRequestSchema } from "@custom-contest/contracts";

import { databaseHealth } from "@/server/db/matches";
import { errorResponse, isErrorResponse, jsonResponse, parseBody } from "@/server/http";
import { commandContext, roomStore, snapshotFor } from "@/server/rooms/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const input = await parseBody(request, createRoomRequestSchema);
  if (isErrorResponse(input)) return input;
  const database = await databaseHealth();
  if (!database.reachable || !database.migrated) {
    return errorResponse("storage_unavailable", database.message, database.fix, 503);
  }

  const settings = {
    mode: "BO1" as const,
    limitMinutes: input.limitMinutes,
    problemIndexes: input.problemIndexes,
    difficultyMin: 400,
    difficultyMax: 1200,
  };
  const { room, participant } = roomStore().create(settings, input.atcoderId, commandContext());
  return jsonResponse(
    {
      roomId: room.roomId,
      seat: participant.seat,
      participantKey: participant.participantKey,
      snapshot: await snapshotFor(room, participant),
    },
    201,
  );
}

import { PARTICIPANT_KEY_HEADER, type ApiErrorCode } from "@custom-contest/contracts";
import type { Result } from "@custom-contest/domain";

import { errorResponse, jsonResponse, statusForCode } from "../http";
import { accessRoom, snapshotFor } from "./store";

export type RoomRouteContext = { params: Promise<{ roomId: string }> };

export function participantKeyFrom(request: Request): string | null {
  return request.headers.get(PARTICIPANT_KEY_HEADER);
}

export function commandFailure(result: Extract<Result, { ok: false }>): Response {
  return errorResponse(result.code, result.message, result.fix, statusForCode(result.code));
}

export async function mutationSnapshot(
  request: Request,
  roomId: string,
  participantKey: string,
): Promise<Response> {
  const access = accessRoom(roomId, participantKey);
  if (!access.ok) return errorResponse(access.code, access.message, access.fix, statusForCode(access.code));
  return jsonResponse({ snapshot: await snapshotFor(access.room, access.participant, { touchParticipant: false }) });
}

export function roomAccessError(access: Extract<ReturnType<typeof accessRoom>, { ok: false }>): Response {
  return errorResponse(
    access.code as ApiErrorCode,
    access.message,
    access.fix,
    statusForCode(access.code),
  );
}

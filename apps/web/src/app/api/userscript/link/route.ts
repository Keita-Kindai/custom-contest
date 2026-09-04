import {
  HEARTBEAT_INTERVAL_MS,
  SUBMISSION_POLL_INTERVAL_MS,
  linkScriptRequestSchema,
  linkScriptResponseSchema,
} from "@custom-contest/contracts";
import { linkScript } from "@custom-contest/domain";

import {
  USERSCRIPT_CORS_HEADERS,
  errorResponse,
  isErrorResponse,
  jsonResponse,
  parseBody,
  statusForCode,
  userscriptOptions,
} from "@/server/http";
import { commandContext, roomStore } from "@/server/rooms/store";

export function OPTIONS() {
  return userscriptOptions();
}

export async function POST(request: Request) {
  const input = await parseBody(request, linkScriptRequestSchema);
  if (isErrorResponse(input)) return input;
  const found = roomStore().findParticipantByLinkKey(input.linkKey);
  if (!found) {
    return errorResponse("link_key_invalid", "接続キーを確認できません。", "Room画面から接続し直してください。", 400, USERSCRIPT_CORS_HEADERS);
  }
  const result = linkScript(found.room, input, commandContext());
  if (!result.ok) return errorResponse(result.code, result.message, result.fix, statusForCode(result.code), USERSCRIPT_CORS_HEADERS);
  return jsonResponse(
    linkScriptResponseSchema.parse({
      scriptToken: result.scriptToken,
      roomId: found.room.roomId,
      seat: result.participant.seat,
      profileAtcoderId: result.participant.atcoderId,
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      pollIntervalMs: SUBMISSION_POLL_INTERVAL_MS,
    }),
    200,
    USERSCRIPT_CORS_HEADERS,
  );
}

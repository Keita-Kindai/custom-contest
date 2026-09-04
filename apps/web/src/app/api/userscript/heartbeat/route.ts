import {
  HEARTBEAT_INTERVAL_MS,
  OUTBOX_RETENTION_AFTER_MATCH_MS,
  SUBMISSION_POLL_INTERVAL_MS,
  heartbeatRequestSchema,
  heartbeatResponseSchema,
} from "@custom-contest/contracts";
import { heartbeat } from "@custom-contest/domain";

import {
  USERSCRIPT_CORS_HEADERS,
  errorResponse,
  isErrorResponse,
  jsonResponse,
  parseBody,
  statusForCode,
  userscriptOptions,
} from "@/server/http";
import { advanceAndPersist, commandContext, roomStore } from "@/server/rooms/store";

export function OPTIONS() {
  return userscriptOptions();
}

export async function POST(request: Request) {
  const input = await parseBody(request, heartbeatRequestSchema);
  if (isErrorResponse(input)) return input;
  const found = roomStore().findParticipantByScriptToken(input.scriptToken);
  if (!found) {
    return errorResponse("script_token_invalid", "userscriptの接続が無効です。", "Room画面から接続し直してください。", 403, USERSCRIPT_CORS_HEADERS);
  }
  const ctx = commandContext();
  const result = heartbeat(
    found.room,
    {
      scriptToken: input.scriptToken,
      loggedIn: input.health.loggedIn,
      loginAtcoderId: input.health.loginAtcoderId,
      judgeReachable: input.health.judgeReachable,
      checkedAt: Date.parse(input.health.checkedAt),
    },
    ctx,
  );
  if (!result.ok) return errorResponse(result.code, result.message, result.fix, statusForCode(result.code), USERSCRIPT_CORS_HEADERS);
  await advanceAndPersist(found.room, ctx.now);
  const match = found.room.match;
  const exposeTarget =
    match && match.phase !== "countdown" &&
    (match.phase !== "decided" || (match.result && ctx.now <= match.result.decidedAt + OUTBOX_RETENTION_AFTER_MATCH_MS));
  const activeMatch = exposeTarget && match
    ? {
        matchId: match.matchId,
        contestId: match.problem.contestId,
        problemId: match.problem.problemId,
        startsAt: new Date(match.startsAt).toISOString(),
        deadlineAt: new Date(match.deadlineAt).toISOString(),
        discardOutboxAfter: match.result
          ? new Date(match.result.decidedAt + OUTBOX_RETENTION_AFTER_MATCH_MS).toISOString()
          : null,
        statusJsonPath: `/contests/${match.problem.contestId}/submissions/me/status/json`,
        submissionsPath: `/contests/${match.problem.contestId}/submissions/me`,
      }
    : null;
  return jsonResponse(
    heartbeatResponseSchema.parse({
      ok: true,
      serverTime: new Date(ctx.now).toISOString(),
      activeMatch,
      pollIntervalMs: SUBMISSION_POLL_INTERVAL_MS,
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      stopped: found.room.closed,
    }),
    200,
    USERSCRIPT_CORS_HEADERS,
  );
}

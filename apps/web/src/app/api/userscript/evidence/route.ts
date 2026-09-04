import { evidenceRequestSchema, evidenceResponseSchema } from "@custom-contest/contracts";
import { submitEvidence, tick } from "@custom-contest/domain";

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
  const input = await parseBody(request, evidenceRequestSchema);
  if (isErrorResponse(input)) return input;
  const found = roomStore().findParticipantByScriptToken(input.scriptToken);
  if (!found) {
    return errorResponse("script_token_invalid", "userscriptの接続が無効です。", "Room画面から接続し直してください。", 403, USERSCRIPT_CORS_HEADERS);
  }
  const ctx = commandContext();
  tick(found.room, ctx.now);
  const result = submitEvidence(
    found.room,
    {
      scriptToken: input.scriptToken,
      matchId: input.matchId,
      submissions: input.submissions.map((entry) => ({ ...entry, submittedAt: Date.parse(entry.submittedAt) })),
    },
    ctx,
  );
  if (!result.ok) return errorResponse(result.code, result.message, result.fix, statusForCode(result.code), USERSCRIPT_CORS_HEADERS);
  await advanceAndPersist(found.room, ctx.now);
  const accepted = result.outcomes.filter((entry) => entry.accepted).map((entry) => entry.submissionId);
  const rejected = result.outcomes.flatMap((entry) =>
    entry.accepted ? [] : [{ submissionId: entry.submissionId, code: entry.code, message: entry.message, fix: entry.fix }],
  );
  return jsonResponse(
    evidenceResponseSchema.parse({ ok: true, serverTime: new Date(ctx.now).toISOString(), accepted, rejected }),
    200,
    USERSCRIPT_CORS_HEADERS,
  );
}

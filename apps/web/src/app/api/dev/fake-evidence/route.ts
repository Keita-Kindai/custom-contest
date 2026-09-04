import { fakeEvidenceRequestSchema } from "@custom-contest/contracts";
import { submitEvidence, tick } from "@custom-contest/domain";

import { errorResponse, isErrorResponse, jsonResponse, parseBody, statusForCode } from "@/server/http";
import { commandContext, fakeEvidenceEnabled, roomStore, snapshotFor } from "@/server/rooms/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!fakeEvidenceEnabled()) {
    return errorResponse("fake_evidence_disabled", "Fake判定はこのサーバーでは無効です。", null, 404);
  }
  const input = await parseBody(request, fakeEvidenceRequestSchema);
  if (isErrorResponse(input)) return input;
  if (input.status === "final" && !input.verdict) {
    return errorResponse("invalid_request", "確定判定には判定ラベルが必要です。", null, 400);
  }

  const found = [...roomStore().rooms.values()].find((room) =>
    [room.participants.host, room.participants.invitee].some(
      (participant) => participant?.participantKey === input.participantKey,
    ),
  );
  const match = found?.match;
  if (!found || !match) return errorResponse("match_not_found", "進行中のMatchが見つかりません。", null, 404);
  const participant = [found.participants.host, found.participants.invitee].find(
    (candidate) => candidate?.participantKey === input.participantKey,
  );
  if (!participant) return errorResponse("not_a_participant", "参加者を確認できません。", null, 403);

  const ctx = commandContext();
  tick(found, ctx.now);
  const submissionId = input.submissionId ?? Number(String(ctx.now).slice(-12));
  const result = submitEvidence(
    found,
    {
      participantKey: input.participantKey,
      matchId: match.matchId,
      submissions: [
        {
          atcoderId: participant.atcoderId,
          submissionId,
          contestId: match.problem.contestId,
          problemId: match.problem.problemId,
          submittedAt: input.submittedAt ? Date.parse(input.submittedAt) : ctx.now,
          status: input.status,
          verdict: input.status === "final" ? (input.verdict ?? null) : null,
          language: input.language ?? "Fake",
          source: "fake",
        },
      ],
    },
    ctx,
  );
  if (!result.ok) return errorResponse(result.code, result.message, result.fix, statusForCode(result.code));
  const outcome = result.outcomes[0];
  if (!outcome?.accepted) {
    return errorResponse("evidence_rejected", outcome?.message ?? "Fake判定を受理できませんでした。", outcome?.fix ?? null, 400);
  }
  return jsonResponse({ snapshot: await snapshotFor(found, participant, { touchParticipant: false }) });
}

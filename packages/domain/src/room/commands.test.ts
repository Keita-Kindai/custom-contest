import { describe, expect, it } from "vitest";

import { OUTBOX_RETENTION_AFTER_MATCH_MS, type RoomSettings } from "@custom-contest/contracts";
import type { RandomSource } from "../random";
import {
  createRoom,
  forfeit,
  heartbeat,
  issueLinkKey,
  joinRoom,
  linkScript,
  markPersisted,
  rematch,
  setReady,
  startMatch,
  submitEvidence,
  tick,
} from "./commands";
import { buildSnapshot } from "./snapshot";

function deterministicRandom(): RandomSource {
  let cursor = 1;
  return {
    bytes(length) {
      return Uint8Array.from({ length }, () => (cursor++ % 251) + 1);
    },
  };
}

const settings: RoomSettings = {
  mode: "BO1",
  limitMinutes: 10,
  problemIndexes: ["C", "D"],
  difficultyMin: 400,
  difficultyMax: 1200,
};

function preparedRoom() {
  const random = deterministicRandom();
  let now = Date.parse("2026-09-06T01:00:00.000Z");
  const ctx = () => ({ now, random, fakeEvidenceEnabled: true });
  const created = createRoom(settings, "Litms", ctx(), "ABC234");
  const joined = joinRoom(created.room, { atcoderId: "friend_1400" }, ctx());
  if (!joined.ok) throw new Error(joined.message);

  for (const participant of [created.participant, joined.participant]) {
    const issued = issueLinkKey(created.room, participant.participantKey, ctx());
    if (!issued.ok) throw new Error(issued.message);
    const linked = linkScript(
      created.room,
      { linkKey: issued.linkKey, loginAtcoderId: participant.atcoderId, scriptVersion: "test" },
      ctx(),
    );
    if (!linked.ok) throw new Error(linked.message);
    const healthy = heartbeat(
      created.room,
      {
        scriptToken: linked.scriptToken,
        loggedIn: true,
        loginAtcoderId: participant.atcoderId,
        judgeReachable: true,
        checkedAt: now,
      },
      ctx(),
    );
    if (!healthy.ok) throw new Error(healthy.message);
    const ready = setReady(created.room, participant.participantKey, true, ctx());
    if (!ready.ok) throw new Error(ready.message);
  }

  const started = startMatch(created.room, created.participant.participantKey, ctx());
  if (!started.ok) throw new Error(started.message);
  return {
    room: created.room,
    host: created.participant,
    invitee: joined.participant,
    match: started.match,
    ctx,
    setNow(value: number) {
      now = value;
    },
  };
}

function evidenceFor(
  fixture: ReturnType<typeof preparedRoom>,
  seat: "host" | "invitee",
  submissionId: number,
  verdict: string | null,
) {
  const participant = seat === "host" ? fixture.host : fixture.invitee;
  return {
    participantKey: participant.participantKey,
    matchId: fixture.match.matchId,
    submissions: [
      {
        atcoderId: participant.atcoderId,
        submissionId,
        contestId: fixture.match.problem.contestId,
        problemId: fixture.match.problem.problemId,
        submittedAt: fixture.match.startsAt + 1_000,
        status: verdict === null ? ("pending" as const) : ("final" as const),
        verdict,
        language: "C++ 23",
        source: "fake" as const,
      },
    ],
  };
}

describe("BO1 room commands", () => {
  it("keeps the problem secret until START and then exposes it", () => {
    const fixture = preparedRoom();
    expect(buildSnapshot(fixture.room, "host", fixture.match.startsAt - 1, { fakeEvidenceEnabled: true }).match?.problem).toBeNull();
    tick(fixture.room, fixture.match.startsAt);
    expect(buildSnapshot(fixture.room, "host", fixture.match.startsAt, { fakeEvidenceEnabled: true }).match?.problem?.problemId).toBe(fixture.match.problem.problemId);
  });

  it("lets the first server-received valid AC win and deduplicates retries", () => {
    const fixture = preparedRoom();
    fixture.setNow(fixture.match.startsAt + 2_000);
    tick(fixture.room, fixture.ctx().now);
    const first = submitEvidence(fixture.room, evidenceFor(fixture, "invitee", 101, "AC"), fixture.ctx());
    expect(first.ok).toBe(true);
    expect(fixture.match.result).toMatchObject({ outcome: "win", winnerSeat: "invitee", reason: "first_ac" });

    fixture.setNow(fixture.ctx().now + 500);
    submitEvidence(fixture.room, evidenceFor(fixture, "host", 102, "AC"), fixture.ctx());
    submitEvidence(fixture.room, evidenceFor(fixture, "invitee", 101, "AC"), fixture.ctx());
    expect(fixture.match.result?.winnerSeat).toBe("invitee");
    expect(fixture.match.submissions).toHaveLength(2);
  });

  it("rejects a submission for a different problem", () => {
    const fixture = preparedRoom();
    fixture.setNow(fixture.match.startsAt + 2_000);
    tick(fixture.room, fixture.ctx().now);
    const input = evidenceFor(fixture, "host", 201, "AC");
    input.submissions[0]!.problemId = "abc999_z";
    const result = submitEvidence(fixture.room, input, fixture.ctx());
    expect(result.ok && result.outcomes[0]).toMatchObject({ accepted: false, code: "wrong_problem" });
    expect(fixture.match.result).toBeNull();
  });

  it("waits for an in-window pending submission and draws after a non-AC final", () => {
    const fixture = preparedRoom();
    fixture.setNow(fixture.match.startsAt + 1_000);
    tick(fixture.room, fixture.ctx().now);
    submitEvidence(fixture.room, evidenceFor(fixture, "host", 301, null), fixture.ctx());
    fixture.setNow(fixture.match.deadlineAt);
    tick(fixture.room, fixture.ctx().now);
    expect(fixture.match.phase).toBe("awaiting_judge");

    fixture.setNow(fixture.ctx().now + 1_000);
    submitEvidence(fixture.room, evidenceFor(fixture, "host", 301, "WA"), fixture.ctx());
    expect(fixture.match.result).toMatchObject({ outcome: "draw", reason: "timeout_all_non_ac" });
  });

  it("records forfeit as the opponent's win", () => {
    const fixture = preparedRoom();
    fixture.setNow(fixture.match.startsAt);
    tick(fixture.room, fixture.ctx().now);
    expect(forfeit(fixture.room, fixture.host.participantKey, fixture.ctx()).ok).toBe(true);
    expect(fixture.match.result).toMatchObject({ outcome: "win", winnerSeat: "invitee", reason: "forfeit" });
  });

  it("keeps a completed match available for late evidence after rematch acceptance", () => {
    const fixture = preparedRoom();
    fixture.setNow(fixture.match.startsAt);
    tick(fixture.room, fixture.ctx().now);
    submitEvidence(fixture.room, evidenceFor(fixture, "host", 401, "AC"), fixture.ctx());
    markPersisted(fixture.room, fixture.match.matchId, fixture.ctx().now);
    expect(rematch(fixture.room, fixture.host.participantKey, "request", fixture.ctx()).ok).toBe(true);
    expect(rematch(fixture.room, fixture.invitee.participantKey, "accept", fixture.ctx()).ok).toBe(true);
    expect(fixture.room.match).toBeNull();

    fixture.setNow(fixture.ctx().now + 1_000);
    const late = submitEvidence(fixture.room, evidenceFor(fixture, "invitee", 402, "AC"), fixture.ctx());
    expect(late.ok).toBe(true);
    expect(fixture.room.archivedMatches[0]?.submissions.at(-1)).toMatchObject({ late: true, submissionId: 402 });
    expect(fixture.room.archivedMatches[0]?.result?.winnerSeat).toBe("host");
    expect(fixture.room.archivedMatches[0]?.persistence.state).toBe("pending");
  });

  it("rejects unsent evidence more than five minutes after the result", () => {
    const fixture = preparedRoom();
    fixture.setNow(fixture.match.startsAt);
    tick(fixture.room, fixture.ctx().now);
    submitEvidence(fixture.room, evidenceFor(fixture, "host", 501, "AC"), fixture.ctx());
    const decidedAt = fixture.match.result?.decidedAt;
    if (decidedAt === undefined) throw new Error("result missing");

    fixture.setNow(decidedAt + OUTBOX_RETENTION_AFTER_MATCH_MS + 1);
    const expired = submitEvidence(fixture.room, evidenceFor(fixture, "invitee", 502, "AC"), fixture.ctx());
    expect(expired.ok && expired.outcomes[0]).toMatchObject({ accepted: false, code: "match_not_running" });
    expect(fixture.match.submissions).toHaveLength(1);
    expect(fixture.match.result?.winnerSeat).toBe("host");
  });
});

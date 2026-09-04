import { afterAll, describe, expect, it } from "vitest";

import { getPool } from "./client";
import { deleteExpiredMatches, loadStoredMatch, saveStoredMatch } from "./matches";

const matchId = "m_aaaaaaaaaaaaaaaaaaaaaaaaaa";
const expiredMatchId = "m_bbbbbbbbbbbbbbbbbbbbbbbbbb";
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("PostgreSQL match persistence", () => {
  afterAll(async () => {
    await getPool()?.query("delete from match_results where match_id = any($1)", [[matchId, expiredMatchId]]);
    await getPool()?.end();
  });

  it("round-trips a completed unlisted match", async () => {
    const now = Date.now();
    await saveStoredMatch({
      matchId,
      roomId: "ABC234",
      mode: "BO1",
      limitMinutes: 10,
      seed: "test-seed",
      problem: {
        problemId: "abc302_c",
        contestId: "abc302",
        problemIndex: "C",
        title: "Almost Equal",
        difficulty: 703,
        url: "https://atcoder.jp/contests/abc302/tasks/abc302_c",
        submitUrl: "https://atcoder.jp/contests/abc302/submit?taskScreenName=abc302_c",
      },
      startedAt: new Date(now - 60_000).toISOString(),
      deadlineAt: new Date(now + 540_000).toISOString(),
      decidedAt: new Date(now).toISOString(),
      outcome: "win",
      winnerSeat: "host",
      reason: "first_ac",
      detail: null,
      verificationLabel: "userscript確認・カジュアル対戦",
      countsTowardRecord: true,
      participants: [
        { seat: "host", atcoderId: "Litms", submissionCount: 1, missCount: 0 },
        { seat: "invitee", atcoderId: "friend_1400", submissionCount: 0, missCount: 0 },
      ],
      submissions: [],
      expiresAt: new Date(now + 90 * 24 * 60 * 60_000).toISOString(),
    });
    const loaded = await loadStoredMatch(matchId);
    expect(loaded).toMatchObject({ matchId, roomId: "ABC234", winnerSeat: "host", countsTowardRecord: true });
  });

  it("deletes completed matches after their 90-day retention deadline", async () => {
    const now = Date.now();
    await saveStoredMatch({
      matchId: expiredMatchId,
      roomId: "ABC234",
      mode: "BO1",
      limitMinutes: 10,
      seed: "expired-seed",
      problem: {
        problemId: "abc302_c",
        contestId: "abc302",
        problemIndex: "C",
        title: "Almost Equal",
        difficulty: 703,
        url: "https://atcoder.jp/contests/abc302/tasks/abc302_c",
        submitUrl: "https://atcoder.jp/contests/abc302/submit?taskScreenName=abc302_c",
      },
      startedAt: new Date(now - 91 * 24 * 60 * 60_000).toISOString(),
      deadlineAt: new Date(now - 91 * 24 * 60 * 60_000 + 600_000).toISOString(),
      decidedAt: new Date(now - 91 * 24 * 60 * 60_000 + 1_000).toISOString(),
      outcome: "draw",
      winnerSeat: null,
      reason: "timeout_no_pending",
      detail: null,
      verificationLabel: "userscript確認・カジュアル対戦",
      countsTowardRecord: true,
      participants: [
        { seat: "host", atcoderId: "Litms", submissionCount: 0, missCount: 0 },
        { seat: "invitee", atcoderId: "friend_1400", submissionCount: 0, missCount: 0 },
      ],
      submissions: [],
      expiresAt: new Date(now - 1_000).toISOString(),
    });

    expect(await deleteExpiredMatches(new Date(now))).toBeGreaterThanOrEqual(1);
    const rows = await getPool()?.query("select match_id from match_results where match_id = $1", [expiredMatchId]);
    expect(rows?.rowCount).toBe(0);
  });
});

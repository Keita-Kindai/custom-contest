import {
  MATCH_RETENTION_DAYS,
  storedMatchResponseSchema,
  type Seat,
  type StoredMatchResponse,
  type SubmissionEntry,
} from "@custom-contest/contracts";
import type { MatchState, RoomState } from "@custom-contest/domain";
import { eq } from "drizzle-orm";

import { getDb, getPool } from "./client";
import { matchResults } from "./schema";

export const REQUIRED_MIGRATION = "0001_match_results";
const RETENTION_CLEANUP_INTERVAL_MS = 24 * 60 * 60_000;

type RetentionGlobal = typeof globalThis & {
  __customContestRetentionCleanupAt?: number;
  __customContestRetentionCleanup?: Promise<void>;
};

export type DatabaseHealth = {
  reachable: boolean;
  migrated: boolean;
  message: string;
  fix: string | null;
};

export async function deleteExpiredMatches(now = new Date()): Promise<number> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const result = await pool.query("delete from match_results where expires_at <= $1", [now]);
  return result.rowCount ?? 0;
}

async function maybeDeleteExpiredMatches(now = Date.now()): Promise<void> {
  const state = globalThis as RetentionGlobal;
  if (
    state.__customContestRetentionCleanupAt !== undefined &&
    now - state.__customContestRetentionCleanupAt < RETENTION_CLEANUP_INTERVAL_MS
  ) {
    return;
  }
  if (!state.__customContestRetentionCleanup) {
    state.__customContestRetentionCleanup = deleteExpiredMatches(new Date(now))
      .then(() => {
        state.__customContestRetentionCleanupAt = now;
      })
      .finally(() => {
        delete state.__customContestRetentionCleanup;
      });
  }
  await state.__customContestRetentionCleanup;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function submissionEntry(record: MatchState["submissions"][number]): SubmissionEntry {
  return {
    submissionId: record.submissionId,
    seat: record.seat,
    atcoderId: record.atcoderId,
    contestId: record.contestId,
    problemId: record.problemId,
    submittedAt: iso(record.submittedAt),
    receivedAt: iso(record.receivedAt),
    status: record.status,
    verdict: record.verdict,
    language: record.language,
    source: record.source,
    late: record.late,
  };
}

function counts(match: MatchState, seat: Seat) {
  const submissions = match.submissions.filter((entry) => entry.seat === seat);
  return {
    submissionCount: submissions.length,
    missCount: submissions.filter((entry) => entry.status === "final" && entry.verdict !== "AC").length,
  };
}

export function storedMatchFromState(room: RoomState, match: MatchState): StoredMatchResponse {
  if (!match.result) throw new Error("decided match must have a result");
  const hostCounts = counts(match, "host");
  const inviteeCounts = counts(match, "invitee");
  return storedMatchResponseSchema.parse({
    matchId: match.matchId,
    roomId: room.roomId,
    mode: "BO1",
    limitMinutes: room.settings.limitMinutes,
    seed: match.seed,
    problem: match.problem,
    startedAt: iso(match.startsAt),
    deadlineAt: iso(match.deadlineAt),
    decidedAt: iso(match.result.decidedAt),
    outcome: match.result.outcome,
    winnerSeat: match.result.winnerSeat,
    reason: match.result.reason,
    detail: match.result.detail,
    verificationLabel: "userscript確認・カジュアル対戦",
    countsTowardRecord: match.result.outcome !== "void",
    participants: [
      { seat: "host", atcoderId: match.participants.hostAtcoderId, ...hostCounts },
      { seat: "invitee", atcoderId: match.participants.inviteeAtcoderId, ...inviteeCounts },
    ],
    submissions: match.submissions.map(submissionEntry),
    expiresAt: iso(match.result.decidedAt + MATCH_RETENTION_DAYS * 24 * 60 * 60_000),
  });
}

export async function databaseHealth(): Promise<DatabaseHealth> {
  const pool = getPool();
  if (!pool) {
    return {
      reachable: false,
      migrated: false,
      message: "DATABASE_URLが設定されていません。",
      fix: "apps/web/.env.localへDATABASE_URLを設定し、pnpm db:migrateを実行してください。",
    };
  }
  try {
    await pool.query("select 1");
    const result = await pool.query<{ version: string }>(
      "select version from custom_contest_migrations where version = $1 limit 1",
      [REQUIRED_MIGRATION],
    );
    if (result.rowCount !== 1) {
      return {
        reachable: true,
        migrated: false,
        message: "PostgreSQLには接続できましたが、必要なmigrationが未適用です。",
        fix: "pnpm db:migrateを実行してください。",
      };
    }
    await maybeDeleteExpiredMatches();
    return { reachable: true, migrated: true, message: "PostgreSQLへ接続済みです。", fix: null };
  } catch (error) {
    const missingTable = error instanceof Error && /custom_contest_migrations/.test(error.message);
    return {
      reachable: missingTable,
      migrated: false,
      message: missingTable
        ? "PostgreSQLには接続できましたが、migrationが未適用です。"
        : "PostgreSQLへ接続できません。",
      fix: missingTable
        ? "pnpm db:migrateを実行してください。"
        : "PostgreSQLを起動し、DATABASE_URLを確認してください。",
    };
  }
}

export async function saveStoredMatch(value: StoredMatchResponse): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  const now = new Date();
  await db
    .insert(matchResults)
    .values({
      matchId: value.matchId,
      roomId: value.roomId,
      mode: value.mode,
      limitMinutes: value.limitMinutes,
      seed: value.seed,
      problem: value.problem,
      startedAt: new Date(value.startedAt),
      deadlineAt: new Date(value.deadlineAt),
      decidedAt: new Date(value.decidedAt),
      outcome: value.outcome,
      winnerSeat: value.winnerSeat,
      reason: value.reason,
      detail: value.detail,
      participants: value.participants,
      submissions: value.submissions,
      expiresAt: new Date(value.expiresAt),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: matchResults.matchId,
      set: {
        submissions: value.submissions,
        participants: value.participants,
        detail: value.detail,
        updatedAt: now,
      },
    });
}

export async function loadStoredMatch(matchId: string): Promise<StoredMatchResponse | null> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  await maybeDeleteExpiredMatches();
  const rows = await db.select().from(matchResults).where(eq(matchResults.matchId, matchId)).limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  return storedMatchResponseSchema.parse({
    matchId: row.matchId,
    roomId: row.roomId,
    mode: row.mode,
    limitMinutes: row.limitMinutes,
    seed: row.seed,
    problem: row.problem,
    startedAt: row.startedAt.toISOString(),
    deadlineAt: row.deadlineAt.toISOString(),
    decidedAt: row.decidedAt.toISOString(),
    outcome: row.outcome,
    winnerSeat: row.winnerSeat,
    reason: row.reason,
    detail: row.detail,
    verificationLabel: "userscript確認・カジュアル対戦",
    countsTowardRecord: row.outcome !== "void",
    participants: row.participants,
    submissions: row.submissions,
    expiresAt: row.expiresAt.toISOString(),
  });
}

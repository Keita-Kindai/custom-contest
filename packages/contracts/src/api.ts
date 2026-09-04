import { z } from "zod";
import {
  atcoderIdSchema,
  limitMinutesSchema,
  linkKeySchema,
  matchIdSchema,
  participantKeySchema,
  problemIndexSchema,
  roomIdSchema,
  seatSchema,
  timestampSchema,
  verdictSchema,
} from "./common";
import { problemSchema } from "./problem";
import { matchOutcomeSchema, matchReasonSchema, roomSnapshotSchema, submissionEntrySchema } from "./room";

/**
 * APIのエラー本体。HTTP statusだけでなく、機械可読なcodeと本人向けの直し方を返す。
 * 相手側の画面には露出させない。
 */
export const apiErrorCodeSchema = z.enum([
  "invalid_request",
  "room_not_found",
  "room_closed",
  "room_full",
  "duplicate_atcoder_id",
  "not_a_participant",
  "forbidden",
  "invalid_state",
  "not_host",
  "ready_blocked",
  "start_blocked",
  "rematch_blocked",
  "link_key_invalid",
  "link_key_expired",
  "script_token_invalid",
  "evidence_rejected",
  "fake_evidence_disabled",
  "match_not_found",
  "match_expired",
  "storage_unavailable",
  "problem_pool_empty",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    /** 画面へそのまま出せる日本語の説明。 */
    message: z.string(),
    /** 直し方。ない場合はnull。 */
    fix: z.string().nullable(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// --- POST /api/rooms ---------------------------------------------------------

export const createRoomRequestSchema = z.object({
  atcoderId: atcoderIdSchema,
  limitMinutes: limitMinutesSchema,
  problemIndexes: z.array(problemIndexSchema).min(1).max(2),
});
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;

export const joinedRoomResponseSchema = z.object({
  roomId: roomIdSchema,
  seat: seatSchema,
  /** ブラウザーだけが保存する。他の参加者へ配らない。 */
  participantKey: participantKeySchema,
  snapshot: roomSnapshotSchema,
});
export type JoinedRoomResponse = z.infer<typeof joinedRoomResponseSchema>;

// --- POST /api/rooms/[roomId]/join -------------------------------------------

export const joinRoomRequestSchema = z.object({
  atcoderId: atcoderIdSchema,
  /** 再読み込み後の復帰では既存の参加者キーを渡す。 */
  participantKey: participantKeySchema.optional(),
});
export type JoinRoomRequest = z.infer<typeof joinRoomRequestSchema>;

// --- GET /api/rooms/[roomId] -------------------------------------------------

export const snapshotResponseSchema = z.object({ snapshot: roomSnapshotSchema });
export type SnapshotResponse = z.infer<typeof snapshotResponseSchema>;

// --- 参加者の操作 -------------------------------------------------------------

export const participantRequestSchema = z.object({ participantKey: participantKeySchema });
export type ParticipantRequest = z.infer<typeof participantRequestSchema>;

/** GET snapshotではbodyを持てないため、このheaderで本人の席を特定する。 */
export const PARTICIPANT_KEY_HEADER = "x-custom-contest-participant-key";

export const readyRequestSchema = participantRequestSchema.extend({ ready: z.boolean() });
export type ReadyRequest = z.infer<typeof readyRequestSchema>;

export const forfeitRequestSchema = participantRequestSchema.extend({
  confirmed: z.literal(true),
});
export type ForfeitRequest = z.infer<typeof forfeitRequestSchema>;

export const problemUnavailableRequestSchema = participantRequestSchema.extend({
  detail: z.string().trim().min(1).max(300),
});
export type ProblemUnavailableRequest = z.infer<typeof problemUnavailableRequestSchema>;

export const rematchRequestSchema = participantRequestSchema.extend({
  action: z.enum(["request", "accept", "cancel"]),
});
export type RematchRequest = z.infer<typeof rematchRequestSchema>;

/** Inviteeの明示的な退出と、Hostによる終了。どちらも参加者キーを無効にする。 */
export const leaveRequestSchema = participantRequestSchema.extend({
  action: z.enum(["leave", "close_room", "release_invitee_seat"]),
});
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;

// --- POST /api/rooms/[roomId]/link-key ---------------------------------------

export const issueLinkKeyResponseSchema = z.object({
  linkKey: linkKeySchema,
  expiresAt: timestampSchema,
  /** userscriptへ接続キーを渡すために開くAtCoder URL。fragmentは使用後に消される。 */
  handoffUrl: z.url(),
  snapshot: roomSnapshotSchema,
});
export type IssueLinkKeyResponse = z.infer<typeof issueLinkKeyResponseSchema>;

// --- POST /api/dev/fake-evidence ---------------------------------------------

/** LAN demo・開発・自動testだけで有効。公開productionではroute自体が拒否する。 */
export const fakeEvidenceRequestSchema = participantRequestSchema.extend({
  submissionId: z.number().int().positive().optional(),
  status: z.enum(["pending", "final"]),
  verdict: verdictSchema.optional(),
  language: z.string().max(40).optional(),
  /** 省略時はサーバーの現在時刻。時間外提出の検査をtestするときだけ指定する。 */
  submittedAt: timestampSchema.optional(),
});
export type FakeEvidenceRequest = z.infer<typeof fakeEvidenceRequestSchema>;

// --- GET /api/matches/[matchId] ----------------------------------------------

export const storedMatchResponseSchema = z.object({
  matchId: matchIdSchema,
  roomId: roomIdSchema,
  mode: z.literal("BO1"),
  limitMinutes: z.number().int().positive(),
  seed: z.string(),
  problem: problemSchema,
  startedAt: timestampSchema,
  deadlineAt: timestampSchema,
  decidedAt: timestampSchema,
  outcome: matchOutcomeSchema,
  winnerSeat: seatSchema.nullable(),
  reason: matchReasonSchema,
  detail: z.string().nullable(),
  verificationLabel: z.literal("userscript確認・カジュアル対戦"),
  /** 戦績や直近の対戦へ含めるか。VOIDはfalse。 */
  countsTowardRecord: z.boolean(),
  participants: z.array(
    z.object({
      seat: seatSchema,
      atcoderId: atcoderIdSchema,
      submissionCount: z.number().int().nonnegative(),
      missCount: z.number().int().nonnegative(),
    }),
  ),
  submissions: z.array(submissionEntrySchema),
  expiresAt: timestampSchema,
});
export type StoredMatchResponse = z.infer<typeof storedMatchResponseSchema>;

// --- GET /api/health ---------------------------------------------------------

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  database: z.object({
    reachable: z.boolean(),
    migrated: z.boolean(),
    message: z.string(),
    fix: z.string().nullable(),
  }),
  fakeEvidenceEnabled: z.boolean(),
  problemPool: z.object({ count: z.number().int().nonnegative(), generatedAt: z.string() }),
  serverTime: timestampSchema,
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const matchIdParamSchema = matchIdSchema;

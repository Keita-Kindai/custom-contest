import { z } from "zod";
import {
  atcoderIdSchema,
  evidenceSourceSchema,
  linkKeySchema,
  matchIdSchema,
  roomIdSchema,
  scriptTokenSchema,
  seatSchema,
  timestampSchema,
  verdictSchema,
} from "./common";

/**
 * POST /api/userscript/link
 * 一回限りの接続キーを、ParticipantとRoomに限定した専用tokenへ交換する。
 */
export const linkScriptRequestSchema = z.object({
  linkKey: linkKeySchema,
  /** AtCoderへログイン中のID。開発用プロフィールと一致しない場合もサーバーは接続を受け付け、READYだけを止める。 */
  loginAtcoderId: atcoderIdSchema.nullable(),
  scriptVersion: z.string().max(20),
});
export type LinkScriptRequest = z.infer<typeof linkScriptRequestSchema>;

export const linkScriptResponseSchema = z.object({
  scriptToken: scriptTokenSchema,
  roomId: roomIdSchema,
  seat: seatSchema,
  /** 開発用プロフィールのAtCoder ID。userscriptはログイン中のIDと突き合わせる。 */
  profileAtcoderId: atcoderIdSchema,
  heartbeatIntervalMs: z.number().int().positive(),
  pollIntervalMs: z.number().int().positive(),
});
export type LinkScriptResponse = z.infer<typeof linkScriptResponseSchema>;

/** userscriptがAtCoder側で確認した健全性。READYの前提になる。 */
export const scriptHealthReportSchema = z.object({
  loggedIn: z.boolean(),
  /** ログイン中のAtCoder ID。未ログインならnull。 */
  loginAtcoderId: atcoderIdSchema.nullable(),
  /** 提出判定確認先へのアクセスに成功したか。 */
  judgeReachable: z.boolean(),
  checkedAt: timestampSchema,
});
export type ScriptHealthReport = z.infer<typeof scriptHealthReportSchema>;

/**
 * POST /api/userscript/heartbeat
 * 15秒以内のhealthを送り、監視すべきactive Matchと対象問題を受け取る。
 */
export const heartbeatRequestSchema = z.object({
  scriptToken: scriptTokenSchema,
  health: scriptHealthReportSchema,
});
export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>;

export const activeMatchTargetSchema = z.object({
  matchId: matchIdSchema,
  contestId: z.string(),
  problemId: z.string(),
  /** 監視対象の提出はこの範囲に限る。 */
  startsAt: timestampSchema,
  deadlineAt: timestampSchema,
  /** 未送信通知を破棄してよい時刻。Match終了+5分。 */
  discardOutboxAfter: timestampSchema.nullable(),
  statusJsonPath: z.string(),
  submissionsPath: z.string(),
});
export type ActiveMatchTarget = z.infer<typeof activeMatchTargetSchema>;

export const heartbeatResponseSchema = z.object({
  ok: z.literal(true),
  serverTime: timestampSchema,
  /** 対象がない場合はnull。userscriptは何も送らない。 */
  activeMatch: activeMatchTargetSchema.nullable(),
  pollIntervalMs: z.number().int().positive(),
  heartbeatIntervalMs: z.number().int().positive(),
  /** Roomが閉じた、または席が解放された。userscriptは停止して破棄する。 */
  stopped: z.boolean(),
});
export type HeartbeatResponse = z.infer<typeof heartbeatResponseSchema>;

/**
 * userscriptが送るSubmission evidence。
 * ソースコード本文とコード長は含めない。
 */
export const submissionEvidenceSchema = z
  .object({
    atcoderId: atcoderIdSchema,
    submissionId: z.number().int().positive(),
    contestId: z.string().min(1).max(40),
    problemId: z.string().min(1).max(40),
    submittedAt: timestampSchema,
    /** pendingは「時間内に判定待ちの提出がある」ことだけを伝える。 */
    status: z.enum(["pending", "final"]),
    /** statusがfinalのときだけ必須。 */
    verdict: verdictSchema.nullable(),
    language: z.string().max(60).nullable(),
    source: evidenceSourceSchema,
  })
  .superRefine((value, context) => {
    if (value.status === "final" && value.verdict === null) {
      context.addIssue({ code: "custom", path: ["verdict"], message: "確定判定には判定ラベルが必要です。" });
    }
    if (value.status === "pending" && value.verdict !== null) {
      context.addIssue({ code: "custom", path: ["verdict"], message: "判定待ちには判定ラベルを付けられません。" });
    }
  });
export type SubmissionEvidence = z.infer<typeof submissionEvidenceSchema>;

/**
 * POST /api/userscript/evidence
 * ACKが返るまでuserscript側のoutboxが再送する。同じ提出IDの同じ通知は一度だけ処理する。
 */
export const evidenceRequestSchema = z.object({
  scriptToken: scriptTokenSchema,
  matchId: matchIdSchema,
  submissions: z.array(submissionEvidenceSchema).min(1).max(50),
});
export type EvidenceRequest = z.infer<typeof evidenceRequestSchema>;

export const evidenceRejectionCodeSchema = z.enum([
  "unknown_match",
  "match_not_running",
  "wrong_problem",
  "outside_time_window",
  "atcoder_id_mismatch",
  "duplicate",
  "fake_disabled",
  "invalid_payload",
]);
export type EvidenceRejectionCode = z.infer<typeof evidenceRejectionCodeSchema>;

export const evidenceResponseSchema = z.object({
  ok: z.literal(true),
  serverTime: timestampSchema,
  /** ACK済みの提出ID。userscriptはoutboxから消す。 */
  accepted: z.array(z.number().int().positive()),
  /**
   * 拒否された提出。再送しても結果が変わらないため、userscriptはoutboxから消す。
   * 理由は本人の画面にだけ表示する。
   */
  rejected: z.array(
    z.object({
      submissionId: z.number().int().positive(),
      code: evidenceRejectionCodeSchema,
      message: z.string(),
      fix: z.string().nullable(),
    }),
  ),
});
export type EvidenceResponse = z.infer<typeof evidenceResponseSchema>;

/** Room画面からuserscriptへ接続キーを渡すときのfragment名。 */
export const LINK_KEY_FRAGMENT_PARAM = "cc-link";
export const SCRIPT_HEALTH_FRESHNESS_MS = 15_000;
export const HEARTBEAT_INTERVAL_MS = 5_000;
export const SUBMISSION_POLL_INTERVAL_MS = 5_000;
export const LINK_KEY_TTL_MS = 5 * 60_000;
export const OUTBOX_RETENTION_AFTER_MATCH_MS = 5 * 60_000;

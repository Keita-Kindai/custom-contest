import { z } from "zod";
import {
  atcoderIdSchema,
  evidenceSourceSchema,
  matchIdSchema,
  roomIdSchema,
  roomSettingsSchema,
  seatSchema,
  timestampSchema,
  verdictSchema,
} from "./common";
import { problemSchema } from "./problem";

/**
 * Matchの進行段階。
 * countdown: ホストの開始要求をサーバーが受理し、`3 → 2 → 1 → START`を表示している。
 * live: START後、制限時間内。
 * awaiting_judge: 制限時間を過ぎたが、時間内のPending submissionの最終判定を最大5分待っている。
 * decided: 勝敗・DRAW・VOIDのいずれかが確定した。
 */
export const matchPhaseSchema = z.enum(["countdown", "live", "awaiting_judge", "decided"]);
export type MatchPhase = z.infer<typeof matchPhaseSchema>;

/** Matchのない待機状態を含めた、画面が分岐に使う状態。 */
export const roomViewSchema = z.enum(["waiting", "countdown", "live", "awaiting_judge", "decided", "closed"]);
export type RoomView = z.infer<typeof roomViewSchema>;

export const matchOutcomeSchema = z.enum(["win", "draw", "void"]);
export type MatchOutcome = z.infer<typeof matchOutcomeSchema>;

/**
 * 結果の理由。
 * first_ac: サーバーが最初に受理した有効AC。
 * forfeit: 明示的な棄権。
 * timeout_no_pending: 制限時間切れ時にPending submissionがなかった。
 * timeout_all_non_ac: 時間内のPending submissionが全て非ACで確定した。
 * void_judge_unconfirmed: 制限時間切れから5分たっても判定を確認できなかった。
 * void_problem_unavailable: START後に問題を利用できないと判明した。
 */
export const matchReasonSchema = z.enum([
  "first_ac",
  "forfeit",
  "timeout_no_pending",
  "timeout_all_non_ac",
  "void_judge_unconfirmed",
  "void_problem_unavailable",
]);
export type MatchReason = z.infer<typeof matchReasonSchema>;

export const matchResultSchema = z.object({
  outcome: matchOutcomeSchema,
  winnerSeat: seatSchema.nullable(),
  reason: matchReasonSchema,
  decidedAt: timestampSchema,
  /** VOIDやForfeitの補足。画面へそのまま表示できる日本語。 */
  detail: z.string().nullable(),
  /** 限定公開の結果URL path。 */
  matchPath: z.string(),
  /** 常に「userscript確認・カジュアル対戦」。公式検証済みとは表示しない。 */
  verificationLabel: z.literal("userscript確認・カジュアル対戦"),
});
export type MatchResult = z.infer<typeof matchResultSchema>;

/** 自分の提出履歴。判定・提出時刻・言語まで表示する。 */
export const submissionEntrySchema = z.object({
  submissionId: z.number().int().positive(),
  seat: seatSchema,
  atcoderId: atcoderIdSchema,
  contestId: z.string(),
  problemId: z.string(),
  submittedAt: timestampSchema,
  receivedAt: timestampSchema,
  status: z.enum(["pending", "final"]),
  /** statusがpendingのときはnull。 */
  verdict: verdictSchema.nullable(),
  language: z.string().nullable(),
  source: evidenceSourceSchema,
  /** 勝敗確定後に到着した有効な提出。結果は変更しない。 */
  late: z.boolean(),
});
export type SubmissionEntry = z.infer<typeof submissionEntrySchema>;

/** 対戦中に相手へ見せる範囲。正確な提出時刻と言語は結果確定まで含めない。 */
export const opponentSubmissionSummarySchema = z.object({
  submissionCount: z.number().int().nonnegative(),
  missCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  latestVerdict: verdictSchema.nullable(),
});
export type OpponentSubmissionSummary = z.infer<typeof opponentSubmissionSummarySchema>;

/** READY可否に使う、直近15秒以内のuserscript健全性。 */
export const scriptHealthSchema = z.object({
  linked: z.boolean(),
  loggedIn: z.boolean(),
  idMatched: z.boolean(),
  judgeReachable: z.boolean(),
  fresh: z.boolean(),
  lastHeartbeatAt: timestampSchema.nullable(),
  /** 失敗している場合の直し方。満たしていればnull。 */
  hint: z.string().nullable(),
});
export type ScriptHealth = z.infer<typeof scriptHealthSchema>;

export const participantViewSchema = z.object({
  seat: seatSchema,
  atcoderId: atcoderIdSchema,
  ready: z.boolean(),
  /** 直近のRoom snapshot取得が新しいか。切断でも席は残る。 */
  appConnected: z.boolean(),
  script: scriptHealthSchema,
  submissionCount: z.number().int().nonnegative(),
  missCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  latestVerdict: verdictSchema.nullable(),
  joinedAt: timestampSchema,
});
export type ParticipantView = z.infer<typeof participantViewSchema>;

export const matchViewSchema = z.object({
  matchId: matchIdSchema,
  roundIndex: z.literal(1),
  phase: matchPhaseSchema,
  /** 抽選seed。結果と一緒に保存する。 */
  seed: z.string(),
  startsAt: timestampSchema,
  deadlineAt: timestampSchema,
  /** awaiting_judgeの期限。それ以外はnull。 */
  graceUntil: timestampSchema.nullable(),
  /** START時刻より前はnull。問題をSTART前に配信しない。 */
  problem: problemSchema.nullable(),
  /** 自分の提出履歴。結果確定後は相手の履歴も含む。 */
  submissions: z.array(submissionEntrySchema),
  /** 対戦中の相手の要約。結果確定後はsubmissionsを参照する。 */
  opponent: opponentSubmissionSummarySchema,
  result: matchResultSchema.nullable(),
  /** 完了Matchの保存状態。savedになるまで再戦を許可しない。 */
  persistence: z.enum(["not_required", "pending", "saved"]),
  persistenceMessage: z.string().nullable(),
});
export type MatchView = z.infer<typeof matchViewSchema>;

export const rematchViewSchema = z.object({
  requestedBy: seatSchema.nullable(),
  requestedAt: timestampSchema.nullable(),
  /** 保存待ちや対戦中は再戦できない。 */
  available: z.boolean(),
  blockedReason: z.string().nullable(),
});
export type RematchView = z.infer<typeof rematchViewSchema>;

export const roomClosedReasonSchema = z.enum(["host_closed", "idle_timeout"]);
export type RoomClosedReason = z.infer<typeof roomClosedReasonSchema>;

/** 1秒polling で取得するRoomの全体像。差分ではなく常に全体を返す。 */
export const roomSnapshotSchema = z.object({
  roomId: roomIdSchema,
  revision: z.number().int().nonnegative(),
  /** サーバーの基準時刻。クライアントはこれを基準にタイマーを描画する。 */
  serverTime: timestampSchema,
  view: roomViewSchema,
  settings: roomSettingsSchema,
  /** snapshotを受け取った本人の席。 */
  viewerSeat: seatSchema,
  self: participantViewSchema,
  opponent: participantViewSchema.nullable(),
  match: matchViewSchema.nullable(),
  rematch: rematchViewSchema,
  /** 自分がREADYにできるか。できない場合はreadyBlockedReasonへ理由を入れる。 */
  canReady: z.boolean(),
  readyBlockedReason: z.string().nullable(),
  /** Hostだけがtrueになり得る。 */
  canStart: z.boolean(),
  startBlockedReason: z.string().nullable(),
  canForfeit: z.boolean(),
  canReleaseInviteeSeat: z.boolean(),
  closed: z.boolean(),
  closedReason: roomClosedReasonSchema.nullable(),
  /** 本人にだけ見せるSubmission evidenceの拒否理由。 */
  notices: z.array(
    z.object({
      id: z.string(),
      level: z.enum(["info", "warning", "error"]),
      message: z.string(),
      fix: z.string().nullable(),
      at: timestampSchema,
    }),
  ),
  /** Fake提出の受付が有効か。公開版ではfalse。 */
  fakeEvidenceEnabled: z.boolean(),
  /** 完了済みMatchの限定公開URL path。新しい順。 */
  finishedMatches: z.array(
    z.object({
      matchId: matchIdSchema,
      matchPath: z.string(),
      outcome: matchOutcomeSchema,
      winnerSeat: seatSchema.nullable(),
      decidedAt: timestampSchema,
    }),
  ),
});
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;

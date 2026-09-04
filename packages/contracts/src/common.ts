import { z } from "zod";

/** Roomの座席。Hostは作成者、Inviteeは招待URLまたはRoom IDから入った参加者。 */
export const seatSchema = z.enum(["host", "invitee"]);
export type Seat = z.infer<typeof seatSchema>;

/** 実際の参加者か、開発・LANデモ専用のテスト相手か。 */
export const participantKindSchema = z.enum(["human", "fake"]);
export type ParticipantKind = z.infer<typeof participantKindSchema>;

export const OPPONENT_SEAT: Record<Seat, Seat> = {
  host: "invitee",
  invitee: "host",
};

/** Room ID。読み間違えやすい文字を除いた6文字。 */
export const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_ID_LENGTH = 6;
export const roomIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`), "Room IDは6文字です。");

/** 推測困難な限定公開Match URLのID。Room IDからは推測できない。 */
export const matchIdSchema = z.string().regex(/^m_[0-9a-f]{26}$/);

/** ブラウザーが端末内へ保存する参加者キー。席の回復と操作の認可に使う。 */
export const participantKeySchema = z.string().regex(/^pk_[0-9a-f]{32}$/);

/** Room画面が発行する一回限りの接続キー。5分で期限切れ。 */
export const linkKeySchema = z.string().regex(/^lk_[0-9a-f]{24}$/);

/** 接続キーと交換したuserscript専用token。ParticipantとRoomに限定される。 */
export const scriptTokenSchema = z.string().regex(/^st_[0-9a-f]{40}$/);

/** AtCoder ID。AtCoderのユーザー名規則にあわせる。 */
export const atcoderIdSchema = z
  .string()
  .trim()
  .min(3, "AtCoder IDは3文字以上です。")
  .max(16, "AtCoder IDは16文字以下です。")
  .regex(/^[A-Za-z0-9_]+$/, "AtCoder IDは英数字とアンダースコアだけです。");

/** サーバー時刻を基準にしたISO 8601文字列。クライアントは自分の時計を加算しない。 */
export const timestampSchema = z.iso.datetime();

/** AtCoderから取得した確定判定ラベル。AC以外は勝利条件にならない。 */
export const KNOWN_VERDICTS = ["AC", "WA", "TLE", "MLE", "RE", "CE", "OLE", "IE", "QLE", "NG"] as const;
export const verdictSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,4}$/, "判定ラベルの形式が想定と異なります。");
export type Verdict = z.infer<typeof verdictSchema>;

export const ACCEPTED_VERDICT = "AC";
export function isAcceptedVerdict(verdict: string): boolean {
  return verdict.trim().toUpperCase() === ACCEPTED_VERDICT;
}

/** 実判定かFake判定か。Fakeはdemo・開発・自動testだけで受け付ける。 */
export const evidenceSourceSchema = z.enum(["atcoder", "fake"]);
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;

export const LIMIT_MINUTES = [10, 20, 30] as const;
export const limitMinutesSchema = z.union([z.literal(10), z.literal(20), z.literal(30)]);
export type LimitMinutes = z.infer<typeof limitMinutesSchema>;

export const problemIndexSchema = z.enum(["C", "D"]);
export type ProblemIndex = z.infer<typeof problemIndexSchema>;

export const roomSettingsSchema = z.object({
  mode: z.literal("BO1"),
  limitMinutes: limitMinutesSchema,
  problemIndexes: z.array(problemIndexSchema).min(1),
  difficultyMin: z.number().int(),
  difficultyMax: z.number().int(),
});
export type RoomSettings = z.infer<typeof roomSettingsSchema>;

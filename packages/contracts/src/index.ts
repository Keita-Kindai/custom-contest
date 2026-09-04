import { z } from "zod";

export * from "./common";
export * from "./problem";
export * from "./room";
export * from "./api";
export * from "./userscript";

export const projectSummarySchema = z.object({
  name: z.string().min(1),
  tagline: z.string().min(1),
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const projectSummary = projectSummarySchema.parse({
  name: "Custom Contest",
  tagline: "競技プログラミングを、もっと手軽に・ゲーム感覚で・友達と。",
});

/** 対戦の時間定数。domainとuserscriptで同じ値を使う。 */
export const COUNTDOWN_MS = 3_000;
export const PENDING_GRACE_MS = 5 * 60_000;
export const APP_CONNECTION_TIMEOUT_MS = 3_000;
export const IDLE_ROOM_TIMEOUT_MS = 30 * 60_000;
export const SNAPSHOT_POLL_INTERVAL_MS = 1_000;
export const MATCH_RETENTION_DAYS = 90;
export const RESULT_SAVE_RETRY_INTERVAL_MS = 5_000;

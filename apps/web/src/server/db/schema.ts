import type { Problem, StoredMatchResponse, SubmissionEntry } from "@custom-contest/contracts";
import { index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const matchResults = pgTable(
  "match_results",
  {
    matchId: varchar("match_id", { length: 28 }).primaryKey(),
    roomId: varchar("room_id", { length: 6 }).notNull(),
    mode: varchar("mode", { length: 8 }).notNull(),
    limitMinutes: integer("limit_minutes").notNull(),
    seed: text("seed").notNull(),
    problem: jsonb("problem").$type<Problem>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
    outcome: varchar("outcome", { length: 8 }).notNull(),
    winnerSeat: varchar("winner_seat", { length: 8 }),
    reason: varchar("reason", { length: 40 }).notNull(),
    detail: text("detail"),
    participants: jsonb("participants").$type<StoredMatchResponse["participants"]>().notNull(),
    submissions: jsonb("submissions").$type<SubmissionEntry[]>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("match_results_expires_at_idx").on(table.expiresAt)],
);

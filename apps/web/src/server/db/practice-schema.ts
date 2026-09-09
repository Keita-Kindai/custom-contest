import type { BandKey, ProblemSetStatus, ProblemSetTag, SolveStatus, Visibility } from "@custom-contest/contracts";
import { relations } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth-schema";

/**
 * 精進（問題セット）側の永続化（ADR-0011）。
 * `0003_problem_sets.sql`と対になる。列の追加はSQLとこのファイルの両方へ入れる。
 *
 * 対戦側の`match_results`（schema.ts）とは独立していて、共有するのは`users`だけ。
 */

/**
 * AtCoderの問題カタログ。`packages/domain`の固定JSONから流し込む。
 *
 * 問題検索はこのtableを読まない。入力のたびに走る最多の処理なので、
 * DBに当てるとNeonのCU-hoursをここで使い切る（ADR-0010）。
 * このtableが要るのは、`problemSetItems`の参照先になることと、
 * セット表示時にJOINして現在の問題名・Difficultyを返すため。
 */
export const problems = pgTable(
  "problems",
  {
    /** AtCoderのtaskScreenName。 */
    problemId: varchar("problem_id", { length: 64 }).primaryKey(),
    contestId: varchar("contest_id", { length: 32 }).notNull(),
    problemIndex: varchar("problem_index", { length: 8 }).notNull(),
    title: text("title").notNull(),
    /** 非公式のDifficulty目安。推定値がない問題はnull。 */
    difficulty: integer("difficulty"),
    /** 一覧で桁を揃えるための短い出典表記。`ABC300 C`、`EDPC B`など。 */
    source: varchar("source", { length: 32 }).notNull(),
    tags: text("tags").array().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("problems_difficulty_idx").on(table.difficulty)],
);

export const problemSets = pgTable(
  "problem_sets",
  {
    /** `ps_` + 英数36種10文字。限定公開はこのIDの推測しにくさに依存する。 */
    setId: varchar("set_id", { length: 13 }).primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 60 }).notNull(),
    description: varchar("description", { length: 400 }).notNull().default(""),
    /** 事前定義の12種から最大6個。CHECK制約はSQL側にある。 */
    tags: text("tags").array().$type<ProblemSetTag[]>().notNull().default([]),
    /** 作成者が想定した対象のrating色。押した段だけを持つ。 */
    targetBands: text("target_bands").array().$type<BandKey[]>().notNull().default([]),
    visibility: varchar("visibility", { length: 8 }).$type<Visibility>().notNull(),
    status: varchar("status", { length: 9 }).$type<ProblemSetStatus>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("problem_sets_tags_idx").using("gin", table.tags),
    index("problem_sets_bands_idx").using("gin", table.targetBands),
    index("problem_sets_discover_idx").on(table.visibility, table.status, table.updatedAt.desc()),
    index("problem_sets_owner_idx").on(table.ownerId, table.updatedAt.desc()),
  ],
);

/**
 * セットに入っている問題と、その並び順。
 * 1セット50問の上限はDBに置かない。行数のCHECKにはトリガが要るため、
 * `problemSetSchema`と保存前の検証で守る。
 */
export const problemSetItems = pgTable(
  "problem_set_items",
  {
    setId: varchar("set_id", { length: 13 })
      .notNull()
      .references(() => problemSets.setId, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** 使われている問題はカタログから消せない。黙って穴が空くより止める。 */
    problemId: varchar("problem_id", { length: 64 })
      .notNull()
      .references(() => problems.problemId, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.setId, table.position] }),
    // 同じ問題を1つのセットへ2回入れない。
    // set_problem_statusの複合外部キーもこの一意性を必要とする。
    unique("problem_set_items_unique_problem").on(table.setId, table.problemId),
    index("problem_set_items_problem_idx").on(table.problemId),
  ],
);

export const problemSetLikes = pgTable(
  "problem_set_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    setId: varchar("set_id", { length: 13 })
      .notNull()
      .references(() => problemSets.setId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.setId] }),
    // いいね数はCOUNT(*)で出す。非正規化した列は置かない。
    index("problem_set_likes_set_idx").on(table.setId),
  ],
);

export const problemSetBookmarks = pgTable(
  "problem_set_bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    setId: varchar("set_id", { length: 13 })
      .notNull()
      .references(() => problemSets.setId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.setId] }),
    index("problem_set_bookmarks_set_idx").on(table.setId),
  ],
);

/** 「最近使用」。履歴ではなく最後に開いた時刻だけを持つので、1人1セット1行に収まる。 */
export const problemSetViews = pgTable(
  "problem_set_views",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    setId: varchar("set_id", { length: 13 })
      .notNull()
      .references(() => problemSets.setId, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.setId] }),
    index("problem_set_views_recent_idx").on(table.userId, table.viewedAt.desc()),
  ],
);

/**
 * 挑戦状態。セットの中で閉じる（DESIGN-108）。
 * 同じ問題を含む別のセットは別の記録を持つ。
 *
 * 「未着手」は既定値なので行を置かない。読み出し側は行がなければ未着手として扱う。
 */
export const setProblemStatus = pgTable(
  "set_problem_status",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    setId: varchar("set_id", { length: 13 }).notNull(),
    problemId: varchar("problem_id", { length: 64 }).notNull(),
    /** `solved`か`solved_with_editorial`のみ。CHECK制約はSQL側にある。 */
    status: varchar("status", { length: 21 }).$type<Exclude<SolveStatus, "unsolved">>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.setId, table.problemId] }),
    // セットから問題を外したら、そのセットでの記録も消す。
    foreignKey({
      columns: [table.setId, table.problemId],
      foreignColumns: [problemSetItems.setId, problemSetItems.problemId],
      name: "set_problem_status_item_fk",
    }).onDelete("cascade"),
    index("set_problem_status_set_idx").on(table.userId, table.setId),
  ],
);

export const problemSetsRelations = relations(problemSets, ({ one, many }) => ({
  owner: one(users, { fields: [problemSets.ownerId], references: [users.id] }),
  items: many(problemSetItems),
  likes: many(problemSetLikes),
}));

export const problemSetItemsRelations = relations(problemSetItems, ({ one }) => ({
  set: one(problemSets, { fields: [problemSetItems.setId], references: [problemSets.setId] }),
  problem: one(problems, { fields: [problemSetItems.problemId], references: [problems.problemId] }),
}));

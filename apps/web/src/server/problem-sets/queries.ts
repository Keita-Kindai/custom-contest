import {
  type CatalogProblem,
  type DiscoverQuery,
  type LibraryTab,
  type ProblemSet,
  type ProblemSetInput,
  type ProblemSetSummary,
  type SetSolveStatusMap,
  type SolveStatus,
  type SolveStatusMap,
} from "@custom-contest/contracts";
import { and, arrayOverlaps, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { users } from "@/server/db/auth-schema";
import { getDb } from "@/server/db/client";
import {
  problemSetBookmarks,
  problemSetItems,
  problemSetLikes,
  problemSetViews,
  problemSets,
  problems,
  setProblemStatus,
} from "@/server/db/practice-schema";

/**
 * 問題セットの読み書き（ADR-0011）。
 *
 * ここはserverだけが呼ぶ。`viewerId`は必ず呼び出し元がsessionから渡すもので、
 * clientから受け取った値を入れてはいけない。
 *
 * 公開範囲の判定もここで行う。画面側で隠すだけでは、URLを直接叩かれたときに素通りする。
 */

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("DATABASE_URLが未設定です。");
    this.name = "DatabaseUnavailableError";
  }
}

function db() {
  const instance = getDb();
  if (!instance) throw new DatabaseUnavailableError();
  return instance;
}

/** いいね数はCOUNT(*)で出す。非正規化した列は置かない。 */
const likeCount = sql<number>`(
  select count(*)::int from ${problemSetLikes} where ${problemSetLikes.setId} = ${problemSets.setId}
)`;

const problemCount = sql<number>`(
  select count(*)::int from ${problemSetItems} where ${problemSetItems.setId} = ${problemSets.setId}
)`;

/** カードが必要とする問題IDとDifficultyだけを、1回のqueryで並べて取る。 */
const problemIds = sql<string[]>`coalesce((
  select array_agg(${problemSetItems.problemId} order by ${problemSetItems.position})
  from ${problemSetItems} where ${problemSetItems.setId} = ${problemSets.setId}
), '{}')`;

const difficulties = sql<(number | null)[]>`coalesce((
  select array_agg(${problems.difficulty} order by ${problemSetItems.position})
  from ${problemSetItems}
  join ${problems} on ${problems.problemId} = ${problemSetItems.problemId}
  where ${problemSetItems.setId} = ${problemSets.setId}
), '{}')`;

const summaryColumns = {
  setId: problemSets.setId,
  title: problemSets.title,
  tags: problemSets.tags,
  visibility: problemSets.visibility,
  status: problemSets.status,
  targetBands: problemSets.targetBands,
  updatedAt: problemSets.updatedAt,
  authorName: users.displayName,
  fallbackName: users.name,
  likeCount,
  problemCount,
  problemIds,
  difficulties,
};

type SummaryRow = {
  setId: string;
  title: string;
  tags: ProblemSetSummary["tags"];
  visibility: ProblemSetSummary["visibility"];
  status: ProblemSetSummary["status"];
  targetBands: ProblemSetSummary["targetBands"];
  updatedAt: Date;
  authorName: string | null;
  fallbackName: string | null;
  likeCount: number;
  problemCount: number;
  problemIds: string[];
  difficulties: (number | null)[];
};

function toSummary(row: SummaryRow): ProblemSetSummary {
  const values = row.difficulties.filter((value): value is number => value !== null);
  return {
    setId: row.setId,
    title: row.title,
    tags: row.tags,
    visibility: row.visibility,
    status: row.status,
    // display_nameは初回ログインで埋まるが、埋まる前の行に備えて素の名前へ落とす。
    authorName: row.authorName ?? row.fallbackName ?? "名前未設定",
    likeCount: row.likeCount,
    updatedAt: row.updatedAt.toISOString(),
    targetBands: row.targetBands,
    problemCount: row.problemCount,
    problemIds: row.problemIds,
    difficultyRange:
      values.length === 0 ? null : { min: Math.min(...values), max: Math.max(...values) },
  };
}

/** Discoverの一覧へ載せてよい条件。下書き・非公開・限定公開は載せない。 */
const listableInDiscover = and(
  eq(problemSets.visibility, "public"),
  eq(problemSets.status, "published"),
);

export async function discover(query: DiscoverQuery): Promise<ProblemSetSummary[]> {
  const conditions = [listableInDiscover];

  // タグは「選んだタグをすべて含む」。想定者は「どれか1色でも当てはまる」。
  // 想定者を全色一致にすると、緑を選んだだけで「茶・緑」向けのセットが消える。
  if (query.tags.length > 0) conditions.push(sql`${problemSets.tags} @> ${query.tags}`);
  if (query.bands.length > 0) conditions.push(arrayOverlaps(problemSets.targetBands, query.bands));
  if (query.q) {
    const term = `%${query.q}%`;
    conditions.push(
      or(ilike(problemSets.title, term), ilike(problemSets.description, term), ilike(users.displayName, term))!,
    );
  }

  const rows = await db()
    .select(summaryColumns)
    .from(problemSets)
    .innerJoin(users, eq(users.id, problemSets.ownerId))
    .where(and(...conditions))
    .orderBy(
      query.sort === "new" ? desc(problemSets.updatedAt) : desc(likeCount),
      desc(problemSets.updatedAt),
    );

  // Difficultyの絞り込みは、セットに入っている問題の幅で判定する。
  // 幅はJOINの集計なのでSQLのWHEREへ持ち込みにくく、取得後に落とす。
  return rows
    .map(toSummary)
    .filter((summary) => matchesDifficulty(summary, query.difficultyMin, query.difficultyMax));
}

function matchesDifficulty(
  summary: ProblemSetSummary,
  min: number | null,
  max: number | null,
): boolean {
  if (min === null && max === null) return true;
  const range = summary.difficultyRange;
  if (range === null) return false;
  if (min !== null && range.max < min) return false;
  if (max !== null && range.min > max) return false;
  return true;
}

export async function featured(kind: "new" | "liked"): Promise<ProblemSetSummary[]> {
  const rows = await db()
    .select(summaryColumns)
    .from(problemSets)
    .innerJoin(users, eq(users.id, problemSets.ownerId))
    .where(listableInDiscover)
    .orderBy(kind === "new" ? desc(problemSets.updatedAt) : desc(likeCount), desc(problemSets.updatedAt))
    .limit(4);
  return rows.map(toSummary);
}

/**
 * セット1件。可視性の判定込みで、見せてよくない相手にはnullを返す。
 *
 * 本人は常に見られる。他人は公開済みの公開・限定公開だけ。
 * 限定公開は`set_id`が推測できないことに依存する。
 */
export async function getSet(setId: string, viewerId: string | null): Promise<ProblemSet | null> {
  const [row] = await db()
    .select({
      setId: problemSets.setId,
      ownerId: problemSets.ownerId,
      title: problemSets.title,
      description: problemSets.description,
      tags: problemSets.tags,
      targetBands: problemSets.targetBands,
      visibility: problemSets.visibility,
      status: problemSets.status,
      createdAt: problemSets.createdAt,
      updatedAt: problemSets.updatedAt,
      authorName: users.displayName,
      fallbackName: users.name,
      likeCount,
    })
    .from(problemSets)
    .innerJoin(users, eq(users.id, problemSets.ownerId))
    .where(eq(problemSets.setId, setId))
    .limit(1);

  if (!row) return null;

  const isOwner = viewerId !== null && row.ownerId === viewerId;
  const openToOthers = row.status === "published" && row.visibility !== "private";
  if (!isOwner && !openToOthers) return null;

  const items = await listProblems(setId);

  return {
    setId: row.setId,
    title: row.title,
    description: row.description,
    tags: row.tags,
    targetBands: row.targetBands,
    visibility: row.visibility,
    status: row.status,
    problems: items,
    authorName: row.authorName ?? row.fallbackName ?? "名前未設定",
    likeCount: row.likeCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** セットに入っている問題を、現在のカタログの値で返す。 */
async function listProblems(setId: string): Promise<CatalogProblem[]> {
  const rows = await db()
    .select({
      problemId: problems.problemId,
      contestId: problems.contestId,
      problemIndex: problems.problemIndex,
      title: problems.title,
      difficulty: problems.difficulty,
      source: problems.source,
      tags: problems.tags,
    })
    .from(problemSetItems)
    .innerJoin(problems, eq(problems.problemId, problemSetItems.problemId))
    .where(eq(problemSetItems.setId, setId))
    .orderBy(asc(problemSetItems.position));
  return rows;
}

/** セットの持ち主。いない場合はnull。 */
export async function ownerOf(setId: string): Promise<string | null> {
  const [row] = await db()
    .select({ ownerId: problemSets.ownerId })
    .from(problemSets)
    .where(eq(problemSets.setId, setId))
    .limit(1);
  return row?.ownerId ?? null;
}

/**
 * セットを作る、または上書きする。
 *
 * 問題は入れ替えで書く。並び順の付け直しを差分で表そうとすると、
 * 一意制約に一時的に触れる順序が出るため、全部消してから入れ直す。
 */
export async function saveSet(set: ProblemSetInput, ownerId: string): Promise<void> {
  await db().transaction(async (tx) => {
    await tx
      .insert(problemSets)
      .values({
        setId: set.setId,
        ownerId,
        title: set.title,
        description: set.description,
        tags: set.tags,
        targetBands: set.targetBands,
        visibility: set.visibility,
        status: set.status,
      })
      .onConflictDoUpdate({
        target: problemSets.setId,
        set: {
          title: set.title,
          description: set.description,
          tags: set.tags,
          targetBands: set.targetBands,
          visibility: set.visibility,
          status: set.status,
          updatedAt: new Date(),
        },
      });

    await tx.delete(problemSetItems).where(eq(problemSetItems.setId, set.setId));
    if (set.problems.length > 0) {
      await tx.insert(problemSetItems).values(
        set.problems.map((problem, position) => ({
          setId: set.setId,
          position,
          problemId: problem.problemId,
        })),
      );
    }
  });
}

export async function removeSet(setId: string): Promise<void> {
  await db().delete(problemSets).where(eq(problemSets.setId, setId));
}

export async function library(tab: LibraryTab, viewerId: string): Promise<ProblemSetSummary[]> {
  const base = db()
    .select(summaryColumns)
    .from(problemSets)
    .innerJoin(users, eq(users.id, problemSets.ownerId));

  if (tab === "created") {
    const rows = await base
      .where(eq(problemSets.ownerId, viewerId))
      .orderBy(desc(problemSets.updatedAt));
    return rows.map(toSummary);
  }

  if (tab === "recent") {
    const rows = await base
      .innerJoin(problemSetViews, eq(problemSetViews.setId, problemSets.setId))
      .where(and(eq(problemSetViews.userId, viewerId), visibleToViewer(viewerId)))
      .orderBy(desc(problemSetViews.viewedAt))
      .limit(12);
    return rows.map(toSummary);
  }

  const table = tab === "liked" ? problemSetLikes : problemSetBookmarks;
  const rows = await base
    .innerJoin(table, eq(table.setId, problemSets.setId))
    .where(and(eq(table.userId, viewerId), visibleToViewer(viewerId)))
    .orderBy(desc(table.createdAt));
  return rows.map(toSummary);
}

/**
 * 保存やいいねをしたあとで、相手が非公開へ変えることがある。
 * その場合はライブラリからも見えなくする。自分のセットは常に見える。
 */
function visibleToViewer(viewerId: string) {
  return or(
    eq(problemSets.ownerId, viewerId),
    and(eq(problemSets.status, "published"), sql`${problemSets.visibility} <> 'private'`),
  )!;
}

export async function counts(viewerId: string): Promise<Record<LibraryTab, number>> {
  const [row] = await db()
    .select({
      created: sql<number>`(select count(*)::int from ${problemSets} where ${problemSets.ownerId} = ${viewerId})`,
      liked: sql<number>`(select count(*)::int from ${problemSetLikes} where ${problemSetLikes.userId} = ${viewerId})`,
      bookmarked: sql<number>`(select count(*)::int from ${problemSetBookmarks} where ${problemSetBookmarks.userId} = ${viewerId})`,
      recent: sql<number>`(select count(*)::int from ${problemSetViews} where ${problemSetViews.userId} = ${viewerId})`,
    })
    .from(sql`(select 1) as one`);
  return row ?? { created: 0, liked: 0, bookmarked: 0, recent: 0 };
}

export type ViewerState = { isOwner: boolean; liked: boolean; bookmarked: boolean };

/** この人がそのセットに対して持っている関係。未ログインならすべてfalse。 */
export async function viewerState(setId: string, viewerId: string | null): Promise<ViewerState> {
  if (!viewerId) return { isOwner: false, liked: false, bookmarked: false };
  const owner = await ownerOf(setId);
  const [liked] = await db()
    .select({ setId: problemSetLikes.setId })
    .from(problemSetLikes)
    .where(and(eq(problemSetLikes.userId, viewerId), eq(problemSetLikes.setId, setId)))
    .limit(1);
  const [bookmarked] = await db()
    .select({ setId: problemSetBookmarks.setId })
    .from(problemSetBookmarks)
    .where(and(eq(problemSetBookmarks.userId, viewerId), eq(problemSetBookmarks.setId, setId)))
    .limit(1);
  return { isOwner: owner === viewerId, liked: Boolean(liked), bookmarked: Boolean(bookmarked) };
}

export async function toggleLike(setId: string, viewerId: string): Promise<boolean> {
  const { liked } = await viewerState(setId, viewerId);
  if (liked) {
    await db()
      .delete(problemSetLikes)
      .where(and(eq(problemSetLikes.userId, viewerId), eq(problemSetLikes.setId, setId)));
    return false;
  }
  await db().insert(problemSetLikes).values({ userId: viewerId, setId }).onConflictDoNothing();
  return true;
}

export async function toggleBookmark(setId: string, viewerId: string): Promise<boolean> {
  const { bookmarked } = await viewerState(setId, viewerId);
  if (bookmarked) {
    await db()
      .delete(problemSetBookmarks)
      .where(and(eq(problemSetBookmarks.userId, viewerId), eq(problemSetBookmarks.setId, setId)));
    return false;
  }
  await db().insert(problemSetBookmarks).values({ userId: viewerId, setId }).onConflictDoNothing();
  return true;
}

export async function markRecent(setId: string, viewerId: string): Promise<void> {
  await db()
    .insert(problemSetViews)
    .values({ userId: viewerId, setId })
    .onConflictDoUpdate({
      target: [problemSetViews.userId, problemSetViews.setId],
      set: { viewedAt: new Date() },
    });
}

export async function solveStatuses(setId: string, viewerId: string): Promise<SolveStatusMap> {
  const rows = await db()
    .select({ problemId: setProblemStatus.problemId, status: setProblemStatus.status })
    .from(setProblemStatus)
    .where(and(eq(setProblemStatus.userId, viewerId), eq(setProblemStatus.setId, setId)));
  return Object.fromEntries(rows.map((row) => [row.problemId, row.status]));
}

export async function allSolveStatuses(viewerId: string): Promise<SetSolveStatusMap> {
  const rows = await db()
    .select({
      setId: setProblemStatus.setId,
      problemId: setProblemStatus.problemId,
      status: setProblemStatus.status,
    })
    .from(setProblemStatus)
    .where(eq(setProblemStatus.userId, viewerId));

  const grouped: SetSolveStatusMap = {};
  for (const row of rows) {
    (grouped[row.setId] ??= {})[row.problemId] = row.status;
  }
  return grouped;
}

/**
 * 挑戦状態を書く。「未着手」は既定値なので行を残さず消す。
 * `(set_id, problem_id)`の外部キーがあるので、セットに入っていない問題は書けない。
 */
export async function setSolveStatus(
  setId: string,
  problemId: string,
  status: SolveStatus,
  viewerId: string,
): Promise<SolveStatusMap> {
  if (status === "unsolved") {
    await db()
      .delete(setProblemStatus)
      .where(
        and(
          eq(setProblemStatus.userId, viewerId),
          eq(setProblemStatus.setId, setId),
          eq(setProblemStatus.problemId, problemId),
        ),
      );
  } else {
    await db()
      .insert(setProblemStatus)
      .values({ userId: viewerId, setId, problemId, status })
      .onConflictDoUpdate({
        target: [setProblemStatus.userId, setProblemStatus.setId, setProblemStatus.problemId],
        set: { status, updatedAt: new Date() },
      });
  }
  return solveStatuses(setId, viewerId);
}

/** カタログに存在するproblemIdだけを残す。保存前の検証に使う。 */
export async function existingProblemIds(ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db()
    .select({ problemId: problems.problemId })
    .from(problems)
    .where(inArray(problems.problemId, [...ids]));
  return new Set(rows.map((row) => row.problemId));
}

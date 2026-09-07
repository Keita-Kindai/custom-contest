import { z } from "zod";
import { atcoderIdSchema, timestampSchema } from "./common";

/**
 * 問題セット（精進）側の契約。
 * 対戦側のRoom/Matchとは独立していて、共有するのは問題データの考え方だけ。
 */

/** 検索カタログの1問。対戦側の`problemSchema`と違い、問題記号はC/Dに限らない。 */
export const catalogProblemSchema = z.object({
  /** AtCoderのtaskScreenName。 */
  problemId: z.string().min(1),
  contestId: z.string().min(1),
  problemIndex: z.string().min(1),
  title: z.string().min(1),
  /** 非公式のDifficulty目安。EDPCや典型90のように推定値がない問題はnull。 */
  difficulty: z.number().int().nullable(),
  /** 一覧で桁を揃えるための短い出典表記。`ABC300 C`、`EDPC B`など。 */
  source: z.string().min(1),
  tags: z.array(z.string()),
});
export type CatalogProblem = z.infer<typeof catalogProblemSchema>;

/** 押して有効化する事前定義タグ。自由入力は受け付けない。 */
export const PROBLEM_SET_TAGS = [
  "DP",
  "グラフ",
  "数学",
  "二分探索",
  "全探索",
  "典型",
  "典型90",
  "EDPC",
  "初級",
  "中級",
  "上級",
  "短時間",
] as const;
export const problemSetTagSchema = z.enum(PROBLEM_SET_TAGS);
export type ProblemSetTag = z.infer<typeof problemSetTagSchema>;

/** 公開範囲。実際のaccess制御はDBと認証の導入まで効かない。 */
export const visibilitySchema = z.enum(["public", "unlisted", "private"]);
export type Visibility = z.infer<typeof visibilitySchema>;

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: "公開",
  unlisted: "限定公開",
  private: "非公開",
};

/** 保存済みか下書きか。下書きは一覧で公開範囲の代わりに「下書き」を出す。 */
export const problemSetStatusSchema = z.enum(["draft", "published"]);
export type ProblemSetStatus = z.infer<typeof problemSetStatusSchema>;

export const problemSetIdSchema = z.string().regex(/^ps_[0-9a-z]{10}$/);

/** セットに入っている1問。カタログからコピーして保存する。 */
export const problemSetItemSchema = catalogProblemSchema;
export type ProblemSetItem = z.infer<typeof problemSetItemSchema>;

export const problemSetSchema = z.object({
  setId: problemSetIdSchema,
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().max(400),
  tags: z.array(problemSetTagSchema).max(6),
  visibility: visibilitySchema,
  status: problemSetStatusSchema,
  problems: z.array(problemSetItemSchema).max(50),
  /** 認証がないため暫定値。DBと認証の導入まで実データにならない。 */
  authorName: atcoderIdSchema,
  likeCount: z.number().int().nonnegative(),
  useCount: z.number().int().nonnegative(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type ProblemSet = z.infer<typeof problemSetSchema>;

/**
 * 一覧のカードが必要とする形。
 * 13章のカード共通フォーマット（タイトル／カテゴリ・作者／いいね数／公開状態）に対応する。
 */
export const problemSetSummarySchema = problemSetSchema
  .pick({
    setId: true,
    title: true,
    tags: true,
    visibility: true,
    status: true,
    authorName: true,
    likeCount: true,
    updatedAt: true,
  })
  .extend({
    problemCount: z.number().int().nonnegative(),
    /** Difficultyを持つ問題だけから求めた範囲。1問もなければnull。 */
    difficultyRange: z.object({ min: z.number().int(), max: z.number().int() }).nullable(),
    estimatedMinutes: z.number().int().nonnegative(),
  });
export type ProblemSetSummary = z.infer<typeof problemSetSummarySchema>;

/** Discoverの並び替え。 */
export const problemSetSortSchema = z.enum(["popular", "new", "liked"]);
export type ProblemSetSort = z.infer<typeof problemSetSortSchema>;

export const PROBLEM_SET_SORT_LABEL: Record<ProblemSetSort, string> = {
  popular: "人気順",
  new: "新着順",
  liked: "いいね順",
};

export const discoverQuerySchema = z.object({
  q: z.string().trim().max(80).default(""),
  tags: z.array(problemSetTagSchema).default([]),
  sort: problemSetSortSchema.default("popular"),
  difficultyMin: z.number().int().nullable().default(null),
  difficultyMax: z.number().int().nullable().default(null),
});
export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;

/** ライブラリ（マイページ）のタブ。 */
export const libraryTabSchema = z.enum(["created", "bookmarked", "liked", "recent"]);
export type LibraryTab = z.infer<typeof libraryTabSchema>;

export const LIBRARY_TAB_LABEL: Record<LibraryTab, string> = {
  created: "作成したセット",
  bookmarked: "ブックマーク",
  liked: "いいねしたセット",
  recent: "最近使用",
};

// --- GET /api/problems/search -------------------------------------------------

/**
 * カタログは約3300問・460KBあるため、clientへ丸ごと配らずserverで検索する。
 * DB導入時は、この境界の実装だけをSQLへ差し替える。
 */
export const problemSearchQuerySchema = z.object({
  q: z.string().trim().max(80).default(""),
  difficultyMin: z.number().int().nullable().default(null),
  difficultyMax: z.number().int().nullable().default(null),
  limit: z.number().int().min(1).max(50).default(20),
});
export type ProblemSearchQuery = z.infer<typeof problemSearchQuerySchema>;

export const problemSearchResponseSchema = z.object({
  /** 絞り込み後の総数。`problems`は`limit`件まで。 */
  total: z.number().int().nonnegative(),
  problems: z.array(catalogProblemSchema),
});
export type ProblemSearchResponse = z.infer<typeof problemSearchResponseSchema>;

/** 想定回答時間の目安。Difficultyがない問題は中央値として扱う。 */
export function estimateMinutes(problems: readonly ProblemSetItem[]): number {
  return problems.reduce((total, problem) => {
    const difficulty = problem.difficulty ?? 800;
    if (difficulty < 600) return total + 10;
    if (difficulty < 1000) return total + 15;
    if (difficulty < 1600) return total + 25;
    return total + 40;
  }, 0);
}

export function difficultyRangeOf(
  problems: readonly ProblemSetItem[],
): { min: number; max: number } | null {
  const values = problems
    .map((problem) => problem.difficulty)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Difficultyの色帯。ブランドの橙（hue 45付近）と競合しないよう6段に絞る。
 * 色だけに依存させないため、必ず数値と色名を併記する。
 */
export const DIFFICULTY_BANDS = [
  { max: 399, key: "gray", label: "灰" },
  { max: 799, key: "brown", label: "茶" },
  { max: 1199, key: "green", label: "緑" },
  { max: 1599, key: "cyan", label: "水" },
  { max: 1999, key: "blue", label: "青" },
  { max: Number.POSITIVE_INFINITY, key: "purple", label: "紫" },
] as const;

export type DifficultyBand = (typeof DIFFICULTY_BANDS)[number];

export function difficultyBand(difficulty: number | null): DifficultyBand | null {
  if (difficulty === null) return null;
  return DIFFICULTY_BANDS.find((band) => difficulty <= band.max) ?? null;
}

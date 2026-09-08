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

/** 公開範囲の選択肢に添える説明。ラベルだけでは何が起きるか読み取れないため。 */
export const VISIBILITY_HELP: Record<Visibility, string> = {
  public: "Discoverに掲載され、誰でも見つけられます",
  unlisted: "リンクを知っている人だけが開けます。検索には出ません",
  private: "自分だけが見られます",
};

/** 保存済みか下書きか。下書きは一覧で公開範囲の代わりに「下書き」を出す。 */
export const problemSetStatusSchema = z.enum(["draft", "published"]);
export type ProblemSetStatus = z.infer<typeof problemSetStatusSchema>;

export const problemSetIdSchema = z.string().regex(/^ps_[0-9a-z]{10}$/);

/** セットに入っている1問。カタログからコピーして保存する。 */
export const problemSetItemSchema = catalogProblemSchema;
export type ProblemSetItem = z.infer<typeof problemSetItemSchema>;

/** 想定者に使うrating色のkey。DIFFICULTY_BANDSと同じ段。 */
export const bandKeySchema = z.enum(["gray", "brown", "green", "cyan", "blue", "yellow", "orange", "red"]);
export type BandKey = z.infer<typeof bandKeySchema>;

export const problemSetSchema = z.object({
  setId: problemSetIdSchema,
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().max(400),
  tags: z.array(problemSetTagSchema).max(6),
  visibility: visibilitySchema,
  status: problemSetStatusSchema,
  problems: z.array(problemSetItemSchema).max(50),
  /**
   * 作成者が想定した対象のrating色。押した段だけを持ち、表示でも押した段の色をその数だけ並べる。
   * 問題から計算するDifficultyとは別で、作成者の意図を表す。
   */
  targetBands: z.array(bandKeySchema).max(8).default([]),
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
    targetBands: true,
  })
  .extend({
    problemCount: z.number().int().nonnegative(),
    /** 進み具合の計算に使う。順序は問わない。 */
    problemIds: z.array(z.string()),
    /** Difficultyを持つ問題だけから求めた範囲。1問もなければnull。 */
    difficultyRange: z.object({ min: z.number().int(), max: z.number().int() }).nullable(),
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
  /** 作成者が選んだ想定者の色。1つでも一致すればそのセットを残す。 */
  bands: z.array(bandKeySchema).max(8).default([]),
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
  bookmarked: "保存",
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
  limit: z.number().int().min(1).max(100).default(20),
  /** ページ送り。`total`件のうち何件目から返すか。 */
  offset: z.number().int().min(0).default(0),
});
export type ProblemSearchQuery = z.infer<typeof problemSearchQuerySchema>;

export const problemSearchResponseSchema = z.object({
  /** 絞り込み後の総数。`problems`は`offset`から`limit`件まで。 */
  total: z.number().int().nonnegative(),
  problems: z.array(catalogProblemSchema),
});
export type ProblemSearchResponse = z.infer<typeof problemSearchResponseSchema>;

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
 * AtCoderのrating色そのままの8段（2026-09-06のADR-0007追記）。
 * 以前は橙をbrand accentと分けるために6段へ丸め、2000以上を「紫」にしていたが、
 * AtCoderに紫という段は無く、利用者が読み違える。橙は塗りつぶさず枠線のchipで描く。
 *
 * 同じ段を、問題のDifficultyと「想定者（対象のrating色）」の両方に使う。
 */
export const DIFFICULTY_BANDS = [
  { max: 399, key: "gray", label: "灰", from: 0 },
  { max: 799, key: "brown", label: "茶", from: 400 },
  { max: 1199, key: "green", label: "緑", from: 800 },
  { max: 1599, key: "cyan", label: "水", from: 1200 },
  { max: 1999, key: "blue", label: "青", from: 1600 },
  { max: 2399, key: "yellow", label: "黄", from: 2000 },
  { max: 2799, key: "orange", label: "橙", from: 2400 },
  { max: Number.POSITIVE_INFINITY, key: "red", label: "赤", from: 2800 },
] as const;

export type DifficultyBand = (typeof DIFFICULTY_BANDS)[number];

/**
 * 押された段を表示順に並べる。押した段だけを返すので、間の段は含まない。
 * 表示は最小〜最大のレンジではなく、選んだ色をその数だけ並べる形にしている。
 */
export function orderedTargetBands(bands: readonly BandKey[]): DifficultyBand[] {
  return DIFFICULTY_BANDS.filter((band) => bands.includes(band.key));
}

export function difficultyBand(difficulty: number | null): DifficultyBand | null {
  if (difficulty === null) return null;
  return DIFFICULTY_BANDS.find((band) => difficulty <= band.max) ?? null;
}

// --- Solve status -------------------------------------------------------------

/**
 * 挑戦状態。本人の自己申告であり、AtCoderの提出結果から自動で決まるものではない。
 * 対戦側のSubmission evidence（外部から受け取った提出情報）とは別物として扱う。
 */
export const solveStatusSchema = z.enum(["unsolved", "solved", "solved_with_editorial"]);
export type SolveStatus = z.infer<typeof solveStatusSchema>;

export const SOLVE_STATUS_LABEL: Record<SolveStatus, string> = {
  unsolved: "未着手",
  solved: "自力",
  solved_with_editorial: "解説",
};

/** 押すたびに次へ進む順序。未AC → 自力AC → 解説AC → 未AC。 */
export const SOLVE_STATUS_ORDER: readonly SolveStatus[] = [
  "unsolved",
  "solved",
  "solved_with_editorial",
];

export function nextSolveStatus(current: SolveStatus): SolveStatus {
  const index = SOLVE_STATUS_ORDER.indexOf(current);
  return SOLVE_STATUS_ORDER[(index + 1) % SOLVE_STATUS_ORDER.length]!;
}

/**
 * problemIdをkeyにした挑戦状態。問題単位で持つため、同じ問題を複数のセットへ入れても状態は1つ。
 * 記録のない問題は`unsolved`として扱う。
 */
export type SolveStatusMap = Record<string, SolveStatus>;

/**
 * 保存したセットを分けるための進み具合。解説ACもACとして数える。
 * 1問も入っていないセットは「未着手」に入れる。
 */
export const setProgressSchema = z.enum(["untouched", "in_progress", "all_solved"]);
export type SetProgress = z.infer<typeof setProgressSchema>;

export const SET_PROGRESS_LABEL: Record<SetProgress, string> = {
  untouched: "未着手",
  in_progress: "進行中",
  all_solved: "全てAC",
};

/** 表示順。全てACを先頭に出さず、手をつけていないものから並べる。 */
export const SET_PROGRESS_ORDER: readonly SetProgress[] = ["in_progress", "untouched", "all_solved"];

export function setProgressOf(
  problemIds: readonly string[],
  statuses: SolveStatusMap,
): SetProgress {
  if (problemIds.length === 0) return "untouched";
  const solved = problemIds.filter((id) => (statuses[id] ?? "unsolved") !== "unsolved").length;
  if (solved === 0) return "untouched";
  return solved === problemIds.length ? "all_solved" : "in_progress";
}

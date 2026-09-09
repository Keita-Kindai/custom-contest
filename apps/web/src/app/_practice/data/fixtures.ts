import type { ProblemSet } from "@custom-contest/contracts";

/**
 * 画面確認用のサンプル問題セット。
 * 問題データはAtCoder Problems由来のカタログから実際に抽出したもので、
 * タイトル・Difficulty・出典は実在の値。作成者名といいね数だけが仮の値。
 * PostgreSQLと認証を入れるまでの暫定データで、ADR-0007の範囲。
 */

const DAY_MS = 86_400_000;
/** fixtureの時刻を固定するための基準日。毎回のbuildで値が動かないようにする。 */
const BASE_TIME = Date.parse("2026-09-04T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(BASE_TIME - days * DAY_MS).toISOString();
}

export const seedProblemSets: ProblemSet[] = [
  {
    setId: "ps_dpintro000",
    title: "DP入門セット",
    description: "緑帯に上がる前に一度は通しておきたい典型DPを集めています。EDPCの前半6問。",
    tags: ["DP", "EDPC", "初級"],
    targetBands: ["brown", "green"],
    visibility: "public",
    status: "published",
    authorName: "kenta_ac",
    likeCount: 87,
    createdAt: daysAgo(23),
    updatedAt: daysAgo(3),
    problems: [
      { problemId: "dp_a", contestId: "dp", problemIndex: "A", title: "Frog 1", difficulty: null, source: "EDPC A", tags: ["DP", "EDPC"] },
      { problemId: "dp_b", contestId: "dp", problemIndex: "B", title: "Frog 2", difficulty: null, source: "EDPC B", tags: ["DP", "EDPC"] },
      { problemId: "dp_c", contestId: "dp", problemIndex: "C", title: "Vacation", difficulty: null, source: "EDPC C", tags: ["DP", "EDPC"] },
      { problemId: "dp_d", contestId: "dp", problemIndex: "D", title: "Knapsack 1", difficulty: null, source: "EDPC D", tags: ["DP", "EDPC"] },
      { problemId: "dp_e", contestId: "dp", problemIndex: "E", title: "Knapsack 2", difficulty: null, source: "EDPC E", tags: ["DP", "EDPC"] },
      { problemId: "dp_f", contestId: "dp", problemIndex: "F", title: "LCS", difficulty: null, source: "EDPC F", tags: ["DP", "EDPC"] },
    ],
  },
  {
    setId: "ps_abccgood00",
    title: "ABC C 良問6選",
    description: "全探索と実装の練習になるABCのC問題を、易しい順に6問。",
    tags: ["全探索", "初級"],
    targetBands: ["gray", "brown"],
    visibility: "public",
    status: "published",
    authorName: "sora__",
    likeCount: 61,
    createdAt: daysAgo(26),
    updatedAt: daysAgo(6),
    problems: [
      { problemId: "abc211_c", contestId: "abc211", problemIndex: "C", title: "chokudai", difficulty: 559, source: "ABC211 C", tags: [] },
      { problemId: "abc459_c", contestId: "abc459", problemIndex: "C", title: "Drop Blocks", difficulty: 659, source: "ABC459 C", tags: [] },
      { problemId: "abc466_c", contestId: "abc466", problemIndex: "C", title: "Count Close Pairs ", difficulty: 658, source: "ABC466 C", tags: [] },
      { problemId: "abc467_c", contestId: "abc467", problemIndex: "C", title: "Adjacent Sums (easy)", difficulty: 608, source: "ABC467 C", tags: [] },
      { problemId: "abc469_c", contestId: "abc469", problemIndex: "C", title: "Cantrip", difficulty: 475, source: "ABC469 C", tags: [] },
      { problemId: "abc471_c", contestId: "abc471", problemIndex: "C", title: "Cookies and Greedy Takahashi", difficulty: 301, source: "ABC471 C", tags: [] },
    ],
  },
  {
    setId: "ps_beforegree",
    title: "緑になる前に解きたい10問",
    description: "Difficulty 700〜1200から、分野が偏らないように10問選んでいます。実力チェック用。",
    tags: ["典型", "中級"],
    targetBands: ["green", "cyan"],
    visibility: "public",
    status: "published",
    authorName: "mio_p",
    likeCount: 342,
    createdAt: daysAgo(21),
    updatedAt: daysAgo(1),
    problems: [
      { problemId: "abc466_e", contestId: "abc466", problemIndex: "E", title: "Range Flip", difficulty: 1027, source: "ABC466 E", tags: [] },
      { problemId: "abc467_d", contestId: "abc467", problemIndex: "D", title: "Concentric Circles", difficulty: 928, source: "ABC467 D", tags: [] },
      { problemId: "abc468_e", contestId: "abc468", problemIndex: "E", title: "Sum of Average", difficulty: 1038, source: "ABC468 E", tags: [] },
      { problemId: "abc469_d", contestId: "abc469", problemIndex: "D", title: "The Big Two", difficulty: 1102, source: "ABC469 D", tags: [] },
      { problemId: "abc470_c", contestId: "abc470", problemIndex: "C", title: "Inc, Dec, Xor", difficulty: 1006, source: "ABC470 C", tags: [] },
      { problemId: "abc470_d", contestId: "abc470", problemIndex: "D", title: "Inverse and Swap", difficulty: 777, source: "ABC470 D", tags: [] },
      { problemId: "abc471_e", contestId: "abc471", problemIndex: "E", title: "Sum of Square of Sum", difficulty: 990, source: "ABC471 E", tags: [] },
      { problemId: "abc472_e", contestId: "abc472", problemIndex: "E", title: "Odd Cycle", difficulty: 1029, source: "ABC472 E", tags: [] },
      { problemId: "abc473_d", contestId: "abc473", problemIndex: "D", title: "Coefficient Stair", difficulty: 838, source: "ABC473 D", tags: [] },
      { problemId: "abc473_e", contestId: "abc473", problemIndex: "E", title: "K-Divisible Subarrays", difficulty: 966, source: "ABC473 E", tags: [] },
    ],
  },
  {
    setId: "ps_abcemid000",
    title: "ABC E 中級6問",
    description: "ABCのE問題から、Difficulty 1000〜1600を6問。腰を据えて解く用。",
    tags: ["中級", "典型"],
    targetBands: ["cyan", "blue"],
    visibility: "public",
    status: "published",
    authorName: "mio_p",
    likeCount: 15,
    createdAt: daysAgo(22),
    updatedAt: daysAgo(2),
    problems: [
      { problemId: "abc462_e", contestId: "abc462", problemIndex: "E", title: "Alternating Costs", difficulty: 1226, source: "ABC462 E", tags: [] },
      { problemId: "abc464_e", contestId: "abc464", problemIndex: "E", title: "Fill-Rect Query", difficulty: 1075, source: "ABC464 E", tags: [] },
      { problemId: "abc465_e", contestId: "abc465", problemIndex: "E", title: "Digit Circus", difficulty: 1417, source: "ABC465 E", tags: [] },
      { problemId: "abc466_e", contestId: "abc466", problemIndex: "E", title: "Range Flip", difficulty: 1027, source: "ABC466 E", tags: [] },
      { problemId: "abc468_e", contestId: "abc468", problemIndex: "E", title: "Sum of Average", difficulty: 1038, source: "ABC468 E", tags: [] },
      { problemId: "abc472_e", contestId: "abc472", problemIndex: "E", title: "Odd Cycle", difficulty: 1029, source: "ABC472 E", tags: [] },
    ],
  },
  {
    setId: "ps_abcdspeed0",
    title: "ABC D 早解き7問",
    description: "Difficulty 600〜1000のD問題。時間を計って一気に7問。",
    tags: ["短時間", "中級"],
    targetBands: ["brown", "green"],
    visibility: "public",
    status: "published",
    authorName: "tk_algo",
    likeCount: 4,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(0),
    problems: [
      { problemId: "abc463_d", contestId: "abc463", problemIndex: "D", title: "Maximize the Gap", difficulty: 838, source: "ABC463 D", tags: [] },
      { problemId: "abc465_d", contestId: "abc465", problemIndex: "D", title: "X to Y", difficulty: 839, source: "ABC465 D", tags: [] },
      { problemId: "abc467_d", contestId: "abc467", problemIndex: "D", title: "Concentric Circles", difficulty: 928, source: "ABC467 D", tags: [] },
      { problemId: "abc468_d", contestId: "abc468", problemIndex: "D", title: "Pre-Palindrome", difficulty: 683, source: "ABC468 D", tags: [] },
      { problemId: "abc470_d", contestId: "abc470", problemIndex: "D", title: "Inverse and Swap", difficulty: 777, source: "ABC470 D", tags: [] },
      { problemId: "abc472_d", contestId: "abc472", problemIndex: "D", title: "Bomber Mad", difficulty: 605, source: "ABC472 D", tags: [] },
      { problemId: "abc473_d", contestId: "abc473", problemIndex: "D", title: "Coefficient Stair", difficulty: 838, source: "ABC473 D", tags: [] },
    ],
  },
  {
    setId: "ps_typical904",
    title: "典型90 ★4だけ5問",
    description: "競プロ典型90問から★4を5問。典型の型を覚える用。",
    tags: ["典型90", "典型"],
    targetBands: ["green"],
    visibility: "public",
    status: "published",
    authorName: "tk_algo",
    likeCount: 55,
    createdAt: daysAgo(29),
    updatedAt: daysAgo(9),
    problems: [
      { problemId: "typical90_a", contestId: "typical90", problemIndex: "001", title: "Yokan Party（★4）", difficulty: null, source: "典型90 001", tags: ["典型90", "典型"] },
      { problemId: "typical90_c", contestId: "typical90", problemIndex: "003", title: "Longest Circular Road（★4）", difficulty: null, source: "典型90 003", tags: ["典型90", "典型"] },
      { problemId: "typical90_h", contestId: "typical90", problemIndex: "008", title: "AtCounter（★4）", difficulty: null, source: "典型90 008", tags: ["典型90", "典型"] },
      { problemId: "typical90_l", contestId: "typical90", problemIndex: "012", title: "Red Painting（★4）", difficulty: null, source: "典型90 012", tags: ["典型90", "典型"] },
      { problemId: "typical90_z", contestId: "typical90", problemIndex: "026", title: "Independent Set on a Tree（★4）", difficulty: null, source: "典型90 026", tags: ["典型90", "典型"] },
    ],
  },
  {
    setId: "ps_typical902",
    title: "典型90 ★2セレクト",
    description: "典型90の★2から、短時間で回せるものを4問。",
    tags: ["典型90", "初級", "短時間"],
    targetBands: ["gray", "brown"],
    visibility: "unlisted",
    status: "published",
    authorName: "tk_algo",
    likeCount: 2,
    createdAt: daysAgo(32),
    updatedAt: daysAgo(12),
    problems: [
      { problemId: "typical90_d", contestId: "typical90", problemIndex: "004", title: "Cross Sum（★2）", difficulty: null, source: "典型90 004", tags: ["典型90", "典型"] },
      { problemId: "typical90_j", contestId: "typical90", problemIndex: "010", title: "Score Sum Queries（★2）", difficulty: null, source: "典型90 010", tags: ["典型90", "典型"] },
      { problemId: "typical90_v", contestId: "typical90", problemIndex: "022", title: "Cubic Cake（★2）", difficulty: null, source: "典型90 022", tags: ["典型90", "典型"] },
      { problemId: "typical90_x", contestId: "typical90", problemIndex: "024", title: "Select +／- One（★2）", difficulty: null, source: "典型90 024", tags: ["典型90", "典型"] },
    ],
  },
  {
    setId: "ps_graphdraft",
    title: "グラフ入門（無題）",
    description: "",
    tags: ["グラフ"],
    targetBands: ["cyan", "blue", "yellow"],
    visibility: "private",
    status: "draft",
    authorName: "Litms",
    likeCount: 0,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(0),
    problems: [
      { problemId: "abc467_d", contestId: "abc467", problemIndex: "D", title: "Concentric Circles", difficulty: 928, source: "ABC467 D", tags: [] },
      { problemId: "abc469_d", contestId: "abc469", problemIndex: "D", title: "The Big Two", difficulty: 1102, source: "ABC469 D", tags: [] },
      { problemId: "abc473_d", contestId: "abc473", problemIndex: "D", title: "Coefficient Stair", difficulty: 838, source: "ABC473 D", tags: [] },
    ],
  },
];

/** この端末の利用者として扱う暫定プロフィール。認証を入れるまでの仮。 */
export const CURRENT_AUTHOR = "Litms";

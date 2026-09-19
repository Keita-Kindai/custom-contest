import { describe, expect, it } from "vitest";

import {
  MAX_PROBLEMS_PER_SET,
  MAX_SETS_PER_USER,
  problemSetCreateSchema,
} from "./problem-set";

function item(index: number) {
  return {
    problemId: `abc300_${index}`,
    contestId: "abc300",
    problemIndex: "a",
    title: `問題 ${index}`,
    difficulty: 800,
    source: "ABC300 A",
    tags: [],
    authorBand: null,
  };
}

function setOf(count: number) {
  return {
    title: "緑だけ",
    description: "",
    tags: [],
    visibility: "public" as const,
    status: "published" as const,
    problems: Array.from({ length: count }, (_, i) => item(i)),
    targetBands: [],
  };
}

describe("problems per set", () => {
  it("accepts a set filled to the limit", () => {
    expect(problemSetCreateSchema.safeParse(setOf(MAX_PROBLEMS_PER_SET)).success).toBe(true);
  });

  it("refuses one problem past the limit", () => {
    expect(problemSetCreateSchema.safeParse(setOf(MAX_PROBLEMS_PER_SET + 1)).success).toBe(false);
  });

  /*
   * 色帯1つぶんのセット（緑だけ、水だけ）は80〜100問になる。上限がそこを下回ると、
   * 作りたいものがそのまま作れない。この下限を切るときは意図的に切ること。
   */
  it("leaves room for a single-band set", () => {
    expect(MAX_PROBLEMS_PER_SET).toBeGreaterThanOrEqual(120);
  });

  /*
   * 2つの上限は掛け算で効く。1アカウントが`problem_set_items`へ書ける行数の最悪値が
   * それなので、片方を上げるときはこの積を見ること。
   */
  it("keeps the worst case one account can write bounded", () => {
    expect(MAX_PROBLEMS_PER_SET * MAX_SETS_PER_USER).toBeLessThanOrEqual(50_000);
  });
});

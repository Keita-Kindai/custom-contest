import { describe, expect, it } from "vitest";

import { problemSetTagSchema, problemSetTagsSchema } from "./problem-set";

describe("freeform set tag boundary", () => {
  it("normalizes full-width input before saving", () => {
    expect(problemSetTagSchema.parse("  ＩＣＰＣ 予選  ")).toBe("ICPC 予選");
  });

  it("rejects duplicate, control-character and oversized input", () => {
    expect(problemSetTagsSchema.safeParse(["DP", "ｄｐ"]).success).toBe(false);
    expect(problemSetTagSchema.safeParse("abc\nprivate").success).toBe(false);
    expect(problemSetTagSchema.safeParse("あ".repeat(25)).success).toBe(false);
    expect(problemSetTagsSchema.safeParse(Array.from({ length: 7 }, (_, i) => `tag${i}`)).success).toBe(false);
  });
});

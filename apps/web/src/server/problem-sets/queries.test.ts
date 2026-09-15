import { describe, expect, it } from "vitest";

import { likePattern } from "./queries";

/**
 * Discoverの検索語はそのままLIKEのパターンになる。
 * ワイルドカードを潰しておかないと、`%`一文字で全件一致になり、
 * 組み立てたパターンで照合そのものを重くできる。
 */
describe("likePattern", () => {
  it("wraps a plain term for a substring match", () => {
    expect(likePattern("dp")).toBe("%dp%");
  });

  it("escapes a percent so it matches the character, not everything", () => {
    expect(likePattern("50%")).toBe("%50\\%%");
  });

  it("escapes an underscore so it matches the character, not any one character", () => {
    expect(likePattern("abc_def")).toBe("%abc\\_def%");
  });

  it("escapes a backslash before the wildcards, so the escape itself stays literal", () => {
    expect(likePattern("a\\b")).toBe("%a\\\\b%");
    expect(likePattern("a\\%b")).toBe("%a\\\\\\%b%");
  });

  it("leaves nothing unescaped in a term built only from wildcards", () => {
    expect(likePattern("%_%_%")).toBe("%\\%\\_\\%\\_\\%%");
  });

  it("keeps an empty term as a bare substring match", () => {
    // discover()は空文字のqでこの関数を呼ばないが、呼ばれても全件一致で壊れない。
    expect(likePattern("")).toBe("%%");
  });
});

import { describe, expect, it } from "vitest";

import { normalizeExternalProblemUrl, sourceLabel } from "./external-problems";

describe("external link registration boundary", () => {
  it("keeps the problem path and query while removing fragment-only duplicates", () => {
    expect(normalizeExternalProblemUrl("https://Example.org/problems/123?lang=ja#statement"))
      .toBe("https://example.org/problems/123?lang=ja");
  });

  it.each([
    "http://example.org/problems/1",
    "https://user:password@example.org/problems/1",
    "https://localhost/problems/1",
    "https://127.0.0.1/problems/1",
    "https://[::1]/problems/1",
    "https://metadata.internal/problems/1",
    "https://169.254.169.254/latest/meta-data/",
  ])("rejects a non-public or credentialed URL: %s", (url) => {
    expect(normalizeExternalProblemUrl(url)).toBeNull();
  });
});

/**
 * `source`は、閲覧者に見えている唯一の出所である。
 * 題名は登録者が自由に決められるので、ここが本当のドメインを示している必要がある。
 */
describe("sourceLabel", () => {
  it("keeps a hostname that already fits", () => {
    expect(sourceLabel("atcoder.jp")).toBe("atcoder.jp");
    expect(sourceLabel("a".repeat(32))).toBe("a".repeat(32));
  });

  it("never exceeds the 32 characters the column holds", () => {
    expect(sourceLabel(`${"sub.".repeat(20)}example.org`).length).toBe(32);
  });

  it("drops the left side, so the registrable domain survives", () => {
    const hostname = "atcoder-jp-problems.attacker.example";
    const label = sourceLabel(hostname);
    // 右から切ると`…attacker.exa`のように本当のドメインだけが消える。
    expect(label.endsWith("attacker.example")).toBe(true);
    expect(label.startsWith("…")).toBe(true);
  });
});

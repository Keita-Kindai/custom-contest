import { describe, expect, it } from "vitest";

import { normalizeExternalProblemUrl } from "./external-problems";

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

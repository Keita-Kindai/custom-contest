import { describe, expect, it } from "vitest";

import { requireSameOrigin } from "./http";

/**
 * 書き込みはcookieのsessionで本人を決める。cookieはブラウザーが自動で付けるので、
 * 別サイトに置かれたformから書き込みを起こされうる。
 * ここで見ているheaderは、どちらもページ側のJavaScriptからは書き換えられない。
 */
function requestWith(headers: Record<string, string>): Request {
  return new Request("https://custom-problems.vercel.app/api/problem-sets/ps_0000000000", {
    method: "PUT",
    headers,
  });
}

describe("requireSameOrigin", () => {
  describe("Sec-Fetch-Site", () => {
    it.each(["same-origin", "same-site"])("lets %s through", (site) => {
      expect(requireSameOrigin(requestWith({ "sec-fetch-site": site }))).toBeNull();
    });

    it.each(["cross-site", "none"])("refuses %s", (site) => {
      expect(requireSameOrigin(requestWith({ "sec-fetch-site": site }))?.status).toBe(403);
    });

    it("is trusted over Origin when both are present", async () => {
      // Sec-Fetch-Siteはブラウザーが付ける。Originより強い根拠として扱う。
      const response = requireSameOrigin(
        requestWith({
          "sec-fetch-site": "cross-site",
          origin: "https://custom-problems.vercel.app",
          host: "custom-problems.vercel.app",
        }),
      );
      expect(response?.status).toBe(403);
      expect(await response?.json()).toMatchObject({ error: { code: "forbidden" } });
    });
  });

  describe("Origin, when the browser sent no Sec-Fetch-Site", () => {
    it("lets a matching host through", () => {
      expect(
        requireSameOrigin(
          requestWith({
            origin: "https://custom-problems.vercel.app",
            host: "custom-problems.vercel.app",
          }),
        ),
      ).toBeNull();
    });

    it("refuses a different host", () => {
      expect(
        requireSameOrigin(
          requestWith({
            origin: "https://evil.example",
            host: "custom-problems.vercel.app",
          }),
        )?.status,
      ).toBe(403);
    });

    it("refuses a lookalike host", () => {
      expect(
        requireSameOrigin(
          requestWith({
            origin: "https://custom-problems.vercel.app.evil.example",
            host: "custom-problems.vercel.app",
          }),
        )?.status,
      ).toBe(403);
    });

    it("prefers x-forwarded-host, because Vercel sits behind a proxy", () => {
      expect(
        requireSameOrigin(
          requestWith({
            origin: "https://custom-problems.vercel.app",
            "x-forwarded-host": "custom-problems.vercel.app",
            host: "some-internal-host.vercel.app",
          }),
        ),
      ).toBeNull();
    });

    it("refuses an Origin that is not a URL", () => {
      expect(
        requireSameOrigin(requestWith({ origin: "null", host: "custom-problems.vercel.app" }))
          ?.status,
      ).toBe(403);
    });
  });

  it("lets a request carrying neither header through", () => {
    /*
     * ブラウザーは書き込みに必ずどちらかを付ける。両方無いのはブラウザーではない。
     * CSRFは他人のブラウザーを踏み台にする攻撃なので、踏み台になりえない相手を
     * ここで止めても防げるものは増えない。curlやserver間の呼び出しがこれにあたる。
     */
    expect(requireSameOrigin(requestWith({}))).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { battleEnabled, fakeEvidenceEnabled, requireBattleEnabled } from "./feature-gate";

/**
 * 公開している機能の境界（ADR-0010）。
 * 「画面を転送しているから閉じている」ではなく、APIが実際に閉じることを確かめる。
 */
describe("feature gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("battleEnabled", () => {
    it("is closed on a production build by default", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CUSTOM_CONTEST_ENABLE_BATTLE", undefined);
      expect(battleEnabled()).toBe(false);
    });

    it("opens on a production build only when explicitly enabled", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CUSTOM_CONTEST_ENABLE_BATTLE", "1");
      expect(battleEnabled()).toBe(true);
    });

    it("stays open for development and test", () => {
      vi.stubEnv("CUSTOM_CONTEST_ENABLE_BATTLE", undefined);
      for (const value of ["development", "test"]) {
        vi.stubEnv("NODE_ENV", value as "development" | "test");
        expect(battleEnabled()).toBe(true);
      }
    });

    it("ignores any value other than exactly \"1\"", () => {
      vi.stubEnv("NODE_ENV", "production");
      for (const value of ["true", "yes", "0", ""]) {
        vi.stubEnv("CUSTOM_CONTEST_ENABLE_BATTLE", value);
        expect(battleEnabled()).toBe(false);
      }
    });
  });

  describe("requireBattleEnabled", () => {
    it("lets the handler continue when the feature is open", () => {
      vi.stubEnv("CUSTOM_CONTEST_ENABLE_BATTLE", "1");
      expect(requireBattleEnabled()).toBeNull();
    });

    it("answers 404, so a closed feature cannot be told apart from a missing one", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CUSTOM_CONTEST_ENABLE_BATTLE", undefined);
      const response = requireBattleEnabled();
      expect(response?.status).toBe(404);
      expect(await response?.json()).toMatchObject({ error: { code: "feature_disabled" } });
    });
  });

  describe("fakeEvidenceEnabled", () => {
    it("stays off on the deployed production, whatever the flag says", () => {
      vi.stubEnv("VERCEL_ENV", "production");
      for (const value of ["1", "true", undefined]) {
        vi.stubEnv("CUSTOM_CONTEST_ENABLE_FAKE_EVIDENCE", value);
        expect(fakeEvidenceEnabled()).toBe(false);
      }
    });

    it("can be opened on a preview deployment for an isolated check", () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("CUSTOM_CONTEST_ENABLE_FAKE_EVIDENCE", "1");
      expect(fakeEvidenceEnabled()).toBe(true);
    });

    it("is on under test without any flag", () => {
      vi.stubEnv("VERCEL_ENV", undefined);
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("CUSTOM_CONTEST_ENABLE_FAKE_EVIDENCE", undefined);
      expect(fakeEvidenceEnabled()).toBe(true);
    });
  });
});

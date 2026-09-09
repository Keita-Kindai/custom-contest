import { describe, expect, it } from "vitest";

import { pinSslMode } from "./client";

/**
 * `sslmode`の書き換えは接続の安全性に関わるので、置き換える範囲を固定しておく。
 * 値だけを差し替え、接続文字列の他の部分は1文字も変えない。
 */
describe("pinSslMode", () => {
  it("upgrades the modes that pg currently treats as verify-full", () => {
    for (const mode of ["require", "prefer", "verify-ca"]) {
      expect(pinSslMode(`postgresql://u:p@host/db?sslmode=${mode}`)).toBe(
        "postgresql://u:p@host/db?sslmode=verify-full",
      );
    }
  });

  it("leaves a connection string without sslmode alone", () => {
    const local = "postgresql://keita@localhost:5432/custom_contest";
    expect(pinSslMode(local)).toBe(local);
  });

  it("leaves verify-full and disable alone", () => {
    for (const mode of ["verify-full", "disable"]) {
      const value = `postgresql://u:p@host/db?sslmode=${mode}`;
      expect(pinSslMode(value)).toBe(value);
    }
  });

  it("keeps the rest of the query string and the password untouched", () => {
    expect(
      pinSslMode(
        "postgresql://user:p%40ss%2Fword@ep-x-pooler.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
      ),
    ).toBe(
      "postgresql://user:p%40ss%2Fword@ep-x-pooler.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require",
    );
  });

  it("does not touch a password that happens to contain the text sslmode=require", () => {
    const value = "postgresql://user:sslmode=require@host/db";
    expect(pinSslMode(value)).toBe(value);
  });
});

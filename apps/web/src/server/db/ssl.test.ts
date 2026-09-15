import { afterEach, describe, expect, it } from "vitest";

import { databaseUrl } from "./ssl";

/**
 * migrationとseedはこの関数を通してしか接続文字列を受け取らない。
 * 生の`DATABASE_URL`が素通りすると、DDL権限を持つ接続だけTLS検証が外れる。
 */
describe("databaseUrl", () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it("returns null when DATABASE_URL is unset", () => {
    delete process.env.DATABASE_URL;
    expect(databaseUrl()).toBeNull();
  });

  it("returns null when DATABASE_URL is blank", () => {
    process.env.DATABASE_URL = "   ";
    expect(databaseUrl()).toBeNull();
  });

  it("pins sslmode before handing the string to pg", () => {
    process.env.DATABASE_URL = "postgresql://u:p@host/db?sslmode=require";
    expect(databaseUrl()).toBe("postgresql://u:p@host/db?sslmode=verify-full");
  });

  it("trims surrounding whitespace", () => {
    process.env.DATABASE_URL = "  postgresql://keita@localhost:5432/custom_contest  ";
    expect(databaseUrl()).toBe("postgresql://keita@localhost:5432/custom_contest");
  });
});

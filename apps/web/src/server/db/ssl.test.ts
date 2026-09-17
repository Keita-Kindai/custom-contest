import { afterEach, describe, expect, it } from "vitest";

import { databaseUrl, migrationDatabaseUrl } from "./ssl";

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

/**
 * 本番ではDDLを持つロールと実行時ロールを分ける。
 * migrationを実行時ロールの接続文字列で流すと、`CREATE`が無いので必ず失敗する。
 */
describe("migrationDatabaseUrl", () => {
  const originalMigration = process.env.MIGRATION_DATABASE_URL;
  const originalDatabase = process.env.DATABASE_URL;

  afterEach(() => {
    for (const [key, value] of [
      ["MIGRATION_DATABASE_URL", originalMigration],
      ["DATABASE_URL", originalDatabase],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("prefers the migration role when both are set", () => {
    process.env.MIGRATION_DATABASE_URL = "postgresql://owner:p@host/db";
    process.env.DATABASE_URL = "postgresql://runtime:p@host/db";
    expect(migrationDatabaseUrl()).toBe("postgresql://owner:p@host/db");
  });

  it("falls back to DATABASE_URL where the roles are not split", () => {
    delete process.env.MIGRATION_DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://u:p@host/db";
    expect(migrationDatabaseUrl()).toBe("postgresql://u:p@host/db");
  });

  it("falls back when the migration variable is present but blank", () => {
    process.env.MIGRATION_DATABASE_URL = "   ";
    process.env.DATABASE_URL = "postgresql://u:p@host/db";
    expect(migrationDatabaseUrl()).toBe("postgresql://u:p@host/db");
  });

  it("pins sslmode on the migration connection too", () => {
    process.env.MIGRATION_DATABASE_URL = "postgresql://owner:p@host/db?sslmode=require";
    expect(migrationDatabaseUrl()).toBe("postgresql://owner:p@host/db?sslmode=verify-full");
  });

  it("returns null when neither is set", () => {
    delete process.env.MIGRATION_DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(migrationDatabaseUrl()).toBeNull();
  });
});

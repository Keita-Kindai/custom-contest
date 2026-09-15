import { createHash } from "node:crypto";

import type { CatalogProblem, ExternalProblemInput } from "@custom-contest/contracts";
import { and, desc, eq, gt, ilike, or, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { problems } from "@/server/db/practice-schema";

import { DatabaseUnavailableError, likePattern } from "./queries";

function db() {
  const instance = getDb();
  if (!instance) throw new DatabaseUnavailableError();
  return instance;
}

/** URLはリンクとして保存するだけ。サーバーから接続しない。 */
export function normalizeExternalProblemUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!host.includes(".") || host.startsWith("[") || /^(?:\d+\.)+\d+$/u.test(host)) return null;
    if (/(?:^|\.)(?:localhost|local|internal|lan|test|invalid)$/u.test(host)) return null;
    url.hostname = host;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function asCatalog(row: typeof problems.$inferSelect): CatalogProblem {
  return {
    problemId: row.problemId,
    contestId: row.contestId,
    problemIndex: row.problemIndex,
    title: row.title,
    difficulty: row.difficulty,
    source: row.source,
    tags: row.tags,
    url: row.externalUrl,
  };
}

export class ExternalProblemLimitError extends Error {
  constructor() {
    super("外部問題の登録は1日20件までです。");
  }
}

/** 同じURLの問題は全員で再利用する。題名は初回登録後に書き換えない。 */
export async function registerExternalProblem(input: ExternalProblemInput, userId: string): Promise<CatalogProblem> {
  const canonical = normalizeExternalProblemUrl(input.url);
  if (!canonical) throw new TypeError("公開サイトのHTTPS URLを入力してください。");

  const [known] = await db().select().from(problems).where(eq(problems.externalUrl, canonical)).limit(1);
  if (known) return asCatalog(known);

  const [recent] = await db().select({ count: sql<number>`count(*)::int` }).from(problems).where(and(
    eq(problems.createdByUserId, userId),
    eq(problems.origin, "external"),
    gt(problems.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
  ));
  if ((recent?.count ?? 0) >= 20) throw new ExternalProblemLimitError();

  const url = new URL(canonical);
  const id = `ext_${createHash("sha256").update(canonical).digest("hex").slice(0, 48)}`;
  const [inserted] = await db().insert(problems).values({
    problemId: id,
    contestId: "external",
    problemIndex: "link",
    title: input.title,
    difficulty: null,
    source: url.hostname.slice(0, 32),
    tags: [],
    origin: "external",
    externalUrl: canonical,
    createdByUserId: userId,
  }).onConflictDoNothing().returning();
  if (inserted) return asCatalog(inserted);
  const [existing] = await db().select().from(problems).where(eq(problems.externalUrl, canonical)).limit(1);
  if (!existing) throw new Error("外部問題IDの衝突が発生しました。");
  return asCatalog(existing);
}

/** DB検索は明示的な操作時だけ行い、件数とoffsetに上限を設ける。 */
export async function searchExternalProblems(query: { q: string; limit: number; offset: number }) {
  const pattern = likePattern(query.q);
  const where = and(
    eq(problems.origin, "external"),
    query.q ? or(ilike(problems.title, pattern), ilike(problems.source, pattern)) : undefined,
  );
  const [count] = await db().select({ total: sql<number>`count(*)::int` }).from(problems).where(where);
  const rows = await db().select().from(problems).where(where)
    .orderBy(desc(problems.createdAt)).limit(query.limit).offset(query.offset);
  return { total: count?.total ?? 0, problems: rows.map(asCatalog) };
}

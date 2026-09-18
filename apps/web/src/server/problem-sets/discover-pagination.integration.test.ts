import type { DiscoverQuery, ProblemSet, Visibility } from "@custom-contest/contracts";
import { DISCOVER_PAGE_SIZE } from "@custom-contest/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPool } from "@/server/db/client";

import { discover, saveSet, toggleLike } from "./queries";

/**
 * Discoverの一覧がページで区切られ、続きを正しく読めることを確かめる（ADR-0011）。
 *
 * ここで見たいのは3つ。1ページの件数に上限があること、カーソルで続きを読むと
 * 重複も取りこぼしも出ないこと、そしてDifficultyの絞り込みがLIMITより前に効くこと。
 * 最後の1つは、以前のように取得後へ絞り込みを置くと1ページの件数が減って壊れる。
 *
 * `DATABASE_URL`が無い環境ではskipする。
 */

const hasDatabase = Boolean(process.env.DATABASE_URL);

const owner = "test_page_owner";
const liker = "test_page_liker";
const prefix = "ps_page0";
/** 2ページ目が出るだけの件数。 */
const total = DISCOVER_PAGE_SIZE + 5;
const title = "ページ送り検証";

/** seedで入っているカタログの問題。difficultyの有無で2種類使う。 */
const easy = "abc086_a";
const hard = "abc126_f";

function setIdAt(index: number): string {
  return `${prefix}${String(index).padStart(3, "0")}`;
}

function query(overrides: Partial<DiscoverQuery> = {}): DiscoverQuery {
  return {
    q: title,
    tags: [],
    bands: [],
    sort: "new",
    difficultyMin: null,
    difficultyMax: null,
    cursor: null,
    ...overrides,
  };
}

function sample(setId: string, problemIds: string[], visibility: Visibility = "public"): ProblemSet {
  const now = new Date().toISOString();
  return {
    setId,
    title: `${title} ${setId}`,
    description: "pagination",
    tags: [],
    targetBands: [],
    visibility,
    status: "published",
    problems: problemIds.map((problemId) => ({
      problemId,
      contestId: "abc",
      problemIndex: "A",
      title: problemId,
      difficulty: null,
      source: "ABC",
      tags: [],
      authorBand: null,
    })),
    authorName: "Owner",
    likeCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function cleanUp(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("delete from problem_sets where set_id like $1", [`${prefix}%`]);
  await pool.query("delete from users where id = any($1)", [[owner, liker]]);
}

/** 全ページを読み切って、出てきた順に並べる。 */
async function readAll(base: DiscoverQuery): Promise<string[]> {
  const seen: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const result = await discover({ ...base, cursor });
    seen.push(...result.items.map((summary) => summary.setId));
    if (!result.nextCursor) return seen;
    cursor = result.nextCursor;
  }
  throw new Error("ページが終わりませんでした。");
}

describe.skipIf(!hasDatabase)("discover pagination", () => {
  beforeAll(async () => {
    await cleanUp();
    const pool = getPool();
    await pool?.query(
      "insert into users(id, name, display_name) values ($1, $2, $3), ($4, $5, $6)",
      [owner, "Owner", "Owner", liker, "Liker", "Liker"],
    );
    for (let index = 0; index < total; index += 1) {
      // 更新時刻を1msずつずらす。同着でも並びが決まることは別のテストで見る。
      await saveSet(sample(setIdAt(index), [easy]), owner);
      await pool?.query("update problem_sets set updated_at = $1 where set_id = $2", [
        new Date(Date.UTC(2026, 0, 1) + index * 1000),
        setIdAt(index),
      ]);
    }
  });

  afterAll(async () => {
    await cleanUp();
    await getPool()?.end();
  });

  it("stops at one page and offers a cursor", async () => {
    const first = await discover(query());
    expect(first.items).toHaveLength(DISCOVER_PAGE_SIZE);
    expect(first.nextCursor).not.toBeNull();
  });

  it("reads every set exactly once across pages", async () => {
    const seen = await readAll(query());
    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
  });

  it("ends without a cursor on the last page", async () => {
    let cursor: string | null = null;
    let last = await discover(query());
    while (last.nextCursor) {
      cursor = last.nextCursor;
      last = await discover(query({ cursor }));
    }
    expect(last.nextCursor).toBeNull();
    expect(last.items.length).toBeGreaterThan(0);
  });

  it("keeps the newest first when sorting by update time", async () => {
    const seen = await readAll(query({ sort: "new" }));
    expect(seen[0]).toBe(setIdAt(total - 1));
    expect(seen.at(-1)).toBe(setIdAt(0));
  });

  it("puts a liked set at the front of the popular sort", async () => {
    const promoted = setIdAt(0);
    await toggleLike(promoted, liker);
    try {
      const seen = await readAll(query({ sort: "popular" }));
      expect(seen[0]).toBe(promoted);
      expect(seen).toHaveLength(total);
      expect(new Set(seen).size).toBe(total);
    } finally {
      await toggleLike(promoted, liker);
    }
  });

  it("counts a like on the set's own column, and gives it back when undone", async () => {
    const target = setIdAt(1);
    const countOf = async () => {
      const result = await getPool()?.query<{ like_count: number }>(
        "select like_count from problem_sets where set_id = $1",
        [target],
      );
      return result?.rows[0]?.like_count ?? -1;
    };
    expect(await countOf()).toBe(0);
    await toggleLike(target, liker);
    expect(await countOf()).toBe(1);
    await toggleLike(target, liker);
    expect(await countOf()).toBe(0);
  });

  it("applies the difficulty filter before the page is cut", async () => {
    /*
     * 絞り込みを取得後に置くと、1ページ24件を取ってから落とすので
     * 返る件数が24未満になる。SQL側で絞れていれば24件のまま埋まる。
     */
    const withDifficulty = await discover(query({ difficultyMin: 0 }));
    expect(withDifficulty.items).toHaveLength(DISCOVER_PAGE_SIZE);

    const impossible = await discover(query({ difficultyMin: 100_000 }));
    expect(impossible.items).toHaveLength(0);
    expect(impossible.nextCursor).toBeNull();
  });

  it("drops a set whose problems carry no difficulty once a range is asked for", async () => {
    const seen = await readAll(query({ difficultyMin: 0 }));
    expect(seen).toHaveLength(total);

    // Difficultyを持たない問題だけのセットは、範囲を指定した時点で外れる。
    await saveSet(sample(`${prefix}900`, [hard]), owner);
    await getPool()?.query("update problems set difficulty = null where problem_id = $1", [hard]);
    try {
      const filtered = await readAll(query({ difficultyMin: 0 }));
      expect(filtered).not.toContain(`${prefix}900`);
      const unfiltered = await readAll(query());
      expect(unfiltered).toContain(`${prefix}900`);
    } finally {
      await getPool()?.query("delete from problem_sets where set_id = $1", [`${prefix}900`]);
    }
  });

  it("treats a damaged cursor as the first page rather than an error", async () => {
    const page = await discover(query({ cursor: "not-a-cursor" }));
    expect(page.items).toHaveLength(DISCOVER_PAGE_SIZE);
  });
});

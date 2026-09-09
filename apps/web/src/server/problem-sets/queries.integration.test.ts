import type { ProblemSet } from "@custom-contest/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPool } from "@/server/db/client";

import {
  counts,
  discover,
  getSet,
  library,
  removeSet,
  saveSet,
  setSolveStatus,
  solveStatuses,
  toggleLike,
} from "./queries";

/**
 * 公開範囲と、セットの中で閉じる挑戦状態を実DBで確かめる（ADR-0011）。
 * `DATABASE_URL`が無い環境ではskipする。
 */

const hasDatabase = Boolean(process.env.DATABASE_URL);

const owner = "test_owner_queries";
const stranger = "test_stranger_queries";
const publicSet = "ps_qtest0pub1";
const unlistedSet = "ps_qtest0unl1";
const privateSet = "ps_qtest0prv1";
const setIds = [publicSet, unlistedSet, privateSet];

/** カタログに実在する問題。seedを流し込んだDBを前提にする。 */
const problemIds = ["dp_a", "dp_b"];

function sampleSet(setId: string, visibility: ProblemSet["visibility"]): ProblemSet {
  const now = new Date().toISOString();
  return {
    setId,
    title: `検証セット ${visibility}`,
    description: "integration test",
    tags: ["DP"],
    targetBands: ["green"],
    visibility,
    status: "published",
    problems: problemIds.map((problemId) => ({
      problemId,
      contestId: "dp",
      problemIndex: problemId.slice(-1).toUpperCase(),
      title: problemId,
      difficulty: null,
      source: `EDPC ${problemId.slice(-1).toUpperCase()}`,
      tags: [],
    })),
    authorName: "tester",
    likeCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function cleanUp(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("delete from problem_sets where set_id = any($1)", [setIds]);
  await pool.query("delete from users where id = any($1)", [[owner, stranger]]);
}

describe.skipIf(!hasDatabase)("problem set queries", () => {
  beforeAll(async () => {
    await cleanUp();
    const pool = getPool();
    await pool?.query(
      "insert into users(id, name, display_name) values ($1, $2, $3), ($4, $5, $6)",
      [owner, "Owner", "Owner", stranger, "Stranger", "Stranger"],
    );
    for (const [setId, visibility] of [
      [publicSet, "public"],
      [unlistedSet, "unlisted"],
      [privateSet, "private"],
    ] as const) {
      await saveSet(sampleSet(setId, visibility), owner);
    }
  });

  afterAll(async () => {
    await cleanUp();
    await getPool()?.end();
  });

  it("lists only public published sets on Discover", async () => {
    const found = await discover({
      q: "検証セット",
      tags: [],
      bands: [],
      sort: "new",
      difficultyMin: null,
      difficultyMax: null,
    });
    const ids = found.map((summary) => summary.setId);
    expect(ids).toContain(publicSet);
    expect(ids).not.toContain(unlistedSet);
    expect(ids).not.toContain(privateSet);
  });

  it("hides a private set from everyone but its owner", async () => {
    expect(await getSet(privateSet, owner)).not.toBeNull();
    expect(await getSet(privateSet, stranger)).toBeNull();
    expect(await getSet(privateSet, null)).toBeNull();
  });

  it("opens an unlisted set to anyone holding the URL", async () => {
    expect(await getSet(unlistedSet, stranger)).not.toBeNull();
    expect(await getSet(unlistedSet, null)).not.toBeNull();
  });

  it("returns the problems in their stored order", async () => {
    const set = await getSet(publicSet, owner);
    expect(set?.problems.map((problem) => problem.problemId)).toEqual(problemIds);
  });

  it("replaces the problems on save instead of appending", async () => {
    const reordered = sampleSet(publicSet, "public");
    reordered.problems = [...reordered.problems].reverse();
    await saveSet(reordered, owner);
    const set = await getSet(publicSet, owner);
    expect(set?.problems.map((problem) => problem.problemId)).toEqual([...problemIds].reverse());
    await saveSet(sampleSet(publicSet, "public"), owner);
  });

  it("keeps solve status inside one set", async () => {
    await setSolveStatus(publicSet, "dp_a", "solved", owner);
    expect(await solveStatuses(publicSet, owner)).toEqual({ dp_a: "solved" });
    // 同じ問題を含む別のセットには影響しない。
    expect(await solveStatuses(unlistedSet, owner)).toEqual({});
  });

  it("drops the row when a problem goes back to unsolved", async () => {
    await setSolveStatus(publicSet, "dp_b", "solved_with_editorial", owner);
    await setSolveStatus(publicSet, "dp_b", "unsolved", owner);
    expect(await solveStatuses(publicSet, owner)).toEqual({ dp_a: "solved" });
  });

  it("counts a like once and reflects it in the library", async () => {
    expect(await toggleLike(publicSet, stranger)).toBe(true);
    const liked = await library("liked", stranger);
    expect(liked.map((summary) => summary.setId)).toEqual([publicSet]);
    expect(liked[0]?.likeCount).toBe(1);
    expect((await counts(stranger)).liked).toBe(1);

    expect(await toggleLike(publicSet, stranger)).toBe(false);
    expect((await counts(stranger)).liked).toBe(0);
  });

  it("removes the set and everything hanging off it", async () => {
    await saveSet(sampleSet(privateSet, "private"), owner);
    await setSolveStatus(privateSet, "dp_a", "solved", owner);
    await removeSet(privateSet);
    expect(await getSet(privateSet, owner)).toBeNull();
    expect(await solveStatuses(privateSet, owner)).toEqual({});
  });
});

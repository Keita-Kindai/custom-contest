import type { ProblemSet } from "@custom-contest/contracts";
import { MAX_SETS_PER_USER } from "@custom-contest/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 1人が持てるセットの数に上限があることを確かめる（ADR-0011）。
 *
 * 上限が無いと、捨てアカウント1つでDBを埋められ、同じタグを付けた公開セットを
 * 大量に作ってタグ候補の一覧へ任意の文字列を載せられる。
 *
 * `DATABASE_URL`が無い環境ではskipする。
 */

const session = vi.hoisted(() => ({ current: null as string | null }));

vi.mock("@/auth", () => ({
  auth: async () => (session.current ? { user: { id: session.current } } : null),
}));

const { getPool } = await import("@/server/db/client");
const { setsOwnedBy } = await import("./queries");
const { PUT: setPut } = await import("../../app/api/problem-sets/[setId]/route");

const hasDatabase = Boolean(process.env.DATABASE_URL);

const owner = "test_quota_owner";
const prefix = "ps_quota";
/** 実データで200件作ると遅いので、上限の手前だけをSQLで用意する。 */
const atLimit = MAX_SETS_PER_USER;

function setIdAt(index: number): string {
  return `${prefix}${String(index).padStart(5, "0")}`;
}

function sample(setId: string): ProblemSet {
  const now = new Date().toISOString();
  return {
    setId,
    title: `上限検証 ${setId}`,
    description: "quota",
    tags: [],
    targetBands: [],
    visibility: "private",
    status: "draft",
    problems: [],
    authorName: "Owner",
    likeCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function put(setId: string): Promise<Response> {
  return setPut(
    new Request("http://t/x", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sample(setId)),
    }),
    { params: Promise.resolve({ setId }) },
  );
}

/** 上限の`count`件だけ、SQLで直接そろえる。 */
async function fill(count: number): Promise<void> {
  const pool = getPool();
  await pool?.query("delete from problem_sets where owner_id = $1", [owner]);
  if (count === 0) return;
  await pool?.query(
    `insert into problem_sets(set_id, owner_id, title, description, tags, target_bands, visibility, status)
     select $1 || lpad(g::text, 5, '0'), $2, 'bulk', '', ARRAY[]::text[], ARRAY[]::text[], 'private', 'draft'
     from generate_series(1, $3) g`,
    [prefix, owner, count],
  );
}

describe.skipIf(!hasDatabase)("problem set quota", () => {
  beforeAll(async () => {
    const pool = getPool();
    await pool?.query("delete from problem_sets where owner_id = $1", [owner]);
    await pool?.query("delete from users where id = $1", [owner]);
    await pool?.query("insert into users(id, name, display_name) values ($1, $2, $3)", [
      owner,
      "Owner",
      "Owner",
    ]);
  });

  beforeEach(() => {
    session.current = owner;
  });

  afterAll(async () => {
    const pool = getPool();
    await pool?.query("delete from problem_sets where owner_id = $1", [owner]);
    await pool?.query("delete from users where id = $1", [owner]);
    await pool?.end();
  });

  it("lets a new set through below the limit", async () => {
    await fill(atLimit - 1);
    const response = await put(setIdAt(99_990));
    expect(response.status).toBe(200);
    expect(await setsOwnedBy(owner)).toBe(atLimit);
  });

  it("refuses a new set at the limit, with 409 rather than 429", async () => {
    await fill(atLimit);
    const response = await put(setIdAt(99_991));
    // 時間を置いても解消しないので、あとで再試行を促す429にはしない。
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "quota_exceeded" } });
    expect(await setsOwnedBy(owner)).toBe(atLimit);
  });

  it("still lets an existing set be updated at the limit", async () => {
    await fill(atLimit);
    // 更新はセットの数を増やさないので、上限に達していても通す。
    const existing = setIdAt(1);
    const response = await put(existing);
    expect(response.status).toBe(200);
    expect(await setsOwnedBy(owner)).toBe(atLimit);
  });

  it("frees a slot when a set is deleted", async () => {
    await fill(atLimit);
    await getPool()?.query("delete from problem_sets where set_id = $1", [setIdAt(1)]);
    expect(await setsOwnedBy(owner)).toBe(atLimit - 1);
    expect((await put(setIdAt(99_992))).status).toBe(200);
  });

  it("counts drafts and private sets, not only published ones", async () => {
    // fill() が作るのはすべて draft かつ private。それでも上限に当たる。
    await fill(atLimit);
    expect((await put(setIdAt(99_993))).status).toBe(409);
  });
});

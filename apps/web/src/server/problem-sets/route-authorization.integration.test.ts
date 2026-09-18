import type { ProblemSet, ProblemSetSummary, Visibility } from "@custom-contest/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 公開範囲と認可を、route handlerの入口から実DBで確かめる。
 *
 * 既存の`queries.integration.test.ts`はquery関数だけを呼ぶ。そこを通らずに
 * handlerが自分でDBを触ったり、401と404を取り違えたりしても気づけない。
 * ここでは`匿名 / 本人 / 他人`の3者で、実際に公開するroute handlerを呼ぶ。
 *
 * sessionは差し替える。Cookieの属性やAuth.jsのsession参照はここでは確かめられないので、
 * それは隔離したPreviewでの手動smoke testが受け持つ。
 *
 * `DATABASE_URL`が無い環境ではskipする。
 */

const session = vi.hoisted(() => ({ current: null as string | null }));

vi.mock("@/auth", () => ({
  auth: async () => (session.current ? { user: { id: session.current } } : null),
}));

const { getPool } = await import("@/server/db/client");
const { ownerOf, saveSet } = await import("./queries");

const {
  GET: setGet,
  PUT: setPut,
  DELETE: setDelete,
} = await import("../../app/api/problem-sets/[setId]/route");
const { GET: discoverGet, POST: createPost } = await import("../../app/api/problem-sets/route");
const { GET: libraryGet } = await import("../../app/api/problem-sets/library/route");
const { GET: countsGet } = await import("../../app/api/problem-sets/counts/route");
const { GET: viewerGet } = await import("../../app/api/problem-sets/[setId]/viewer/route");
const { POST: likePost } = await import("../../app/api/problem-sets/[setId]/like/route");
const { POST: bookmarkPost } = await import("../../app/api/problem-sets/[setId]/bookmark/route");
const { POST: viewPost } = await import("../../app/api/problem-sets/[setId]/view/route");
const {
  GET: solveStatusGet,
  PUT: solveStatusPut,
} = await import("../../app/api/problem-sets/[setId]/solve-status/route");
const { GET: allSolveStatusGet } = await import("../../app/api/problem-sets/solve-status/route");

const hasDatabase = Boolean(process.env.DATABASE_URL);

const alice = "test_authz_alice";
const bob = "test_authz_bob";

/** 公開範囲ごとに1つずつ。IDは`ps_`+英数36種10文字の形に合わせる。 */
const sets = {
  public: "ps_authz00pub",
  unlisted: "ps_authz00unl",
  private: "ps_authz00prv",
  draft: "ps_authz00drf",
} as const;

/** seedで入っているカタログの問題。外部キーを満たすために実在するIDを使う。 */
const problemIds = ["dp_a", "dp_b"];
/** セットに入っていない問題。挑戦状態の書き込みが弾かれることの確認に使う。 */
const foreignProblemId = "dp_c";

function context(setId: string) {
  return { params: Promise.resolve({ setId }) };
}

function request(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function sample(setId: string, visibility: Visibility, status: "draft" | "published"): ProblemSet {
  const now = new Date().toISOString();
  return {
    setId,
    title: `認可検証 ${setId}`,
    description: "route authorization",
    tags: ["DP"],
    targetBands: ["green"],
    visibility,
    status,
    problems: problemIds.map((problemId) => ({
      problemId,
      contestId: "dp",
      problemIndex: problemId.slice(-1).toUpperCase(),
      title: problemId,
      difficulty: null,
      source: `EDPC ${problemId.slice(-1).toUpperCase()}`,
      tags: [],
      authorBand: null,
    })),
    authorName: "Alice",
    likeCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function cleanUp(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query("delete from problem_sets where set_id = any($1)", [Object.values(sets)]);
  await pool.query("delete from users where id = any($1)", [[alice, bob]]);
}

/** 毎回同じ状態から始める。前のテストのいいねや公開範囲の変更を持ち越さない。 */
async function reset(): Promise<void> {
  const pool = getPool();
  await pool?.query("delete from problem_sets where set_id = any($1)", [Object.values(sets)]);
  await saveSet(sample(sets.public, "public", "published"), alice);
  await saveSet(sample(sets.unlisted, "unlisted", "published"), alice);
  await saveSet(sample(sets.private, "private", "published"), alice);
  await saveSet(sample(sets.draft, "public", "draft"), alice);
}

function as(userId: string | null): void {
  session.current = userId;
}

describe.skipIf(!hasDatabase)("problem set route authorization", () => {
  beforeAll(async () => {
    await cleanUp();
    await getPool()?.query(
      "insert into users(id, name, display_name) values ($1, $2, $3), ($4, $5, $6)",
      [alice, "Alice", "Alice", bob, "Bob", "Bob"],
    );
  });

  beforeEach(async () => {
    await reset();
    as(null);
  });

  afterAll(async () => {
    await cleanUp();
    await getPool()?.end();
  });

  describe("reading one set", () => {
    it.each([
      ["public", sets.public, 200],
      ["unlisted", sets.unlisted, 200],
      ["private", sets.private, 404],
      ["draft", sets.draft, 404],
    ] as const)("answers %s with %i for an anonymous visitor", async (_label, setId, status) => {
      as(null);
      expect((await setGet(request("GET", "http://t/x"), context(setId))).status).toBe(status);
    });

    it.each([
      ["public", sets.public, 200],
      ["unlisted", sets.unlisted, 200],
      ["private", sets.private, 404],
      ["draft", sets.draft, 404],
    ] as const)("answers %s with %i for a signed-in stranger", async (_label, setId, status) => {
      as(bob);
      expect((await setGet(request("GET", "http://t/x"), context(setId))).status).toBe(status);
    });

    it("lets the owner read every one of their own sets", async () => {
      as(alice);
      for (const setId of Object.values(sets)) {
        expect((await setGet(request("GET", "http://t/x"), context(setId))).status).toBe(200);
      }
    });

    it("cannot be told apart from a set that does not exist", async () => {
      as(bob);
      const hidden = await setGet(request("GET", "http://t/x"), context(sets.private));
      const missing = await setGet(request("GET", "http://t/x"), context("ps_0000000000"));
      expect(hidden.status).toBe(missing.status);
      expect(await hidden.json()).toEqual(await missing.json());
    });
  });

  describe("writing one set", () => {
    it("refuses an anonymous write with 401, not 404", async () => {
      as(null);
      const body = sample(sets.public, "public", "published");
      expect((await setPut(request("PUT", "http://t/x", body), context(sets.public))).status).toBe(401);
      expect((await setDelete(request("DELETE", "http://t/x"), context(sets.public))).status).toBe(401);
    });

    it("refuses a stranger's update and delete on every visibility", async () => {
      as(bob);
      for (const [visibility, setId] of Object.entries(sets)) {
        const body = { ...sample(setId, "public", "published"), title: `乗っ取り ${visibility}` };
        expect((await setPut(request("PUT", "http://t/x", body), context(setId))).status).toBe(404);
        expect((await setDelete(request("DELETE", "http://t/x"), context(setId))).status).toBe(404);
      }
      for (const setId of Object.values(sets)) {
        expect(await ownerOf(setId)).toBe(alice);
      }
    });

    it("ignores an ownerId supplied in the body", async () => {
      as(alice);
      const body = { ...sample(sets.public, "public", "published"), ownerId: bob };
      expect((await setPut(request("PUT", "http://t/x", body), context(sets.public))).status).toBe(200);
      // 持ち主はsessionから決まる。bodyの`ownerId`は読まれない。
      expect(await ownerOf(sets.public)).toBe(alice);
    });

    it("refuses to create through the update route", async () => {
      as(bob);
      // IDはserverが決める。無いIDへのPUTで作れると、clientが自分でIDを選べてしまう。
      const body = sample("ps_neverexist", "public", "published");
      expect((await setPut(request("PUT", "http://t/x", body), context("ps_neverexist"))).status).toBe(404);
      expect(await ownerOf("ps_neverexist")).toBeNull();
    });

    it("rejects a body whose setId disagrees with the URL", async () => {
      as(alice);
      const body = sample(sets.private, "public", "published");
      expect((await setPut(request("PUT", "http://t/x", body), context(sets.public))).status).toBe(400);
    });

    it("lets the owner update and delete their own set", async () => {
      as(alice);
      const body = { ...sample(sets.public, "public", "published"), title: "書き換え後" };
      const updated = await setPut(request("PUT", "http://t/x", body), context(sets.public));
      expect(updated.status).toBe(200);
      expect(((await updated.json()) as ProblemSet).title).toBe("書き換え後");
      expect((await setDelete(request("DELETE", "http://t/x"), context(sets.public))).status).toBe(200);
      expect(await ownerOf(sets.public)).toBeNull();
    });
  });

  describe("creating a set", () => {
    it("refuses without a session", async () => {
      as(null);
      const { setId: _ignored, ...draft } = sample(sets.public, "public", "published");
      expect((await createPost(request("POST", "http://t/api", draft))).status).toBe(401);
    });

    it("assigns an id the caller did not choose", async () => {
      as(bob);
      const { setId: _ignored, ...draft } = sample(sets.public, "public", "published");
      // bodyへ紛れ込ませたIDは読まれない。serverが決めた値が返る。
      const response = await createPost(
        request("POST", "http://t/api", { ...draft, setId: "ps_chosenbyme" }),
      );
      expect(response.status).toBe(201);
      const created = (await response.json()) as ProblemSet;
      expect(created.setId).not.toBe("ps_chosenbyme");
      expect(created.setId).toMatch(/^ps_[0-9a-z]{10}$/u);
      expect(await ownerOf("ps_chosenbyme")).toBeNull();
      expect(await ownerOf(created.setId)).toBe(bob);
      await getPool()?.query("delete from problem_sets where set_id = $1", [created.setId]);
    });

    it("gives two creations different ids", async () => {
      as(bob);
      const { setId: _ignored, ...draft } = sample(sets.public, "public", "published");
      const ids: string[] = [];
      for (let i = 0; i < 2; i += 1) {
        const response = await createPost(request("POST", "http://t/api", draft));
        expect(response.status).toBe(201);
        ids.push(((await response.json()) as ProblemSet).setId);
      }
      expect(ids[0]).not.toBe(ids[1]);
      await getPool()?.query("delete from problem_sets where set_id = any($1)", [ids]);
    });

    it("refuses a problem that is not in the catalogue", async () => {
      as(bob);
      const { setId: _ignored, ...draft } = sample(sets.public, "public", "published");
      const body = {
        ...draft,
        problems: [{ ...draft.problems[0], problemId: "not_a_real_problem" }],
      };
      expect((await createPost(request("POST", "http://t/api", body))).status).toBe(400);
    });
  });

  describe("reactions", () => {
    it.each([
      ["like", likePost],
      ["bookmark", bookmarkPost],
      ["view", viewPost],
    ] as const)("refuses %s without a session", async (_label, handler) => {
      as(null);
      expect((await handler(request("POST", "http://t/x"), context(sets.public))).status).toBe(401);
    });

    it.each([
      ["like", likePost],
      ["bookmark", bookmarkPost],
      ["view", viewPost],
    ] as const)("refuses %s from a stranger on a private set", async (_label, handler) => {
      as(bob);
      expect((await handler(request("POST", "http://t/x"), context(sets.private))).status).toBe(404);
      expect((await handler(request("POST", "http://t/x"), context(sets.draft))).status).toBe(404);
    });

    it("lets a stranger react to a set that is open to them", async () => {
      as(bob);
      for (const setId of [sets.public, sets.unlisted]) {
        expect((await likePost(request("POST", "http://t/x"), context(setId))).status).toBe(200);
      }
    });

    it("keeps a stranger's reaction out of the owner's own state", async () => {
      as(bob);
      await likePost(request("POST", "http://t/x"), context(sets.public));
      as(alice);
      const mine = await viewerGet(request("GET", "http://t/x"), context(sets.public));
      expect(await mine.json()).toMatchObject({ isOwner: true, liked: false });
    });

    it("reports nothing for an anonymous viewer, whatever the set", async () => {
      as(null);
      for (const setId of Object.values(sets)) {
        const response = await viewerGet(request("GET", "http://t/x"), context(setId));
        expect(await response.json()).toEqual({ isOwner: false, liked: false, bookmarked: false });
      }
    });
  });

  describe("solve status", () => {
    it("refuses both directions without a session", async () => {
      as(null);
      expect((await solveStatusGet(request("GET", "http://t/x"), context(sets.public))).status).toBe(401);
      const body = { problemId: problemIds[0], status: "solved" };
      expect((await solveStatusPut(request("PUT", "http://t/x", body), context(sets.public))).status).toBe(401);
      expect((await allSolveStatusGet()).status).toBe(401);
    });

    it("refuses a write against a set the writer cannot open", async () => {
      as(bob);
      const body = { problemId: problemIds[0], status: "solved" };
      expect((await solveStatusPut(request("PUT", "http://t/x", body), context(sets.private))).status).toBe(404);
    });

    it("refuses a problem that is not in the set", async () => {
      as(alice);
      const body = { problemId: foreignProblemId, status: "solved" };
      expect((await solveStatusPut(request("PUT", "http://t/x", body), context(sets.public))).status).toBe(400);
    });

    it("keeps one person's progress out of another's", async () => {
      as(alice);
      await solveStatusPut(
        request("PUT", "http://t/x", { problemId: problemIds[0], status: "solved" }),
        context(sets.public),
      );
      as(bob);
      const theirs = await solveStatusGet(request("GET", "http://t/x"), context(sets.public));
      expect(await theirs.json()).toEqual({});
      as(alice);
      const mine = await solveStatusGet(request("GET", "http://t/x"), context(sets.public));
      expect(await mine.json()).toMatchObject({ [problemIds[0]]: "solved" });
    });
  });

  describe("collections", () => {
    it("refuses the personal collections without a session", async () => {
      as(null);
      expect((await libraryGet(request("GET", "http://t/api?tab=created"))).status).toBe(401);
      expect((await countsGet()).status).toBe(401);
    });

    it("shows only published public sets on Discover", async () => {
      as(null);
      const response = await discoverGet(request("GET", "http://t/api?q=認可検証"));
      const found = (await response.json()) as ProblemSetSummary[];
      expect(found.map((entry) => entry.setId)).toEqual([sets.public]);
    });

    it("shows the same Discover result to a signed-in stranger", async () => {
      as(bob);
      const response = await discoverGet(request("GET", "http://t/api?q=認可検証"));
      const found = (await response.json()) as ProblemSetSummary[];
      expect(found.map((entry) => entry.setId)).toEqual([sets.public]);
    });

    it("drops a liked set from the stranger's library once it is made private", async () => {
      as(bob);
      await likePost(request("POST", "http://t/x"), context(sets.public));
      const before = (await (await libraryGet(request("GET", "http://t/api?tab=liked"))).json()) as ProblemSetSummary[];
      expect(before.map((entry) => entry.setId)).toContain(sets.public);

      as(alice);
      await setPut(
        request("PUT", "http://t/x", sample(sets.public, "private", "published")),
        context(sets.public),
      );

      as(bob);
      const after = (await (await libraryGet(request("GET", "http://t/api?tab=liked"))).json()) as ProblemSetSummary[];
      expect(after.map((entry) => entry.setId)).not.toContain(sets.public);
    });

    it("keeps the owner's own sets in their library after going private", async () => {
      as(alice);
      await setPut(
        request("PUT", "http://t/x", sample(sets.public, "private", "published")),
        context(sets.public),
      );
      const mine = (await (await libraryGet(request("GET", "http://t/api?tab=created"))).json()) as ProblemSetSummary[];
      expect(mine.map((entry) => entry.setId)).toContain(sets.public);
    });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * どの応答をCDNへ預けてよいかを、route handlerの入口から実DBで確かめる。
 *
 * これは性能の試験ではなく安全の試験である。預けてよいのは「誰が見ても同じ」応答だけで、
 * 見る人によって内容が変わる応答を預けると、最初の1人の内容が後続の全員へ配られる。
 * 非公開セットや他人のライブラリがそれに当たる。
 *
 * HobbyプランではWAFのrate limitが使えないため、未認証で叩ける経路の保護はCDNしかない。
 * そのぶん「ついでにここも預けよう」という変更が入りやすい。預けてはいけない側を
 * 名指しで固定しておく。
 *
 * `DATABASE_URL`が無い環境ではskipする。
 */

const session = vi.hoisted(() => ({ current: null as string | null }));

vi.mock("@/auth", () => ({
  auth: async () => (session.current ? { user: { id: session.current } } : null),
}));

const { getPool } = await import("@/server/db/client");
const { saveSet } = await import("./queries");

const { GET: discoverGet } = await import("../../app/api/problem-sets/route");
const { GET: featuredGet } = await import("../../app/api/problem-sets/featured/route");
const { GET: setGet } = await import("../../app/api/problem-sets/[setId]/route");
const { GET: viewerGet } = await import("../../app/api/problem-sets/[setId]/viewer/route");
const { GET: libraryGet } = await import("../../app/api/problem-sets/library/route");
const { GET: countsGet } = await import("../../app/api/problem-sets/counts/route");

const hasDatabase = Boolean(process.env.DATABASE_URL);

const alice = "test_cache_alice";
const publicSet = "ps_cache000pb";
const privateSet = "ps_cache000pv";

function setBody(setId: string, visibility: "public" | "private") {
  return {
    setId,
    title: `cache ${visibility}`,
    description: "",
    tags: [],
    visibility,
    status: "published" as const,
    problems: [],
    targetBands: [],
  };
}

/** 共有cacheへ預ける指示が入っているか。`s-maxage`があれば預かる。 */
function sharedCacheSeconds(response: Response): number | null {
  const header = response.headers.get("cache-control");
  const found = header?.match(/s-maxage=(\d+)/);
  return found ? Number(found[1]) : null;
}

describe.skipIf(!hasDatabase)("which responses may reach a shared cache", () => {
  beforeAll(async () => {
    const pool = getPool();
    if (!pool) throw new Error("DATABASE_URL is set but no pool was created");
    await pool.query(
      `insert into users (id, name, email) values ($1, $1, $1 || '@example.test')
       on conflict (id) do nothing`,
      [alice],
    );
    await saveSet(setBody(publicSet, "public"), alice);
    await saveSet(setBody(privateSet, "private"), alice);
  });

  afterAll(async () => {
    const pool = getPool();
    if (!pool) return;
    await pool.query("delete from problem_sets where set_id = any($1)", [[publicSet, privateSet]]);
    await pool.query("delete from users where id = $1", [alice]);
  });

  beforeEach(() => {
    session.current = null;
  });

  describe("may be cached: the same bytes for every viewer", () => {
    it("caches the discover listing", async () => {
      const response = await discoverGet(new Request("http://localhost/api/problem-sets?sort=popular"));
      expect(response.status).toBe(200);
      expect(sharedCacheSeconds(response)).toBeGreaterThan(0);
    });

    it("caches the featured shelves", async () => {
      const response = await featuredGet(new Request("http://localhost/api/problem-sets/featured?kind=new"));
      expect(response.status).toBe(200);
      expect(sharedCacheSeconds(response)).toBeGreaterThan(0);
    });

    /*
     * 公開した本人が自分のセットを見つけられない時間が、このぶんだけ延びる。
     * 連打を吸う効果は短くても出るので、長くしない。
     */
    it("keeps the staleness short enough that a new set shows up quickly", async () => {
      const response = await discoverGet(new Request("http://localhost/api/problem-sets"));
      expect(sharedCacheSeconds(response)).toBeLessThanOrEqual(60);
    });
  });

  describe("must not be cached: the answer depends on who asks", () => {
    /*
     * ここが預けられると、非公開セットを持ち主が1度開いた応答が、
     * 同じURLを叩いた他人へそのまま配られる。
     */
    it("never caches a single set, even a public one", async () => {
      session.current = alice;
      const response = await setGet(new Request(`http://localhost/api/problem-sets/${publicSet}`), {
        params: Promise.resolve({ setId: publicSet }),
      });
      expect(response.status).toBe(200);
      expect(sharedCacheSeconds(response)).toBeNull();
    });

    it("never caches a private set", async () => {
      session.current = alice;
      const response = await setGet(new Request(`http://localhost/api/problem-sets/${privateSet}`), {
        params: Promise.resolve({ setId: privateSet }),
      });
      expect(response.status).toBe(200);
      expect(sharedCacheSeconds(response)).toBeNull();
    });

    it("never caches the viewer state", async () => {
      session.current = alice;
      const response = await viewerGet(new Request(`http://localhost/api/problem-sets/${publicSet}/viewer`), {
        params: Promise.resolve({ setId: publicSet }),
      });
      expect(sharedCacheSeconds(response)).toBeNull();
    });

    it("never caches a library", async () => {
      session.current = alice;
      const response = await libraryGet(new Request("http://localhost/api/problem-sets/library?tab=mine"));
      expect(sharedCacheSeconds(response)).toBeNull();
    });

    it("never caches the library counts", async () => {
      session.current = alice;
      const response = await countsGet();
      expect(sharedCacheSeconds(response)).toBeNull();
    });
  });
});

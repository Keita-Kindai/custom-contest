// 日曜デモ用の固定問題JSONを生成します。
// 実行するのは開発者だけで、Room作成やMatch開始では外部APIへ問い合わせません。
// 出力: packages/domain/src/problems/abc-cd-400-1200.json
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROBLEMS_URL = "https://kenkoooo.com/atcoder/resources/problems.json";
const MODELS_URL = "https://kenkoooo.com/atcoder/resources/problem-models.json";
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/domain/src/problems/abc-cd-400-1200.json");

const ALLOWED_INDEXES = new Set(["C", "D"]);
const DIFFICULTY_MIN = 400;
const DIFFICULTY_MAX = 1200;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.json();
}

// AtCoder Problems asks API clients to leave more than one second between accesses.
// This script is run manually and never from a Room request, so a simple serial delay is sufficient.
const problems = await fetchJson(PROBLEMS_URL);
await new Promise((resolve) => setTimeout(resolve, 1_100));
const models = await fetchJson(MODELS_URL);

const entries = [];
for (const problem of problems) {
  if (!/^abc\d+$/.test(problem.contest_id)) continue;
  if (!ALLOWED_INDEXES.has(problem.problem_index)) continue;
  const model = models[problem.id];
  if (!model || typeof model.difficulty !== "number") continue;
  if (model.is_experimental) continue;
  if (model.difficulty < DIFFICULTY_MIN || model.difficulty > DIFFICULTY_MAX) continue;
  entries.push({
    problemId: problem.id,
    contestId: problem.contest_id,
    problemIndex: problem.problem_index,
    title: problem.name,
    difficulty: Math.round(model.difficulty),
    url: `https://atcoder.jp/contests/${problem.contest_id}/tasks/${problem.id}`,
    submitUrl: `https://atcoder.jp/contests/${problem.contest_id}/submit?taskScreenName=${problem.id}`,
  });
}

entries.sort((a, b) => (a.contestId === b.contestId ? a.problemIndex.localeCompare(b.problemIndex) : a.contestId.localeCompare(b.contestId)));

const pool = {
  source: {
    name: "AtCoder Problems",
    problems: PROBLEMS_URL,
    models: MODELS_URL,
    note: "Difficultyは非公式の推定値であり、画面では「目安」と表記します。",
  },
  filter: {
    contestPrefix: "abc",
    problemIndexes: [...ALLOWED_INDEXES],
    difficultyMin: DIFFICULTY_MIN,
    difficultyMax: DIFFICULTY_MAX,
    excludeExperimental: true,
  },
  generatedAt: new Date().toISOString(),
  count: entries.length,
  problems: entries,
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(pool, null, 2)}\n`, "utf8");
console.log(`wrote ${entries.length} problems to ${OUTPUT}`);

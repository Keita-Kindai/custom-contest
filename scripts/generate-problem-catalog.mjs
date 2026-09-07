// 問題セット作成画面が検索する問題カタログを生成します。
// 対戦側の抽選pool（abc-cd-400-1200.json）とは別物で、範囲がずっと広い。
// 実行するのは開発者だけで、画面の検索では外部APIへ問い合わせません。
// 出力: packages/domain/src/problems/catalog.json
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROBLEMS_URL = "https://kenkoooo.com/atcoder/resources/problems.json";
const MODELS_URL = "https://kenkoooo.com/atcoder/resources/problem-models.json";
const CONTESTS_URL = "https://kenkoooo.com/atcoder/resources/contests.json";
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/domain/src/problems/catalog.json");

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.json();
}

const [problems, models, contests] = await Promise.all([
  fetchJson(PROBLEMS_URL),
  fetchJson(MODELS_URL),
  fetchJson(CONTESTS_URL),
]);

const contestTitleById = new Map(contests.map((contest) => [contest.id, contest.title]));

/** 出典の短縮表記。検索結果の一覧で桁を揃えるために使う。 */
function sourceLabel(contestId, problemIndex) {
  if (/^abc\d+$/.test(contestId)) return `ABC${contestId.slice(3)} ${problemIndex}`;
  if (/^arc\d+$/.test(contestId)) return `ARC${contestId.slice(3)} ${problemIndex}`;
  if (/^agc\d+$/.test(contestId)) return `AGC${contestId.slice(3)} ${problemIndex}`;
  if (contestId === "dp") return `EDPC ${problemIndex}`;
  if (contestId === "typical90") return `典型90 ${problemIndex}`;
  if (contestId === "tessoku-book") return `鉄則 ${problemIndex}`;
  if (contestId === "math-and-algorithm") return `数学 ${problemIndex}`;
  return `${contestId} ${problemIndex}`;
}

/** 検索の既定タグ。AtCoder Problemsはタグを持たないため、出典から推定できる分だけ付ける。 */
function inferredTags(contestId) {
  if (contestId === "dp") return ["DP", "EDPC"];
  if (contestId === "typical90") return ["典型90", "典型"];
  if (contestId === "tessoku-book") return ["典型"];
  if (contestId === "math-and-algorithm") return ["数学"];
  return [];
}

/**
 * 精進で実際に使う出典だけに絞る。
 * AtCoder Daily Trainingなどの再掲コンテストを入れると、同じ問題が何度も検索へ出る。
 */
const PRACTICE_SET_CONTESTS = new Set(["dp", "typical90", "tessoku-book", "math-and-algorithm"]);
function includedContest(contestId) {
  if (/^(abc|arc|agc)\d+$/.test(contestId)) return true;
  return PRACTICE_SET_CONTESTS.has(contestId);
}

const entries = [];
for (const problem of problems) {
  if (!includedContest(problem.contest_id)) continue;
  if (!contestTitleById.has(problem.contest_id)) continue;

  // EDPCや典型90はratedでないためDifficultyの推定値を持たない。
  // 数値がない問題も検索対象に残し、画面ではDifficultyだけを伏せる。
  const model = models[problem.id];
  const raw = model && !model.is_experimental ? model.difficulty : null;
  const difficulty =
    typeof raw === "number"
      ? // Difficultyが400未満の領域は推定が歪むため、AtCoder Problemsと同じ補正をかける。
        raw >= 400
        ? Math.round(raw)
        : Math.round(400 / Math.exp(1 - raw / 400))
      : null;

  entries.push({
    problemId: problem.id,
    contestId: problem.contest_id,
    problemIndex: problem.problem_index,
    title: problem.name,
    difficulty,
    source: sourceLabel(problem.contest_id, problem.problem_index),
    tags: inferredTags(problem.contest_id),
  });
}

/**
 * 既定の並び順。検索語なしで開いたときに、まず新しいABC/ARC/AGCが出るようにする。
 * 古いコンテストはDifficulty推定がis_experimentalで伏せられることが多く、先頭に出ても選びにくい。
 */
const SERIES_RANK = { abc: 0, arc: 1, agc: 2 };
function orderKey(entry) {
  const match = /^(abc|arc|agc)(\d+)$/.exec(entry.contestId);
  if (match) {
    const [, series, number] = match;
    // 番号の大きい回ほど前へ。
    return [0, SERIES_RANK[series], -Number(number), entry.problemIndex];
  }
  return [1, 0, 0, entry.source];
}

entries.sort((a, b) => {
  const left = orderKey(a);
  const right = orderKey(b);
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] === right[i]) continue;
    return typeof left[i] === "number" ? left[i] - right[i] : String(left[i]).localeCompare(String(right[i]), "en");
  }
  return 0;
});

const catalog = {
  source: {
    name: "AtCoder Problems",
    problems: PROBLEMS_URL,
    models: MODELS_URL,
    contests: CONTESTS_URL,
    note: "Difficultyは非公式の推定値であり、画面では「目安」と表記します。400未満はAtCoder Problemsと同じ補正後の値です。",
  },
  generatedAt: new Date().toISOString(),
  count: entries.length,
  problems: entries,
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(catalog)}\n`, "utf8");
console.log(`wrote ${entries.length} problems to ${OUTPUT}`);

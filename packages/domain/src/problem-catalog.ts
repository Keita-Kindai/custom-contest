import type { CatalogProblem, ProblemSearchQuery, ProblemSearchResponse } from "@custom-contest/contracts";
import catalogJson from "./problems/catalog.json";

/**
 * 問題セット作成画面が検索する固定カタログ。
 * 対戦側の抽選pool（`problem-pool.ts`）とは別物で、範囲が広く問題記号も限定しない。
 * 約3300問・460KBあるため、clientへ配らずserver側だけで読む。
 */
export const problemCatalog = catalogJson as {
  source: Record<string, string>;
  generatedAt: string;
  count: number;
  problems: CatalogProblem[];
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

/** タイトル・出典・タグ・問題IDのどれかに含まれれば一致とする。 */
function matchesKeyword(problem: CatalogProblem, keyword: string): boolean {
  if (!keyword) return true;
  const haystack = normalize(
    `${problem.title} ${problem.source} ${problem.problemId} ${problem.tags.join(" ")}`,
  );
  return keyword
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(normalize(term)));
}

function matchesDifficulty(problem: CatalogProblem, min: number | null, max: number | null): boolean {
  if (min === null && max === null) return true;
  // Difficultyを持たない問題は、帯で絞り込んだ時点で候補から外す。
  if (problem.difficulty === null) return false;
  if (min !== null && problem.difficulty < min) return false;
  if (max !== null && problem.difficulty > max) return false;
  return true;
}

export function searchCatalog(query: ProblemSearchQuery): ProblemSearchResponse {
  const matched = problemCatalog.problems.filter(
    (problem) =>
      matchesKeyword(problem, query.q) &&
      matchesDifficulty(problem, query.difficultyMin, query.difficultyMax),
  );
  return { total: matched.length, problems: matched.slice(0, query.limit) };
}

export function catalogProblemById(problemId: string): CatalogProblem | null {
  return problemCatalog.problems.find((problem) => problem.problemId === problemId) ?? null;
}

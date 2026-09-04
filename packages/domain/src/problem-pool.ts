import type { Problem, RoomSettings } from "@custom-contest/contracts";
import { problemPoolSchema } from "@custom-contest/contracts";
import poolJson from "./problems/abc-cd-400-1200.json";
import { seededPicker } from "./random";

/**
 * 事前生成した固定JSON。Room作成やMatch開始で外部APIへ問い合わせない。
 * 再生成は `pnpm problems:generate` を開発者が実行する。
 */
export const problemPool = problemPoolSchema.parse(poolJson);

export type ProblemSelection =
  | { ok: true; problem: Problem; resetUsed: boolean }
  | { ok: false; reason: "problem_pool_empty" };

function matchesSettings(problem: Problem, settings: RoomSettings): boolean {
  if (!settings.problemIndexes.includes(problem.problemIndex)) return false;
  if (problem.difficulty === null) return false;
  return problem.difficulty >= settings.difficultyMin && problem.difficulty <= settings.difficultyMax;
}

export function candidatesFor(settings: RoomSettings): Problem[] {
  return problemPool.problems.filter((problem) => matchesSettings(problem, settings));
}

/**
 * Roomの出題履歴を避けて1問選ぶ。
 * 候補を使い切っている場合だけ履歴をresetして選び直す（`resetUsed: true`）。
 */
export function selectProblem(
  settings: RoomSettings,
  usedProblemIds: readonly string[],
  seed: string,
  /** START前に利用不能と分かった問題。再抽選で除外する。 */
  unavailableProblemIds: readonly string[] = [],
): ProblemSelection {
  const all = candidatesFor(settings).filter((problem) => !unavailableProblemIds.includes(problem.problemId));
  if (all.length === 0) return { ok: false, reason: "problem_pool_empty" };

  const used = new Set(usedProblemIds);
  const fresh = all.filter((problem) => !used.has(problem.problemId));
  const resetUsed = fresh.length === 0;
  const pool = resetUsed ? all : fresh;

  const pick = seededPicker(seed);
  const index = Math.floor(pick() * pool.length) % pool.length;
  const problem = pool[index];
  if (!problem) return { ok: false, reason: "problem_pool_empty" };
  return { ok: true, problem, resetUsed };
}

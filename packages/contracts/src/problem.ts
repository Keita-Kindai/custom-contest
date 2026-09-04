import { z } from "zod";
import { problemIndexSchema } from "./common";

/** 事前生成した固定JSONの1問。runtimeに外部APIへ問い合わせない。 */
export const problemSchema = z.object({
  /** AtCoderのtaskScreenName。`abc302_c` や `arc061_a` の形をとる。 */
  problemId: z.string().min(1),
  contestId: z.string().min(1),
  problemIndex: problemIndexSchema,
  title: z.string().min(1),
  /** 非公式のDifficulty目安。取得できない場合は画面から隠す。 */
  difficulty: z.number().int().nullable(),
  url: z.url(),
  submitUrl: z.url(),
});
export type Problem = z.infer<typeof problemSchema>;

export const problemPoolSchema = z.object({
  source: z.object({
    name: z.string(),
    problems: z.url(),
    models: z.url(),
    note: z.string(),
  }),
  filter: z.object({
    contestPrefix: z.string(),
    problemIndexes: z.array(problemIndexSchema),
    difficultyMin: z.number().int(),
    difficultyMax: z.number().int(),
    excludeExperimental: z.boolean(),
  }),
  generatedAt: z.iso.datetime(),
  count: z.number().int().nonnegative(),
  problems: z.array(problemSchema.extend({ difficulty: z.number().int() })),
});
export type ProblemPool = z.infer<typeof problemPoolSchema>;

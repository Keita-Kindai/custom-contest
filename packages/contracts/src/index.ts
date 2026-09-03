import { z } from "zod";

export const projectSummarySchema = z.object({
  name: z.string().min(1),
  tagline: z.string().min(1),
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const projectSummary = projectSummarySchema.parse({
  name: "Custom Contest",
  tagline: "競技プログラミングを、もっと手軽に・ゲーム感覚で・友達と。",
});

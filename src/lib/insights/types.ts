import { z } from "zod";

export const INSIGHT_TOPICS = [
  "savings",
  "nutrition",
  "nutrition_analysis",
  "spending",
  "habits",
  "custom",
] as const;

export type InsightTopic = (typeof INSIGHT_TOPICS)[number];

export const insightRequestSchema = z
  .object({
    topic: z.enum(INSIGHT_TOPICS),
    custom_query: z.string().min(1).max(500).optional(),
    locale: z.enum(["de", "en"]),
    household_size: z.number().int().min(1).max(8).optional(),
  })
  .refine(
    (d) => d.topic !== "custom" || (d.custom_query?.trim().length ?? 0) > 0,
    { message: "custom_query required for custom topic", path: ["custom_query"] },
  );

export type InsightRequest = z.infer<typeof insightRequestSchema>;

const insightSectionSchema = z.object({
  content: z.string(),
  suggested_product_name: z.string().nullish(),
});

export const insightResponseSchema = z.object({
  title: z.string(),
  sections: z.array(insightSectionSchema),
  summary: z.string(),
  follow_up_suggestions: z
    .array(z.string())
    .nullable()
    .transform((v) => v ?? []),
});

export type InsightSection = z.infer<typeof insightSectionSchema>;
export type InsightResponse = z.infer<typeof insightResponseSchema>;

/**
 * Explicit mapping from API topic enum to prompt file identifier.
 * The naming mismatch ("nutrition" -> health, "nutrition_analysis" -> nutrition)
 * is intentional -- matches the spec's UI labels to Claude prompt files.
 */
export const TOPIC_PROMPT_MAP: Record<InsightTopic, string> = {
  savings: "savings",
  nutrition: "health",
  nutrition_analysis: "nutrition",
  spending: "spending",
  habits: "habits",
  custom: "custom",
};

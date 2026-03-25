import { z } from "zod";

export const recipeIngredientSchema = z.object({
  name: z.string(),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  category: z.string(),
  notes: z.string(),
  is_optional: z.boolean(),
});

export const saveRecipeBodySchema = z
  .object({
    title: z.string().min(1).max(500),
    source_url: z.union([z.string().url().max(2000), z.null()]),
    source_name: z.string().min(1).max(200),
    source_type: z.enum(["url_import", "ai_cook"]),
    original_servings: z.number().int().min(1).max(99),
    servings_label: z.string().min(1).max(80),
    ingredients: z.array(recipeIngredientSchema).min(1).max(100),
    /** Kochschritte (v. a. ai_cook); optional, URL-Import übergibt null / weglässt. */
    instructions: z.array(z.string().max(2000)).max(200).nullable().optional(),
    prep_time_minutes: z.number().int().nullable(),
    cook_time_minutes: z.number().int().nullable(),
    difficulty: z.string().max(80).nullable(),
    aldi_adapted: z.boolean(),
  })
  .strict()
  .refine(
    (data) =>
      data.source_type === "ai_cook" ? data.source_url === null : true,
    "ai_cook recipes must have source_url null",
  );

export type SaveRecipeBody = z.infer<typeof saveRecipeBodySchema>;

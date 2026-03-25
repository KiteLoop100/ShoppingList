-- AI-generated recipes (source_type ai_cook): store cooking steps in JSONB.
-- Nullable: URL imports have no steps (decision D10 extended for ai_cook).
ALTER TABLE public.saved_recipes
  ADD COLUMN IF NOT EXISTS instructions JSONB;

COMMENT ON COLUMN public.saved_recipes.instructions IS
  'Optional ordered cooking steps (string[] JSON); set for ai_cook saves, null for url_import.';

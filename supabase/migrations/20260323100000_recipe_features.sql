-- F-RECIPE: saved recipes, import analytics, AI cook chat (spec F-RECIPE-FEATURES-SPEC.md)
-- No instructions column on saved_recipes (decision D10: user keeps source page).

-- 1. saved_recipes
CREATE TABLE public.saved_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_url TEXT,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('url_import', 'ai_cook')),
  original_servings INTEGER NOT NULL,
  servings_label TEXT NOT NULL DEFAULT 'Portionen',
  ingredients JSONB NOT NULL,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  difficulty TEXT,
  aldi_adapted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

COMMENT ON TABLE public.saved_recipes IS
  'User-saved recipes from URL import or AI cook flow; ingredients JSONB; no stored cooking steps (D10).';

ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recipes"
  ON public.saved_recipes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_saved_recipes_user_id ON public.saved_recipes (user_id);
CREATE INDEX idx_saved_recipes_user_source_type ON public.saved_recipes (user_id, source_type);

-- 2. recipe_imports
CREATE TABLE public.recipe_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  extraction_method TEXT NOT NULL CHECK (
    extraction_method IN ('json-ld', 'microdata', 'ai-fallback')
  ),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.recipe_imports IS
  'Per-import audit trail for recipe URL extraction (analytics, debugging).';

ALTER TABLE public.recipe_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recipe imports"
  ON public.recipe_imports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_recipe_imports_user_id ON public.recipe_imports (user_id);

-- 3. cook_conversations
CREATE TABLE public.cook_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  pantry_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cook_conversations IS
  'AI "What can I cook?" chat sessions with optional pantry snapshot.';

ALTER TABLE public.cook_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cook conversations"
  ON public.cook_conversations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cook_conversations_user_id ON public.cook_conversations (user_id);

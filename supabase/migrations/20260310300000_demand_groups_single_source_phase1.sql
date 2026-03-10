-- Demand Groups: Single Source of Truth — Phase 1
--
-- Adds source, is_meta, reviewed_at columns to demand_groups and
-- demand_sub_groups. Adds CHECK constraints, marks existing meta-categories,
-- and creates the XX "Sonstige" catch-all group.
--
-- v3: source CHECK allows 4 values: curated, ai_generated, official, merged

BEGIN;

-- =====================================================================
-- 1a. New columns on demand_groups
-- =====================================================================
ALTER TABLE demand_groups ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'curated';
ALTER TABLE demand_groups ADD COLUMN IF NOT EXISTS is_meta BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE demand_groups ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- =====================================================================
-- 1b. New columns on demand_sub_groups
-- =====================================================================
ALTER TABLE demand_sub_groups ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'curated';
ALTER TABLE demand_sub_groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- =====================================================================
-- 1c. CHECK constraints on demand_groups (idempotent via DO block)
-- =====================================================================
DO $$ BEGIN
  ALTER TABLE demand_groups ADD CONSTRAINT chk_dg_source
    CHECK (source IN ('curated', 'ai_generated', 'official', 'merged'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE demand_groups ADD CONSTRAINT chk_dg_hierarchy
    CHECK ((is_meta = true AND parent_group IS NULL) OR (is_meta = false));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- 1d. CHECK constraint on demand_sub_groups
-- =====================================================================
DO $$ BEGIN
  ALTER TABLE demand_sub_groups ADD CONSTRAINT chk_dsg_source
    CHECK (source IN ('curated', 'ai_generated', 'official', 'merged'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- 1e. Mark existing meta-categories (M01–M14)
-- =====================================================================
UPDATE demand_groups SET is_meta = true WHERE code LIKE 'M%' AND parent_group IS NULL;

-- =====================================================================
-- 1f. Create XX "Sonstige" catch-all group
-- =====================================================================
INSERT INTO demand_groups (code, name, name_en, icon, color, sort_position, is_meta, source)
VALUES ('XX', 'Sonstige', 'Other / Unmapped', '📦', '#9E9E9E', 999, false, 'curated')
ON CONFLICT (code) DO NOTHING;

COMMIT;

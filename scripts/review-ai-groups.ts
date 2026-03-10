/**
 * MECE Review Script — reviews AI-generated demand groups for overlaps and
 * merges them into curated groups when appropriate.
 *
 * Uses Claude Sonnet to analyze groups and suggest merges, then executes
 * them via the mece-merge library.
 *
 * Usage:
 *   npx tsx scripts/review-ai-groups.ts
 *   npx tsx scripts/review-ai-groups.ts --dry-run
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { executeMerge, deduplicatePairwise, type SubGroupMapping } from "./lib/mece-merge";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const CLAUDE_MODEL_SONNET = "claude-sonnet-4-5-20250929";

const isDryRun = process.argv.includes("--dry-run");

interface DemandGroupCandidate {
  code: string;
  name: string;
  name_en: string | null;
  source: string;
  product_count: number;
  sub_groups: Array<{ code: string; name: string }>;
}

interface MergeDecision {
  old_code: string;
  new_code: string;
  sub_group_mapping: SubGroupMapping;
}

interface MECEAnalysis {
  merges: MergeDecision[];
  keep: string[];
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY");
    process.exit(1);
  }
  if (!ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  console.log(`\n🔍 MECE Review Script${isDryRun ? " (DRY RUN)" : ""}\n`);

  // Step 1: Load candidates
  console.log("Step 1: Loading AI-generated group candidates...");
  const candidates = await loadCandidates(supabase);
  console.log(`  Found ${candidates.length} AI-generated groups to review`);

  if (candidates.length === 0) {
    console.log("  No candidates to review. Done.");
    return;
  }

  const curatedGroups = await loadCuratedGroups(supabase);
  console.log(`  Loaded ${curatedGroups.length} curated groups for context`);

  // Step 2: MECE analysis via Claude
  console.log("\nStep 2: Running MECE analysis via Claude Sonnet...");
  const analysis = await runMECEAnalysis(candidates, curatedGroups);
  console.log(`  Merges proposed: ${analysis.merges.length}`);
  console.log(`  Groups to keep: ${analysis.keep.length}`);

  for (const merge of analysis.merges) {
    console.log(`    MERGE: ${merge.old_code} → ${merge.new_code}`);
    for (const [oldSub, newSub] of Object.entries(merge.sub_group_mapping)) {
      console.log(`      Sub-group: ${oldSub} → ${newSub}`);
    }
  }
  for (const code of analysis.keep) {
    console.log(`    KEEP: ${code}`);
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] No changes applied.");
    return;
  }

  // Step 3: Execute merges
  console.log("\nStep 3: Executing merges...");
  for (const merge of analysis.merges) {
    console.log(`  Merging ${merge.old_code} → ${merge.new_code}...`);
    const result = await executeMerge(
      supabase,
      merge.old_code,
      merge.new_code,
      merge.sub_group_mapping,
    );
    console.log(`    Updated: ${result.tablesUpdated.join(", ")}`);
    if (result.errors.length > 0) {
      console.error(`    Errors: ${result.errors.join("; ")}`);
    }
  }

  // Step 4: Deduplicate pairwise
  if (analysis.merges.length > 0) {
    console.log("\nStep 4: Deduplicating pairwise comparisons...");
    const merged = await deduplicatePairwise(supabase);
    console.log(`  Merged ${merged} duplicate pairwise records`);
  }

  // Step 5: Mark all reviewed groups
  console.log("\nStep 5: Marking groups as reviewed...");
  const allReviewedCodes = [
    ...analysis.merges.map((m) => m.old_code),
    ...analysis.keep,
  ];

  if (allReviewedCodes.length > 0) {
    const { error } = await supabase
      .from("demand_groups")
      .update({ reviewed_at: new Date().toISOString() })
      .in("code", allReviewedCodes);
    if (error) {
      console.error(`  Failed to update reviewed_at: ${error.message}`);
    } else {
      console.log(`  Updated reviewed_at for ${allReviewedCodes.length} groups`);
    }
  }

  console.log("\nDone!");
}

async function loadCandidates(supabase: ReturnType<typeof createClient>): Promise<DemandGroupCandidate[]> {
  const { data: groups, error } = await supabase
    .from("demand_groups")
    .select("code, name, name_en, source")
    .eq("source", "ai_generated")
    .or("reviewed_at.is.null,reviewed_at.lt." + thirtyDaysAgo());
  if (error) throw new Error(`Failed to load candidates: ${error.message}`);

  const candidates: DemandGroupCandidate[] = [];
  for (const g of groups ?? []) {
    const count = await countReferencingProducts(supabase, g.code);

    const { data: subs } = await supabase
      .from("demand_sub_groups")
      .select("code, name")
      .eq("demand_group_code", g.code)
      .neq("source", "merged");

    candidates.push({
      code: g.code,
      name: g.name,
      name_en: g.name_en,
      source: g.source,
      product_count: count,
      sub_groups: subs ?? [],
    });
  }

  return candidates;
}

async function countReferencingProducts(
  supabase: ReturnType<typeof createClient>,
  code: string,
): Promise<number> {
  const { count: pCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("demand_group_code", code);

  const { count: cCount } = await supabase
    .from("competitor_products")
    .select("*", { count: "exact", head: true })
    .eq("demand_group_code", code);

  return (pCount ?? 0) + (cCount ?? 0);
}

async function loadCuratedGroups(
  supabase: ReturnType<typeof createClient>,
): Promise<Array<{ code: string; name: string; name_en: string | null; sub_groups: Array<{ code: string; name: string }> }>> {
  const { data, error } = await supabase
    .from("demand_groups")
    .select("code, name, name_en")
    .in("source", ["curated", "official"])
    .order("sort_position");
  if (error) throw new Error(`Failed to load curated groups: ${error.message}`);

  const result = [];
  for (const g of data ?? []) {
    const { data: subs } = await supabase
      .from("demand_sub_groups")
      .select("code, name")
      .eq("demand_group_code", g.code)
      .neq("source", "merged");

    result.push({ ...g, sub_groups: subs ?? [] });
  }

  return result;
}

async function runMECEAnalysis(
  candidates: DemandGroupCandidate[],
  curatedGroups: Array<{ code: string; name: string; name_en: string | null; sub_groups: Array<{ code: string; name: string }> }>,
): Promise<MECEAnalysis> {
  const candidatesList = candidates
    .map((c) => {
      const subs = c.sub_groups.map((s) => `${s.code} ${s.name}`).join(", ");
      return `${c.code} "${c.name}" (${c.product_count} Produkte) — Sub-Groups: ${subs || "(keine)"}`;
    })
    .join("\n");

  const curatedList = curatedGroups
    .map((g) => {
      const subs = g.sub_groups.map((s) => `${s.code} ${s.name}`).join(", ");
      return `${g.code} "${g.name}" — Sub-Groups: ${subs || "(keine)"}`;
    })
    .join("\n");

  const prompt = `Analysiere diese AI-generierten Warengruppen auf MECE-Verletzungen (Mutually Exclusive, Collectively Exhaustive).

AI-generierte Gruppen (zu prüfen):
${candidatesList}

Bestehende curated Gruppen (Kontext):
${curatedList}

Aufgaben:
1. Welche AI-Gruppen überlappen sich mit bestehenden curated Gruppen?
2. Welche AI-Gruppen sollten mit bestehenden curated Gruppen zusammengelegt werden?
3. Welche AI-Gruppen sind sinnvolle neue Kategorien und sollten behalten werden?

Für Merges: Gib an, welche Sub-Groups auf welche bestehenden Sub-Groups gemappt werden sollen.

Antworte als JSON:
{
  "merges": [
    {
      "old_code": "AG03",
      "new_code": "83",
      "sub_group_mapping": { "AG03-01": "83-02", "AG03-02": "83-05" }
    }
  ],
  "keep": ["AG01", "AG07"]
}

Regeln:
- Jede AI-Gruppe muss entweder in "merges" oder "keep" erscheinen.
- old_code ist immer eine AI-Gruppe (AG...), new_code eine bestehende curated Gruppe.
- sub_group_mapping muss alle Sub-Groups der AI-Gruppe abdecken.`;

  const response = await callClaude(prompt);
  const cleaned = response
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  return JSON.parse(cleaned) as MECEAnalysis;
}

async function callClaude(prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL_SONNET,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data.content?.[0]?.text as string) ?? "";
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

/**
 * Phase 2b: Validate demand_sub_group values in products and competitor_products.
 *
 * Checks that every products.demand_sub_group / competitor_products.demand_sub_group
 * value has a matching row in demand_sub_groups. Reports invalid values.
 *
 * Usage: npx tsx scripts/validate-demand-groups.ts
 */

import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== Phase 2b: Demand Groups Validation ===\n");

  // 1. Count demand_groups
  const { count: groupCount } = await supabase
    .from("demand_groups")
    .select("*", { count: "exact", head: true });
  console.log(`1. Total demand_groups: ${groupCount}`);

  // Check if Phase 1 columns exist
  const { data: sampleGroup } = await supabase
    .from("demand_groups")
    .select("*")
    .limit(1);
  const hasPhase1 = sampleGroup?.[0] && "source" in sampleGroup[0];
  console.log(`   Phase 1 columns (source, is_meta): ${hasPhase1 ? "APPLIED ✅" : "NOT YET APPLIED ⚠"}`);

  if (hasPhase1) {
    const { data: metaGroups } = await supabase
      .from("demand_groups")
      .select("code, name, is_meta")
      .eq("is_meta", true)
      .order("code");
    console.log(`   Meta-categories (is_meta=true): ${metaGroups?.length ?? 0}`);
    metaGroups?.forEach((g) => console.log(`     ${g.code}: ${g.name}`));

    const { data: xxGroup } = await supabase
      .from("demand_groups")
      .select("code, name")
      .eq("code", "XX");
    console.log(`   XX catch-all group: ${xxGroup?.length ? "EXISTS ✅" : "MISSING ⚠"}`);
  }

  // 2. Count demand_sub_groups
  const { count: subGroupCount } = await supabase
    .from("demand_sub_groups")
    .select("*", { count: "exact", head: true });
  console.log(`\n2. Total demand_sub_groups: ${subGroupCount}`);

  // 3. Load all valid sub-group codes
  const { data: allSubGroups } = await supabase
    .from("demand_sub_groups")
    .select("code");
  const validCodes = new Set(allSubGroups?.map((sg) => sg.code) ?? []);
  console.log(`   Valid sub-group codes loaded: ${validCodes.size}`);

  // 4. Validate products.demand_sub_group
  console.log("\n3. Validating products.demand_sub_group...");

  let allProducts: Array<{ product_id: string; demand_group_code: string; demand_sub_group: string }> = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("product_id, demand_group_code, demand_sub_group")
      .not("demand_sub_group", "is", null)
      .range(from, from + pageSize - 1);
    if (error) { console.error("Error:", error.message); break; }
    if (!data || data.length === 0) break;
    allProducts = allProducts.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`   Products with demand_sub_group: ${allProducts.length}`);

  const invalidProducts: Record<string, { demand_group_code: string; count: number }> = {};
  for (const p of allProducts) {
    if (!validCodes.has(p.demand_sub_group)) {
      const key = `${p.demand_sub_group}|${p.demand_group_code}`;
      if (!invalidProducts[key]) {
        invalidProducts[key] = { demand_group_code: p.demand_group_code, count: 0 };
      }
      invalidProducts[key].count++;
    }
  }

  const invalidEntries = Object.entries(invalidProducts)
    .map(([key, val]) => ({
      demand_sub_group: key.split("|")[0],
      demand_group_code: val.demand_group_code,
      count: val.count,
    }))
    .sort((a, b) => b.count - a.count);

  if (invalidEntries.length === 0) {
    console.log("   ✅ All products.demand_sub_group values have matching demand_sub_groups rows");
  } else {
    console.log(`   ⚠ Found ${invalidEntries.length} distinct invalid demand_sub_group values in products:`);
    console.table(invalidEntries);
  }

  // 5. Validate competitor_products.demand_sub_group
  console.log("\n4. Validating competitor_products.demand_sub_group...");

  let allComp: Array<{ product_id: string; demand_group_code: string; demand_sub_group: string }> = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("competitor_products")
      .select("product_id, demand_group_code, demand_sub_group")
      .not("demand_sub_group", "is", null)
      .range(from, from + pageSize - 1);
    if (error) { console.error("Error:", error.message); break; }
    if (!data || data.length === 0) break;
    allComp = allComp.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`   Competitor products with demand_sub_group: ${allComp.length}`);

  const invalidComp: Record<string, { demand_group_code: string; count: number }> = {};
  for (const cp of allComp) {
    if (!validCodes.has(cp.demand_sub_group)) {
      const key = `${cp.demand_sub_group}|${cp.demand_group_code}`;
      if (!invalidComp[key]) {
        invalidComp[key] = { demand_group_code: cp.demand_group_code, count: 0 };
      }
      invalidComp[key].count++;
    }
  }

  const invalidCompEntries = Object.entries(invalidComp)
    .map(([key, val]) => ({
      demand_sub_group: key.split("|")[0],
      demand_group_code: val.demand_group_code,
      count: val.count,
    }))
    .sort((a, b) => b.count - a.count);

  if (invalidCompEntries.length === 0) {
    console.log("   ✅ All competitor_products.demand_sub_group values have matching demand_sub_groups rows");
  } else {
    console.log(`   ⚠ Found ${invalidCompEntries.length} distinct invalid demand_sub_group values in competitor_products:`);
    console.table(invalidCompEntries);
  }

  // 6. Groups without sub-groups
  console.log("\n5. Groups without any sub-groups...");
  const { data: allGroups } = await supabase
    .from("demand_groups")
    .select("code, name")
    .order("code");

  const { data: subGroupsByGroup } = await supabase
    .from("demand_sub_groups")
    .select("demand_group_code");
  const groupsWithSubs = new Set(subGroupsByGroup?.map((sg) => sg.demand_group_code) ?? []);

  const groupsWithoutSubs = (allGroups ?? []).filter(
    (g) => !groupsWithSubs.has(g.code) && !g.code.startsWith("M") && g.code !== "XX"
  );
  if (groupsWithoutSubs.length === 0) {
    console.log("   ✅ All non-meta groups have at least one sub-group");
  } else {
    console.log(`   ⚠ ${groupsWithoutSubs.length} groups without sub-groups:`);
    groupsWithoutSubs.forEach((g) => console.log(`     ${g.code}: ${g.name}`));
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Groups: ${groupCount} | Sub-groups: ${subGroupCount}`);
  console.log(`Invalid products.demand_sub_group: ${invalidEntries.length} distinct values`);
  console.log(`Invalid competitor_products.demand_sub_group: ${invalidCompEntries.length} distinct values`);
  console.log(`Groups without sub-groups: ${groupsWithoutSubs.length}`);

  if (invalidEntries.length === 0 && invalidCompEntries.length === 0) {
    console.log("\n✅ Phase 2b validation PASSED — safe to proceed to Phase 5 (FK constraints)");
  } else {
    console.log("\n⚠ Phase 2b validation FAILED — invalid values must be fixed before Phase 5");
  }
}

main().catch(console.error);

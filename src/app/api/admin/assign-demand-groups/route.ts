/**
 * Admin: assign demand_group and demand_sub_group to products that have demand_group = NULL.
 * Processes one batch per request (50 products). Protected by admin cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMAND_GROUPS_INSTRUCTION } from "@/lib/products/demand-groups-prompt";
import { CLAUDE_MODEL_HAIKU } from "@/lib/api/config";
import { requireApiKey, requireAdminAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import { callClaudeJSON } from "@/lib/api/claude-client";

const BATCH_SIZE = 50;

const assignDemandGroupsSchema = z.object({
  country: z.string().min(1).max(5).optional(),
});

export async function POST(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const apiKeyCheck = requireApiKey();
  if (apiKeyCheck instanceof NextResponse) return apiKeyCheck;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }
  const parsed = assignDemandGroupsSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { country } = parsed.data;

  let fetchQuery = supabase
    .from("products")
    .select("product_id, name")
    .is("demand_group", null)
    .eq("status", "active");
  if (country) fetchQuery = fetchQuery.eq("country", country);
  const { data: productsWithoutGroup, error: fetchErr } = await fetchQuery.limit(BATCH_SIZE);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const batch = productsWithoutGroup ?? [];
  if (batch.length === 0) {
    let countQuery = supabase
      .from("products")
      .select("product_id", { count: "exact", head: true })
      .eq("status", "active");
    if (country) countQuery = countQuery.eq("country", country);
    const { count } = await countQuery;
    return NextResponse.json({
      done: true,
      assigned_this_batch: 0,
      total_remaining: 0,
      total_assigned: 0,
      batches_done: 0,
      message: "Keine Produkte ohne Demand Group.",
    });
  }

  const productList = batch.map((p) => `${p.product_id}: ${p.name ?? ""}`).join("\n");
  const prompt = `${DEMAND_GROUPS_INSTRUCTION}

Hier ist eine Liste von Produktnamen (Format: product_id: Name). Ordne jedem Produkt eine demand_group und demand_sub_group zu. Wähle aus der vorgegebenen Liste.

Produktliste:
${productList}

Antworte ausschließlich mit einem JSON-Array. Kein Markdown, keine Backticks. Jedes Element: { "product_id": "uuid", "demand_group": "string", "demand_sub_group": "string or null" }.
Beispiel: [{"product_id":"...","demand_group":"Milchprodukte","demand_sub_group":"Milch"}, ...]`;

  let parsed: Array<{ product_id: string; demand_group: string; demand_sub_group: string | null }> = [];
  try {
    parsed = await callClaudeJSON<typeof parsed>({
      model: CLAUDE_MODEL_HAIKU,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Claude parse failed: ${msg}` }, { status: 502 });
  }

  const byId = new Map(
    batch.map((p) => [p.product_id, p])
  );
  let updated = 0;
  const now = new Date().toISOString();
  for (const item of parsed) {
    if (!byId.has(item.product_id)) continue;
    const dg = typeof item.demand_group === "string" ? item.demand_group.trim() : null;
    const dsg =
      item.demand_sub_group != null && typeof item.demand_sub_group === "string"
        ? item.demand_sub_group.trim() || null
        : null;
    if (!dg) continue;
    const { error: updErr } = await supabase
      .from("products")
      .update({
        demand_group: dg,
        demand_sub_group: dsg,
        updated_at: now,
      })
      .eq("product_id", item.product_id);
    if (!updErr) updated++;
  }

  const { count: totalRemaining } = await supabase
    .from("products")
    .select("product_id", { count: "exact", head: true })
    .is("demand_group", null)
    .eq("status", "active");

  const totalWithGroup = await supabase
    .from("products")
    .select("product_id", { count: "exact", head: true })
    .not("demand_group", "is", null)
    .eq("status", "active");

  return NextResponse.json({
    done: (totalRemaining ?? 0) === 0,
    assigned_this_batch: updated,
    total_remaining: totalRemaining ?? 0,
    total_with_group: totalWithGroup.count ?? 0,
    batches_done: 1,
    message:
      (totalRemaining ?? 0) === 0
        ? `Fertig. ${updated} Produkte in diesem Batch zugeordnet.`
        : `Batch verarbeitet: ${updated} zugeordnet, ${totalRemaining} verbleibend.`,
  });
}

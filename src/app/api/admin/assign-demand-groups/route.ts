/**
 * Admin: assign demand_group and demand_sub_group to products that have demand_group = NULL.
 * Processes one batch per request (50 products). Protected by admin cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMAND_GROUPS_INSTRUCTION } from "@/lib/products/demand-groups-prompt";

const ADMIN_COOKIE = "admin_session";
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const BATCH_SIZE = 50;

function checkAdmin(request: NextRequest): boolean {
  return request.cookies.get(ADMIN_COOKIE)?.value === "1";
}

export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data: productsWithoutGroup, error: fetchErr } = await supabase
    .from("products")
    .select("product_id, name")
    .is("demand_group", null)
    .eq("status", "active")
    .limit(BATCH_SIZE);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const batch = productsWithoutGroup ?? [];
  if (batch.length === 0) {
    const { count } = await supabase
      .from("products")
      .select("product_id", { count: "exact", head: true })
      .eq("status", "active");
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
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Claude API: ${res.status} ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }
    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned) as Array<{
      product_id: string;
      demand_group: string;
      demand_sub_group: string | null;
    }>;
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

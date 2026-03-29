import { log } from "@/lib/utils/logger";
import type { UserShoppingContext } from "./context-assembler";

const MAX_CONTEXT_CHARS = 8000;

export function formatContextForPrompt(ctx: UserShoppingContext): string {
  const lines: string[] = [];

  lines.push(`Receipts: ${ctx.receipt_count} (${ctx.date_range.from} to ${ctx.date_range.to})`);
  lines.push(`Total spent: €${ctx.total_spent.toFixed(2)}`);
  lines.push(`Avg per trip: €${ctx.avg_per_trip.toFixed(2)}`);
  lines.push(`Shopping frequency: ${ctx.shopping_frequency_per_week}/week`);
  lines.push(`Trips completed: ${ctx.trip_count}`);
  lines.push(`Organic ratio: ${(ctx.organic_ratio * 100).toFixed(0)}%`);
  lines.push(`Vegan ratio: ${(ctx.vegan_ratio * 100).toFixed(0)}%`);
  lines.push("");

  if (ctx.top_products.length > 0) {
    lines.push("TOP PRODUCTS (by frequency):");
    for (const p of ctx.top_products) {
      lines.push(`- ${p.name}: ${p.count}x, €${p.total_spent.toFixed(2)}`);
    }
    lines.push("");
  }

  if (ctx.category_breakdown.length > 0) {
    lines.push("SPENDING BY CATEGORY:");
    for (const c of ctx.category_breakdown) {
      lines.push(`- ${c.group}: €${c.spent.toFixed(2)} (${c.items} items)`);
    }
    lines.push("");
  }

  if (ctx.nutrition_summary) {
    const ns = ctx.nutrition_summary;
    lines.push(`NUTRITION (avg per product, ${ns.products_with_data}/${ns.products_total} with data):`);
    if (ns.avg_energy_kcal !== undefined) lines.push(`- Energy: ${ns.avg_energy_kcal} kcal`);
    if (ns.avg_fat !== undefined) lines.push(`- Fat: ${ns.avg_fat}g`);
    if (ns.avg_carbs !== undefined) lines.push(`- Carbs: ${ns.avg_carbs}g`);
    if (ns.avg_protein !== undefined) lines.push(`- Protein: ${ns.avg_protein}g`);
    if (ns.avg_sugar !== undefined) lines.push(`- Sugar: ${ns.avg_sugar}g`);
    if (ns.avg_salt !== undefined) lines.push(`- Salt: ${ns.avg_salt}g`);
    lines.push("");
  }

  if (ctx.weekly_spending.length > 0) {
    lines.push("WEEKLY SPENDING TREND:");
    for (const w of ctx.weekly_spending) {
      lines.push(`- ${w.week}: €${w.amount.toFixed(2)}`);
    }
    lines.push("");
  }

  if (ctx.auto_reorder_items.length > 0) {
    lines.push("AUTO-REORDER ITEMS:");
    for (const a of ctx.auto_reorder_items) {
      lines.push(`- ${a.name}: every ${a.interval}`);
    }
    lines.push("");
  }

  return truncateContext(lines.join("\n"));
}

function truncateContext(text: string): string {
  if (text.length <= MAX_CONTEXT_CHARS) return text;

  log.warn(`[insights] Context exceeds ${MAX_CONTEXT_CHARS} chars (${text.length}), truncating`);

  const sections = [
    { marker: "AUTO-REORDER ITEMS:" },
    { marker: "WEEKLY SPENDING TREND:" },
    { marker: "SPENDING BY CATEGORY:" },
    { marker: "TOP PRODUCTS (by frequency):" },
  ];

  let result = text;
  for (const section of sections) {
    if (result.length <= MAX_CONTEXT_CHARS) break;
    const idx = result.indexOf(section.marker);
    if (idx === -1) continue;
    const nextSection = result.indexOf("\n\n", idx + section.marker.length);
    if (nextSection === -1) {
      result = result.slice(0, idx).trimEnd();
    } else {
      result = result.slice(0, idx) + result.slice(nextSection + 2);
    }
  }

  if (result.length > MAX_CONTEXT_CHARS) {
    result = result.slice(0, MAX_CONTEXT_CHARS - 3) + "...";
  }

  return result;
}

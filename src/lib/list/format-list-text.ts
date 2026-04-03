import type { ListItemWithMeta } from "./list-helpers";

export interface FormatListOptions {
  includeChecked?: boolean;
  includeDeferred?: boolean;
  grouped?: boolean;
  locale?: string;
}

function isElsewhereDeferred(item: ListItemWithMeta): boolean {
  return item.deferred_reason === "elsewhere" || item.buy_elsewhere_retailer != null;
}

function formatItem(item: ListItemWithMeta): string {
  const qty = item.quantity > 1 ? ` x${item.quantity}` : "";
  return `- ${item.display_name}${qty}`;
}

function formatGrouped(items: ListItemWithMeta[]): string[] {
  const groups = new Map<string, { icon: string; items: ListItemWithMeta[] }>();
  for (const item of items) {
    const key = item.category_name;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, { icon: item.category_icon, items: [item] });
    }
  }
  const lines: string[] = [];
  for (const [name, { icon, items: groupItems }] of groups) {
    lines.push(`${icon} ${name}`);
    for (const item of groupItems) {
      lines.push(formatItem(item));
    }
    lines.push("");
  }
  return lines;
}

function formatFlat(items: ListItemWithMeta[]): string[] {
  return items.map(formatItem);
}

export function formatListAsText(
  unchecked: ListItemWithMeta[],
  checked: ListItemWithMeta[],
  deferred: ListItemWithMeta[],
  options: FormatListOptions = {},
): string {
  const {
    includeChecked = false,
    includeDeferred = true,
    grouped = true,
    locale = "de",
  } = options;

  const trulyDeferred = deferred.filter((i) => !isElsewhereDeferred(i));
  const elsewhere = deferred.filter((i) => isElsewhereDeferred(i));

  const allEmpty =
    unchecked.length === 0 &&
    (!includeChecked || checked.length === 0) &&
    (!includeDeferred || (trulyDeferred.length === 0 && elsewhere.length === 0));

  if (allEmpty) {
    return locale === "de" ? "(Leere Liste)" : "(Empty list)";
  }

  const sections: string[] = [];

  if (unchecked.length > 0) {
    const lines = grouped ? formatGrouped(unchecked) : formatFlat(unchecked);
    sections.push(lines.join("\n").trimEnd());
  }

  if (includeDeferred && trulyDeferred.length > 0) {
    const header = locale === "de" ? "--- Später ---" : "--- Later ---";
    const lines = grouped ? formatGrouped(trulyDeferred) : formatFlat(trulyDeferred);
    sections.push(`${header}\n${lines.join("\n").trimEnd()}`);
  }

  if (includeDeferred && elsewhere.length > 0) {
    const byRetailer = new Map<string, ListItemWithMeta[]>();
    for (const item of elsewhere) {
      const retailer = item.buy_elsewhere_retailer ?? "?";
      const list = byRetailer.get(retailer);
      if (list) list.push(item);
      else byRetailer.set(retailer, [item]);
    }
    for (const [retailer, items] of byRetailer) {
      const lines = items.map(formatItem);
      sections.push(`--- ${retailer} ---\n${lines.join("\n")}`);
    }
  }

  if (includeChecked && checked.length > 0) {
    const header = locale === "de" ? "--- Erledigt ---" : "--- Done ---";
    const lines = grouped ? formatGrouped(checked) : formatFlat(checked);
    sections.push(`${header}\n${lines.join("\n").trimEnd()}`);
  }

  return sections.join("\n\n").trimEnd();
}

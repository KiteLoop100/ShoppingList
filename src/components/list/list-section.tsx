"use client";

import { memo } from "react";
import { ListItemRow } from "./list-item-row";
import { getCategoryColor } from "@/lib/categories/category-colors";
import { formatDemandGroupLabel } from "@/lib/i18n/category-translations";
import { getRetailerByName } from "@/lib/retailers/retailers";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

interface CategoryGroup {
  categoryName: string;
  demandGroupCode: string;
  items: ListItemWithMeta[];
}

export function groupConsecutiveByCategory(items: ListItemWithMeta[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.categoryName === item.category_name) {
      last.items.push(item);
    } else {
      groups.push({ categoryName: item.category_name, demandGroupCode: item.demand_group_code, items: [item] });
    }
  }
  return groups;
}

interface ItemCallbacks {
  onCheck: (itemId: string, checked: boolean) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onDelete: (itemId: string) => Promise<void>;
  deleteLabel: string;
  onOpenDetail: (item: ListItemWithMeta) => void;
  onDefer?: (itemId: string) => Promise<void>;
  onUndefer?: (itemId: string) => Promise<void>;
  onBuyElsewhere?: (itemId: string) => void;
  onRenameItem?: (itemId: string, newName: string) => Promise<void>;
}

export interface ListSectionProps extends ItemCallbacks {
  items: ListItemWithMeta[];
  grouped: boolean;
}

export const ListSection = memo(function ListSection({ items, grouped, ...cbs }: ListSectionProps) {
  if (grouped) {
    return (
      <div className="space-y-3">
        {groupConsecutiveByCategory(items).map((group, gi) => (
          <div key={`${group.categoryName}-${gi}`} className="space-y-1 border-l-4 pl-1"
            style={{ borderColor: getCategoryColor(group.demandGroupCode) }}>
            {group.items.map((item) => (
              <ListItemRow key={item.item_id} item={item} {...cbs}
                categoryLabel={formatDemandGroupLabel(item.demand_group || item.category_name)} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.item_id}>
          <ListItemRow item={item} {...cbs}
            categoryLabel={formatDemandGroupLabel(item.demand_group || item.category_name)} />
        </li>
      ))}
    </ul>
  );
});

export interface DeferredSectionsProps {
  deferredByDate: [string, ListItemWithMeta[]][];
  formatDeferredDate: (dateStr: string) => string;
  deferredSectionLabel: string;
  deferredSectionNextTripLabel: string;
  callbacks: ItemCallbacks;
}

export const DeferredSections = memo(function DeferredSections({
  deferredByDate, formatDeferredDate, deferredSectionLabel, deferredSectionNextTripLabel, callbacks,
}: DeferredSectionsProps) {
  if (deferredByDate.length === 0) return null;
  return (
    <section className="mt-6">
      {deferredByDate.map(([dateStr, items]) => (
        <div key={dateStr} className="mb-4">
          <h2 className="mb-3 text-category font-semibold uppercase tracking-wider text-aldi-muted">
            {dateStr === "next_trip" ? (
              <svg className="mr-1 inline-block h-3.5 w-3.5 -translate-y-px text-aldi-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            ) : (
              <svg className="mr-1 inline-block h-3.5 w-3.5 -translate-y-px text-aldi-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
            )}
            {dateStr === "next_trip" ? deferredSectionNextTripLabel : deferredSectionLabel.replace("{date}", formatDeferredDate(dateStr))}
          </h2>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.item_id}>
                <ListItemRow item={item} onCheck={callbacks.onCheck} onQuantityChange={callbacks.onQuantityChange}
                  onDelete={callbacks.onDelete} deleteLabel={callbacks.deleteLabel}
                  onOpenDetail={callbacks.onOpenDetail} onUndefer={callbacks.onUndefer}
                  onRenameItem={callbacks.onRenameItem} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
});

export interface ElsewhereSectionProps {
  elsewhereByRetailer: [string, ListItemWithMeta[]][];
  sectionLabel: string;
  addButtonLabel: string;
  onAddCompetitor: () => void;
  callbacks: ItemCallbacks;
}

export const ElsewhereSection = memo(function ElsewhereSection({
  elsewhereByRetailer, sectionLabel, addButtonLabel, onAddCompetitor, callbacks,
}: ElsewhereSectionProps) {
  if (elsewhereByRetailer.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="mb-3 border-t border-dashed border-gray-300 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-category font-semibold uppercase tracking-wider text-aldi-muted">
            <span className="mr-1">🏪</span>{sectionLabel}
          </h2>
          <button type="button" onClick={onAddCompetitor}
            className="rounded-lg px-2 py-1 text-xs text-aldi-muted transition-colors hover:text-aldi-blue">
            + {addButtonLabel}
          </button>
        </div>
      </div>
      {elsewhereByRetailer.map(([retailerName, items]) => {
        const config = getRetailerByName(retailerName);
        const bgClass = config?.bgColor ?? "bg-orange-50/30";
        return (
          <div key={retailerName} className={`mb-3 rounded-xl ${bgClass} px-2 py-2`}>
            <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{retailerName}</h3>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.item_id}>
                  <ListItemRow item={item} onCheck={callbacks.onCheck} onQuantityChange={callbacks.onQuantityChange}
                    onDelete={callbacks.onDelete} deleteLabel={callbacks.deleteLabel}
                    onOpenDetail={callbacks.onOpenDetail} onBuyElsewhere={callbacks.onBuyElsewhere} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
});

export interface CheckedSectionProps {
  items: ListItemWithMeta[];
  open: boolean;
  onToggle: () => void;
  label: string;
  callbacks: ItemCallbacks;
}

export const CheckedSection = memo(function CheckedSection({
  items, open, onToggle, label, callbacks,
}: CheckedSectionProps) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <button type="button" onClick={onToggle}
        className="mb-3 flex w-full items-center gap-1 text-category font-semibold uppercase tracking-wider text-aldi-muted">
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        ✓ {label} ({items.length})
      </button>
      {open && (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.item_id}>
              <ListItemRow item={item} onCheck={callbacks.onCheck} onQuantityChange={callbacks.onQuantityChange}
                onDelete={callbacks.onDelete} deleteLabel={callbacks.deleteLabel}
                onOpenDetail={callbacks.onOpenDetail} onRenameItem={callbacks.onRenameItem} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});

"use client";

import type { ListItemWithMeta } from "@/lib/list/list-helpers";
import type { InlineRenameActions } from "./hooks/use-inline-rename";
import { ItemBadges } from "./item-badges";

export interface ItemNameProps {
  item: ListItemWithMeta;
  isDeferred: boolean;
  isElsewhere: boolean;
  categoryLabel?: string;
  hasOpenDetail: boolean;
  rename: InlineRenameActions;
}

export function ItemName({
  item,
  isDeferred,
  isElsewhere,
  categoryLabel,
  hasOpenDetail,
  rename,
}: ItemNameProps) {
  const {
    editing,
    editValue,
    setEditValue,
    editInputRef,
    canRename,
    isGeneric,
    startEditing,
    startLongPress,
    cancelLongPress,
    handleNameTap,
    commitRename,
    handleEditKeyDown,
  } = rename;

  return (
    <button
      type="button"
      className={`min-h-touch min-w-0 flex-1 py-2 text-left transition-colors duration-200 ${
        hasOpenDetail ? "cursor-pointer" : ""
      }`}
      onClick={handleNameTap}
      onDoubleClick={
        canRename
          ? (e) => {
              e.stopPropagation();
              startEditing();
            }
          : undefined
      }
      onTouchStart={canRename ? startLongPress : undefined}
      onTouchEnd={canRename ? cancelLongPress : undefined}
      onTouchMove={canRename ? cancelLongPress : undefined}
      onContextMenu={
        canRename
          ? (e) => {
              e.preventDefault();
              startEditing();
            }
          : undefined
      }
    >
      {editing ? (
        <input
          ref={editInputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleEditKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="block w-full rounded-md border border-aldi-blue bg-white px-2 py-1 text-[15px] leading-tight text-aldi-text outline-none ring-1 ring-aldi-blue/30"
        />
      ) : (
        <span
          className={`block truncate text-[15px] leading-tight ${
            item.is_checked ? "text-aldi-muted line-through" : isDeferred ? "text-aldi-muted" : "text-aldi-text"
          } ${!item.product_id ? "italic" : ""} ${hasOpenDetail ? "hover:underline" : ""}`}
        >
          {isGeneric && (
            <svg className="mr-1 inline-block h-3 w-3 -translate-y-px text-aldi-muted/60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
            </svg>
          )}
          {item.display_name}
        </span>
      )}
      <ItemBadges
        item={item}
        isDeferred={isDeferred}
        isElsewhere={isElsewhere}
        categoryLabel={categoryLabel}
      />
    </button>
  );
}

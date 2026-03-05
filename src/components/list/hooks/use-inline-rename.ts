import { useState, useRef, useEffect, useCallback } from "react";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

export interface UseInlineRenameOptions {
  item: ListItemWithMeta;
  onRenameItem?: (itemId: string, newName: string) => void;
  onOpenDetail?: (item: ListItemWithMeta) => void;
}

export interface InlineRenameActions {
  editing: boolean;
  editValue: string;
  setEditValue: (v: string) => void;
  editInputRef: React.RefObject<HTMLInputElement>;
  canRename: boolean;
  isGeneric: boolean;
  startEditing: () => void;
  startLongPress: () => void;
  cancelLongPress: () => void;
  handleNameTap: (e: React.MouseEvent) => void;
  commitRename: () => void;
  handleEditKeyDown: (e: React.KeyboardEvent) => void;
}

export function useInlineRename({
  item,
  onRenameItem,
  onOpenDetail,
}: UseInlineRenameOptions): InlineRenameActions {
  const isGeneric = !item.product_id && !item.competitor_product_id;
  const canRename = isGeneric && !!onRenameItem;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editing]);

  const displayName = item.display_name || item.custom_name || "";

  const startEditing = useCallback(() => {
    setEditValue(displayName);
    setEditing(true);
  }, [displayName]);

  const startLongPress = useCallback(() => {
    if (!canRename) return;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setEditValue(displayName);
      setEditing(true);
    }, 500);
  }, [canRename, displayName]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleNameTap = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (longPressFired.current) {
        longPressFired.current = false;
        return;
      }
      if (editing) return;
      if (onOpenDetail) onOpenDetail(item);
    },
    [editing, onOpenDetail, item],
  );

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    setEditing(false);
    if (trimmed && trimmed !== displayName) {
      onRenameItem?.(item.item_id, trimmed);
    }
  }, [editValue, displayName, item.item_id, onRenameItem]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitRename();
      } else if (e.key === "Escape") {
        setEditing(false);
      }
    },
    [commitRename],
  );

  return {
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
  };
}

export interface FieldConflict {
  field: string;
  currentValue: string;
  aiValue: string;
}

function normalizeForComparison(value: string): string {
  return value.replace(",", ".").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Detects fields where the AI-extracted value differs from the current value.
 * Skips empty current values (those get auto-filled, not flagged) and locked fields.
 */
export function detectFieldConflicts(
  currentValues: Record<string, string>,
  aiValues: Record<string, string>,
  lockedFields: Set<string>,
): FieldConflict[] {
  const conflicts: FieldConflict[] = [];

  for (const [field, aiValue] of Object.entries(aiValues)) {
    if (lockedFields.has(field)) continue;
    if (!aiValue) continue;

    const currentValue = currentValues[field] ?? "";
    if (!currentValue) continue;

    if (
      normalizeForComparison(currentValue) !==
      normalizeForComparison(aiValue)
    ) {
      conflicts.push({ field, currentValue, aiValue });
    }
  }

  return conflicts;
}

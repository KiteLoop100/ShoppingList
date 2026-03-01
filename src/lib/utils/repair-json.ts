/**
 * Attempts to repair a truncated JSON string by finding the last complete
 * object boundary and closing the surrounding structure.
 *
 * Returns the repaired string or null if repair is not possible.
 * The caller is responsible for parsing the result with JSON.parse().
 */
export function tryRepairTruncatedJson(raw: string): string | null {
  const trimmed = raw.trimEnd();
  const lastCloseBraceComma = trimmed.lastIndexOf("},");
  const lastCloseBraceBracket = trimmed.lastIndexOf("}]");

  if (
    lastCloseBraceBracket >= 0 &&
    lastCloseBraceBracket > lastCloseBraceComma
  ) {
    return trimmed.slice(0, lastCloseBraceBracket + 2) + "}";
  }
  if (lastCloseBraceComma >= 0) {
    return trimmed.slice(0, lastCloseBraceComma + 1) + "]}";
  }
  if (trimmed.endsWith("}")) {
    return trimmed + "]}";
  }
  return null;
}

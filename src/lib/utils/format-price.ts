/**
 * Format a price value consistently across the app.
 * Uses German locale convention: comma decimal separator, € suffix.
 */
export function formatPrice(amount: number): string {
  return amount.toFixed(2).replace(".", ",") + "\u00A0€";
}

/**
 * Format price with € prefix (no-break space between symbol and number).
 * Used in contexts where "€1,29" style is preferred over "1,29 €".
 */
export function formatPricePrefix(amount: number): string {
  return "€" + amount.toFixed(2);
}

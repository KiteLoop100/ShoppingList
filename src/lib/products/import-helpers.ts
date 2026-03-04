/**
 * Pure helper functions shared between product import scripts.
 */

const DEFAULT_THUMBNAIL_PX = '200';

export function normalizeProductName(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Resolves an ALDI AEM image URL to a thumbnail-sized URL.
 *
 * Handles two formats:
 * - Template: `.../scaleWidth/{width}/UUID/{slug}` → replaces placeholders
 * - Direct:   `.../scaleWidth/1000/UUID/1000` → replaces size values
 */
export function resolveImageUrl(
  rawUrl: string | null | undefined,
  size: string = DEFAULT_THUMBNAIL_PX,
): string | null {
  if (!rawUrl || String(rawUrl).trim() === '') return null;
  const url = String(rawUrl).trim();
  if (url.includes('{width}')) {
    return url.replace('{width}', size).replace('{slug}', size);
  }
  return url
    .replace(/scaleWidth\/\d+/, `scaleWidth/${size}`)
    .replace(/\/(\d+)\s*$/, `/${size}`);
}

/**
 * Extracts the numeric demand_group_code from a Commodity Group string.
 * E.g. "71-Gekühlter verzehrfertiger Fisch" → "71"
 *      "AK-Aktionsartikel" → "AK"
 */
export function extractDemandGroupCode(commodityGroup: string): string | null {
  const match = commodityGroup.match(/^(\d+|AK)-/);
  return match ? match[1] : null;
}

/**
 * Determines if a brand type string indicates a private label product.
 */
export function isPrivateLabel(brandType: string | null | undefined): boolean {
  return brandType === 'Private Label';
}

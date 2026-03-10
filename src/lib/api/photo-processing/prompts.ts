/**
 * Claude prompt templates and shared types for photo processing (BL-31).
 * All prompt functions receive a demandGroupsBlock parameter built at
 * runtime from the demand_groups + demand_sub_groups tables.
 */

export const PDF_PAGES_INITIAL_MAX = 5;

export function buildFlyerPdfFirstPagePrompt(demandGroupsBlock: string): string {
  const year = new Date().getFullYear();
  return `Dies ist die ERSTE Seite eines Supermarkt-Handzettels. Extrahiere: (1) Handzettel-Titel (flyer_title, z.B. "KW 09 – Angebote ab 24.02."), (2) Gültigkeitszeitraum (special_valid_from, special_valid_to, YYYY-MM-DD), (3) JEDES Produkt auf dieser Seite, (4) das Land anhand des Logos/Brandings.
Das aktuelle Jahr ist ${year}. Wenn auf dem Handzettel kein Jahr angegeben ist, verwende ${year} für alle Datumsangaben.

LAND-ERKENNUNG (detected_country):
Erkenne anhand des Logos und Brandings ob es sich um einen ALDI SÜD (Deutschland) oder Hofer (Österreich) Handzettel handelt.
- ALDI SÜD hat das blaue ALDI-Logo mit dem Text "ALDI" → detected_country: "DE"
- Hofer hat das Hofer-Logo mit dem Text "Hofer" → detected_country: "AT"
- Falls nicht eindeutig erkennbar → detected_country: "unknown"

Pro Produkt: article_number (falls sichtbar), name (vollständiger Produktname), price (Preis), weight_or_quantity (Gewicht/Menge falls angegeben), brand (Marke falls sichtbar), special_start_date, special_end_date (YYYY-MM-DD), demand_group, demand_sub_group, assortment_type, is_private_label, is_seasonal.

WICHTIG für assortment_type – es gibt genau 3 Werte:
- "daily_range": Dauersortiment – reguläre Supermarktprodukte (Milch, Brot, Obst, Grundnahrungsmittel usw.) die dauerhaft im Sortiment sind. Auch wenn sie im Handzettel mit Preisaktion beworben werden!
- "special_food": Food-Aktionsartikel – Lebensmittel die nur einmalig angeliefert und abverkauft werden, z.B. saisonale Spezialitäten, limitierte Food-Editionen
- "special_nonfood": Non-Food-Aktionsartikel – Non-Food-Ware die zeitlich begrenzt angeboten wird (Kleidung, Elektronik, Haushaltsgegenstände, Werkzeug usw.)

Die MEISTEN Lebensmittel im Handzettel sind "daily_range"! Nur echte Einmal-Aktionen ohne regulären Platz im Sortiment sind "special_food".

is_private_label (boolean oder null):
- true = Eigenmarke von ALDI/Hofer (z.B. Milsani, Lacura, Tandil, GUT bio, MAMIA, Moser Roth, Knorr-Bremse, Casa Morando, Ombra, River, Crane, Meine Metzgerei)
- false = Fremdmarke / Markenprodukt (z.B. Nivea, Coca-Cola, Haribo, Nutella, Persil)
- null = nicht erkennbar

is_seasonal (boolean):
- true = Saisonprodukt das jährlich wiederkehrt (z.B. Spargel, Erdbeeren, Lebkuchen, Glühwein, Christstollen, Osterhasen)
- false = kein Saisonprodukt
HINWEIS: is_seasonal ist NICHT dasselbe wie assortment_type "special". Aktionsartikel kommen einmal; Saisonprodukte kehren jährlich wieder und können Dauersortiment sein.

${demandGroupsBlock}

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.

{
  "photo_type": "flyer_pdf",
  "detected_country": "DE or AT or unknown",
  "flyer_title": "string",
  "special_valid_from": "YYYY-MM-DD or null",
  "special_valid_to": "YYYY-MM-DD or null",
  "products": [
    { "article_number": "string or null", "name": "string", "price": number or null, "weight_or_quantity": "string or null", "brand": "string or null", "special_start_date": "YYYY-MM-DD or null", "special_end_date": "YYYY-MM-DD or null", "demand_group": "string or null", "demand_sub_group": "string or null", "assortment_type": "daily_range or special_food or special_nonfood", "is_private_label": true or false or null, "is_seasonal": true or false }
  ]
}`;
}

export function buildFlyerPdfPagePrompt(demandGroupsBlock: string): string {
  const year = new Date().getFullYear();
  return `Dies ist eine Seite eines Supermarkt-Handzettels (nicht die erste). Extrahiere JEDES Produkt auf dieser Seite.
Das aktuelle Jahr ist ${year}. Wenn auf dem Handzettel kein Jahr angegeben ist, verwende ${year} für alle Datumsangaben.
Pro Produkt: article_number (falls sichtbar), name (vollständiger Produktname), price (Preis), weight_or_quantity (Gewicht/Menge falls angegeben), brand (Marke falls sichtbar), special_start_date, special_end_date (YYYY-MM-DD), demand_group, demand_sub_group, assortment_type, is_private_label, is_seasonal.

WICHTIG für assortment_type – es gibt genau 3 Werte:
- "daily_range": Dauersortiment – reguläre Supermarktprodukte die dauerhaft im Sortiment sind. Auch wenn sie im Handzettel mit Preisaktion beworben werden!
- "special_food": Food-Aktionsartikel – Lebensmittel die nur einmalig angeliefert und abverkauft werden
- "special_nonfood": Non-Food-Aktionsartikel – Non-Food-Ware die zeitlich begrenzt angeboten wird

Die MEISTEN Lebensmittel im Handzettel sind "daily_range"!

is_private_label: true = Eigenmarke (Milsani, Lacura, Tandil, GUT bio, MAMIA, Moser Roth, etc.), false = Fremdmarke (Nivea, Coca-Cola, etc.), null = unklar.
is_seasonal: true = jährlich wiederkehrendes Saisonprodukt (Spargel, Erdbeeren, Lebkuchen, Glühwein), false = kein Saisonprodukt.

${demandGroupsBlock}

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.

{
  "photo_type": "flyer_pdf",
  "products": [
    { "article_number": "string or null", "name": "string", "price": number or null, "weight_or_quantity": "string or null", "brand": "string or null", "special_start_date": "YYYY-MM-DD or null", "special_end_date": "YYYY-MM-DD or null", "demand_group": "string or null", "demand_sub_group": "string or null", "assortment_type": "daily_range or special_food or special_nonfood", "is_private_label": true or false or null, "is_seasonal": true or false }
  ]
}`;
}

export function buildVisionPrompt(demandGroupsBlock: string): string {
  return `You are analyzing a photo from a grocery shopping context. Classify the photo type and extract structured data.

${demandGroupsBlock}

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks, kein zusätzlicher Text. Jedes Produkt MUSS demand_group und demand_sub_group haben (string oder null; null nur wenn wirklich unklar).

Photo types: product_front (single product front), product_back (product back with barcode/nutrition), receipt (supermarket receipt), flyer (promo flyer), shelf (store shelf with multiple products).

For RECEIPTS (ALDI/Hofer): The number on the far LEFT of each line is article_number. Extract EVERY line as one product. Return {article_number, name, price, demand_group, demand_sub_group} per product. Even for abbreviated receipt names (e.g. MILS.FETT.MI, BIO TRINKM) try to infer demand_group (e.g. Milchprodukte). Ignore payment lines, tax summaries, totals, subtotals, card details, TSE data, store address, and footer text. Only extract actual product purchase lines. If name is unclear use raw receipt text.

IMPORTANT for product_back: Extract ONLY the EAN barcode. Do NOT extract name or brand from the back of the package – the back often contains generic or misleading text that is not the real product name. Leave name as empty string and brand as null.

For non-receipt photos use the full shape below.

is_private_label (boolean or null): true = ALDI/Hofer private label (Milsani, Lacura, Tandil, GUT bio, MAMIA, Moser Roth, etc.), false = external brand (Nivea, Coca-Cola, Haribo, etc.), null = unknown.
is_seasonal (boolean): true = seasonal product that returns yearly (asparagus, strawberries, gingerbread, mulled wine), false = not seasonal.

Respond with a single JSON object, no markdown:
{
  "photo_type": "product_front" | "product_back" | "receipt" | "flyer" | "shelf",
  "products": [
    { "article_number": "string or null", "name": "string", "price": number or null, "demand_group": "string or null", "demand_sub_group": "string or null", "is_private_label": true or false or null, "is_seasonal": true or false }
  ],
  "receipt_date": "YYYY-MM-DD or null if receipt",
  "special_valid_from": "YYYY-MM-DD or null if flyer",
  "special_valid_to": "YYYY-MM-DD or null if flyer"
}

For receipts each product has article_number, name, price, demand_group, demand_sub_group. For other photo types add brand, ean_barcode, is_private_label, is_seasonal etc. Keep JSON compact.`;
}

export function buildDataExtractionPrompt(demandGroupsBlock: string): string {
  return `Extrahiere aus diesem Produktfoto alle sichtbaren Daten für ein Lebensmittel/Produkt. Das Foto kann Strichcode, Rückseite mit Inhaltsstoffen, Nährwerttabelle, Nutri-Score, Preisschild o. ä. zeigen.

${demandGroupsBlock}

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.
Gib nur Felder an, die du auf dem Foto erkennst. Fehlende Werte als null.
Produktname in korrekter deutscher Groß-/Kleinschreibung (jedes Wort großgeschrieben, z. B. "Risotto Reis Mit Pilzen").
is_bio: true wenn EU-Bio-Logo (grünes Blatt), deutsches Bio-Siegel (Sechseck), DE-ÖKO-Nummer oder "Bio" im Produktnamen/auf der Verpackung sichtbar ist.

{
  "name": "string or null (Title Case)",
  "brand": "string or null",
  "ean_barcode": "string or null",
  "article_number": "string or null",
  "price": number or null,
  "weight_or_quantity": "string or null",
  "ingredients": "string or null",
  "nutrition_info": { "energy_kcal": number or null, "fat": number or null, "carbs": number or null, "protein": number or null, "salt": number or null } or null,
  "allergens": "string or null",
  "demand_group": "string or null",
  "demand_sub_group": "string or null",
  "is_bio": true or false
}`;
}

export const CROP_PROMPT = `Identify the main product in this image. Return the bounding box that contains the COMPLETE product — include the entire object from top to bottom and side to side (e.g. for a bottle: cap, neck, body, and base; for a box: all four corners). Exclude background, shelves, hands, and unrelated objects, but do NOT cut off any part of the product itself.

Return JSON with: { "crop_x", "crop_y", "crop_width", "crop_height" } in pixels, plus the image dimensions as { "image_width", "image_height" }.

Reply with ONLY a single JSON object, no markdown, no backticks. Example: {"crop_x":100,"crop_y":50,"crop_width":300,"crop_height":400,"image_width":800,"image_height":600}`;

export const ROTATION_PROMPT = `Look at the product packaging in this image. Find the BRAND NAME — the largest, most prominent text on the front of the packaging.

Your task: tell me WHERE in the image the FIRST CHARACTER of the brand name is located.

- "left": The first character is on the LEFT side of the image (text reads horizontally, left to right — normal orientation)
- "bottom": The first character is near the BOTTOM of the image (text runs upward along the packaging)
- "right": The first character is on the RIGHT side of the image (text is upside-down, reading right to left)
- "top": The first character is near the TOP of the image (text runs downward along the packaging)

Reply with JSON only, no markdown:
{"brand_name": "the brand you found", "first_letter_position": "left or bottom or right or top"}`;

export const TILT_PROMPT = `The product text in this image should be perfectly horizontal, reading left to right. But it may be slightly tilted.

How many degrees is the text tilted from perfectly horizontal?
- Positive = clockwise tilt (right side of text droops down)
- Negative = counter-clockwise tilt (left side of text droops down)
- 0 = already perfectly horizontal

Reply with JSON only, no markdown:
{"tilt_degrees": 0}`;

export interface ExtractedProduct {
  article_number?: string | null;
  name?: string;
  brand?: string | null;
  ean_barcode?: string | null;
  price?: number | null;
  weight_or_quantity?: string | null;
  nutrition_info?: Record<string, unknown> | null;
  ingredients?: string | null;
  allergens?: string | null;
  demand_group?: string | null;
  demand_group_code?: string | null;
  demand_sub_group?: string | null;
  special_start_date?: string | null;
  special_end_date?: string | null;
  assortment_type?: string | null;
  is_private_label?: boolean | null;
  is_seasonal?: boolean | null;
  bbox?: [number, number, number, number] | null;
}

export interface ClaudeResponse {
  photo_type?: string;
  products?: ExtractedProduct[];
  receipt_date?: string | null;
  special_valid_from?: string | null;
  special_valid_to?: string | null;
  flyer_title?: string | null;
}

export interface ExtractedProductWithPage extends ExtractedProduct {
  flyer_page?: number;
}

/**
 * Product Photo Studio — AI prompt templates for classification,
 * extraction, and thumbnail quality verification.
 */

export function classifyPhotosPrompt(photoCount: number): string {
  return `Du bist ein Content-Moderator fuer eine Produkt-Datenbank. Dir werden ${photoCount} Fotos uebergeben, die angeblich verschiedene Ansichten EINES Produkts zeigen (Vorderseite, Rueckseite, Seite, Preisschild, Barcode usw.).

AUFGABE: Klassifiziere JEDES Foto einzeln.

Fuer jedes Foto bestimme:
1. is_product_photo (boolean): Handelt es sich um ein Foto eines Produkts, einer Verpackung, eines Preisschilds oder eines Barcodes?
   - true: Produktverpackung (Vorder-/Rueck-/Seitenansicht), Preisschild, Barcode-Nahaufnahme, Regalfoto mit erkennbarem Produkt
   - false: Selfies, Landschaften, Screenshots, Memes, unangemessene Inhalte, Text-Dokumente, komplett unleserliche/unscharfe Bilder
2. photo_type: "product_front" | "product_back" | "product_side" | "price_tag" | "barcode" | "shelf" | "other"
   - product_front: Vorderseite der Verpackung mit Produktname/Marke
   - product_back: Rueckseite mit Naehrwerttabelle/Zutatenliste/Barcode
   - product_side: Seitenansicht der Verpackung
   - price_tag: Preisschild im Regal
   - barcode: Nahaufnahme des Barcodes
   - shelf: Produkt im Regal (nicht einzeln)
   - other: Keiner der obigen Typen
3. confidence (0.0-1.0): Sicherheit der Klassifikation
4. rejection_reason (string oder null): Falls is_product_photo=false, der Grund (z.B. "selfie", "landscape", "screenshot", "inappropriate", "unrecognizable")
5. quality_score (0.0-1.0): Bildqualitaet fuer Thumbnail-Eignung (Schaerfe, Belichtung, Ausrichtung, Reflexionen)
6. has_reflections (boolean): Stoerende Spiegelungen auf der Verpackung?
7. text_readable (boolean): Ist Text auf dem Produkt/Preisschild lesbar?

WICHTIG:
- Preisschilder und Barcodes SIND gueltige Produktfotos (is_product_photo=true)
- Auch unscharfe Produktfotos sind gueltig, aber quality_score niedrig setzen
- Nur wirklich sachfremde Fotos ablehnen (is_product_photo=false)

Antworte ausschliesslich mit validem JSON. Kein Markdown, keine Backticks.

{
  "photos": [
    {
      "photo_index": 0,
      "is_product_photo": true,
      "photo_type": "product_front",
      "confidence": 0.95,
      "rejection_reason": null,
      "quality_score": 0.85,
      "has_reflections": false,
      "text_readable": true
    }
  ],
  "all_same_product": true,
  "suspicious_content": false,
  "overall_assessment": "string (kurze Begruendung)"
}`;
}

export function extractCompetitorProductPrompt(
  photoCount: number,
  scannedEan: string | null,
  demandGroupsBlock: string,
): string {
  const eanHint =
    scannedEan != null
      ? `\n\nWICHTIG: Der EAN-Code wurde bereits per Barcode-Scanner erkannt: ${scannedEan}. Setze "ean_barcode" auf exakt diesen Wert. Lies den EAN NICHT aus dem Bild ab.`
      : "";

  return `Dir werden ${photoCount} Fotos desselben Produkts aus verschiedenen Perspektiven gezeigt.

AUFGABE: Extrahiere ALLE sichtbaren Produktinformationen aus ALLEN Fotos zusammen. Behandle alle Fotos als verschiedene Ansichten EINES einzigen Produkts und kombiniere die Informationen.

REGELN:
- Produktname: Vollstaendiger offizieller Produktname in korrekter Gross-/Kleinschreibung (Title Case, z.B. "Bio Hafermilch Barista")
- Bei widerspruechlichen Informationen zwischen Fotos: Vorderseite hat Vorrang
- EAN-Barcode: Nur Ziffernfolge, keine Bindestriche oder Leerzeichen
- Preis: NUR angeben wenn ein Preisschild sichtbar ist (nicht von der Verpackung ablesen)
- Naehrwerte: Pro 100g bzw. 100ml, wie auf der Naehrwerttabelle angegeben
- Zutaten: Vollstaendige Zutatenliste exakt wie auf der Verpackung abgedruckt
- Allergene: Komma-separierte Liste (z.B. "Milch, Soja, Gluten, Erdnuesse")
- Nutri-Score: Buchstabe A-E, NUR wenn das offizielle Nutri-Score-Logo sichtbar ist
- Herkunft: Herkunftsland falls angegeben

KENNZEICHNUNGEN:
- is_bio: true wenn EU-Bio-Logo (gruenes Blatt), deutsches Bio-Siegel (Sechseck), DE-OEKO-Nummer oder "Bio" auf der Verpackung sichtbar
- is_vegan: true wenn V-Label vegan, "vegan" Aufdruck oder offizielles Vegan-Logo sichtbar
- is_gluten_free: true wenn "glutenfrei" Text oder durchgestrichene Aehre sichtbar
- is_lactose_free: true wenn "laktosefrei" Text sichtbar
- animal_welfare_level: 1-4 falls Haltungsform-Logo sichtbar (1=Stallhaltung, 2=StallhaltungPlus, 3=Aussenklima, 4=Premium/Bio), null sonst

PREISSCHILD-ANALYSE (falls Preisschild-Foto vorhanden):
- price: Verkaufspreis in Euro
- retailer_from_price_tag: Haendler-Name falls erkennbar (REWE, EDEKA, Lidl, DM, Rossmann, Penny, Netto, Kaufland usw.)
- unit_price: Grundpreis als String falls angegeben (z.B. "1 kg = 3,98 EUR")

WARENGRUPPEN-ZUORDNUNG:
- demand_group: Ordne das Produkt anhand von Name, Verpackung und Kategorie einer Warengruppe zu.
${demandGroupsBlock}

CONTENT-MODERATION:
- suspicious_content: Setze auf true, wenn EINES der Fotos unangemessene, beleidigende oder sachfremde Inhalte zeigt (Nacktheit, Gewalt, Selfies, Memes, Screenshots). Produktfotos, Preisschilder und Barcodes sind IMMER angemessen (false).

Antworte ausschliesslich mit validem JSON. Kein Markdown, keine Backticks.
Fehlende/nicht sichtbare Werte als null. Boolesche Flags als false wenn nicht erkennbar.

{
  "name": "string or null",
  "brand": "string or null",
  "ean_barcode": "string or null",
  "article_number": "string or null",
  "price": null,
  "retailer_from_price_tag": "string or null",
  "unit_price": "string or null",
  "weight_or_quantity": "string or null",
  "demand_group": "string or null",
  "ingredients": "string or null",
  "nutrition_info": {
    "energy_kcal": null,
    "fat": null,
    "saturated_fat": null,
    "carbs": null,
    "sugar": null,
    "fiber": null,
    "protein": null,
    "salt": null
  },
  "allergens": "string or null",
  "nutri_score": null,
  "is_bio": false,
  "is_vegan": false,
  "is_gluten_free": false,
  "is_lactose_free": false,
  "animal_welfare_level": null,
  "country_of_origin": "string or null",
  "suspicious_content": false
}${eanHint}`;
}

export const VERIFY_THUMBNAIL_PROMPT = `Du siehst ein bearbeitetes Produktfoto, das als Thumbnail in einer oeffentlichen Produktdatenbank verwendet werden soll.

Bewerte das Foto anhand dieser Kriterien:
1. VOLLSTAENDIGKEIT: Ist das GESAMTE Produkt sichtbar? Fehlen Teile (z.B. Deckel abgeschnitten, Boden fehlt, Seite abgeschnitten)? Wenn ja → "reject".
2. FREISTELLUNG: Ist das Produkt freigestellt (Hintergrund entfernt)? Wenn Regal, Tisch, Hand oder anderer Hintergrund sichtbar → "reject".
3. PROFESSIONELL: Sieht es aus wie ein professionelles Produktfoto? (Belichtung, Schaerfe)
4. ZENTRIERUNG: Ist das Produkt gut zentriert?
5. HINTERGRUND: Ist der Hintergrund sauber (weiss/einheitlich, keine Artefakte)?
6. LESBARKEIT: Ist Text auf dem Produkt lesbar, keine stoerenden Spiegeleffekte?
7. ISOLIERUNG: Zeigt das Foto NUR das Produkt (keine Haende, Regale, andere Objekte)?
8. ANGEMESSENHEIT: Ist der Inhalt fuer eine oeffentliche Produktdatenbank geeignet?

WICHTIG: Kriterien 1 (Vollstaendigkeit) und 2 (Freistellung) sind K.O.-Kriterien. Wenn eines davon verletzt ist, MUSS die recommendation "reject" sein.

Antworte ausschliesslich mit validem JSON. Kein Markdown, keine Backticks.

{
  "passes_quality_check": true,
  "quality_score": 0.85,
  "issues": [],
  "recommendation": "approve"
}

recommendation:
- "approve": Professionell genug fuer die Datenbank (freigestellt, vollstaendig, gute Qualitaet)
- "review": Grenzwertig, sollte manuell geprueft werden
- "reject": Produkt abgeschnitten, nicht freigestellt, oder Qualitaet unzureichend`;

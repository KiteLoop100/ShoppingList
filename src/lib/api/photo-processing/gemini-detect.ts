/**
 * WORKAROUND: Gemini-based bounding box detection for flyer pages.
 * Gemini is specifically trained for spatial object detection and delivers
 * significantly more precise bounding boxes than Claude's estimations.
 *
 * Will be replaced when structured retailer data feeds become available.
 */

import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-2.5-flash";

export interface DetectedProductBox {
  label: string;
  bbox: [number, number, number, number]; // [y_min, x_min, y_max, x_max] 0-1000
}

const DETECT_PROMPT = `Du siehst eine Seite eines Supermarkt-Handzettels (Werbebeilage).
Finde JEDEN einzelnen Produktbereich auf dieser Seite.

Pro Produkt gib zurück:
- "label": Kurzbezeichnung des Produkts (z.B. "Milch 3,5%", "Bananen", "Waschpulver")
- "bbox": Bounding Box als [y_min, x_min, y_max, x_max] mit Werten 0-1000 (normalisiert auf Seitengröße)

Die Bounding Box soll den gesamten Produktbereich umfassen: Produktbild, Name, Preis und ggf. Aktionsbanner.
Überlappungen zwischen Boxen vermeiden.

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.

{ "products": [ { "label": "string", "bbox": [y_min, x_min, y_max, x_max] } ] }`;

export async function detectProductBoxes(
  pdfBase64: string,
): Promise<DetectedProductBox[]> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return [];
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: pdfBase64,
              },
            },
            { text: DETECT_PROMPT },
          ],
        },
      ],
    });

    const text = response.text?.trim() ?? "";
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned) as { products?: DetectedProductBox[] };

    if (!Array.isArray(parsed.products)) return [];

    return parsed.products.filter(
      (p) =>
        typeof p.label === "string" &&
        p.label.length > 0 &&
        Array.isArray(p.bbox) &&
        p.bbox.length === 4 &&
        p.bbox.every((v) => typeof v === "number" && v >= 0 && v <= 1000),
    );
  } catch {
    return [];
  }
}

/**
 * Match Gemini bounding boxes to Claude-extracted products by label similarity.
 * Returns a map from product name (normalized) to the best matching bbox.
 */
export function matchBboxesToProducts(
  boxes: DetectedProductBox[],
  productNames: string[],
): Map<string, [number, number, number, number]> {
  const result = new Map<string, [number, number, number, number]>();
  if (boxes.length === 0 || productNames.length === 0) return result;

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-zäöüß0-9]/g, " ").replace(/\s+/g, " ").trim();

  const usedBoxIndices = new Set<number>();

  for (const name of productNames) {
    const nameNorm = normalize(name);
    const nameWords = nameNorm.split(" ").filter((w) => w.length > 2);
    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < boxes.length; i++) {
      if (usedBoxIndices.has(i)) continue;
      const labelNorm = normalize(boxes[i].label);

      if (nameNorm === labelNorm) {
        bestIdx = i;
        bestScore = 100;
        break;
      }

      if (nameNorm.includes(labelNorm) || labelNorm.includes(nameNorm)) {
        const score = 80;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
        continue;
      }

      const labelWords = labelNorm.split(" ").filter((w) => w.length > 2);
      const matchingWords = nameWords.filter((w) =>
        labelWords.some((lw) => lw.includes(w) || w.includes(lw)),
      );
      const score =
        nameWords.length > 0
          ? (matchingWords.length / Math.max(nameWords.length, labelWords.length)) * 70
          : 0;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestScore >= 20) {
      result.set(name, boxes[bestIdx].bbox);
      usedBoxIndices.add(bestIdx);
    }
  }

  return result;
}

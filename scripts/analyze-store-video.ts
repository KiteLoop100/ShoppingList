/**
 * Analysiert ein Video aus einem Supermarkt (z.B. ALDI) und listet die
 * Produktkategorien in der Reihenfolge auf, wie du den Laden abgelaufen bist.
 *
 * Ablauf:
 * 1. Mit ffmpeg werden in festen Abständen Einzelbilder aus dem Video extrahiert.
 * 2. Jedes Bild wird an Claude (Anthropic Vision) geschickt mit der Frage:
 *    „Welche Produktkategorie / welcher Bereich ist zu sehen?“
 * 3. Aufeinanderfolgende gleiche Kategorien werden zusammengefasst.
 * 4. Die Reihenfolge wird ausgegeben (und optional in eine Datei geschrieben).
 *
 * Nutzung:
 *   npx tsx scripts/analyze-store-video.ts <video-datei>
 *   npx tsx scripts/analyze-store-video.ts aldi-rundgang.mp4 --interval 3 --out reihenfolge.txt
 *
 * Optionen:
 *   --interval N   Ein Frame alle N Sekunden (Standard: 2)
 *   --max-size N   Maximale Kantenlänge in Pixel (Standard: 1280). 0 = Original behalten.
 *   --out DATEI   Ergebnis in Datei schreiben (Standard: nur Konsole)
 *   --keep-frames Frames-Ordner nach der Auswertung behalten
 *
 * Voraussetzungen:
 *   - ffmpeg (wird automatisch über @ffmpeg-installer/ffmpeg genutzt, falls installiert; sonst ffmpeg im PATH)
 *   - .env.local mit ANTHROPIC_API_KEY
 */

import { config } from "dotenv";
import { resolve, join } from "path";
import { readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import sharp from "sharp";

function getFfmpegPath(): string {
  try {
    return require("@ffmpeg-installer/ffmpeg").path;
  } catch {
    return "ffmpeg";
  }
}

config({ path: resolve(process.cwd(), ".env.local") });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

const PROMPT = `Das Bild zeigt einen Ausschnitt aus einem Supermarkt/Discounter (z.B. ALDI).
Welche Produktkategorie bzw. welcher Bereich ist zu sehen?

Antworte NUR mit einer kurzen Bezeichnung auf Deutsch, genau eine Zeile.
Beispiele: Obst & Gemüse, Milchprodukte, Getränke, Brot & Backwaren, Kühlwaren, Tiefkühl, Süßwaren & Snacks, Drogerie, Kaffee & Tee, Wurst & Käse, Haushalt, Kosmetik.
Keine Sätze, keine Erklärung – nur die Kategorie.`;

// ── CLI ─────────────────────────────────────────────────────────

function parseArgs(): {
  videoPath: string;
  intervalSec: number;
  maxSize: number;
  outFile: string | null;
  keepFrames: boolean;
} {
  const args = process.argv.slice(2);
  let videoPath = "";
  let intervalSec = 2;
  let maxSize = 1280;
  let outFile: string | null = null;
  let keepFrames = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--interval") {
      const parsed = parseFloat(args[++i] ?? "2");
      intervalSec = Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
    } else if (args[i] === "--max-size") {
      maxSize = parseInt(args[++i] ?? "1280", 10);
      if (maxSize < 0) maxSize = 0;
    } else if (args[i] === "--out") {
      outFile = args[++i] ?? null;
    } else if (args[i] === "--keep-frames") {
      keepFrames = true;
    } else if (!args[i].startsWith("-")) {
      videoPath = args[i];
    }
  }
  return { videoPath, intervalSec, maxSize, outFile, keepFrames };
}

// ── Frames mit ffmpeg extrahieren ────────────────────────────────

function extractFrames(videoPath: string, framesDir: string, intervalSec: number): string[] {
  mkdirSync(framesDir, { recursive: true });
  const fps = intervalSec <= 0 ? 1 : 1 / intervalSec;
  const fpsStr = fps < 1 ? `1/${1 / fps}` : String(fps);
  const ffmpegPath = getFfmpegPath();
  const outputPattern = join(framesDir, "frame_%04d.jpg");
  execFileSync(ffmpegPath, ["-i", videoPath, "-vf", `fps=${fpsStr}`, "-q:v", "3", outputPattern], {
    stdio: "inherit",
  });
  const files = readdirSync(framesDir)
    .filter((f) => f.endsWith(".jpg"))
    .sort();
  return files.map((f) => join(framesDir, f));
}

// ── Ein Bild an Claude senden, Kategorie zurück ───────────────────

async function getCategoryForImage(imagePath: string, maxSize: number): Promise<string> {
  let buffer = readFileSync(imagePath);
  if (maxSize > 0) {
    try {
      buffer = await sharp(buffer)
        .resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
    } catch {
      // Fallback: Original nutzen
    }
  }
  const base64 = buffer.toString("base64");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 128,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64,
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = (data.content?.[0]?.text ?? "").trim();
  // Erste Zeile, Bereinigung
  const line = text.split(/\r?\n/)[0]?.trim() ?? text;
  return line || "Unbekannt";
}

// ── Aufeinanderfolgende gleiche Kategorien zusammenfassen ─────────

function deduplicateSequence(categories: string[]): string[] {
  const out: string[] = [];
  let prev = "";
  for (const cat of categories) {
    const n = cat.trim();
    if (n && n !== prev) {
      out.push(n);
      prev = n;
    }
  }
  return out;
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  const { videoPath, intervalSec, maxSize, outFile, keepFrames } = parseArgs();

  if (!videoPath) {
    console.error("Nutzung: npx tsx scripts/analyze-store-video.ts <video-datei> [--interval N] [--out datei.txt] [--keep-frames]");
    process.exit(1);
  }

  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY fehlt in .env.local");
    process.exit(1);
  }

  const absoluteVideo = resolve(process.cwd(), videoPath);
  const framesDir = join(process.cwd(), "scripts", "store-video-frames");

  console.log("Video:", absoluteVideo);
  console.log("Frame-Intervall:", intervalSec, "Sekunden");
  console.log("Bildauflösung: max.", maxSize === 0 ? "Original" : `${maxSize}px (lange Kante)`);
  console.log("Extrahiere Frames mit ffmpeg …");

  let framePaths: string[];
  try {
    framePaths = extractFrames(absoluteVideo, framesDir, intervalSec);
  } catch (e) {
    console.error("ffmpeg fehlgeschlagen. Ist ffmpeg installiert und im PATH?", e);
    process.exit(1);
  }

  console.log("Anzahl Frames:", framePaths.length);
  if (framePaths.length === 0) {
    console.error("Keine Frames extrahiert. Prüfe Video-Datei und Pfad.");
    if (!keepFrames) rmSync(framesDir, { recursive: true, force: true });
    process.exit(1);
  }

  const categories: string[] = [];
  for (let i = 0; i < framePaths.length; i++) {
    process.stdout.write(`Analysiere Frame ${i + 1}/${framePaths.length} … `);
    try {
      const cat = await getCategoryForImage(framePaths[i], maxSize);
      categories.push(cat);
      console.log(cat);
    } catch (e) {
      console.log("Fehler:", (e as Error).message);
      categories.push("(Fehler)");
    }
  }

  const sequence = deduplicateSequence(categories);

  console.log("\n--- Reihenfolge der Produktkategorien ---");
  sequence.forEach((cat, i) => console.log(`${i + 1}. ${cat}`));
  console.log("----------------------------------------");

  if (outFile) {
    const outPath = resolve(process.cwd(), outFile);
    const content = sequence.map((c, i) => `${i + 1}. ${c}`).join("\n");
    writeFileSync(outPath, content, "utf-8");
    console.log("Ergebnis gespeichert:", outPath);
  }

  if (!keepFrames) {
    rmSync(framesDir, { recursive: true, force: true });
    console.log("Frames-Ordner gelöscht.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

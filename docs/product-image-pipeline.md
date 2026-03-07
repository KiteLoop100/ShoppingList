# Workflow: Vom Nutzer-Snapshot zum Studio-Produktbild

## Überblick

Der Prozess nimmt einen Batch von Nutzerfotos (Produkt aus verschiedenen Winkeln + Preisschild) entgegen und erzeugt daraus zwei Outputs: (1) strukturierte Produktdaten und (2) ein freigestelltes, farbkorrigiertes Produktbild in Katalogqualität.

Das gesamte Pipeline-Budget beträgt **28 Sekunden**. Schritt 7 (Qualitätskontrolle) wird übersprungen und als "zur Prüfung markiert" behandelt, wenn das Budget erschöpft ist.

## Schritt 1: Upload & Klassifikation

Nutzer lädt 1–8 Bilder hoch. Claude Sonnet klassifiziert jedes Bild parallel zu einem ZBar-Barcode-Scan:

- **Typ A**: Produktansicht (Front, Seite, Rückseite, Detail)
- **Typ B**: Preisschild / Regalschild
- **Typ C**: Nährwerttabelle / Zutatenliste (Rückseite)

Für jedes Bild wird zusätzlich ein Qualitäts-Score ermittelt (Schärfe, Belichtung, Verdeckung, Perspektive). Das beste Frontalbild wird als **Hero-Kandidat** markiert.

## Schritt 2: Informationsextraktion

Alle Bilder werden an Claude Sonnet übergeben. Extrahierte Daten (Name, Marke, Füllmenge, Nährwerte, Preis, EAN-Code) werden in die Produktdatenbank geschrieben.

## Schritt 3: Hero-Bild-Auswahl

Aus allen Typ-A-Bildern wird das beste Kandidatenbild für die Weiterverarbeitung ausgewählt. Kriterien in absteigender Priorität:

1. Frontale Perspektive (Produkt von vorne, leicht erhöht — typische Katalogansicht)
2. Geringste Verdeckung (keine Hand, kein Regal im Vordergrund)
3. Beste Schärfe und Belichtung
4. Höchste Auflösung

Falls ein einzelnes Frontalbild als hochwertig eingestuft wird (`quality_score ≥ 0.8`), wird die restliche Verarbeitung als Fast-Path durchgeführt (kein zweites Kandidatenbild).

## Schritt 4: Produktbereich-Erkennung & Pre-Crop

Claude Haiku bestimmt per Vision-Analyse die **Bounding Box** des Produkts im Bild:

- Sanity-Checks: Box muss ≥ 5% und ≤ 98% der Bildfläche abdecken; sonst kein Crop
- Pre-Crop mit **20% Rand** (mindestens 50px), damit das Produkt nach der Freistellung nicht abgeschnitten wird
- **Clipping-Erkennung**: Nach dem Crop wird geprüft, ob nicht-transparente Pixel die Bildkanten berühren; falls ja, wird ein zweiter Versuch ohne Pre-Crop gemacht

## Schritt 5: Hintergrundentfernung

Provider-Kette — erster Erfolg gewinnt:

| Priorität | Provider | Bedingung |
|-----------|---------|-----------|
| 1 | Self-hosted (BiRefNet/RMBG-2.0) | `SELF_HOSTED_BG_REMOVAL_URL` gesetzt |
| 2 | remove.bg `type=product` | `REMOVE_BG_API_KEY` gesetzt |
| 3 | remove.bg `type=auto` | `REMOVE_BG_API_KEY` gesetzt (Fallback bei ähnlicher Verpackungsfarbe) |
| 4 | Crop-Fallback (Sharp) | Immer verfügbar |

Alle externen Anfragen haben ein **15-Sekunden-Timeout** (`AbortSignal.timeout`).

Wenn der Crop-Fallback (Priorität 4) verwendet wird, setzt die Pipeline das Flag `backgroundRemovalFailed: true`. Dieses Flag wird in der API-Antwort als `background_removal_failed` zurückgegeben.

**Konfiguration remove.bg:**
- `type`: `product` (erster Versuch) / `auto` (zweiter Versuch)
- `size`: `full` (volle Auflösung)
- `crop`: `true` (automatisches Zuschneiden auf das Objekt)
- `format`: `png`

## Schritt 6: Post-Processing Pipeline

Deterministische Bildverarbeitung mit Sharp (kein AI):

### 6a. Spiegelungen & Glanzstellen entfernen (`removeReflections`)

- Erkennung von Pixeln nahe 255/255/255 (Highlight-Clipping)
- Erstellen einer dilatierten Maske um die erkannten Bereiche
- Blending der Highlight-Region mit einer Gauss-geglätteten Version der Umgebung
- Funktioniert sowohl mit als auch ohne Alpha-Kanal

### 6b. Farbkorrektur & Sättigung

- Leichte Sättigungserhöhung (Supermarktbeleuchtung wäscht Farben aus)
- Kontrastanpassung für Katalogoptik

### 6c. Schärfung

- Unsharp Mask mit moderaten Werten
- Nur auf den Produktbereich angewendet

### 6d. Compositing

- Produkt auf weißem Hintergrund platzieren
- Leichter, weicher Schlagschatten (Offset nach unten, niedriger Blur, 15–20% Opacity)
- Bild auf 1200×1200px skalieren (Produkt füllt ~80% der Fläche)
- Export als WebP

## Schritt 7: Qualitätskontrolle (Claude Haiku)

Automatische Prüfung des Ergebnisses mit zwei Schichten:

**Sharp-basierte Metriken (ohne AI):**
- Highlight-Anteil (Pixelwerte nahe 255)
- Gibt Hinweis auf verbliebene Glanzstellen

**Claude Haiku Visual Assessment:**
- **K.O.-Kriterien** (führen zu `recommendation: "reject"`):
  - Produkt abgeschnitten (Vollständigkeit)
  - Hintergrund nicht entfernt (Freistellung)
- **Weitere Prüfpunkte**: Artefakte, Farbstich, Unschärfe

**`backgroundRemovalFailed`-Flag:**
- Wenn gesetzt, wird die Verification-Empfehlung unabhängig vom Claude-Ergebnis auf `"review"` gezwungen
- Issue: `"Hintergrund nicht entfernt — Produkt ist nicht freigestellt"` wird hinzugefügt

Falls der Quality Gate fehlschlägt: Bild wird als `review_required` gelistet, trotzdem als Platzhalter gespeichert.

## Architektur-Hinweise

- Die Pipeline läuft synchron im API-Request mit einem **28-Sekunden-Gesamtbudget**
- `PipelineRunner` in `pipeline-runner.ts` ermöglicht Resumierbarkeit: Jeder Schritt persistiert seinen Zustand, sodass bei Fehlern ab einem bestimmten Schritt neu gestartet werden kann
- remove.bg-Kosten kontrollieren: Nur das Hero-Bild wird gesendet, nicht alle Bilder
- Self-hosted Ersatz für remove.bg: BiRefNet oder RMBG-2.0 via Docker/Replicate (konfigurierbar über `SELF_HOSTED_BG_REMOVAL_URL`)
- Bounding-Box-Erkennung verwendet Claude **Haiku** (nicht Sonnet) für bessere Kosten/Geschwindigkeit

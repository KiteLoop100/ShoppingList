# Refactoring-Plan: Produkt-Foto-Ausrichtung (Tilt-Korrektur)

## Ziel

Die Ausrichtungsfunktion (Tilt-Korrektur) in der Foto-Pipeline funktioniert nicht korrekt. Produkte, die auf Fotos ca. 10-15° schief stehen, werden NICHT gerade ausgerichtet. Dieses Refactoring soll NUR die Ausrichtung reparieren, ohne andere Pipeline-Funktionen (insbesondere Freistellung/Background-Removal) zu beeinträchtigen.

---

## Kontext: Was funktioniert bereits

- **Freistellung (Background-Removal)**: Funktioniert korrekt für Thumbnails UND Gallery-Fotos. NICHT ANFASSEN.
- **BBox-Erkennung (Bounding Box)**: Funktioniert korrekt — Claude erkennt das Produkt präzise.
- **Cardinal Rotation (0/90/180/270°)**: Die `transformBboxForCardinalRotation()` Logik ist korrekt implementiert und getestet.
- **Gallery-Foto-Anzeige in der UI**: Wurde in diesem Chat repariert — `processedGalleryPhotos` werden jetzt korrekt an `GuidedPhotoSlots` durchgereicht und angezeigt (grüner Rahmen + Häkchen).
- **Pipeline-Orchestrierung**: Fast-Path mit paralleler Verarbeitung funktioniert.

---

## Kontext: Was NICHT funktioniert — die Tilt-Korrektur

### Symptom
Produkte, die auf Fotos ca. 10-15° schief stehen, bleiben nach der Verarbeitung schief. Die Tilt-Korrektur hat keinen sichtbaren Effekt.

### Bisherige Debug-Ergebnisse (Runtime-Evidenz aus Terminal-Logs)

**Run 1-4 (alter Prompt, alte Richtung):**
```
[claude-bbox] success: bbox 816x1184+192+368 rotation 0 tilt -2.5
[photo-studio] applying tilt correction: -2.5 degrees
```
Claude gibt bei einem ~15° schiefen Bild nur `tilt: -2.5` zurück. Das ist ein 6x Fehler.

**Run 5 (neuer Prompt, negierte Richtung):**
```
[claude-bbox] success: bbox 648x1264+156+272 rotation 0 tilt 1.5
[photo-studio] applying tilt correction: 1.5 degrees (sharp angle: -1.5 )
```
Der verbesserte Prompt hat den Tilt-Wert NICHT verbessert — Claude gibt jetzt sogar nur 1.5° zurück statt -2.5°. Die Prompt-Änderung war wirkungslos.

### Zwei bekannte Probleme

#### Problem 1: AI gibt viel zu kleine Tilt-Werte zurück
- **Evidenz**: 5 Runs, alle mit Tilt-Werten zwischen -2.5° und +1.5° bei einem Bild, das laut User ca. 15° schief ist.
- **Ursache**: Unklar. Möglicherweise ein fundamentales Problem mit der Tilt-Erkennung durch Claude/Gemini bei Produktfotos. Der Prompt wurde bereits von "Fine rotation correction" zu "Measure the ACTUAL tilt angle... Report the TRUE angle" geändert — ohne Wirkung.
- **Gemini**: Gibt konsistent Timeouts (5s Limit), wird nie genutzt. Nur Claude-Fallback greift.

#### Problem 2: Tilt-Richtung war invertiert (möglicherweise bereits gefixt)
- **Analyse**: Der AI-Prompt definiert `Positive = clockwise needed`. Aber `sharp.rotate(angle)` verwendet die Konvention: positive Winkel = counterclockwise.
- **Fix im Code**: `const sharpAngle = -data.tilt;` wurde eingeführt. Der Code ruft jetzt `sharp.rotate(sharpAngle)` auf.
- **Status**: Der Fix wurde angewendet, aber da die Tilt-Werte zu klein sind (1.5° statt 15°), ist der Effekt nicht verifizierbar.

---

## Betroffene Dateien

### Primär (HIER liegt das Problem)

1. **`src/lib/product-photo-studio/gemini-bbox.ts`** — AI-Prompts und Response-Parsing
   - `geminiSmartPreCrop()` — Gemini Flash Call (derzeit immer Timeout)
   - `claudeSmartPreCrop()` — Claude Sonnet Fallback (einziger aktiver Pfad)
   - 4 Prompt-Konstanten: `GEMINI_PROMPT_DEFAULT`, `GEMINI_PROMPT_PRICE_TAG`, `CLAUDE_PROMPT_DEFAULT`, `CLAUDE_PROMPT_PRICE_TAG`
   - `sanitizeTilt()` — Clamping auf ±15°
   - Enthält Debug-Instrumentation (`// #region agent log` Blöcke) — muss aufgeräumt werden

2. **`src/lib/product-photo-studio/create-thumbnail.ts`** — Tilt-Anwendung
   - `applyPreCropData()` — Wendet rotation + tilt + bbox-crop an
   - `preCropToProduct()` — Orchestriert Gemini/Claude → applyPreCropData
   - Enthält Debug-Instrumentation — muss aufgeräumt werden
   - **Zeile 157-163**: Die Tilt-Anwendung: `const sharpAngle = -data.tilt;` dann `sharp.rotate(sharpAngle, ...)`
   - **Zeilen 170-178**: Bbox-Koordinaten-Transformation nach Tilt (scaleX/Y, offsetX/Y)

### Sekundär (rufen `preCropToProduct` auf — NICHT ändern)

3. **`src/lib/product-photo-studio/process-gallery.ts`** — Gallery-Foto-Verarbeitung
   - `processOnePhoto()` → `preCropToProduct()` → `removeBackground()` → `compositeOnCanvas()`
   - NICHT ÄNDERN — funktioniert korrekt

4. **`src/lib/product-photo-studio/pipeline.ts`** — Pipeline-Orchestrierung
   - NICHT ÄNDERN — funktioniert korrekt

### Tests

5. **`src/lib/product-photo-studio/__tests__/gemini-bbox.test.ts`** — 17 Tests
6. **`src/lib/product-photo-studio/__tests__/create-thumbnail.test.ts`** — 27 Tests

---

## Aktueller Code: Tilt-Anwendung (`create-thumbnail.ts`, Zeilen 156-168)

```typescript
if (data.tilt !== 0) {
    const sharpAngle = -data.tilt;
    log.debug("[photo-studio] applying tilt correction:", data.tilt, "degrees (sharp angle:", sharpAngle, ")");
    // #region agent log  <-- ENTFERNEN
    fetch('http://127.0.0.1:7547/...').catch(()=>{});
    // #endregion          <-- ENTFERNEN
    output = await sharp(output)
      .rotate(sharpAngle, { background: { r: 255, g: 255, b: 255 } })
      .toBuffer();
    const meta = await sharp(output).metadata();
    currentW = meta.width ?? currentW;
    currentH = meta.height ?? currentH;
}
```

## Aktueller Code: Tilt-Prompt (Claude, `gemini-bbox.ts`)

```
tilt: Measure the ACTUAL tilt angle of the product in degrees. Look at vertical edges of the product packaging — how many degrees are they tilted from perfectly vertical? Positive = product leans clockwise, negative = product leans counterclockwise. Report the TRUE angle, even if it is large (up to 15 degrees). 0 ONLY if the product is perfectly straight.
```

## sharp.rotate() Konvention (verifiziert)

- `sharp.rotate(positive)` = **counterclockwise** Rotation
- `sharp.rotate(negative)` = **clockwise** Rotation
- Das aktuelle `const sharpAngle = -data.tilt` soll den AI-Tilt (Positive = clockwise needed) in sharp-Konvention übersetzen.

---

## Aufgaben für das Refactoring

### Phase 1: Diagnostik (ZUERST, vor jedem Code-Änderung)

1. **Erstelle ein isoliertes Test-Script** (`src/lib/product-photo-studio/__tests__/tilt-diagnostic.test.ts`):
   - Nimm ein echtes Testbild (ein Foto eines Produkts, das sichtbar ~15° schief steht)
   - Oder erstelle ein synthetisches Bild mit sharp, das einen bekannten Tilt hat (z.B. ein schwarzes Rechteck auf weißem Hintergrund, 15° gedreht)
   - Rufe `claudeSmartPreCrop()` mit diesem Bild auf und logge den exakten Tilt-Wert
   - Rufe `geminiSmartPreCrop()` mit diesem Bild auf (erhöhe ggf. den Timeout auf 15s für den Test) und logge den Wert
   - Vergleiche die AI-Tilt-Werte mit dem bekannten Ground-Truth-Winkel
   - **Ziel**: Verstehen, ob das Problem am Prompt liegt, an der AI generell, oder am Input-Bild

2. **Erstelle einen sharp-Rotation-Test**:
   - Erstelle ein Bild (100x200 schwarzes Rechteck auf weißem Hintergrund)
   - Drehe es mit `sharp.rotate(15)` und prüfe das Ergebnis
   - Drehe es mit `sharp.rotate(-15)` und prüfe das Ergebnis
   - **Ziel**: Verifiziere die sharp-Rotationsrichtung empirisch (nicht nur nach Dokumentation)

3. **Überprüfe EXIF-Orientierung**:
   - Lade ein echtes Smartphone-Foto und prüfe `sharp(buffer).metadata().orientation`
   - Prüfe, ob `sharp(buffer).rotate().toBuffer()` die Orientierung korrekt anwendet
   - **Ziel**: Sicherstellen, dass das Bild, das Claude sieht, die gleiche Orientierung hat wie das, was der User sieht

### Phase 2: Fix der Tilt-Erkennung

Basierend auf den Ergebnissen aus Phase 1, eine oder mehrere dieser Strategien anwenden:

**Strategie A: Prompt-Engineering (wenn AI den Tilt grundsätzlich erkennen kann)**
- Experimentiere mit verschiedenen Prompt-Formulierungen
- Teste One-Shot oder Few-Shot Prompting mit Beispiel-Tilts
- Teste ob ein anderes Framing hilft: statt "tilt angle" z.B. "angle between the vertical edges of the product and the vertical axis of the image"

**Strategie B: Eigene Tilt-Erkennung ohne AI (wenn AI versagt)**
- Implementiere eine Hough-Linie-basierte Tilt-Erkennung mit sharp/node-canvas
- Oder nutze die Konturen des freigestellten Produkts (nach BG-Removal), um den Hauptwinkel zu berechnen
- **Achtung**: Dies ist komplexer und sollte nur als Fallback dienen

**Strategie C: Gemini-Timeout erhöhen (wenn Gemini bessere Werte liefern würde)**
- Erhöhe `GEMINI_TIMEOUT_MS` von 5000 auf 10000-15000
- Teste, ob Gemini bei ausreichend Zeit bessere Tilt-Werte liefert als Claude
- **Achtung**: Erhöht die Gesamtlaufzeit

**Strategie D: Zwei-Pass-Ansatz**
- Erster Pass: BBox + Rotation wie bisher (schnell, nur Crop)
- Zweiter Pass: Nach BG-Removal, wenn das Produkt isoliert ist, einen separaten Tilt-Detection-Call machen — das freigestellte Produktbild hat klarere Kanten und könnte einen besseren Tilt-Wert liefern

### Phase 3: Fix verifizieren

1. Alle existierenden Tests müssen weiterhin bestehen:
   ```bash
   npx vitest run src/lib/product-photo-studio
   ```
   Erwartung: Alle 156 Tests grün.

2. Type-Check:
   ```bash
   npx tsc --noEmit
   ```
   Erwartung: Keine neuen Fehler (der bestehende `page.tsx` Fehler ist pre-existing und irrelevant).

3. **Neuer Tilt-spezifischer Test**: Ein Test der verifiziert, dass ein synthetisch um X° gedrehtes Bild nach dem Pre-Crop um ~X° zurückgedreht wurde.

4. **Manueller Test**:
   - Produkt-Foto aufnehmen, das sichtbar schief steht (10-15°)
   - Hochladen als Front-Foto
   - Prüfen: Ist das Produkt im Thumbnail gerade?
   - Hochladen als Extra-Foto
   - Prüfen: Ist das Extra-Foto gerade?

### Phase 4: Aufräumen

1. **ALLE Debug-Instrumentation entfernen** — Suche nach `// #region agent log` und `// #endregion` in:
   - `src/lib/product-photo-studio/gemini-bbox.ts` (1 Block, Zeilen 225-227)
   - `src/lib/product-photo-studio/create-thumbnail.ts` (2 Blöcke, Zeilen 159-161 und 225-227)
   - `src/components/guided-photo-slots.tsx` (1 Block, Zeilen 133-135)
   - `src/app/api/analyze-product-photos/route.ts` (1 Block — suche nach `[DEBUG-e67f2d]`)
   - `src/components/product-capture/hooks/use-product-capture-form.ts` (1 Block — suche nach `[DEBUG-e67f2d]`)
   - `src/components/product-capture/product-capture-save.ts` (2 Blöcke — suche nach `[DEBUG-e67f2d]`)

2. **`rawMeta` Variable entfernen** in `preCropToProduct()` (`create-thumbnail.ts`, Zeile 222) — wurde nur für Instrumentation gebraucht.

---

## Regressions-Checkliste

**VOR dem Refactoring den aktuellen Test-Stand erfassen:**
```bash
npx vitest run src/lib/product-photo-studio 2>&1
# Erwartung: 10 files, 156 tests passed
```

**NACH jeder Änderung prüfen:**
- [ ] Alle 156 bestehenden Tests bestehen
- [ ] `npx tsc --noEmit` — keine neuen Fehler
- [ ] Freistellung (BG-Removal) funktioniert weiterhin für Thumbnails
- [ ] Freistellung funktioniert weiterhin für Gallery-Fotos
- [ ] Gallery-Fotos werden weiterhin in der UI angezeigt (grüner Rahmen)
- [ ] Cardinal Rotation (90/180/270) funktioniert weiterhin
- [ ] Bbox-Cropping schneidet das Produkt nicht ab

**NICHT anfassen:**
- `src/lib/product-photo-studio/background-removal.ts`
- `src/lib/product-photo-studio/edge-quality.ts`
- `src/lib/product-photo-studio/image-enhance.ts`
- `src/lib/product-photo-studio/pipeline.ts` (außer Debug-Log-Entfernung)
- `src/lib/product-photo-studio/process-gallery.ts`
- `src/components/guided-photo-slots.tsx` (außer Debug-Log-Entfernung)
- `src/components/product-capture/` (außer Debug-Log-Entfernung)

---

## Technische Details

### sharp.rotate() Verhalten bei Non-90°-Winkeln
Wenn sharp ein Bild um z.B. 15° dreht, wird die Canvas-Größe vergrößert, um das gesamte gedrehte Bild aufzunehmen. Die "leeren" Ecken werden mit der `background`-Farbe gefüllt (in unserem Fall weiß). Nach der Rotation sind `width` und `height` des Bildes größer als vorher. Die aktuelle Bbox-Transformation berücksichtigt dies (Zeilen 170-178 in `create-thumbnail.ts`), aber die Berechnung könnte fehlerhaft sein — verifiziere dies!

### Provider-Kette für Pre-Crop
1. Gemini Flash (`gemini-2.5-flash`, 5s Timeout) — derzeit IMMER Timeout
2. Claude Sonnet (8s Timeout) — einziger aktiver Pfad

### Prompt-Konvention für Tilt
Die aktuelle Konvention in allen 4 Prompts:
- `Positive = product leans clockwise`
- `Negative = product leans counterclockwise`
- Dann in `applyPreCropData`: `sharpAngle = -data.tilt` (Inversion für sharp)

---

## Zusammenfassung der Änderungen aus dem vorherigen Chat

Diese Änderungen wurden in dem Chat gemacht, der dieses Dokument erstellt hat. Sie sind NICHT die Ursache des Alignment-Problems, aber relevant als Kontext:

1. **Pipeline Fast-Path** (`pipeline.ts`): Parallele Verarbeitung wenn `photoRoles` vorhanden (Phase 1: Images, Phase 2: Extract)
2. **UI Gallery-Display** (`guided-photo-slots.tsx`, `photo-upload-section.tsx`, `product-capture-modal.tsx`, `product-photo-section.tsx`, `create-product-modal.tsx`, `use-product-creation.ts`): `processedGalleryPhotos` werden jetzt in der UI angezeigt
3. **Prompt-Änderung** (`gemini-bbox.ts`): "Fine rotation correction" → "Measure the ACTUAL tilt angle" — hatte KEINE Wirkung
4. **Tilt-Richtung** (`create-thumbnail.ts`): `sharp.rotate(data.tilt)` → `sharp.rotate(-data.tilt)` — Richtungskorrektur, nicht verifizierbar wegen zu kleiner Tilt-Werte
5. **Abuse Detection** (`prompts.ts`, `extract-product-info.ts`, `types.ts`): `suspicious_content` Flag in Extraction integriert
6. **Classification entfernt** (Fast Path): Wenn `photoRoles` vorhanden, wird die AI-Klassifizierung übersprungen

---

## Prompt für den neuen Chat

Kopiere den folgenden Prompt in einen neuen Chat:

---

**Aufgabe: Refactoring der Produkt-Foto-Ausrichtung (Tilt-Korrektur)**

Lies bitte zuerst die Datei `specs/ALIGNMENT-REFACTORING.md` — sie enthält den vollständigen Kontext, alle bisherigen Debug-Ergebnisse, den aktuellen Code-Stand, und eine detaillierte Aufgabenbeschreibung.

**Kernproblem**: Produktfotos mit ca. 10-15° Schieflage werden NICHT korrekt ausgerichtet. Die AI (Claude Sonnet) gibt viel zu kleine Tilt-Werte zurück (1.5-2.5° statt 10-15°). Gemini gibt konsistent Timeouts.

**Dein Auftrag**:
1. Folge dem Phasenplan in der MD-Datei (Diagnostik → Fix → Verifizierung → Aufräumen)
2. Beginne mit Phase 1 (Diagnostik): Erstelle isolierte Tests, um das Problem exakt zu lokalisieren
3. Stelle sicher, dass KEINE Regression entsteht — insbesondere die Freistellung darf NICHT kaputtgehen
4. Entferne am Ende alle Debug-Instrumentation (suche nach `// #region agent log` und `[DEBUG-e67f2d]`)

**WICHTIG**: 
- Die Dateien `background-removal.ts`, `edge-quality.ts`, `image-enhance.ts`, `pipeline.ts`, `process-gallery.ts` NICHT ändern (außer Debug-Log-Entfernung)
- Alle 156 bestehenden Tests müssen nach dem Refactoring weiterhin bestehen
- `npx tsc --noEmit` darf keine neuen Fehler erzeugen

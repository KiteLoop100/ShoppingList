# Workflow: Vom Nutzer-Snapshot zum Studio-Produktbild

## Überblick

Der Prozess nimmt einen Batch von Nutzerfotos (Produkt aus verschiedenen Winkeln + Preisschild) entgegen und erzeugt daraus zwei Outputs: (1) strukturierte Produktdaten und (2) ein freigestelltes, farbkorrigiertes Produktbild in Katalogqualität.

## Schritt 1: Upload & Klassifikation

Nutzer lädt N Bilder hoch. Ein Vision-Modell (z.B. Claude) klassifiziert jedes Bild:

- **Typ A**: Produktansicht (Front, Seite, Rückseite, Detail)
- **Typ B**: Preisschild / Regalschild
- **Typ C**: Nährwerttabelle / Zutatenliste (Rückseite)

Für jedes Bild wird zusätzlich ein Qualitäts-Score ermittelt (Schärfe, Belichtung, Verdeckung, Perspektive). Das beste Frontalbild wird als **Hero-Kandidat** markiert.

## Schritt 2: Informationsextraktion (funktioniert bereits)

Alle Bilder werden an das Vision-Modell übergeben. Extrahierte Daten werden in die Produktdatenbank geschrieben. Dieser Teil bleibt wie gehabt.

## Schritt 3: Hero-Bild-Auswahl

Aus allen Typ-A-Bildern wird das beste Kandidatenbild für die Weiterverarbeitung ausgewählt. Kriterien in absteigender Priorität:

1. Frontale Perspektive (Produkt von vorne, leicht erhöht — typische Katalogansicht)
2. Geringste Verdeckung (keine Hand, kein Regal im Vordergrund)
3. Beste Schärfe und Belichtung
4. Höchste Auflösung

Falls kein einzelnes Bild ausreichend gut ist, werden die zwei besten Kandidaten behalten und parallel weiterverarbeitet. Am Ende wird das bessere Ergebnis gewählt.

## Schritt 4: Hintergrundentfernung (remove.bg API)

Das Hero-Bild geht an remove.bg. Wichtig für die API-Konfiguration:

- `type`: `product` (nicht `auto` — Product-Modus ist für Packungen optimiert)
- `size`: `full` (volle Auflösung behalten)
- `crop`: `true` (automatisches Zuschneiden auf das Objekt)
- `scale`: ggf. anpassen, um Rand zu erhalten

**Fallback**: Wenn remove.bg ein schlechtes Ergebnis liefert (z.B. Teile des Produkts entfernt, weil Verpackungsfarbe dem Hintergrund ähnelt), kann man alternativ einen zweiten Durchlauf mit `type: auto` versuchen oder auf ein Segment-Anything-Modell (SAM) als lokalen Fallback zurückgreifen.

## Schritt 5: Post-Processing Pipeline

Nach der Freistellung folgt eine deterministische Bildverarbeitungs-Pipeline (kein AI nötig — klassische Bildverarbeitung, z.B. mit Sharp/Jimp in Node oder Pillow in Python):

### 5a. Perspektivkorrektur

- Kanten des Produkts erkennen (Konturfindung auf dem freigestellten Bild)
- Leichte perspektivische Entzerrung anwenden, sodass vertikale Kanten parallel sind (Keystone-Korrektur)
- Ziel: Das Produkt soll "gerade" stehen

### 5b. Farbkorrektur & Sättigung

- Auto-Weißabgleich auf Basis der hellsten nicht-weißen Fläche
- Leichte Sättigungserhöhung (+10–15%) — Supermarktbeleuchtung wäscht Farben aus
- Kontrastanpassung (leichtes S-Kurven-Tonemapping)
- Schatten leicht aufhellen (Supermarktfotos haben oft harte Schatten von oben)

### 5c. Spiegelungen & Glanzstellen entfernen

- Highlight-Clipping erkennen (Pixel nahe 255/255/255 auf dem Produkt)
- Inpainting dieser Stellen mit umgebender Farbe/Textur (hier kann ein kleines AI-Inpainting-Modell helfen, oder einfaches Frequency-Separation-Blending)
- Alternativ: Wenn mehrere Produktbilder vorhanden sind, können Glanzstellen aus Bild A mit der entsprechenden Region aus Bild B ersetzt werden (Multi-Image-Compositing)

### 5d. Schärfung

- Unsharp Mask mit moderaten Werten (Radius 1–2px, Amount 30–50%)
- Nur auf den Produktbereich anwenden (Maske aus Schritt 4)

## Schritt 6: Finales Compositing

- Produkt auf weißem oder transparentem Hintergrund platzieren
- Leichten, weichen Schlagschatten hinzufügen (Offset 2–4px nach unten, Blur 8–12px, Opacity 15–20%) — das gibt dem Produkt die typische "schwebt-leicht-über-der-Fläche"-Katalogoptik
- Bild auf Zielgröße skalieren (z.B. 1200×1200px quadratisch, Produkt füllt ca. 80% der Fläche)
- In WebP und PNG exportieren

## Schritt 7: Qualitätskontrolle

Automatische Prüfung des Ergebnisses:

- Ist das Produkt vollständig im Bild (kein Abschnitt)?
- Ist der Hintergrund sauber (keine Artefakte vom Freistellen)?
- Stimmt das Seitenverhältnis des Produkts mit typischen Werten für die Kategorie überein (z.B. eine Milchtüte sollte höher als breit sein)?
- Optional: Das Ergebnis nochmal an ein Vision-Modell geben mit der Frage "Sieht dieses Produktbild aus wie ein professionelles Katalogbild? Was fehlt?" — als automatischer Quality Gate.

Falls der Quality Gate fehlschlägt: Bild als "manuell prüfen" flaggen, trotzdem als Platzhalter verwenden, Nutzer ggf. um bessere Fotos bitten.

## Architektur-Hinweise

- Die Pipeline sollte als Queue verarbeitet werden (nicht synchron im Upload-Request)
- Jeder Schritt speichert sein Zwischenergebnis, sodass man bei Fehlern ab einem bestimmten Schritt neu starten kann
- remove.bg-Kosten kontrollieren: Nur das Hero-Bild senden, nicht alle Bilder
- Langfristig kann remove.bg durch ein self-hosted Modell (z.B. BiRefNet, RMBG-2.0) ersetzt werden, um Kosten zu senken

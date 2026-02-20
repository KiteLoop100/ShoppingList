# UI.md – User Interface Spezifikation

> Dieses Dokument beschreibt die Screens, Navigation und Interaktionsmuster der App.
> Für Feature-Details siehe FEATURES.md, für Design-Sprache siehe Abschnitt 5.

---

## 1. Grundprinzipien

- **Mobile-first, Einhandbedienung:** Alle wichtigen Elemente sind mit dem Daumen erreichbar
- **Minimal Clicks:** Häufigste Aktionen in maximal 2 Taps
- **Kein visueller Ballast:** Nur das Nötigste auf dem Screen. Weißraum ist ein Feature
- **Kein Darkmode:** Ein einziges Farbschema basierend auf ALDI SÜD Design-Sprache
- **Kein Unterschied Laden/Zuhause im MVP:** Die App sieht immer gleich aus (Vision: späterer Einkaufsmodus mit größeren Tap-Flächen)

---

## 2. Screens & Navigation

### 2.1 Screen-Übersicht

Die App hat bewusst wenige Screens. Es gibt **einen einzigen Hauptscreen**, der alles kombiniert: Suche, Liste, Startseite. Der Nutzer verlässt diesen Screen praktisch nie.

```
┌──────────────────┐
│  Hauptscreen     │ ← Suchfeld + Liste in einem
│  (S1)            │
│                  ├───→ ┌──────────────┐
│                  │     │ Ladenauswahl │
│                  │     │ (S2, Overlay)│
│                  │     └──────────────┘
│                  │
│                  ├───→ ┌──────────────┐
│                  │     │ Einstellungen│
│                  │     │ (S3)         │
│                  │     └──────────────┘
└──────────────────┘
                         Versteckt:
                         ┌──────────────┐
                         │ Admin (S4)   │
                         └──────────────┘
```

### 2.2 Navigationsmodell

- **Keine Tab-Leiste.** Die App ist so einfach, dass eine Tab-Navigation unnötig komplex wäre
- **Kein Seitenwechsel zwischen Startseite und Liste.** Alles passiert auf einem Screen
- Navigation erfolgt über kontextuelle Elemente:
  - Hauptscreen → Ladenauswahl: Tap auf den Laden-Namen oben
  - Einstellungen: Zahnrad-Icon oben rechts
  - Admin: Versteckter Zugang (langes Drücken auf Logo oder /admin URL)

---

## 3. Screen-Beschreibungen

### S1: Hauptscreen (Einziger Screen)

Der Nutzer verbringt hier 100% seiner Zeit. Suchfeld oben, Einkaufsliste darunter. Wenn der Nutzer ins Suchfeld tippt, überlagern die Suchergebnisse die Liste vollständig.

**Listenmodus (Standard – Suchfeld leer):**

```
┌─────────────────────────────────┐
│ [ALDI Logo]  Musterstr. ▾  [⚙️]│  ← Logo, Laden (tappbar), Settings
│ ┌─────────────────────────────┐ │
│ │ 🔍 Produkt suchen...   [📷]│ │  ← Suchfeld + Barcode-Scanner
│ └─────────────────────────────┘ │
│ [Meine Reihenfolge|Einkauf ▾]  │  ← Sortier-Tabs (dezent, klein)
│                                  │
│ ── Obst & Gemüse ──────────── │  ← Kategorie-Header (nur bei
│                                  │     "Einkaufsreihenfolge")
│ ○ Äpfel              [-] 1 [+] │
│ ○ Bananen            [-] 2 [+] │
│                                  │
│ ── Milchprodukte ──────────── │
│                                  │
│ ○ Milsani Fettarme   [-] 1 [+] │
│   Milch 1,5% 1L                │
│ ○ Gouda              [-] 1 [+] │
│                                  │
│ ── Tiefkühl ──────────────── │
│                                  │
│ ○ Pizza Margherita   [-] 2 [+] │
│                                  │
│ ── Abgehakt ──────────────── │  ← Ausgegraut, unten
│                                  │
│ ✓ Butter             [-] 1 [+] │  ← ✓ = Häkchen im Kreis, ausgegraut
│                                  │
│─────────────────────────────────│
│ Geschätzter Preis: ca. €23,40  │  ← Fixiert am unteren Rand
│ (2 Produkte ohne Preis)        │
│                                  │
│              [ ⚠ Fehler ]       │  ← Fehler-Button, dezent
└─────────────────────────────────┘

Wenn die Liste leer ist:

┌─────────────────────────────────┐
│ [ALDI Logo]  Musterstr. ▾  [⚙️]│
│ ┌─────────────────────────────┐ │
│ │ 🔍 Produkt suchen...       │ │
│ └─────────────────────────────┘ │
│                                  │
│                                  │
│    Deine Liste ist leer.        │
│                                  │
│    [ Typische Produkte laden ]  │
│                                  │
│                                  │
└─────────────────────────────────┘
```

**Suchmodus (Suchfeld aktiv, Nutzer tippt):**

Die Suchergebnisse überlagern die Einkaufsliste **vollständig**. Die Liste ist im Hintergrund nicht sichtbar. Erst wenn der Nutzer die Suche verlässt (Suchfeld leeren, Zurück-Taste, oder Tap außerhalb), erscheint die Liste wieder.

```
┌─────────────────────────────────┐
│ [ALDI Logo]  Musterstr. ▾      │
│ ┌─────────────────────────────┐ │
│ │ 🔍 Milch|              [✕] │ │  ← Nutzer tippt, X zum Leeren
│ └─────────────────────────────┘ │
│                                  │
│ ┌─────────────────────────────┐ │  ← Suchergebnis-Overlay
│ │                              │ │     überlagert die Liste komplett
│ │ ★ Milsani Fettarme Milch   │ │  ← Persönlicher Favorit
│ │   1,5% 1L           €0,99  │ │
│ │                              │ │
│ │ Milsani Frische Vollmilch  │ │  ← Beliebt
│ │   3,5% 1L           €1,09  │ │
│ │                              │ │
│ │ Milsani H-Milch 1,5%      │ │
│ │   1L                 €0,85  │ │
│ │                              │ │
│ │ Milsani H-Milch 3,5%      │ │
│ │   1L                 €0,95  │ │
│ │                              │ │
│ │ Milka Schokolade Alpenmilch│ │  ← Weitere Treffer
│ │   100g               €1,19  │ │
│ │                              │ │
│ └─────────────────────────────┘ │
│         ┌──────────────┐        │
│         │   [Return]   │        │  ← Return = "Milch" generisch
│         └──────────────┘        │     hinzufügen
│ ┌─────────────────────────────┐ │
│ │  Tastatur                    │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Interaktionen im Listenmodus:**
- Tap auf den Kreis (○) links neben dem Produkt → Abhaken (Häkchen ✓ erscheint im Kreis, Produkt wird ausgegraut, rutscht nach unten)
- Tap auf den Kreis (✓) eines abgehakten Produkts → wird wieder aktiv
- Swipe links auf Produkt → Löschen (mit 3-Sekunden-Undo-Banner)
- Tap auf [-] oder [+] → Menge sofort um 1 verringern/erhöhen (kein Popup, kein Zwischenschritt)
- Menge auf 0 per [-] → Produkt wird entfernt (mit Undo)
- Tap auf Laden-Name oben → Öffnet Ladenauswahl (S2, Overlay)
- Tap auf Suchfeld → Wechsel in Suchmodus

**Interaktionen im Suchmodus:**
- Return-Taste → Suchbegriff als generisches Produkt hinzufügen, Suchmodus wird verlassen
- Tap auf Suchergebnis → Spezifisches Produkt hinzufügen, Suchmodus wird verlassen
- Tap auf [✕] im Suchfeld oder Zurück-Taste → Suchmodus verlassen, Liste wird wieder sichtbar

---

### S2: Ladenauswahl

Erscheint als Overlay/Modal über der Liste.

```
┌─────────────────────────────────┐
│                          [ ✕ ]  │  ← Schließen
│                                  │
│ Laden auswählen                 │
│                                  │
│ ┌─────────────────────────────┐ │
│ │ 🔍 Laden suchen...         │ │
│ └─────────────────────────────┘ │
│                                  │
│ ── Zuletzt besucht ─────────── │
│                                  │
│ 📍 ALDI SÜD Musterstr. 12     │
│    München · 0,3 km            │
│                                  │
│ 📍 ALDI SÜD Hauptstr. 45      │
│    München · 2,1 km            │
│                                  │
│ ── In der Nähe ────────────── │
│                                  │
│ 📍 ALDI SÜD Bahnhofstr. 8     │
│    München · 0,8 km            │
│                                  │
│ 📍 ALDI SÜD Schillerstr. 22   │
│    München · 1,5 km            │
│                                  │
│ ...                              │
└─────────────────────────────────┘
```

**Verhalten:**
- Sortierung: Zuletzt besucht oben, dann nach Entfernung (wenn GPS verfügbar)
- Tap auf einen Laden → Laden wird ausgewählt, Liste sortiert sich neu, Overlay schließt sich
- Suche filtert nach Adresse und Stadtteil

---

### S3: Einstellungen

Minimaler Screen, erreichbar über das Zahnrad-Icon.

```
┌─────────────────────────────────┐
│ [←]  Einstellungen              │
│                                  │
│ Sprache                         │
│ [ Deutsch               ▾ ]    │
│                                  │
│ Standard-Laden                  │
│ [ ALDI SÜD Musterstr. 12  ▾ ] │
│ Wird verwendet, wenn GPS den    │
│ Laden nicht erkennt.            │
│                                  │
│─────────────────────────────────│
│                                  │
│ Über diese App                  │
│ Version 0.1 (MVP)              │
│ Ein Prototyp-Projekt.           │
│                                  │
└─────────────────────────────────┘
```

---

### S4: Admin-Bereich (versteckt)

Erreichbar über langes Drücken auf das ALDI-Logo oder direkt via /admin URL. Geschützt durch Admin-Passwort.

```
┌─────────────────────────────────┐
│ [←]  Admin                      │
│                                  │
│ ── Produkte ───────────────── │
│                                  │
│ [ Produkt hinzufügen ]         │
│ [ Bulk-Import (CSV) ]          │
│ [ Produkte verwalten → ]       │  ← Liste aller Produkte
│                                  │
│ ── Crowdsourcing ──────────── │
│                                  │
│ [ Vorschläge prüfen (12) → ]  │  ← Anzahl offener Vorschläge
│                                  │
│ ── Fehler-Meldungen ────────── │
│                                  │
│ [ Fehler einsehen (3) → ]     │  ← Anzahl offener Meldungen
│                                  │
│ ── Daten ──────────────────── │
│                                  │
│ [ Einkaufsdaten exportieren ]  │
│ [ Ladendatenbank verwalten ]   │
│                                  │
└─────────────────────────────────┘
```

---

## 4. Interaktionsmuster

### 4.1 Swipe-to-Delete
- Swipe nach links auf einem Listeneintrag
- Rote "Löschen"-Fläche erscheint (wie bei iOS Mail)
- Produkt wird entfernt
- Am unteren Bildschirmrand: "Rückgängig"-Banner für 3 Sekunden

### 4.2 Tap-to-Check (Kreis-Checkbox)
- Jeder Listeneintrag hat links einen Kreis (○) als Abhak-Feld
- Tap auf den Kreis → Häkchen erscheint im Kreis (✓), kurze Animation
- Produkt wird ausgegraut und gleitet nach unten in den "Abgehakt"-Bereich
- Erneuter Tap auf den Kreis (✓) → Häkchen verschwindet, Produkt wird wieder aktiv

### 4.3 Mengenänderung (Direkt, ohne Popup)
- Plus- und Minus-Buttons sind direkt neben der Menge sichtbar: [ - ] 2 [ + ]
- Tap auf [+] → Menge sofort +1
- Tap auf [-] → Menge sofort -1
- Kein Popup, kein Picker, kein Zwischenschritt
- Menge 0 → Produkt wird entfernt (mit Undo)

### 4.4 Pull-to-Refresh
- Pull-down-Geste auf der Liste → manuelle Synchronisation mit der Cloud
- Zeigt kurz den Sync-Status an ("Synchronisiert" oder "Offline – letzte Sync vor 5 Min.")

### 4.5 Letztes Produkt abgehakt
- Kurze Erfolgs-Animation (z.B. Konfetti oder Häkchen-Animation, dezent im ALDI-Stil)
- Automatischer Wechsel zur Startseite nach 1-2 Sekunden
- Einkauf wird im Hintergrund archiviert

---

## 5. Design-Sprache

### 5.1 Farbpalette

Basierend auf der ALDI SÜD Markenidentität (abgeleitet von öffentlichen Quellen):

- **Primärfarbe:** ALDI-Blau (#00005f oder ähnlich – aus ALDI-Website ableiten)
- **Sekundärfarbe:** ALDI-Orange/Gelb (Akzentfarbe für Buttons und Highlights)
- **Hintergrund:** Weiß (#FFFFFF)
- **Text:** Dunkelgrau (#333333)
- **Ausgegraut (abgehakt):** Hellgrau (#CCCCCC)
- **Fehler/Löschen:** Rot (#E74C3C)
- **Erfolg:** Grün (#27AE60)

> Die exakten Farbwerte sollen von der AI aus der aktuellen ALDI SÜD Website abgeleitet werden.

### 5.2 Typografie

- Klare, gut lesbare Sans-Serif-Schrift
- Produktnamen: Normale Größe, gut lesbar
- Kategorie-Header: Etwas kleiner, Großbuchstaben, ALDI-Blau
- Preise: Gleiche Größe wie Produktnamen, rechtsbündig
- Gesamtsumme: Etwas größer, fett

> Die AI soll prüfen, welche Schriftart ALDI SÜD verwendet, und eine möglichst ähnliche frei verfügbare Alternative wählen.

### 5.3 Icons & Symbole

- Minimaler Icon-Einsatz – nur wo nötig (Suche, Einstellungen, Zurück)
- Kategorie-Icons neben den Kategorie-Headern (optional, z.B. 🍎 für Obst, 🥛 für Milch)
- Die AI soll entscheiden, ob Emojis oder ein Icon-Set besser zum ALDI-Design passen

### 5.4 Abstände & Touch-Targets

- Mindestgröße für tappbare Elemente: 44x44px (Apple-Richtlinie)
- Genug Abstand zwischen Listenelementen, um versehentliches Tippen zu vermeiden
- Besonders wichtig: Abstand zwischen "Abhaken" und "Mengen ändern" muss groß genug sein

### 5.5 Animationen

- Dezent und schnell – nie länger als 300ms
- Abhaken: Kurzes Slide + Fade
- Löschen: Slide nach links
- Hinzufügen: Kurzes Aufblitzen/Highlight des neuen Eintrags
- Sortierung: Sanftes Umordnen (wenn Laden erkannt wird)
- Keine Animationen, die die Bedienung verzögern

---

## 6. Responsive Verhalten

### Smartphone (Primär)
- Optimiert für Bildschirmbreiten von 320px bis 428px
- Einspaltiges Layout
- Touch-optimiert

### Tablet
- Gleiche Funktionalität, mehr Weißraum
- Suchfeld und Liste können breiter dargestellt werden
- Kein grundlegend anderes Layout

### Desktop
- Funktional nutzbar (für Admin-Tätigkeiten)
- Zentrierte Darstellung mit maximaler Breite (ca. 480px)
- Kein Fokus auf Desktop-Optimierung

---

## 7. Offline-Anzeige

- Wenn offline: Dezenter Hinweis am oberen Bildschirmrand: "Offline – Änderungen werden synchronisiert, sobald du online bist"
- Dieser Hinweis verschwindet automatisch bei Verbindung
- Kein blockierendes Modal oder Popup – die App funktioniert normal weiter

---

## 8. Leere Zustände (Empty States)

### Leere Liste
- Freundliche Nachricht: "Deine Liste ist leer"
- Suchfeld ist prominent
- Button "Typische Produkte laden"

### Keine Suchergebnisse
- "Kein Produkt gefunden für '[Suchbegriff]'"
- Button "Produkt vorschlagen" (Crowdsourcing, siehe F09)
- Hinweis: "Drücke Return, um '[Suchbegriff]' als generisches Produkt hinzuzufügen"

### Kein Laden erkannt
- "Laden konnte nicht erkannt werden"
- Button "Laden manuell auswählen"
- Liste bleibt in Kategorie-Sortierung nutzbar

---

## 9. Vision: Späterer Einkaufsmodus (nicht MVP)

> Für spätere Phasen dokumentiert, nicht Teil des MVP.

Wenn ein Laden erkannt wird, wechselt die App in einen optimierten Einkaufsmodus:
- Größere Tap-Flächen (für schnelles Abhaken mit einer Hand)
- Vereinfachte Darstellung (nur Produktname und Abhak-Fläche)
- Kein Suchfeld sichtbar (ausklappbar bei Bedarf)
- Größere Schrift
- Fortschrittsanzeige: "5 von 12 Produkten ✓"
- Eventuell: Bildschirm bleibt aktiv (kein Auto-Lock)

---

*Letzte Aktualisierung: 2025-02-16*
*Status: Entwurf v1 – Review durch Produktinhaber ausstehend*

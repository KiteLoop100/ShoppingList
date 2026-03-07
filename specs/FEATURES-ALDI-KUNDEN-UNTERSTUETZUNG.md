# FEATURES-ALDI-KUNDEN-UNTERSTUETZUNG.md – ALDI-Kunden-Unterstützung (F30)

> Crowdsourced Customer Intelligence: Kunden helfen ALDI über die App, besser zu werden.
> Nutzt den einzigartigen Kontext der App (aktueller Laden, Einkaufshistorie, Standort, Zeitpunkt).

---

## 1. Overview

| Aspect | Value |
|--------|-------|
| **Feature ID** | F30 |
| **Phase** | Post-MVP |
| **Dependencies** | F17 (Account & Auth), F25 (Feedback), F06 (Store Detection) |
| **Principle** | Jede Interaktion muss für den Kunden freiwillig, transparent und niedrigschwellig sein. Keine Gamification, keine Punkte. |

### Goal

Kunden werden zu aktiven Verbesserungspartnern für ALDI — nicht durch extra Aufwand, sondern durch natürliche Erweiterungen des bestehenden Einkaufs-Flows. Die App liefert dabei automatisch den Kontext (Filiale, Zeitpunkt, Produkt), den klassische Umfrage-Tools nicht haben.

### Abgrenzung zu F25 (Feedback)

F25 ist ein **allgemeiner Feedback-Kanal** (Kunde → ALDI, initiiert vom Kunden). F30 dreht die Richtung um: **ALDI fragt gezielt** und Kunden liefern strukturierte Daten, die direkt in operative Verbesserungen fließen.

---

## 2. Feature-Bausteine

### Übersicht

| ID | Baustein | Aufwand | Kunden-Aufwand | Wert für ALDI |
|----|----------|---------|----------------|---------------|
| KU-01 | Leeres-Regal-Meldung | M | Minimal (1 Tap) | Sehr hoch |
| KU-02 | Regalfotos mit Kontext | L | Mittel (Foto) | Sehr hoch |
| KU-03 | Kontext-getriggerte Micro-Surveys | L | Gering (1-2 Taps / Voice) | Sehr hoch |
| KU-04 | Produkt-Tasting-Feedback | M | Gering (Rating + Text) | Hoch |
| KU-05 | Sortimentswünsche & Konkurrenz-Kontext | M | Gering (1 Tap) | Hoch |
| KU-06 | Aktionsware-Tracking | S | Minimal (1 Tap) | Hoch |
| KU-07 | „Wo hast du es gefunden?" | S | Gering (Auswahl) | Mittel |
| KU-08 | Passive Datenerhebung (Suchbegriffe, Zeitpunkte) | S | Kein Aufwand | Mittel |
| KU-09 | Mystery-Shopping-Light | L | Mittel (Checkliste) | Hoch |
| KU-10 | Filial-Auslastung & Stoßzeiten | M | Kein Aufwand | Mittel |

---

## 3. Detailbeschreibung der Bausteine

### KU-01: Leeres-Regal-Meldung

**Trigger:** Kunde will ein Produkt abhaken, findet es aber nicht im Regal.

**UI-Integration:** Neuer Button im Abhak-Flow (neben "Woanders kaufen"):

```
┌─────────────────────────────────────┐
│ ✓ Milsani H-Milch 1,5%             │
│                                     │
│ [✓ Erledigt]  [Woanders]  [Leer]   │
│                                     │
│ Oder: Long-press → Kontextmenü     │
│   → "Regal war leer"               │
└─────────────────────────────────────┘
```

**Was wird gespeichert:**
- `product_id`, `store_id`, `timestamp`, `user_id`
- Automatisch: Wochentag, Uhrzeit, Demand-Group

**Aggregation für ALDI:**
- Echtzeit-Out-of-Stock-Dashboard pro Filiale
- Muster: "Milch-Regal in Filiale X ist freitags ab 17 Uhr regelmäßig leer"
- Vergleich über Filialen: Welche Filialen haben systematisch OOS-Probleme?

**Datenschutz:** User-ID wird bei Aggregation anonymisiert. ALDI sieht nur aggregierte Trends.

---

### KU-02: Regalfotos mit Kontext

**Trigger:** Kunde fotografiert freiwillig ein Regal, eine Auslage oder einen Bereich im Laden.

**UI-Integration:** Kamera-Button auf der Hauptseite (neben Barcode-Scanner), neuer Modus "Filiale dokumentieren":

```
┌─────────────────────────────────────┐
│ 📸 Filiale dokumentieren            │
│                                     │
│ Was möchtest du fotografieren?      │
│                                     │
│ [Regal/Auslage]  [Frischetheke]    │
│ [Eingangsbereich] [Sonstiges]      │
│                                     │
│        [ Foto aufnehmen ]           │
│                                     │
│ Optional: Kommentar                 │
│ ┌─────────────────────────────────┐ │
│ │ z.B. "Obst sieht heute nicht   │ │
│ │ frisch aus"                     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Automatisch angereicherte Metadaten:**
- Filiale (aus Store Detection / GPS)
- Geschätzter Gang/Bereich (aus gelernter Sortierung)
- Datum, Uhrzeit, Wochentag

**Wert für ALDI:**
- Planogram-Compliance: Sieht das Regal so aus wie geplant?
- Frische-Monitoring: Zustand verderblicher Ware im Tagesverlauf
- Vergleich über Filialen: Welche Filialen sind besonders ordentlich?

---

### KU-03: Kontext-getriggerte Micro-Surveys

**Kernidee:** Nicht zufällige Fragen, sondern **situativ passende**. Die App weiß, in welchem Laden der Kunde gerade war, was er gekauft hat und wann.

**Opt-In:** Einmalige Zustimmung in den Einstellungen:

```
┌─────────────────────────────────────┐
│ ⚙️ Einstellungen                    │
│                                     │
│ ALDI-Unterstützung                  │
│                                     │
│ Hilf ALDI, besser zu werden!       │
│ Wir stellen dir ab und zu kurze    │
│ Fragen zu deinem Einkauf.          │
│                                     │
│ [Micro-Umfragen aktivieren]  [off] │
│                                     │
│ Antworten per:                      │
│ [✓ Tippen]  [✓ Spracheingabe]     │
│                                     │
│ Häufigkeit: max. 3× pro Woche     │
└─────────────────────────────────────┘
```

**Fragetypen:**

| Typ | Trigger | Beispiel |
|-----|---------|----------|
| Filial-spezifisch | Nach Einkauf in Filiale X | "Waren die SB-Kassen in der Musterstraße heute in Betrieb?" |
| Produkt-spezifisch | Produkt X wurde gekauft | "Bist du zufrieden mit der neuen Verpackung der Milsani Butter?" |
| Sortiment | Suchbegriff ohne Treffer | "Du hast nach 'Hummus' gesucht. Wünschst du dir das im ALDI-Sortiment?" |
| Saisonal | Zeitraum-basiert | "Findest du die Weihnachts-Aktionsware rechtzeitig genug im Laden?" |

**Antwortformate:**
- **Quick-Choice:** 2-4 Optionen, 1 Tap (Ja/Nein, Skala, Multiple Choice)
- **Freitext:** Textfeld, max 500 Zeichen
- **Spracheingabe:** Voice-to-Text via Web Speech API oder Whisper, wird transkribiert und als Text gespeichert

**UI nach dem Einkauf:**

```
┌─────────────────────────────────────┐
│ 💬 Kurze Frage von ALDI             │
│                                     │
│ "Wie war die Wartezeit an der      │
│  Kasse heute in der Musterstraße?" │
│                                     │
│ [Sehr kurz] [OK] [Zu lang]        │
│                                     │
│ 🎤 Per Sprache antworten           │
│                                     │
│           [Überspringen]            │
└─────────────────────────────────────┘
```

**Rate-Limiting:**
- Max 1 Frage pro Einkauf
- Max 3 Fragen pro Woche
- Immer überspringbar, kein Dark Pattern

---

### KU-04: Produkt-Tasting-Feedback

**Trigger:** Kunde kauft ein Produkt, das als "neu" oder "geänderte Rezeptur" markiert ist. 2-3 Tage nach dem Kassenbon-Scan erscheint eine Push-Notification oder In-App-Prompt.

```
┌─────────────────────────────────────┐
│ 🆕 Wie war das neue Produkt?        │
│                                     │
│ Du hast "GutBio Hafer Barista"     │
│ am Dienstag gekauft.               │
│                                     │
│ Würdest du es wieder kaufen?       │
│ [Ja, gern!] [Vielleicht] [Nein]   │
│                                     │
│ Was fandest du gut/schlecht?        │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│ 🎤                                  │
│                                     │
│ [ Absenden ]    [ Überspringen ]   │
└─────────────────────────────────────┘
```

**Wert für ALDI:**
- Direktes Kundenfeedback zu Neulistungen, bevor Abverkaufszahlen aussagekräftig sind
- Frühwarnung bei Rezepturänderungen, die schlecht ankommen
- Verbindung von Kaufdaten und Zufriedenheit

---

### KU-05: Sortimentswünsche & Konkurrenz-Kontext

**Passive Variante:** Die App weiß bereits, welche Produkte Kunden bei der Konkurrenz kaufen (`competitor_products`). Aggregiert: "500 Kunden in Region München kaufen Bio-Hafermilch regelmäßig bei Rewe."

**Aktive Variante:** Button bei Konkurrenzprodukten:

```
┌─────────────────────────────────────┐
│ 🛒 Bio-Hafermilch (Rewe)            │
│                                     │
│ Dieses Produkt kaufst du bei Rewe. │
│                                     │
│ [ Wünsche ich mir bei ALDI ]  ♥ 342│
│                                     │
└─────────────────────────────────────┘
```

**Aggregation:** Ranking der meistgewünschten Produkte/Kategorien pro Region. ALDI Einkauf bekommt ein datengetriebenes Signal für Sortimentsentscheidungen.

---

### KU-06: Aktionsware-Tracking

**Trigger:** Kunde hatte ein Flyer-Produkt auf der Einkaufsliste. Nach dem Einkauf:

```
┌─────────────────────────────────────┐
│ 📋 Aktionsware-Check                │
│                                     │
│ Du hattest 2 Angebote auf der Liste:│
│                                     │
│ Braun Rasierer       [✓ Gefunden]  │
│                       [✗ Nicht da] │
│                                     │
│ Gartenschlauch 15m   [✓ Gefunden]  │
│                       [✗ Nicht da] │
│                                     │
│              [ Fertig ]             │
└─────────────────────────────────────┘
```

**Wert für ALDI:** Messbar, ob Aktionsware tatsächlich in der Filiale verfügbar ist. Identifiziert Filialen, die Aktionsware zu spät oder gar nicht auslegen.

---

### KU-07: „Wo hast du es gefunden?"

**Trigger:** Kunde hakt ein Produkt ab, das die App noch keinem Bereich zugeordnet hat (neues Produkt oder neuer Laden).

```
┌─────────────────────────────────────┐
│ 📍 Wo war "Olivenöl extra vergine"?│
│                                     │
│ [Obst/Gemüse] [Kühlregal]         │
│ [Tiefkühl] [Konserven/Öl]         │
│ [Süßwaren] [Getränke]             │
│ [Drogerie] [Aktionsware]          │
│                                     │
│         [ Überspringen ]            │
└─────────────────────────────────────┘
```

**Doppelter Nutzen:**
1. Beschleunigt das Sortierungs-Lernen der App (Vorteil für den Kunden)
2. Gibt ALDI Planogram-Daten: "Kunden finden Olivenöl im Konserven-Gang, nicht bei Gewürzen"

---

### KU-08: Passive Datenerhebung (kein Kundenaufwand)

Daten, die bereits anfallen und nur ausgewertet werden müssen:

| Datenquelle | Was ALDI daraus lernt |
|-------------|----------------------|
| **Erfolglose Suchbegriffe** | Sortimentslücken ("Hummus" wird 340×/Monat gesucht, ALDI hat keins) |
| **Einkaufszeitpunkte** | Auslastungsmuster pro Filiale und Wochentag |
| **Planned vs. Actual** (Liste vs. Kassenbon) | Substitutionsverhalten, Impulskäufe |
| **Konkurrenzprodukte** | Welche Kategorien verliert ALDI an Wettbewerber? |
| **Abhak-Reihenfolge** | Tatsächlicher Laufweg der Kunden (weicht vom Planogram ab?) |

Kein neues UI nötig — nur Backend-Aggregation und Reporting.

---

### KU-09: Mystery-Shopping-Light

**Trigger:** ALDI stellt gezielte Aufgaben für bestimmte Filialen ein. Kunden, die dort einkaufen und Micro-Surveys aktiviert haben, sehen die Aufgabe.

```
┌─────────────────────────────────────┐
│ 🔍 Filial-Check (freiwillig)        │
│                                     │
│ ALDI möchte wissen, wie es in      │
│ deiner Filiale aussieht. Kannst du │
│ beim nächsten Einkauf kurz prüfen? │
│                                     │
│ ☐ Pfandautomaten funktionieren     │
│ ☐ Backwaren-Auslage voll          │
│ ☐ Obst/Gemüse sieht frisch aus    │
│ ☐ Aktionsware ist aufgebaut        │
│                                     │
│ 📸 Optional: Foto beifügen         │
│                                     │
│  [ Erledigt ]    [ Nicht jetzt ]   │
└─────────────────────────────────────┘
```

**Wert für ALDI:** Kosteneffiziente Alternative zu professionellem Mystery Shopping. Kein repräsentativer Ersatz, aber kontinuierliches Signal.

---

### KU-10: Filial-Auslastung & Stoßzeiten

**Passive Erhebung:** Aus Einkaufszeitpunkten (Beginn = App geöffnet im Laden, Ende = letztes Produkt abgehakt) wird die Auslastung pro Filiale geschätzt.

**Rückkanal zum Kunden:** Sobald genug Daten vorliegen:

```
┌─────────────────────────────────────┐
│ 🕐 Beste Einkaufszeiten             │
│ ALDI SÜD Musterstraße              │
│                                     │
│ Mo ████░░░░░░░░ ruhig ab 18 Uhr   │
│ Di ██████░░░░░░ ruhig ab 19 Uhr   │
│ Mi ████████████ ganztags voll      │
│ Do ██████░░░░░░                    │
│ Fr █████████░░░ Freitag-Rush       │
│ Sa ████████████ vormittags voll    │
└─────────────────────────────────────┘
```

**Wert:** Für den Kunden (bessere Zeitplanung) UND für ALDI (Personaleinsatzplanung, Vergleich mit Kassendaten).

---

## 4. Opt-In & Datenschutz

| Prinzip | Umsetzung |
|---------|-----------|
| **Opt-In** | Alle aktiven Bausteine (KU-01 bis KU-09) erfordern einmalige Zustimmung in den Einstellungen |
| **Granulares Opt-In** | Kunden wählen, welche Bausteine sie aktivieren (Fotos ja, Umfragen nein) |
| **Transparenz** | Jede Datenerhebung zeigt, wofür die Daten genutzt werden |
| **Anonymisierung** | Aggregierte Reports an ALDI enthalten keine User-IDs |
| **Löschrecht** | Alle eigenen Beiträge jederzeit löschbar über Einstellungen |
| **Keine Vergütung** | Kein Geld, keine Punkte, keine Gamification — passt zu ALDI-Philosophie |
| **Kein Zwang** | Alles überspringbar, kein Dark Pattern, kein Guilt-Tripping |

### Einstellungs-Sektion

```
┌─────────────────────────────────────┐
│ ⚙️ ALDI-Unterstützung               │
│                                     │
│ Hilf ALDI, deinen Einkauf zu       │
│ verbessern. Alles freiwillig.      │
│                                     │
│ Verfügbarkeit melden        [on]   │
│ Filiale fotografieren       [off]  │
│ Micro-Umfragen              [on]   │
│   Antworten per Sprache     [on]   │
│   Max. 3× pro Woche               │
│ Produkt-Feedback            [on]   │
│ Sortimentswünsche           [on]   │
│                                     │
│ [ Meine Beiträge ansehen ]         │
│ [ Alle Daten löschen ]             │
└─────────────────────────────────────┘
```

---

## 5. Datenmodell

### Tabelle: `customer_contributions`

| Field | Type | Description |
|-------|------|-------------|
| contribution_id | UUID PK | Unique ID |
| user_id | TEXT NOT NULL | `auth.uid()` |
| contribution_type | TEXT NOT NULL | `out_of_stock` / `shelf_photo` / `micro_survey` / `tasting` / `assortment_wish` / `promo_check` / `location_hint` / `mystery_check` |
| store_id | UUID | Filiale (aus Store Detection) |
| product_id | UUID | Produkt-Referenz (optional) |
| trip_id | UUID | Trip-Referenz (optional) |
| payload | JSONB NOT NULL | Typ-spezifische Daten (siehe unten) |
| photo_url | TEXT | Supabase Storage URL (optional) |
| created_at | TIMESTAMPTZ | Zeitstempel |
| day_of_week | SMALLINT | 0-6, automatisch aus `created_at` |
| hour_of_day | SMALLINT | 0-23, automatisch aus `created_at` |

### Tabelle: `micro_survey_questions`

| Field | Type | Description |
|-------|------|-------------|
| question_id | UUID PK | Unique ID |
| question_type | TEXT NOT NULL | `store` / `product` / `assortment` / `seasonal` |
| target_store_id | UUID | Filiale (NULL = alle) |
| target_product_id | UUID | Produkt (NULL = alle) |
| question_text_de | TEXT NOT NULL | Fragetext Deutsch |
| question_text_en | TEXT | Fragetext Englisch |
| answer_format | TEXT NOT NULL | `choice` / `free_text` / `voice` / `scale` |
| answer_options | JSONB | Antwortoptionen für `choice` |
| active | BOOLEAN DEFAULT true | Aktiv/Inaktiv |
| valid_from | TIMESTAMPTZ | Gültig ab |
| valid_until | TIMESTAMPTZ | Gültig bis |
| max_responses | INTEGER | Max Antworten (NULL = unbegrenzt) |
| created_at | TIMESTAMPTZ | Erstellt am |

### Tabelle: `micro_survey_responses`

| Field | Type | Description |
|-------|------|-------------|
| response_id | UUID PK | Unique ID |
| question_id | UUID FK | Referenz zur Frage |
| user_id | TEXT NOT NULL | `auth.uid()` |
| store_id | UUID | Filiale des Kunden |
| answer_choice | TEXT | Gewählte Option |
| answer_text | TEXT | Freitext / Transkription |
| answer_voice_url | TEXT | Audio-URL (optional, nur wenn Kunde zustimmt) |
| created_at | TIMESTAMPTZ | Zeitstempel |

### Payload-Beispiele (JSONB)

```jsonc
// out_of_stock
{ "product_name": "Milsani H-Milch 1,5%", "demand_group_code": "02" }

// shelf_photo
{ "area": "frischetheke", "comment": "Obst sieht nicht frisch aus" }

// tasting
{ "product_name": "GutBio Hafer Barista", "would_buy_again": "yes", "comment": "Guter Geschmack" }

// assortment_wish
{ "product_name": "Bio-Hafermilch", "competitor": "Rewe", "competitor_product_id": "uuid" }

// promo_check
{ "flyer_item_id": "uuid", "found": false }

// location_hint
{ "area_selected": "konserven_oel" }

// mystery_check
{ "checklist": { "pfandautomat": true, "backwaren": true, "obst_frisch": false, "aktionsware": true }, "comment": "Obst-Auslage dünn" }
```

### RLS Policies

- **INSERT:** `user_id = auth.uid()::text`
- **SELECT eigene:** `user_id = auth.uid()::text` (Kunden sehen eigene Beiträge)
- **SELECT/UPDATE alle:** Admin-Rolle (für Dashboard)
- **DELETE eigene:** `user_id = auth.uid()::text` (Löschrecht)

---

## 6. Implementierungsreihenfolge

| Phase | Bausteine | Begründung |
|-------|-----------|------------|
| **Phase 1** | KU-01 (OOS-Meldung), KU-08 (Passive Daten) | Höchster Wert, niedrigster Aufwand, natürliche Integration |
| **Phase 2** | KU-03 (Micro-Surveys), KU-07 (Wo gefunden?) | Opt-In-Infrastruktur, Survey-Engine |
| **Phase 3** | KU-02 (Regalfotos), KU-04 (Tasting), KU-06 (Aktionsware) | Foto-Upload-Erweiterung, Push-Trigger |
| **Phase 4** | KU-05 (Sortimentswünsche), KU-09 (Mystery), KU-10 (Stoßzeiten) | Aggregation, Dashboard, Rückkanal |

---

## 7. Betroffene Dateien (Schätzung)

### Neue Dateien

| File | Purpose |
|------|---------|
| `src/lib/contribution/contribution-types.ts` | TypeScript Interfaces |
| `src/lib/contribution/contribution-service.ts` | CRUD für Beiträge |
| `src/lib/contribution/survey-service.ts` | Survey-Logik (Auswahl, Rate-Limiting) |
| `src/components/contribution/out-of-stock-button.tsx` | OOS-Meldung im Abhak-Flow |
| `src/components/contribution/shelf-photo-capture.tsx` | Regalfoto-Aufnahme |
| `src/components/contribution/micro-survey-prompt.tsx` | Survey-Anzeige (Choice, Text, Voice) |
| `src/components/contribution/tasting-prompt.tsx` | Produkt-Tasting nach Kauf |
| `src/components/contribution/assortment-wish-button.tsx` | "Wünsche ich mir bei ALDI" |
| `src/components/contribution/contribution-settings.tsx` | Einstellungen / Opt-In |
| `src/components/contribution/my-contributions.tsx` | Eigene Beiträge ansehen/löschen |
| `src/app/api/contributions/route.ts` | API-Endpunkt |
| `src/app/api/surveys/route.ts` | Survey-Fragen abrufen |
| `supabase/migrations/YYYYMMDD_customer_contributions.sql` | DB-Schema |

### Modifizierte Dateien

| File | Change |
|------|--------|
| `src/components/list/list-item-row.tsx` | OOS-Button im Kontextmenü |
| `src/components/list/shopping-list-content.tsx` | Survey-Prompt nach Einkauf |
| `src/app/[locale]/settings/settings-client.tsx` | ALDI-Unterstützung Sektion |
| `src/messages/de.json` + `en.json` | Übersetzungen |

---

## 8. Nicht enthalten (bewusst ausgeschlossen)

| Idee | Grund |
|------|-------|
| **Preisschilder-Check** | ALDI nutzt Electronic Shelf Labels (ESL) — Preisfehler sind systemseitig ausgeschlossen |
| **Gamification / Punkte** | Widerspricht ALDI-Philosophie und Core Principle #4 ("No gamification") |
| **Bezahltes Mystery Shopping** | Außerhalb des App-Scopes, rechtliche Komplexität |
| **GPS-Tracking / Laufwege** | Datenschutz-Bedenken überwiegen den Nutzen in der aktuellen Phase |

---

*Created: 2026-03-07*
*Status: Backlog*

# DATA-MODEL.md – Datenmodell

> Dieses Dokument beschreibt die Datenstrukturen der App.
> Es ist inhaltlich formuliert (nicht als technisches Datenbankschema) – der AI-Agent übersetzt es in die passende technische Struktur.
> Für Feature-Kontext siehe FEATURES.md.

---

## 1. Übersicht der Datenobjekte

```
Nutzer (User)
  └── hat eine aktive Einkaufsliste (ShoppingList)
  │     └── enthält Listeneinträge (ListItem)
  │           └── verweist optional auf ein Produkt (Product)
  └── hat eine Einkaufshistorie (ShoppingTrip, viele)
  │     └── enthält archivierte Einträge (TripItem)
  └── hat persönliche Produktpräferenzen (UserProductPreference)

Produkt (Product)
  └── gehört zu einer Kategorie (Category)
  └── hat optional einen Preis (ProductPrice)
  └── hat einen Sortimentstyp (Daily Range / Special)

Laden (Store)
  └── hat eine Adresse und GPS-Koordinaten
  └── hat Gangfolge-Daten (AisleOrder)

Lernalgorithmus-Daten
  └── Abhak-Sequenzen (CheckoffSequence)
  └── Fehler-Meldungen (SortingError)
  └── Aggregierte Gangfolgen (AggregatedAisleOrder)
```

---

## 2. Nutzer (User)

Ein Nutzer wird automatisch beim ersten App-Start angelegt (Anonymous-First, siehe PRODUCT.md Abschnitt 7).

| Feld | Beschreibung |
|------|-------------|
| user_id | Eindeutige ID, automatisch generiert beim ersten App-Start |
| device_id | ID des Geräts (um anonymes Konto an Gerät zu binden) |
| email | E-Mail-Adresse (leer bis zur Registrierung) |
| password_hash | Passwort (leer bis zur Registrierung) |
| is_registered | Ob der Nutzer ein persönliches Konto angelegt hat (true/false) |
| preferred_language | Spracheinstellung (de / en) |
| default_store_id | Standard-Laden (optional, vom Nutzer in Einstellungen wählbar) |
| created_at | Zeitpunkt der Erstellung |
| last_active_at | Letzter Zeitpunkt der Nutzung |

---

## 3. Einkaufsliste (ShoppingList)

Jeder Nutzer hat genau eine aktive Einkaufsliste. Im MVP gibt es keine Mehrfach-Listen.

| Feld | Beschreibung |
|------|-------------|
| list_id | Eindeutige ID |
| user_id | Zugehöriger Nutzer |
| store_id | Aktuell zugeordneter Laden (null wenn kein Laden erkannt/gewählt) |
| status | active / completed |
| created_at | Zeitpunkt der Erstellung |
| completed_at | Zeitpunkt des Abschlusses (wenn letztes Produkt abgehakt) |

---

## 4. Listeneintrag (ListItem)

Ein einzelnes Produkt auf der Einkaufsliste.

| Feld | Beschreibung |
|------|-------------|
| item_id | Eindeutige ID |
| list_id | Zugehörige Einkaufsliste |
| product_id | Verweis auf ein Produkt in der Datenbank (null bei generischen Einträgen) |
| custom_name | Freitext-Produktname (bei generischen Einträgen, z.B. "Milch") |
| display_name | Der angezeigte Name: entweder Produktname aus der DB oder custom_name |
| quantity | Menge (ganzzahlig, Standard: 1) |
| is_checked | Abgehakt ja/nein |
| checked_at | Zeitpunkt des Abhakens (wichtig für den Lernalgorithmus) |
| sort_position | Aktuelle Position in der sortierten Liste |
| category_id | Kategorie (aus Produkt-DB oder algorithmisch zugewiesen) |
| added_at | Zeitpunkt des Hinzufügens |

### Logik
- Wenn product_id gesetzt → spezifischer Eintrag (Preis, Kategorie etc. aus Produkt-DB)
- Wenn product_id null → generischer Eintrag (custom_name wird angezeigt, Kategorie wird algorithmisch zugewiesen)
- display_name wird beim Hinzufügen gesetzt und dient als Anzeigewert

---

## 5. Produkt (Product)

Ein Produkt aus dem ALDI SÜD Sortiment.

### Sortimentsstruktur
- **Dauersortiment (daily_range):** Ca. 2.500 ganzjährig verfügbare Produkte. Hinzu kommen sortierte Kartons (z.B. verschiedene Gewürze im gleichen Karton mit gleicher Produktnummer aber unterschiedlichen Produkten), sodass die tatsächliche Anzahl bei ca. **3.500 Produkten** liegt
- **Aktionsartikel (special):** Ca. 6.000 neue Aktionsartikel pro Jahr, zeitlich begrenzt verfügbar. Stehen zusammen in einem Bereich im Laden
- **Aktive Produkte zu einem Zeitpunkt:** Ca. **4.000** (3.500 Dauersortiment + aktuelle Aktionsartikel)
- **Historische Produkte:** Abgelaufene Aktionsartikel bleiben in der Datenbank (status = inactive), werden aber nicht mehr in der Suche angezeigt. Die Datenbank wächst jährlich um ca. 6.000 Einträge

| Feld | Beschreibung |
|------|-------------|
| product_id | Eindeutige ID |
| article_number | Interne ALDI-Artikelnummer (für eindeutige Identifikation und Duplikaterkennung) |
| ean_barcode | EAN/Barcode-Nummer (für Barcode-Scanner Feature) |
| name | Produktname (z.B. "Fettarme Milch 1,5% 1L") |
| name_normalized | Normalisierter Name für Suche und Duplikaterkennung (Kleinbuchstaben, ohne Sonderzeichen) |
| brand | Marke/Eigenmarke (z.B. "Milsani", "Workzone", "GutBio", "Nur Nur Natur"). Leer bei generischen oder Marken-unabhängigen Produkten |
| demand_group | Customer Demand Group (z.B. "Frische & Kühlung", "Obst & Gemüse"). Entspricht der ALDI-internen Kategorisierung und wird für die Gang-Sortierung verwendet |
| demand_sub_group | Customer Demand Sub-Group (z.B. "Weiße Linie", "Steinobst"). Feinere Gruppierung innerhalb der Demand Group |
| category_id | Zugehörige App-Kategorie (gemappt aus demand_group) |
| price | Aktueller Preis in EUR (optional) |
| price_updated_at | Wann der Preis zuletzt aktualisiert wurde |
| popularity_score | Abverkaufsmenge oder Beliebtheitswert (optional, für Ranking in Suchergebnissen) |
| assortment_type | daily_range / special |
| availability | national / regional |
| region | Regionskennung (nur wenn availability = regional) |
| special_start_date | Aktionsstart (nur bei Specials) |
| special_end_date | Aktionsende (nur bei Specials) |
| status | active / inactive |
| source | admin / crowdsourcing / import |
| crowdsource_status | pending / approved / rejected (nur wenn source = crowdsourcing) |
| created_at | Erstellungsdatum |
| updated_at | Letzte Aktualisierung |

### Status-Logik
- **active:** Produkt ist aktuell verfügbar und wird in der Suche angezeigt
- **inactive:** Produkt ist nicht mehr verfügbar (z.B. abgelaufener Aktionsartikel). Wird NICHT in der Suche angezeigt, bleibt aber in der Datenbank für Einkaufshistorie und Analysen
- Aktionsartikel werden automatisch auf inactive gesetzt, wenn special_end_date überschritten ist
- In der Einkaufshistorie werden auch inactive Produkte korrekt angezeigt (mit Name und Preis zum Kaufzeitpunkt)

### Suchbarkeit
- Die Suche durchsucht nur Produkte mit status = active
- Der lokal gecachte Produktkatalog enthält nur aktive Produkte (~4.000 statt aller historischen Produkte)
- Das hält den lokalen Cache klein (~1-2 MB) und die Suche schnell

### Duplikaterkennung
- Beim Hinzufügen neuer Produkte (Admin oder Crowdsourcing) wird der name_normalized mit bestehenden Produkten verglichen
- Ähnlichkeitssuche: Produkte mit hoher Textähnlichkeit (z.B. Levenshtein-Distanz oder ähnlicher Algorithmus) werden als potenzielle Duplikate markiert
- Bei Crowdsourcing-Vorschlägen: Wenn ein ähnliches Produkt existiert, wird der Admin darauf hingewiesen
- Der Algorithmus soll auch Abkürzungen und Varianten erkennen (z.B. "Milsani Milch fettarm" ≈ "Milsani Fettarme Milch 1,5% 1L")
- Die AI soll die beste technische Lösung für die Duplikaterkennung vorschlagen

---

## 6. Kategorie (Category)

Produktkategorien, die für Sortierung und Gruppierung verwendet werden.

| Feld | Beschreibung |
|------|-------------|
| category_id | Eindeutige ID |
| name | Kategoriename (z.B. "Obst & Gemüse") |
| name_translations | Übersetzungen des Kategorienamens (de, en, ...) |
| icon | Icon oder Emoji für die Darstellung (z.B. 🍎) |
| default_sort_position | Standard-Sortierposition (für Kategorie-basierte Vorsortierung ohne Ladendaten) |

### Initiale Kategorien
Die Kategorieliste wird initial basierend auf einer typischen ALDI SÜD Ladenstruktur erstellt. Die AI soll die passenden Kategorien aus öffentlich verfügbaren ALDI-Quellen ableiten. Typische Beispiele:

- Obst & Gemüse
- Brot & Backwaren
- Kühlregal (Milch, Joghurt, Käse, Aufschnitt)
- Fleisch & Wurst (Frischetheke / Kühlregal)
- Tiefkühlprodukte
- Getränke
- Süßwaren & Snacks
- Konserven & Fertiggerichte
- Grundnahrungsmittel (Mehl, Zucker, Reis, Nudeln)
- Haushalt & Reinigung
- Körperpflege & Hygiene
- Baby & Kind
- Tierbedarf
- Specials / Aktionsware

> Diese Liste ist ein Startpunkt. Die AI soll sie bei der Implementierung verfeinern und ggf. ergänzen.

---

## 6b. Kategorie-Alias (CategoryAlias)

Mappt Begriffe, Markennamen und umgangssprachliche Bezeichnungen auf Kategorien. Kernstück der automatischen Kategoriezuordnung (siehe LEARNING-LOGIC.md Abschnitt 5).

| Feld | Beschreibung |
|------|-------------|
| alias_id | Eindeutige ID |
| term_normalized | Normalisierter Suchbegriff (Kleinbuchstaben, ohne Sonderzeichen, z.B. "pink lady", "tempo", "klopapier") |
| category_id | Zugeordnete Kategorie |
| source | Woher die Zuordnung stammt: manual / ai / crowdsourcing |
| confidence | Konfidenz der Zuordnung (1.0 = manuell/sicher, 0.8 = AI, variabel = Crowdsourcing) |
| created_at | Erstellungsdatum |
| updated_at | Letzte Aktualisierung |

### Initiale Befüllung
- Die AI soll die Tabelle initial mit mindestens 500 gängigen Begriffen befüllen
- Bekannte Marken: Pink Lady, Tempo, Nutella, Barilla, Dr. Oetker, Haribo, etc.
- ALDI-Eigenmarken: Milsani, GutBio, Workzone, Kokett, Tandil, Lacura, Mamia, ALDI, etc.
- Umgangssprachliche Begriffe: Spüli, Klopapier, Brötchen, Aufbackbrötchen, Tiefkühlpizza, etc.
- Regionale Begriffe: Semmel (= Brötchen), Quark (= Topfen in AT), etc.

### Wachstum
- Neue Begriffe werden automatisch durch die AI-Zuordnung (Sprachmodell) hinzugefügt
- Admin kann Einträge korrigieren (source wird zu "manual", confidence zu 1.0)
- Crowdsourcing-Vorschläge können Aliase enthalten

---

## 7. Laden (Store)

Eine ALDI SÜD Filiale.

| Feld | Beschreibung |
|------|-------------|
| store_id | Eindeutige ID |
| name | Anzeigename (z.B. "ALDI SÜD Musterstraße 12") |
| address | Vollständige Adresse |
| city | Stadt |
| postal_code | Postleitzahl |
| country | Land (DE / AT im MVP) |
| latitude | GPS-Breitengrad |
| longitude | GPS-Längengrad |
| has_sorting_data | Ob für diesen Laden Gangfolge-Daten vorliegen (true/false) |
| sorting_data_quality | Qualitätsindikator: Anzahl der Einkäufe, die zur Gangfolge beigetragen haben |
| created_at | Erstellungsdatum |
| updated_at | Letzte Aktualisierung |

### Ladendaten-Import (MVP)
- Deutsche und österreichische ALDI SÜD Filialen
- Die AI soll automatisch einen Weg finden, Filialdaten aus dem Internet zu beziehen (ALDI-Website, Google Maps API, OpenStreetMap oder ähnliche öffentlich zugängliche Quellen)
- Fallback: Manueller Import über die Admin-Oberfläche (CSV mit Adresse, Koordinaten)
- Daten werden regelmäßig aktualisiert (neue Filialen, Schließungen)

---

## 8. Einkauf (ShoppingTrip)

Ein abgeschlossener Einkauf. Wird erstellt, wenn das letzte Produkt abgehakt wird.

| Feld | Beschreibung |
|------|-------------|
| trip_id | Eindeutige ID |
| user_id | Zugehöriger Nutzer |
| store_id | Laden, in dem eingekauft wurde (kann null sein) |
| started_at | Zeitpunkt des ersten Abhakens |
| completed_at | Zeitpunkt des letzten Abhakens |
| duration_seconds | Einkaufsdauer in Sekunden (completed_at - started_at) |
| total_items | Anzahl der Produkte |
| estimated_total_price | Geschätzter Gesamtpreis zum Zeitpunkt des Einkaufs |
| sorting_errors_reported | Anzahl gemeldeter Sortierungsfehler während dieses Einkaufs |
| created_at | Erstellungsdatum |

### Aufbewahrung
- Einkaufsdaten werden **unbegrenzt** aufbewahrt
- Daten sind die Basis für den Lernalgorithmus und zukünftige Auswertungen

---

## 9. Einkaufs-Eintrag (TripItem)

Ein einzelnes Produkt innerhalb eines abgeschlossenen Einkaufs (archivierte Kopie des ListItem).

| Feld | Beschreibung |
|------|-------------|
| trip_item_id | Eindeutige ID |
| trip_id | Zugehöriger Einkauf |
| product_id | Verweis auf Produkt (null bei generisch) |
| custom_name | Freitext-Name (bei generisch) |
| display_name | Angezeigter Name |
| quantity | Menge |
| price_at_purchase | Preis zum Zeitpunkt des Einkaufs (wenn bekannt) |
| category_id | Kategorie |
| check_position | In welcher Reihenfolge wurde dieses Produkt abgehakt (1, 2, 3, ...) |
| checked_at | Zeitpunkt des Abhakens |
| was_removed | Wurde das Produkt per Swipe entfernt statt abgehakt (true/false) |

---

## 10. Nutzer-Produktpräferenz (UserProductPreference)

Speichert, wie oft ein Nutzer ein bestimmtes Produkt kauft. Basis für personalisiertes Ranking in der Suche.

| Feld | Beschreibung |
|------|-------------|
| user_id | Nutzer |
| product_id | Produkt (null bei generischen Einträgen) |
| generic_name | Normalisierter generischer Name (bei generischen Einträgen, z.B. "milch") |
| purchase_count | Wie oft dieses Produkt auf der Liste stand |
| last_purchased_at | Wann zuletzt |

### Logik
- Wird nach jedem abgeschlossenen Einkauf aktualisiert
- Sowohl spezifische Produkte (product_id) als auch generische Begriffe (generic_name) werden getrackt
- Dient als Basis für die Sortierung in den Suchergebnissen (F02: Persönliche Favoriten)

---

## 11. Gangfolge-Daten (AisleOrder)

Speichert die gelernte Reihenfolge der Produkte/Kategorien in einem bestimmten Laden.

| Feld | Beschreibung |
|------|-------------|
| store_id | Laden |
| category_id | Kategorie |
| learned_position | Gelernte Position dieser Kategorie im Laden (1 = zuerst, aufsteigend) |
| confidence | Konfidenzwert (0.0 bis 1.0) – wie sicher ist die Position |
| data_points | Anzahl der Einkäufe, die zu dieser Berechnung beigetragen haben |
| last_updated_at | Letzte Aktualisierung |

### Logik
- Wird aus den Abhak-Sequenzen (CheckoffSequence) aggregiert
- Confidence steigt mit mehr Datenpunkten
- Bei niedrigem Confidence: Fallback auf Durchschnitt aller Läden
- Bei keinen Daten: Fallback auf default_sort_position der Kategorie
- Details zum Algorithmus in LEARNING-LOGIC.md

---

## 12. Abhak-Sequenz (CheckoffSequence)

Rohdaten: In welcher Reihenfolge hat ein Nutzer Produkte in einem Laden abgehakt. Kern-Input für den Lernalgorithmus.

| Feld | Beschreibung |
|------|-------------|
| sequence_id | Eindeutige ID |
| trip_id | Zugehöriger Einkauf |
| store_id | Laden |
| user_id | Nutzer |
| is_valid | Ob diese Sequenz für den Lernalgorithmus verwendbar ist (siehe Validierung unten) |
| items | Geordnete Liste der abgehakten Produkte mit Zeitstempel und Kategorie |
| created_at | Erstellungsdatum |

### Validierung
Nicht jede Abhak-Sequenz ist für den Lernalgorithmus brauchbar. Der Algorithmus muss unterscheiden:

- **Valide:** Nutzer hakt Produkte während des Einkaufs ab (zeitliche Abstände zwischen den Abhak-Vorgängen)
- **Invalide:** Nutzer hakt alles nach dem Einkauf in einem Rutsch ab (sehr kurze Abstände, z.B. alle Produkte innerhalb von 30 Sekunden)

Kriterien für Validität:
- Mindestdauer des gesamten Einkaufs (z.B. > 3 Minuten für > 5 Produkte)
- Zeitliche Verteilung: Abstände zwischen Abhak-Vorgängen sollten variieren
- Die AI soll die optimalen Schwellenwerte selbst bestimmen und ggf. dynamisch anpassen

---

## 13. Sortierungs-Fehler (SortingError)

Fehler-Meldungen von Nutzern bezüglich der Gang-Sortierung.

| Feld | Beschreibung |
|------|-------------|
| error_id | Eindeutige ID |
| user_id | Meldender Nutzer |
| store_id | Laden |
| trip_id | Zugehöriger Einkauf (wenn während eines Einkaufs gemeldet) |
| current_sort_order | Die Sortierung zum Zeitpunkt der Meldung (Snapshot) |
| reported_at | Zeitpunkt der Meldung |
| status | open / investigated / resolved |

### Auswertung
- **MVP:** Fehler werden geloggt und sind über den Admin-Bereich einsehbar
- **Später:** Automatische Analyse – wenn viele Fehler für einen Laden gemeldet werden, wird die Gangfolge als unsicher markiert und die Confidence-Werte gesenkt

---

## 14. Aggregierte Gangfolge (AggregatedAisleOrder)

Durchschnittliche Gangfolge über alle Läden hinweg. Dient als Fallback für Läden ohne eigene Daten.

| Feld | Beschreibung |
|------|-------------|
| category_id | Kategorie |
| average_position | Durchschnittliche Position über alle Läden |
| std_deviation | Standardabweichung (wie einheitlich ist die Position über alle Läden) |
| contributing_stores | Anzahl der Läden, die in die Berechnung eingeflossen sind |
| last_calculated_at | Letzte Neuberechnung |

### Logik
- Wird regelmäßig aus allen AisleOrder-Einträgen neu berechnet
- Wird verwendet, wenn ein Laden noch keine eigenen Gangfolge-Daten hat
- Läden mit wenig Datenpunkten bekommen eine Mischung aus eigenen Daten und Durchschnitt (gewichtet nach Confidence)

---

## 15. Datenfluss-Übersicht

```
Nutzer fügt Produkt hinzu
    │
    ▼
ListItem wird erstellt
    │ (generisch: Kategorie wird algorithmisch zugewiesen)
    │ (spezifisch: Kategorie aus Product-DB)
    │
    ▼
Liste wird sortiert
    │ (mit AisleOrder des erkannten Ladens
    │  oder AggregatedAisleOrder als Fallback
    │  oder Category.default_sort_position als Basis-Fallback)
    │
    ▼
Nutzer hakt Produkte ab (im Laden)
    │
    ▼
CheckoffSequence wird gespeichert
    │ (mit Zeitstempeln pro Produkt)
    │
    ▼
Validierung: War der Einkauf "echt"?
    │
    ├── Ja → AisleOrder für diesen Laden aktualisieren
    │         AggregatedAisleOrder neu berechnen
    │
    └── Nein → Sequenz wird ignoriert (is_valid = false)
    
    │
    ▼
ShoppingTrip wird archiviert
    │
    ▼
UserProductPreference wird aktualisiert
```

---

## 16. Datenschutz-Hinweise (für spätere Umsetzung)

- user_id ist im MVP eine anonyme ID ohne personenbezogene Daten
- Bei Registrierung wird E-Mail gespeichert → DSGVO-relevant
- Abhak-Sequenzen enthalten Verhaltens- und Standortdaten → bei Veröffentlichung Einwilligung erforderlich
- Crowdsourced Gangfolge-Daten werden nur aggregiert verwendet, nicht pro Nutzer
- Lösch-Funktion für Nutzerdaten muss vor Veröffentlichung implementiert werden

---

## 17. Foto-Uploads (PhotoUpload) – F13

Jedes hochgeladene Foto wird in dieser Tabelle erfasst und asynchron verarbeitet.

| Feld | Beschreibung |
|------|-------------|
| upload_id | Eindeutige ID |
| user_id | Wer hat das Foto hochgeladen |
| photo_url | URL in Supabase Storage (Bucket: product-photos) |
| photo_type | Automatisch erkannter Typ: product_front / product_back / receipt / flyer / shelf |
| status | uploading / processing / completed / error |
| extracted_data | JSON mit den extrahierten Rohdaten aus der KI-Analyse |
| products_created | Anzahl neu erstellter Produkte (nach Verarbeitung) |
| products_updated | Anzahl aktualisierter Produkte (nach Verarbeitung) |
| error_message | Fehlermeldung (wenn status = error) |
| created_at | Upload-Zeitpunkt |
| processed_at | Verarbeitungszeitpunkt |

### Verarbeitungs-Pipeline
1. Foto wird in Supabase Storage hochgeladen → Status: uploading
2. Serverless Function wird getriggert → Status: processing
3. Claude Vision API analysiert das Foto und extrahiert Daten
4. Bei EAN-Erkennung: Open Food Facts API für Zusatzinfos
5. Produktbild wird freigestellt und als Thumbnail gespeichert
6. Produkte werden in DB geschrieben/aktualisiert → Status: completed
7. Bei Fehler → Status: error mit error_message

### Erweiterung Produkt-Tabelle (Product)

Folgende Felder werden zur bestehenden Produkt-Tabelle (Abschnitt 5) hinzugefügt:

| Feld | Beschreibung |
|------|-------------|
| thumbnail_url | URL des freigestellten Produktbildes in Supabase Storage (150x150px) |
| photo_source_id | Verweis auf photo_uploads.upload_id (welches Foto hat das Produkt erzeugt) |
| nutrition_info | JSON mit Nährwerten (aus Rückseiten-Foto oder Open Food Facts) |
| ingredients | Zutaten als Text |
| allergens | Allergene als Text |

---

## 18. Handzettel (Flyer) – F14

### Handzettel-Tabelle (flyers)

| Feld | Beschreibung |
|------|-------------|
| flyer_id | Eindeutige ID |
| title | Titel/Bezeichnung (z.B. "KW 09 – Angebote ab 24.02.") |
| valid_from | Gültig ab (Datum) |
| valid_until | Gültig bis (Datum) |
| country | Länderkennung: 'DE' oder 'AT' |
| pdf_url | URL der Original-PDF in Supabase Storage |
| total_pages | Anzahl Seiten der PDF |
| status | active / expired (automatisch basierend auf valid_until) |
| created_at | Upload-Zeitpunkt |

### Handzettel-Seiten (flyer_pages)

| Feld | Beschreibung |
|------|-------------|
| page_id | Eindeutige ID |
| flyer_id | Verweis auf flyers.flyer_id |
| page_number | Seitennummer (1, 2, 3, ...) |
| image_url | URL des Seitenbilds als JPEG in Supabase Storage |

### Erweiterung Produkt-Tabelle (Product)

| Feld | Beschreibung |
|------|-------------|
| flyer_id | Verweis auf flyers.flyer_id (aus welchem Handzettel stammt das Produkt) – optional |
| flyer_page | Seitennummer im Handzettel (für Zuordnung Produkt → Seite in der Anzeige) |

### Verknüpfungslogik
- Beim PDF-Import werden Produkte seitenweise analysiert
- Jedes Produkt bekommt flyer_id und flyer_page zugewiesen
- Im Handzettel-Browser werden Produkte über flyer_id + flyer_page der richtigen Seite zugeordnet
- Abgelaufene Handzettel: Produkte bleiben in der DB, Handzettel-Status wechselt auf 'expired'

---

*Letzte Aktualisierung: 2025-02-21*
*Status: Entwurf v3 – F14 Handzettel-Browser ergänzt*

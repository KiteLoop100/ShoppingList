# FEATURES.md – Feature-Spezifikationen

> Dieses Dokument beschreibt alle Features des MVP im Detail.
> Jedes Feature ist aus Nutzersicht beschrieben.
> Für den Gesamtüberblick siehe PRODUCT.md, für den MVP-Scope siehe MVP.md.

---

## F01: Startseite

### Beschreibung
Es gibt nur einen einzigen Hauptscreen. Oben das Suchfeld, darunter die Einkaufsliste. Wenn die Liste leer ist, zeigt der Screen einen Hinweis und den Button "Liste mit typischen Produkten befüllen".

### Verhalten
- Wenn eine **aktive Liste mit Produkten** existiert: Der Hauptscreen zeigt oben das Suchfeld und darunter die Einkaufsliste mit allen Produkten
- Wenn die **Liste leer** ist: Unterhalb des Suchfelds erscheint "Deine Liste ist leer" und der Button "Liste mit typischen Produkten befüllen"
- Wenn ein **Einkauf gerade abgeschlossen** wurde (letztes Produkt abgehakt): Die Liste ist leer, der Button "Liste mit typischen Produkten befüllen" erscheint

### Elemente
- Suchfeld (immer sichtbar, oben fixiert)
- Einkaufsliste (unterhalb des Suchfelds)
- Button "Liste mit typischen Produkten befüllen" (wenn Liste leer)
- Laden-Name oben (tappbar für Ladenauswahl)
- Zugang zu Einstellungen (Zahnrad-Icon oben rechts)

### "Liste mit typischen Produkten befüllen"
- **MVP-Logik:** Alle Produkte, die bei mindestens jedem zweiten Einkauf auf der Liste standen, werden automatisch hinzugefügt
- **Später:** Eigener Algorithmus, der Kaufmuster, Wochentage, Saison und weitere Faktoren berücksichtigt
- Nach dem Befüllen wird die Liste angezeigt. Der Nutzer kann Produkte entfernen oder weitere hinzufügen

---

## F02: Produktsuche & Hinzufügen

### Beschreibung
Das Herzstück der App. Der Nutzer sucht nach Produkten und fügt sie der Einkaufsliste hinzu. Der gesamte Flow ist auf minimale Taps optimiert.

### Suchverhalten
- Das Suchfeld ist immer sichtbar, oben fixiert
- Leeres Suchfeld = keine Vorschläge. Erst wenn der Nutzer tippt, erscheinen Ergebnisse
- Die AI soll die optimale Mindest-Zeichenanzahl für den Suchstart selbst bestimmen und testen – Ziel ist die schnellste wahrgenommene Reaktionszeit bei realistischen Datenmengen (ca. 4.000 aktive Produkte)
- Die Ergebnisse überlagern die Einkaufsliste vollständig (siehe UI.md S1, Suchmodus)

### Suchmodul (Kernspezifikation)

Die Suche ist als **eigenständiges Modul** implementiert mit folgender Schnittstelle:

```
Input:  query (string)       ← der aktuelle Suchbegriff, wird bei jedem Tastendruck aktualisiert
        user_id (string)     ← für personalisiertes Ranking
Output: SearchResult[]       ← 0 bis maximal 20 Ergebnisse, danach abgeschnitten
        Jedes Ergebnis: { product_id, name, category, price, score, source }
```

### Matching-Regeln (was als Treffer gilt)

**Primär-Match: Produktname**
- Der Suchbegriff muss im Produktnamen enthalten sein (Substring-Match)
- "Milch" findet "Milch", "Milsani Fettarme Milch 1,5%", "Milchschokolade"
- "Milch" findet NICHT "Butter", "Gouda", "Joghurt" (auch wenn sie zur gleichen Kategorie gehören)

**Sekundär-Match: Marken-/Eigenmarken-Suche**
- Wenn der Suchbegriff einem Marken- oder Eigenmarkennamen entspricht, werden die beliebtesten Produkte dieser Marke angezeigt
- "Workzone" findet alle Workzone-Produkte, sortiert nach Beliebtheit
- "Nur Nur Natur" findet alle Produkte der Eigenmarke Nur Nur Natur
- "Milsani" findet alle Milsani-Produkte
- "GutBio" findet alle GutBio-Produkte
- Dafür muss im Produktdatenmodell ein Feld "brand" (Marke/Eigenmarke) vorhanden sein
- Die Marken-Suche wird ausgelöst, wenn der Suchbegriff mit einem bekannten Markennamen übereinstimmt

**Tertiär-Match: Kategorienname (nur bei exaktem Kategorie-Match)**
- Wenn der Suchbegriff exakt einem Kategorienamen entspricht, werden alle Produkte dieser Kategorie angezeigt
- "Obst" findet Äpfel, Bananen, Birnen (weil "Obst & Gemüse" eine Kategorie ist)
- "Öl" findet NICHT Äpfel (nur weil Äpfel auch ein "Ö" enthalten)

**Tippfehler-Toleranz**
- Einfache Fuzzy-Suche: maximal 1-2 Buchstaben Abweichung
- "Milh" findet "Milch" (1 Buchstabe fehlt)
- "Milch" findet NICHT "Schokolade" (zu weit entfernt)
- Die Fuzzy-Suche darf nur greifen, wenn der exakte Substring-Match keine oder wenige Ergebnisse liefert

**Groß-/Kleinschreibung** wird ignoriert

### Kommando-Erkennung (Smart Command Field)

Das Suchfeld erkennt neben Produktsuchen auch **Kommandos**. Das Suchmodul prüft bei jeder Eingabe zuerst, ob ein Kommando vorliegt, bevor es die Produktsuche startet.

**MVP-Kommandos (Schlüsselwort-basiert, kein Sprachmodell nötig):**

| Eingabe (Schlüsselphrasen) | Aktion |
|----------------------------|--------|
| "letzter einkauf", "letzten einkauf wiederholen", "last shopping" | Liste der Produkte des letzten Einkaufs anzeigen. Nutzer wählt einzelne Produkte aus. Bestätigungs-Button "X Produkte hinzufügen" und "Abbrechen" |
| "aktionsartikel", "aktionen", "angebote", "specials" | Zeigt alle Aktionsartikel der letzten 30 Tage, sortiert nach Einlistungsdatum (neueste zuerst). Nutzer kann einzelne Produkte antippen, um sie der Liste hinzuzufügen |

**Kommando-Erkennung im MVP:**
- Einfacher String-Match gegen eine Liste bekannter Schlüsselphrasen
- Wird nur ausgelöst, wenn die Eingabe mit einem bekannten Kommando übereinstimmt
- Wenn kein Kommando erkannt wird → normale Produktsuche
- Kommando-Ergebnisse werden visuell anders dargestellt als Produktergebnisse (z.B. als Aktionskarte statt als Produktliste)
- Rückbestätigung vor destruktiven oder umfangreichen Aktionen

### Aktionsartikel – Verfügbarkeitsanzeige

Da ALDI SÜD keine Echtzeit-Bestandsdaten liefert, wird die Verfügbarkeit von Aktionsartikeln anhand des Einlistungsdatums approximiert. Diese Anzeige erscheint bei **jedem Aktionsartikel in jedem Suchergebnis**, nicht nur beim Kommando "Aktionsartikel".

**Verfügbarkeits-Stufen:**

| Zeitraum seit Einlistung | Anzeige | Farbe |
|--------------------------|---------|-------|
| 0–14 Tage | "vermutlich verfügbar" | Grün |
| 15–30 Tage | "Restbestände möglich" | Gelb/Orange |
| > 30 Tage | Produkt erscheint nicht mehr in der Suche (status wird auf inactive gesetzt) | – |

**Logik:**
- Berechnung basiert auf dem Feld `special_start_date` im Produkt-Datenmodell
- Der Verfügbarkeitstext erscheint als kleine Zeile unter dem Produktnamen in den Suchergebnissen
- Auch auf der Einkaufsliste wird der Status dezent angezeigt, damit der Nutzer im Laden weiß, ob ein Aktionsartikel wahrscheinlich noch vorrätig ist
- Dauersortiment (daily_range) bekommt keine Verfügbarkeitsanzeige – es ist immer verfügbar

**Automatische Deaktivierung:**
- Aktionsartikel, deren `special_start_date` mehr als 30 Tage zurückliegt, werden automatisch auf status = inactive gesetzt
- Dies kann als täglicher Job (Supabase Edge Function oder Cron) laufen
- Inaktive Aktionsartikel bleiben in der Datenbank für Einkaufshistorie und Analysen

**Vision: Intelligentes Kommandofeld (nicht MVP)**

In späteren Phasen wird das Suchfeld zum AI-gesteuerten Kommandofeld erweitert. Ein Sprachmodell versteht beliebige natürliche Sprache und setzt sie in Aktionen um. Beispiele:

- "Alle Produkte meines letzten Einkaufs der Liste hinzufügen"
- "Streich alle Milchprodukte von der Liste"
- "Was habe ich letzten Monat für Obst ausgegeben?"
- "Alles für Frühstück hinzufügen" (basierend auf gelernten Frühstücks-Gewohnheiten)
- "Grillparty für 6 Personen" (generiert eine typische Grillparty-Liste)
- "Zeig mir meine häufigsten Produkte"
- Mehrsprachig: Kommandos funktionieren in allen unterstützten Sprachen

Dafür wird ein Sprachmodell (API-Anbindung) benötigt. Die modulare Architektur des Suchfelds erlaubt diese Erweiterung, ohne die Grundstruktur zu ändern. Das Suchmodul bekommt dann eine zusätzliche Schicht:

```
Eingabe → Kommando-Erkennung (Sprachmodell) → Kommando erkannt? 
  → Ja: Aktion ausführen (mit Rückbestätigung)
  → Nein: Normale Produktsuche
```

### Ergebnisreihenfolge (Ranking)

Die maximal 20 Ergebnisse werden in folgender Priorität sortiert:

1. **Persönliche Favoriten:** Produkte, die dieser Nutzer häufig kauft und die zum Suchbegriff passen – sortiert nach persönlichem Kauf-Score
2. **Beliebte Produkte:** Produkte, die von allen Nutzern häufig gekauft werden und die zum Suchbegriff passen – sortiert nach globalem Score
3. **Weitere Treffer:** Alle übrigen passenden Produkte – alphabetisch sortiert
4. **Abschneiden bei 20:** Nach 20 Ergebnissen wird abgeschnitten. Wenn Priorität 1 bereits 20 Ergebnisse liefert, werden 2 und 3 nicht mehr angezeigt

### Suchqualität-Regeln

- **Relevanz über Quantität:** Lieber 5 perfekt passende Ergebnisse als 20 halbwegs passende
- **Kein Category-Bleed:** Ein Suchbegriff darf nicht Produkte aus anderen Kategorien anzeigen, nur weil sie zur gleichen Oberkategorie gehören
- **Suchqualität ist kritisch** – eine schlechte Suche ruiniert die gesamte Nutzererfahrung
- Bei 0 Treffern: Hinweis "Kein Produkt gefunden" + Button "Produkt vorschlagen" (Crowdsourcing)

### Modulare Architektur
- Die Suche ist als eigenständiges Modul mit klar definierter Schnittstelle gebaut
- Im MVP: Lokale Suchimplementierung über die Produktdatenbank
- Später: Die Schnittstelle erlaubt es, externe Suchalgorithmen einzubinden (z.B. Elasticsearch, Algolia) ohne den Rest der App zu ändern
- Das Suchmodul kann unabhängig vom Rest der App getestet und optimiert werden

### Generisches Hinzufügen via Return-Taste
- Der Nutzer kann jederzeit "Return" auf der Tastatur drücken → der eingetippte Begriff wird als **generisches Produkt** sofort zur Liste hinzugefügt
- Das ist der schnellste Weg, ein Produkt hinzuzufügen (Tippen + Return, kein weiterer Tap)
- Für spezifische Produkte tippt der Nutzer stattdessen auf einen Eintrag aus der Ergebnisliste

### Hinzufügen-Flow
```
Nutzer tippt "Mil"
→ Ergebnisliste erscheint auf dem Screen:
  ★ Milsani Fettarme Milch 1,5% 1L   €0,99    ← persönlicher Favorit
  Milsani Frische Vollmilch 3,5% 1L  €1,09    ← aus Datenbank
  Milka Schokolade Alpenmilch 100g    €1,19    ← aus Datenbank
  ...

OPTION A – Generisch (schnellster Weg):
Nutzer tippt "Milch" fertig und drückt Return
→ "Milch" (generisch) wird sofort zur Liste hinzugefügt (Menge: 1)
→ Suchfeld wird geleert, Cursor bleibt im Suchfeld
→ Nutzer kann sofort das nächste Produkt eingeben

OPTION B – Spezifisch:
Nutzer tippt auf "Milsani Fettarme Milch" in der Ergebnisliste
→ Produkt wird sofort zur Liste hinzugefügt (Menge: 1)
→ Suchfeld wird geleert, Cursor bleibt im Suchfeld
→ Nutzer kann sofort das nächste Produkt eingeben
```

### Nach dem Hinzufügen
- Kurze visuelle Bestätigung (z.B. kurzes Highlight oder Animation), dass das Produkt hinzugefügt wurde
- Suchfeld bleibt aktiv und leer → Nutzer kann sofort weitertippen
- Kein Wechsel zur Listenansicht – der Nutzer bleibt im "Hinzufügen-Modus" bis er selbst zur Liste wechselt

### Barcode-Scanner (MVP)
- Neben dem Suchfeld ein Kamera-Icon
- Tap auf das Icon → Handy-Kamera öffnet sich als Barcode-Scanner
- Nutzer scannt den Barcode (EAN) eines Produkts
- App sucht den EAN in der Produktdatenbank (Feld ean_barcode)
- Produkt gefunden → wird sofort der Liste hinzugefügt (wie Tap auf Suchergebnis)
- Produkt nicht gefunden → Hinweis "Produkt nicht in der Datenbank" + Option "Produkt vorschlagen"
- Technische Umsetzung: JavaScript-Bibliothek für Barcode-Scanning (z.B. html5-qrcode oder QuaggaJS). Die AI soll die beste Bibliothek vorschlagen

---

## F03: Einkaufsliste – Ansicht & Verwaltung

### Beschreibung
Die zentrale Listenansicht, die sowohl zu Hause beim Planen als auch im Laden beim Einkaufen verwendet wird.

### Listenansicht
- Produkte werden gruppiert nach Customer Demand Group angezeigt (entspricht der ALDI-internen Kategorisierung und der Regalstruktur im Laden)
- Kategorie-Überschriften zeigen nur den Gruppennamen als Text, kein Icon daneben
- Jede Produktzeile soll kompakt sein – so wenig vertikaler Platz wie möglich, ohne die Schrift zu verkleinern. Ziel: Möglichst viele Produkte auf dem Bildschirm sichtbar
- Jedes Listenelement zeigt:
  - Produktname (generisch oder spezifisch)
  - Menge mit Plus/Minus-Buttons
  - Preis (wenn bekannt, sonst kein Preis angezeigt)
- Kein Kategorie-Icon neben der Überschrift
- Am Ende der Liste: Geschätzte Gesamtsumme (siehe F08: Preisschätzung)

### Sortierung (Zwei Modi mit automatischem Umschalten)

Die Liste hat zwei Sortier-Modi, zwischen denen der Nutzer jederzeit manuell umschalten kann. Zusätzlich wechselt die App automatisch den Modus, wenn sie erkennt, dass der Nutzer im Laden ist.

**Modus 1: "Meine Reihenfolge" (Standard zu Hause)**
- Produkte werden in der Reihenfolge angezeigt, in der sie der Liste hinzugefügt wurden (neueste unten)
- Keine Gruppierung nach Kategorien
- Das ist die Ansicht für zu Hause beim Planen der Einkaufsliste

**Modus 2: "Einkaufsreihenfolge" (Standard im Laden)**
- Produkte werden hierarchisch sortiert nach drei Lernebenen:
  1. **Demand Groups:** Reihenfolge der großen Bereiche im Laden (z.B. Obst → Brot → Kühlung → Tiefkühl)
  2. **Sub-Groups innerhalb einer Demand Group:** Reihenfolge der Untergruppen (z.B. innerhalb Obst: Äpfel → Zitrusfrüchte → Beeren)
  3. **Produkte innerhalb einer Sub-Group:** Reihenfolge einzelner Produkte (z.B. innerhalb Äpfel: Pink Lady → Elstar → Tafeläpfel)
- Jede Ebene hat ihr eigenes Schichten-Modell mit ladenspezifischen Daten, Durchschnitt aller Läden und Standard-Sortierung als Fallback
- Siehe LEARNING-LOGIC.md Abschnitt 2.4 für Details
- Wenn kein Laden ausgewählt ist, wird die Standard-Kategorie-Sortierung einer typischen ALDI-Ladenstruktur verwendet

**Umschalter (UI):**
- Zwei dezente Tabs direkt unter dem Suchfeld: "Meine Reihenfolge" | "Einkaufsreihenfolge"
- Der aktive Tab ist visuell hervorgehoben
- Tap auf einen Tab wechselt sofort die Sortierung
- Die gewählte Sortierung bleibt gespeichert bis der Nutzer sie ändert oder die App automatisch umschaltet

**Automatisches Umschalten:**
- Wenn die App erkennt, dass der Nutzer in einem Laden ist (GPS-basierte Ladenerkennung oder manuelle Ladenauswahl), wechselt die Sortierung automatisch auf "Einkaufsreihenfolge"
- Wenn der Nutzer den Laden verlässt (GPS erkennt, dass der Nutzer nicht mehr in der Nähe einer Filiale ist, oder Einkauf wird abgeschlossen), wechselt die Sortierung automatisch zurück auf "Meine Reihenfolge"
- Der automatische Wechsel kann vom Nutzer überschrieben werden (z.B. wenn er im Laden lieber "Meine Reihenfolge" nutzen möchte, bleibt seine manuelle Wahl aktiv bis zum nächsten Ladenbesuch)
- Beim automatischen Umschalten erscheint eine kurze dezente Benachrichtigung: "Sortierung auf Einkaufsreihenfolge umgestellt" (verschwindet nach 2 Sekunden)

### Interaktionen

**Menge ändern:**
- Plus- und Minus-Buttons sind direkt neben der Menge sichtbar: [ - ] 2 [ + ]
- Tap auf [+] erhöht die Menge um 1, Tap auf [-] verringert um 1
- Kein Popup, kein Picker, kein Zwischenschritt – Änderung passiert sofort
- Nur ganzzahlige Stückzahlen (1, 2, 3, ...)
- Standardmenge beim Hinzufügen: 1
- Menge 0 → Produkt wird von der Liste entfernt (mit Undo)

**Produkt entfernen:**
- Swipe nach links → Produkt wird von der Liste entfernt
- Kurze Undo-Option (z.B. 3 Sekunden "Rückgängig"-Banner am unteren Bildschirmrand)

**Produkt abhaken (im Laden):**
- Jeder Listeneintrag hat links einen Kreis (○) als Abhak-Feld
- Tap auf den Kreis (○) → Häkchen erscheint im Kreis (✓), Produkt wird als abgehakt markiert
- Abgehakte Produkte werden ausgegraut und rutschen ans Ende der Liste (unterhalb aller noch offenen Produkte)
- Die Reihenfolge der abgehakten Produkte untereinander ist chronologisch (zuletzt abgehakt ganz unten)
- Tap auf den Kreis (✓) eines abgehakten Produkts → wird wieder aktiv (Abhaken rückgängig)

**Letztes Produkt abgehakt:**
- Wenn das letzte Produkt abgehakt wird, zeigt die App eine kurze "Einkauf abgeschlossen"-Animation
- Danach: Weiterleitung zur Startseite
- Der abgeschlossene Einkauf wird im Hintergrund archiviert (Datum, Produkte, Laden, Dauer)

---

## F04: Ladenerkennung

### Beschreibung
Die App erkennt automatisch, in welchem ALDI SÜD Laden sich der Nutzer befindet, und passt die Listensortierung entsprechend an.

### Automatische Erkennung (GPS)
- Die App nutzt die GPS-Position des Geräts
- Wenn die Position mit einem bekannten ALDI SÜD Standort übereinstimmt (Radius: ca. 50-100m), wird dieser Laden automatisch ausgewählt
- Anzeige oben in der Liste: "ALDI SÜD [Adresse]" mit Option zum Ändern
- GPS-Berechtigung wird beim ersten Mal vom Nutzer erfragt. Wird sie verweigert, funktioniert die App trotzdem – nur die manuelle Auswahl ist dann nötig

### Manuelle Auswahl
- Button "Laden wechseln" (oder wenn GPS keinen Laden findet)
- Suchliste mit ALDI SÜD Filialen, sortiert nach Entfernung (wenn GPS verfügbar) oder alphabetisch
- Zuletzt besuchte Läden werden oben angezeigt

### Ladendatenbank
- Liste aller ALDI SÜD Filialen mit Adresse und GPS-Koordinaten
- Diese Daten sind öffentlich verfügbar (ALDI Website / Google Maps)
- Die Ladendatenbank muss initial befüllt werden (Scraping oder manueller Import)

### Kein Laden ausgewählt
- Ohne Ladenerkennung bleibt die Kategorie-basierte Vorsortierung aktiv
- Die App funktioniert vollständig – nur die ladenspezifische Gangfolge fehlt

---

## F05: Automatische Gang-Sortierung

### Beschreibung
Das Alleinstellungsmerkmal der App. Die Einkaufsliste wird automatisch so sortiert, dass der Nutzer den Laden nur einmal von Anfang bis Ende durchlaufen muss.

### Sortierlogik (Schichten-Modell)

Der Sortieralgorithmus kombiniert mehrere Informationsquellen, priorisiert von oben nach unten:

**Schicht 1: Ladenspezifische Daten (höchste Priorität)**
- Basiert auf der Abhak-Reihenfolge von Nutzern in diesem spezifischen Laden
- Je mehr Nutzer in einem Laden einkaufen, desto genauer wird die Sortierung
- Siehe LEARNING-LOGIC.md für Details zum Lernalgorithmus

**Schicht 2: Durchschnitt aller Läden (Fallback)**
- Wenn für einen Laden noch keine oder zu wenig Daten vorliegen
- Basiert auf dem Durchschnitt der Sortierreihenfolgen aller bekannten Läden
- Annahme: ALDI-Läden sind untereinander ähnlich aufgebaut

**Schicht 3: Kategorie-Clustering (Basis-Fallback)**
- Wenn überhaupt keine Nutzerdaten vorliegen (z.B. direkt nach dem Launch)
- Produkte werden nach Kategorien gruppiert, die typischerweise im Laden nah beieinander liegen
- Z.B.: Äpfel und Birnen zusammen, Gouda und Streichkäse zusammen, alle Tiefkühlprodukte zusammen
- Die Reihenfolge der Kategorien basiert auf einem generischen ALDI-Ladenlayout

**Schicht 4: Specials**
- Specials (Aktionsware) stehen immer grob an der gleichen Stelle im Laden
- Produkte einer Aktionswoche, die zusammen geliefert wurden, stehen zusammen
- Die Position der Specials-Zone wird wie ein eigener Gang behandelt

### Sortierung auslösen
- Automatisch bei Ladenerkennung (GPS oder manuelle Auswahl)
- Die Sortierung kann sich im Laden von der Sortierung zu Hause unterscheiden (zu Hause: Kategorie-Gruppierung, im Laden: Gangfolge)
- Kein manuelles Sortieren möglich – die App entscheidet

---

## F06: Fehler-Feedback

### Beschreibung
Ein einfacher Mechanismus, mit dem Nutzer dem System signalisieren können, dass die Sortierung nicht stimmt.

### Verhalten
- In der Listenansicht (im Laden) gibt es einen sichtbaren aber nicht aufdringlichen "Fehler melden"-Button
- Tap → Kurze Bestätigung: "Danke – wir verbessern die Sortierung"
- Keine weitere Eingabe vom Nutzer erforderlich – es ist eine pauschale Meldung
- Der Fehler wird mit Kontext gespeichert: Laden, aktuelle Sortierung, Zeitpunkt, Nutzer-ID

### Auswertung
- **MVP:** Fehler werden geloggt und können vom Admin eingesehen werden
- **Später:** Ein Algorithmus untersucht Fehler-Meldungen automatisch, identifiziert Muster und korrigiert die Sortierung

---

## F07: Einkaufsanalyse (Hintergrund)

### Beschreibung
Die App sammelt im Hintergrund Daten über jeden Einkauf. Im MVP werden diese Daten nur gespeichert, nicht angezeigt.

### Gesammelte Daten pro Einkauf
- Anonyme Nutzer-ID
- Datum und Uhrzeit (Start und Ende)
- Erkannter Laden (ID, Adresse)
- Liste der Produkte (Name, Menge, Preis, generisch/spezifisch)
- Abhak-Reihenfolge mit Zeitstempeln (für den Lernalgorithmus)
- Einkaufsdauer (Zeit vom ersten bis zum letzten Abhaken)
- Anzahl gemeldeter Sortierungsfehler

### Zweck
- Training des Lernalgorithmus (Gangfolge)
- Training des Personalisierungs-Algorithmus (häufig gekaufte Produkte)
- Basis für spätere Auswertungsfunktionen (Dashboard, Trends, etc.)

---

## F08: Preisschätzung

### Beschreibung
Die App zeigt eine grobe Schätzung des Gesamtpreises für den Einkauf.

### Verhalten
- Anzeige am Ende der Einkaufsliste
- Format: "Geschätzter Preis: €XX,XX"
- Wenn nicht für alle Produkte ein Preis bekannt ist: "(N Produkte ohne Preis)"
- Generische Einträge haben keinen Preis → werden nicht in die Summe eingerechnet
- Mengen werden berücksichtigt (2x Milch à €0,99 = €1,98)

### Preisquelle
- Preis aus der Produktdatenbank
- Im MVP werden Preise manuell / per Crowdsourcing gepflegt
- Keine Garantie auf Aktualität – Anzeige ist ein Orientierungswert

### Regionale Preisunterschiede
- Im MVP wird ein einheitlicher Preis pro Produkt verwendet
- Später: Preise können regional unterschiedlich sein (siehe PRODUCT.md, Daily Range)

---

## F09: Produktdatenbank & Admin

### Beschreibung
Die Produktdatenbank enthält alle bekannten ALDI SÜD Produkte mit ihren Eigenschaften. Im MVP wird sie über zwei Wege befüllt: Admin-Oberfläche und Crowdsourcing.

### Admin-Oberfläche
- Erreichbar über einen versteckten Zugang in der App (z.B. langes Drücken auf das Logo oder eine spezielle URL wie /admin)
- Geschützt durch ein Admin-Passwort (einfache Lösung, kein vollwertiges User-Management)
- Funktionen:
  - Produkt hinzufügen (Name, Kategorie, Preis, Sortimentstyp, regionale Verfügbarkeit)
  - Produkt bearbeiten
  - Produkt löschen
  - Bulk-Import via CSV
  - Crowdsourcing-Beiträge prüfen und freigeben/ablehnen
  - Fehler-Meldungen einsehen

### Crowdsourcing
- Jeder Nutzer kann über die Produktsuche ein neues Produkt vorschlagen, wenn es nicht gefunden wird
- Flow: Nutzer sucht "XY" → kein Treffer → Button "Produkt vorschlagen"
- Der Nutzer gibt ein: Produktname, Kategorie (aus vordefinierter Liste), Preis (optional)
- Vorgeschlagene Produkte landen in einer Freigabe-Warteschlange für den Admin
- Nach Freigabe sind sie für alle Nutzer sichtbar

### Produktdatenmodell
- Produktname
- Kategorie (algorithmisch zugewiesen – siehe unten)
- Preis (optional, in EUR)
- Sortimentstyp: Daily Range oder Special
- Regionale Verfügbarkeit: National / Regional (im MVP: nur National)
- Aktionszeitraum (nur für Specials): Von-Bis-Datum
- Status: Aktiv / Inaktiv
- Quelle: Admin / Crowdsourcing
- Erstellungsdatum, letzte Aktualisierung

### Automatische Kategoriezuordnung (3-Schichten-Modell)

Die Kategoriezuordnung ist entscheidend für die Sortierung. Jeder eingegebene Begriff – egal ob Produktname, Markenname oder umgangssprachlicher Begriff – muss zuverlässig einer Kategorie zugeordnet werden.

**Schicht 1: Produktdatenbank**
- Produkt existiert in der Datenbank → Kategorie aus der DB lesen
- Beispiel: "Milsani Fettarme Milch 1,5% 1L" → Milchprodukte (aus DB)

**Schicht 2: Alias-Tabelle**
- Eine Datenbank-Tabelle, die Begriffe, Markennamen und umgangssprachliche Bezeichnungen auf Kategorien mappt
- Beispiele:
  - "Pink Lady" → Obst & Gemüse
  - "Tempo" → Haushalt & Reinigung
  - "Nutella" → Brotaufstrich / Süßwaren
  - "Pampers" → Baby & Kind
  - "Kokett" → Haushalt & Reinigung (ALDI-Eigenmarke für Taschentücher)
- Die Alias-Tabelle wird initial möglichst umfangreich erstellt (die AI soll gängige Markennamen, ALDI-Eigenmarken und umgangssprachliche Begriffe abdecken)
- Wächst automatisch durch Schicht 3 (neue Begriffe werden nach AI-Zuordnung gespeichert)
- Kann vom Admin korrigiert werden
- Kann durch Crowdsourcing ergänzt werden

**Schicht 3: AI-basierte Zuordnung (Sprachmodell-Fallback)**
- Wenn Schicht 1 und 2 keinen Treffer liefern, wird ein Sprachmodell (z.B. Claude API) gefragt
- Anfrage: "Zu welcher Supermarkt-Kategorie gehört '[Begriff]'? Antworte nur mit dem Kategorienamen aus folgender Liste: [Kategorieliste]"
- Das Ergebnis wird automatisch in die Alias-Tabelle geschrieben → beim nächsten Mal ist keine API-Anfrage mehr nötig
- API-Kosten: Minimal (wenige Cent pro Anfrage), und sinken über Zeit auf fast null, da die Alias-Tabelle wächst
- Offline-Fallback: Wenn keine Internetverbindung besteht, wird die Fallback-Kategorie "Sonstiges" verwendet

**Gesamter Flow:**
```
Nutzer gibt "Pink Lady" ein
  → Schicht 1: "Pink Lady" in Produktdatenbank? → Nein
  → Schicht 2: "Pink Lady" in Alias-Tabelle? → Ja! → "Obst & Gemüse"
  → Fertig.

Nutzer gibt "Matcha Pulver" ein (zum ersten Mal)
  → Schicht 1: In Produktdatenbank? → Nein
  → Schicht 2: In Alias-Tabelle? → Nein
  → Schicht 3: AI-Anfrage → "Getränke" oder "Grundnahrungsmittel"
  → Ergebnis wird in Alias-Tabelle gespeichert
  → Beim nächsten Mal greift Schicht 2 sofort
```

**Wichtig:**
- Es ist nicht akzeptabel, dass viele Produkte ohne Kategorie bleiben
- Jedes Produkt muss einer Kategorie zugeordnet werden
- Die Fallback-Kategorie "Sonstiges" soll so selten wie möglich verwendet werden
- Auch generische Einträge (z.B. "Milch", "Brot", "Shampoo") müssen sofort korrekt kategorisiert werden

---

## F10: Offline-Modus (VERSCHOBEN – nicht im MVP)

> **Entscheidung:** Offline-Modus wird auf eine spätere Phase verschoben. Der MVP funktioniert rein online. Die vollständige Offline-Spezifikation bleibt in OFFLINE-STRATEGY.md dokumentiert und wird implementiert, sobald alle Online-Funktionen stabil laufen.

### Begründung
- Offline-Modus ist technisch der aufwendigste Teil (Service Workers, IndexedDB, Sync-Logik, Konfliktbehandlung)
- Der MVP soll zuerst beweisen, dass die Kernfunktionen (Suche, Sortierung, Lernen) funktionieren
- Offline-Fähigkeit wird in einer späteren Phase nachgerüstet

---

## F11: Mehrsprachigkeit

### Beschreibung
Die App-Oberfläche ist von Anfang an mehrsprachig angelegt.

### MVP-Sprachen
- Deutsch (Standard)
- Englisch

### Verhalten
- Sprache wird beim ersten Start basierend auf der Gerätesprache automatisch gewählt
- Manuelle Sprachwahl in den Einstellungen
- Alle UI-Texte (Buttons, Labels, Meldungen) sind übersetzt
- Produktnamen werden NICHT übersetzt – sie bleiben wie in der Datenbank hinterlegt (ALDI-Produktnamen sind sprachunabhängig)

### Technisch
- Alle UI-Texte liegen in Sprachdateien (i18n), nicht hart im Code
- Neue Sprachen können durch Hinzufügen einer Sprachdatei ergänzt werden, ohne Code-Änderungen

---

## F12: Einstellungen

### Beschreibung
Minimale Einstellungsseite für die wichtigsten Konfigurationen.

### Einstellungen im MVP
- **Sprache:** Deutsch / Englisch
- **Laden manuell wählen:** Standardladen festlegen (wird verwendet, wenn GPS keinen Laden erkennt)
- **Info/Impressum:** App-Version, Hinweis auf Prototyp-Status

### Nicht im MVP
- Konto-Verwaltung (kommt mit Registrierung in Phase 3)
- Benachrichtigungs-Einstellungen (kommt mit nativer App)
- Theme/Darstellung (nicht geplant)

---

## Feature-Übersicht (Quick Reference)

| ID | Feature | MVP | Beschreibung |
|----|---------|-----|-------------|
| F01 | Startseite | ✅ | Einstieg, Zusammenfassung, "Typische Produkte befüllen" |
| F02 | Produktsuche & Hinzufügen | ✅ | Live-Suche, generisch + spezifisch, personalisiertes Ranking |
| F03 | Einkaufsliste | ✅ | Anzeige, Abhaken, Swipe-Löschen, Mengen ändern |
| F04 | Ladenerkennung | ✅ | GPS-basiert + manuelle Auswahl |
| F05 | Gang-Sortierung | ✅ | Selbstlernend, Schichten-Modell mit Fallbacks |
| F06 | Fehler-Feedback | ✅ | Pauschaler Fehler-Button |
| F07 | Einkaufsanalyse | ✅ | Hintergrund-Datensammlung, kein Dashboard |
| F08 | Preisschätzung | ✅ | Orientierungswert basierend auf bekannten Preisen |
| F09 | Produktdatenbank & Admin | ✅ | Admin-Oberfläche + Crowdsourcing |
| F10 | Offline-Modus | ✅ | Vollständige Nutzung im Laden ohne Internet |
| F11 | Mehrsprachigkeit | ✅ | DE + EN, i18n-ready |
| F12 | Einstellungen | ✅ | Sprache, Standard-Laden |
| F13 | Foto-Produkterfassung | ✅ | MVP – Fotos von Produkten, Kassenzetteln, Handzetteln |
| F14 | Handzettel-Browser | ✅ | MVP – Wöchentliche Handzettel durchblättern, Produkte direkt zur Liste hinzufügen |
| F15 | Geteilte Listen | ❌ | Phase 3 – erfordert Kontomodell |
| F16 | Registrierung / Konto | ❌ | Phase 3 |
| F17 | Auswertungs-Dashboard | ❌ | Phase 2+ |
| F18 | Preisvergleich (LIDL etc.) | ❌ | Phase 5 |
| F19 | Rezept-Import | ❌ | Phase 5 |
| F20 | Sprachassistenten | ❌ | Phase 5 |

---

## F13: Foto-Produkterfassung (MVP)

### Übersicht
Nutzer können Produkte, Kassenzettel, Handzettel und Regalfotos aus dem Laden fotografieren. Die Fotos werden in die Cloud hochgeladen und dort automatisch von einem KI-Modell (Claude API) verarbeitet. Erkannte Produkte, Preise und Barcodes werden automatisch in die Datenbank geschrieben. Produktbilder werden freigestellt und als Thumbnail gespeichert.

### Zugang
- Im MVP gibt es keinen Passwortschutz für die Foto-Erfassung
- Jeder MVP-Nutzer kann Produkte über Fotos hinzufügen
- Erreichbar über einen eigenen Bereich in der App (z.B. Tab "Produkte erfassen" oder Icon in der Navigation)

### Foto-Typen und Erkennung

Die Software erkennt automatisch, um welchen Foto-Typ es sich handelt:

**Typ 1: Produktfoto (Vorderseite)**
- Erkennt: Produktname, Marke, Gewicht/Menge, Variante
- Erstellt freigestelltes Produktbild (Hintergrund entfernt) als Thumbnail
- Versucht Preis zu erkennen (wenn Preisschild sichtbar)

**Typ 2: Produktfoto (Rückseite)**
- Erkennt: EAN/Barcode, Nährwerte, Zutaten, Allergene, Herkunftsland
- Ordnet die Daten dem zuletzt erfassten oder per Barcode identifizierten Produkt zu

**Typ 3: Kassenzettel**
- Erkennt: Liste von Produktnamen und Preisen
- Matching mit bestehenden Produkten in der Datenbank (über Name-Ähnlichkeit)
- Aktualisiert Preise bei bereits vorhandenen Produkten
- Legt neue Produkte an, wenn kein Match gefunden wird (mit Status "pending review")
- Erkennt Datum des Kassenzettels für price_updated_at

**Typ 4: Handzettel / Prospekt-Screenshot**
- Erkennt: Aktionsartikel mit Namen, Preisen, Gültigkeitszeitraum
- Setzt assortment_type = 'special' und special_start_date / special_end_date
- Legt neue Aktionsartikel an oder aktualisiert bestehende

**Typ 5: Regalfoto aus dem Laden**
- Erkennt: Mehrere Produkte gleichzeitig mit Preisschildern
- Erstellt/aktualisiert Produkte mit aktuellem Preis
- Kann auch Demand Group ableiten (z.B. "Kühlregal" → "Frische & Kühlung")

### Workflow

```
Nutzer öffnet Foto-Bereich
  → Kamera-Ansicht oder "Foto aus Galerie wählen"
  → Foto wird aufgenommen / ausgewählt
  → Sofortiger Upload in Supabase Storage (Foto bleibt nicht auf dem Gerät)
  → Nutzer kann sofort nächstes Foto machen (kein Warten)
  → Cloud-Verarbeitung läuft asynchron:
      1. Claude API analysiert das Foto
      2. Typ wird erkannt (Produkt/Kassenzettel/Handzettel/Regal)
      3. Daten werden extrahiert
      4. Internet-Abfrage (Open Food Facts) für Zusatzinfos via EAN
      5. Produktbild wird freigestellt und als Thumbnail gespeichert
      6. Daten werden in Supabase geschrieben
  → Nutzer sieht Status-Feed: "Verarbeitet...", "3 Produkte erkannt", "Preis aktualisiert"
```

### Duplikat-Handling

Wenn ein erkanntes Produkt bereits in der Datenbank existiert:
- **Neue Daten ergänzen fehlende Felder:** z.B. Produkt hat keinen Preis → Preis wird ergänzt
- **Produktbild:** Wenn ein Produktbild bereits existiert, wird der Nutzer gefragt: "Existierendes Produktbild überschreiben? [Ja] [Nein]"
- **Preis:** Neuerer Preis überschreibt älteren automatisch (mit Aktualisierung von price_updated_at)
- **Andere Felder:** Bestehende Daten werden NICHT überschrieben, nur leere Felder werden ergänzt

### Upload von existierenden Fotos

- Neben der Kamera-Funktion gibt es einen "Galerie"-Button
- Nutzer kann mehrere Fotos auf einmal aus der Galerie auswählen
- Alle werden in die Upload-Queue gestellt und nacheinander verarbeitet

### Verarbeitungs-Queue und Status

- Jedes Foto bekommt einen Eintrag in einer Queue-Tabelle
- Status: uploading → processing → completed / error
- Nutzer sieht eine Übersicht der letzten Uploads mit Status
- Bei Fehlern: "Foto konnte nicht verarbeitet werden" mit Option zum erneuten Versuch

### Technische Architektur

**Frontend (App):**
- Kamera-Zugriff via Browser MediaDevices API (gleich wie Barcode-Scanner)
- Upload direkt an Supabase Storage (kein Umweg über Server)
- Status-Polling oder Realtime-Subscription für Verarbeitungsstatus

**Backend (Vercel Serverless Functions oder Supabase Edge Functions):**
- Trigger bei neuem Foto in Storage
- Claude API Call mit dem Bild (Vision-Fähigkeit)
- Prompt enthält Anweisungen zur Extraktion je nach erkanntem Fototyp
- Open Food Facts API Call wenn EAN erkannt wurde
- Bildfreistellung via Background Removal API oder Claude-gesteuerte Crop-Koordinaten
- Schreiben der Ergebnisse in Supabase

**Storage:**
- Original-Fotos: Supabase Storage Bucket "product-photos"
- Thumbnails: Supabase Storage Bucket "product-thumbnails" (150x150px)
- Fotos werden nach erfolgreicher Verarbeitung archiviert (nicht gelöscht, für späteres Re-Processing)

### Datenmodell-Erweiterungen

**Neue Tabelle: photo_uploads**

| Feld | Beschreibung |
|------|-------------|
| upload_id | Eindeutige ID |
| user_id | Wer hat das Foto hochgeladen |
| photo_url | URL in Supabase Storage |
| photo_type | product_front / product_back / receipt / flyer / shelf (automatisch erkannt) |
| status | uploading / processing / completed / error |
| extracted_data | JSON mit den extrahierten Rohdaten |
| products_created | Anzahl neu erstellter Produkte |
| products_updated | Anzahl aktualisierter Produkte |
| error_message | Fehlermeldung (wenn status = error) |
| created_at | Upload-Zeitpunkt |
| processed_at | Verarbeitungszeitpunkt |

**Erweiterung Produkt-Tabelle:**

| Feld | Beschreibung |
|------|-------------|
| thumbnail_url | URL des freigestellten Produktbildes (150x150px) |
| photo_source_id | Verweis auf photo_uploads (welches Foto hat das Produkt erzeugt) |
| nutrition_info | JSON mit Nährwerten (aus Rückseiten-Foto oder Open Food Facts) |
| ingredients | Zutaten als Text |
| allergens | Allergene als Text |

### Kosten

- Claude API: ca. 1-2 Cent pro Foto (Vision-Analyse)
- Supabase Storage: Kostenlos im Free Tier bis 1 GB
- Open Food Facts API: Kostenlos
- Geschätzte Kosten bei 1.000 Fotos: ca. €10-20

### Einschränkungen MVP

- Keine automatische Qualitätsprüfung der Fotos (unscharfe Fotos werden trotzdem verarbeitet, Ergebnis kann unvollständig sein)
- Freistellung des Produktbildes kann bei komplexen Hintergründen ungenau sein
- Kassenzettel-Erkennung funktioniert am besten bei ALDI/Hofer-Kassenzetteln (bekanntes Format)

---

## F14: Handzettel-Browser (MVP)

### Übersicht
Ein eigener Bereich in der App, in dem Nutzer die wöchentlichen ALDI-Handzettel (Prospekte) durchblättern können. Jede PDF-Seite wird als Bild angezeigt. Unter jeder Seite stehen die erkannten Aktionsprodukte als Buttons – ein Tap fügt das Produkt direkt zur Einkaufsliste hinzu.

### Zugang
- Erreichbar über ein Icon in der Navigation (z.B. Prospekt/Handzettel-Symbol)
- Route: /[locale]/flyer
- Kein Passwortschutz

### Datenmodell-Erweiterungen

**Neue Tabelle: flyers**

| Feld | Beschreibung |
|------|-------------|
| flyer_id | Eindeutige ID |
| title | Titel/Bezeichnung (z.B. "KW 09 – Angebote ab 24.02.") |
| valid_from | Gültig ab (Datum) |
| valid_until | Gültig bis (Datum) |
| country | 'DE' oder 'AT' |
| pdf_url | URL der Original-PDF in Supabase Storage |
| total_pages | Anzahl Seiten |
| status | active / expired (automatisch basierend auf valid_until) |
| created_at | Upload-Zeitpunkt |

**Neue Tabelle: flyer_pages**

| Feld | Beschreibung |
|------|-------------|
| page_id | Eindeutige ID |
| flyer_id | Verweis auf flyers |
| page_number | Seitennummer (1, 2, 3, ...) |
| image_url | URL des Seitenbilds in Supabase Storage (JPEG, erzeugt beim PDF-Import) |

**Erweiterung products-Tabelle:**

| Feld | Beschreibung |
|------|-------------|
| flyer_id | Verweis auf flyers (welcher Handzettel) – optional |
| flyer_page | Seitennummer im Handzettel (für Zuordnung Produkt → Seite) |

### PDF-Import-Workflow

Beim Upload einer Handzettel-PDF über die Foto-Erfassung (F13):

```
1. PDF wird in Supabase Storage hochgeladen
2. Neuer Eintrag in flyers-Tabelle (Titel, Datum aus Claude-Analyse der ersten Seite)
3. PDF wird seitenweise aufgeteilt (wie bereits implementiert)
4. Jede Seite wird als JPEG-Bild in Supabase Storage gespeichert
5. Eintrag in flyer_pages pro Seite (mit image_url)
6. Claude analysiert jede Seite und extrahiert Produkte
7. Produkte werden in products-Tabelle geschrieben mit flyer_id und flyer_page
```

### UI: Handzettel-Übersicht (/[locale]/flyer)

```
┌─────────────────────────────────┐
│ ←  Handzettel                    │
│                                   │
│ ┌───────────────────────────────┐ │
│ │ KW 09 – ab 24.02.            │ │
│ │ [Seite 1 als großes Bild]    │ │
│ │                               │ │
│ └───────────────────────────────┘ │
│                                   │
│ ┌───────────────────────────────┐ │
│ │ KW 08 – ab 17.02.            │ │
│ │ [Seite 1 als großes Bild]    │ │
│ │  (ausgegraut wenn abgelaufen) │ │
│ └───────────────────────────────┘ │
│                                   │
│ ...                               │
└─────────────────────────────────┘
```

- Handzettel werden nach Datum sortiert (neuester oben)
- Erste Seite füllt die Kartenbreite aus
- Abgelaufene Handzettel werden ausgegraut aber bleiben sichtbar
- Tap auf einen Handzettel → Detailansicht

### UI: Handzettel-Detailansicht

```
┌─────────────────────────────────┐
│ ← KW 09 – ab 24.02.            │
│   Gültig bis 01.03.             │
│                                   │
│ [Seite 1 als bildschirmbreites   │
│  Bild, Pinch-to-Zoom möglich]   │
│                                   │
│ Produkte auf dieser Seite:       │
│ ┌─────────────────────────────┐  │
│ │ Sitzkissen         1,79€ [+]│  │
│ │ BELAVI                      │  │
│ ├─────────────────────────────┤  │
│ │ Gartenstuhl       29,99€ [+]│  │
│ │ BELAVI                      │  │
│ ├─────────────────────────────┤  │
│ │ Sonnenschirm      14,99€ [+]│  │
│ │ BELAVI                      │  │
│ └─────────────────────────────┘  │
│                                   │
│ [Seite 2 als Bild]              │
│                                   │
│ Produkte auf dieser Seite:       │
│ ┌─────────────────────────────┐  │
│ │ Lachs              3,49€ [+]│  │
│ │ ...                         │  │
│ └─────────────────────────────┘  │
│                                   │
│ ... (alle Seiten scrollen)       │
└─────────────────────────────────┘
```

- Alle Seiten untereinander, vertikales Scrollen
- Jedes Seitenbild ist bildschirmbreit, Pinch-to-Zoom zum Vergrößern
- Unter jedem Seitenbild: Liste der Produkte dieser Seite
- Jedes Produkt hat einen [+] Button der es zur Einkaufsliste hinzufügt
- Nach Tap auf [+]: Kurzes Feedback "Zur Liste hinzugefügt ✓" (Toast-Nachricht)
- Produkte die bereits auf der Einkaufsliste stehen werden mit einem Häkchen markiert statt [+]

### Verbindung zu F13

- Der PDF-Upload läuft weiterhin über die Foto-Erfassung (F13)
- Beim Upload einer PDF wird automatisch erkannt dass es ein Handzettel ist
- Die Seiten-Bilder und Produkt-Seitenzuordnung werden beim Import erstellt
- Der Handzettel-Browser zeigt die importierten Daten nur an

---

## Zukünftige Features (nicht MVP, aber dokumentiert)

Die folgenden Features sind für spätere Versionen vorgesehen. Sie werden hier dokumentiert, damit die Architektur sie berücksichtigen kann.

### Z1: Produkt vermutlich nicht bei ALDI verfügbar
- Wenn der Nutzer ein Produkt eingibt, das es wahrscheinlich nicht bei ALDI gibt (z.B. "Kaviar", "Trüffel", "Dom Pérignon"), zeigt die App einen Hinweis: "Dieses Produkt ist vermutlich bei ALDI SÜD nicht verfügbar"
- Abfrage: "Trotzdem auf die Einkaufsliste setzen? [Ja] [Abbrechen]"
- Die Erkennung kann über eine Negativliste oder ein Sprachmodell erfolgen
- Sinnvoll auch für Produkte, die bei ALDI nicht im typischen Sortiment sind

### Z2: Avatar – Wer hat das Produkt hinzugefügt
- Jedes Produkt auf der Liste zeigt ein kleines Avatar-Icon der Person, die es hinzugefügt hat
- Relevant für das Familien-Feature (geteilte Listen)
- Die Mutter sieht z.B., dass die Haribo-Packung vom Sohn oder Vater auf die Liste gesetzt wurde
- Setzt persönliche Konten und geteilte Listen voraus (Phase 3)

### Z3: Mehrsprachige Produkteingabe
- Nutzer kann Produkte auch in einer anderen Sprache eingeben
- Wenn jemand auf Türkisch "süt" (Milch) eintippt, erkennt die App die Sprache und zeigt die deutschen Milchprodukte an
- Erfordert ein Sprachmodell oder eine mehrsprachige Alias-Tabelle
- Besonders relevant für den deutschen Markt mit vielen mehrsprachigen Kunden

### Z4: Einkaufspreis-Übersicht nach Abschluss
- Nach Abschluss eines Einkaufs (letztes Produkt abgehakt) soll der Warenkorbpreis weiterhin abrufbar sein
- Z.B. als "Letzter Einkauf: €23,40" auf dem Hauptscreen oder in einer Einkaufshistorie-Ansicht

### Z5: Offline-Modus
- Vollständige Offline-Fähigkeit wie in OFFLINE-STRATEGY.md beschrieben
- Service Workers, IndexedDB, Sync-Logik

### Z6: Intelligentes Kommandofeld mit Sprachmodell
- Wie in F02 unter "Vision: Intelligentes Kommandofeld" beschrieben
- Natürliche Sprache für beliebige Befehle

---

*Letzte Aktualisierung: 2025-02-17*
*Status: MVP in Entwicklung*

# LEARNING-LOGIC.md – Lernalgorithmus & Selbstlernende Logik

> Dieses Dokument beschreibt, wie die App aus dem Verhalten der Nutzer lernt.
> Der Lernalgorithmus ist das Alleinstellungsmerkmal der App.
> Für das zugrunde liegende Datenmodell siehe DATA-MODEL.md.
> Dieses Dokument beschreibt die gewünschte Logik – die AI soll die beste technische Umsetzung selbst vorschlagen.

---

## 1. Übersicht: Was lernt die App?

Die App lernt auf drei Ebenen:

| Ebene | Was wird gelernt | Nutzen |
|-------|-----------------|--------|
| **Gangfolge pro Laden** | In welcher Reihenfolge stehen Produktkategorien in einem bestimmten Laden | Liste wird in Laufreihenfolge sortiert |
| **Persönliche Präferenzen** | Welche Produkte kauft ein Nutzer regelmäßig | Suche zeigt relevante Produkte zuerst |
| **Automatische Kategoriezuordnung** | Zu welcher Kategorie gehört ein unbekanntes Produkt | Neue/generische Produkte werden korrekt einsortiert |

---

## 2. Gangfolge-Algorithmus (Kern)

### 2.1 Ziel

Für jeden ALDI SÜD Laden eine Reihenfolge der Produktkategorien berechnen, die dem tatsächlichen Ladenlayout entspricht. Ein Nutzer, der die Liste von oben nach unten abarbeitet, soll den Laden nur einmal durchlaufen müssen.

### 2.2 Informationsquellen (Schichten)

Der Algorithmus kombiniert mehrere Informationsquellen. Die Schichten sind nach Priorität geordnet:

**Schicht 1: Ladenspezifische Abhak-Daten (höchste Priorität)**

- Quelle: Validierte Abhak-Sequenzen (CheckoffSequence) aus diesem Laden
- Logik: Wenn viele Nutzer in Laden X zuerst Obst abhaken, dann Brot, dann Milchprodukte → diese Reihenfolge wird als Gangfolge angenommen
- Confidence steigt mit der Anzahl der Datenpunkte
- Minimum: Ab ~5 validierten Einkäufen können erste sinnvolle Aussagen getroffen werden
- Optimum: Ab ~20 validierten Einkäufen sollte die Sortierung zuverlässig sein

**Schicht 2: Durchschnitt aller Läden (Fallback)**

- Quelle: AggregatedAisleOrder – Durchschnitt der Gangfolgen aller Läden
- Logik: ALDI SÜD Läden sind ähnlich aufgebaut. Wenn 80% aller Läden Obst am Eingang haben, ist das auch für einen unbekannten Laden eine gute Annahme
- Wird verwendet, wenn für einen Laden noch zu wenig eigene Daten vorliegen
- Gewichtung: Je weniger eigene Daten ein Laden hat, desto stärker fließt der Durchschnitt ein

**Schicht 3: Kategorie-Clustering (Basis-Fallback)**

- Quelle: Allgemeinwissen über Produktgruppierungen
- Logik: Auch ohne jegliche Nutzerdaten weiß man, dass Äpfel und Birnen nebeneinander liegen, Käse und Milch nahe beieinander stehen, Tiefkühlprodukte zusammen in einer Truhe liegen
- Wird als initiale Grundsortierung verwendet, bevor es Nutzerdaten gibt
- Basiert auf der default_sort_position der Kategorien

**Schicht 4: Specials-Positionierung**

- Quelle: Annahme + Lernen
- Logik: Specials (Aktionsware) stehen in ALDI-Läden typischerweise in einem bestimmten Bereich (oft Mitte des Ladens)
- Produkte einer Aktionswoche stehen zusammen
- Die Position des Specials-Bereichs wird wie jede andere Kategorie gelernt

### 2.3 Gewichtungs-Modell

```
Für einen bestimmten Laden mit N validierten Einkäufen:

Wenn N = 0:
  → Verwende Kategorie-Clustering (Schicht 3)

Wenn N < Schwellenwert_Minimum (z.B. 5):
  → Gewichtete Mischung:
    70% Durchschnitt aller Läden (Schicht 2)
    30% Eigene Daten (Schicht 1)

Wenn N >= Schwellenwert_Minimum und N < Schwellenwert_Optimal (z.B. 20):
  → Gewichtete Mischung:
    Anteil eigene Daten steigt linear mit N
    Anteil Durchschnitt sinkt entsprechend

Wenn N >= Schwellenwert_Optimal:
  → Primär eigene Daten (Schicht 1)
    Durchschnitt nur noch als Sanity-Check
```

> Die exakten Schwellenwerte und Gewichtungen soll die AI selbst bestimmen, testen und ggf. dynamisch anpassen.

### 2.4 Berechnung der Gangfolge aus Abhak-Sequenzen

Der Algorithmus arbeitet auf **drei hierarchischen Ebenen**. Auf jeder Ebene wird der gleiche paarweise Vergleichsalgorithmus angewandt. Die Ebenen bauen aufeinander auf:

**Ebene 1: Demand Groups** (gröbste Ebene, ~15-20 Gruppen)
- Bestimmt die Reihenfolge der großen Bereiche im Laden
- z.B.: Obst & Gemüse → Brot & Backwaren → Frische & Kühlung → Tiefkühl → ...
- Braucht am wenigsten Daten, da es nur ~15-20 Gruppen gibt
- Ab ~5 Einkäufen sinnvolle Ergebnisse

**Ebene 2: Demand Sub-Groups innerhalb einer Demand Group** (~3-8 Sub-Groups pro Group)
- Bestimmt die Reihenfolge innerhalb eines Bereichs
- z.B. innerhalb "Obst & Gemüse": Äpfel & Birnen → Zitrusfrüchte → Beeren → Salate → Wurzelgemüse
- Braucht mehr Daten als Ebene 1, da pro Demand Group gelernt wird
- Ab ~10-15 Einkäufen sinnvolle Ergebnisse

**Ebene 3: Produkte innerhalb einer Sub-Group** (feinste Ebene)
- Bestimmt die Reihenfolge einzelner Produkte
- z.B. innerhalb "Äpfel & Birnen": Pink Lady → Elstar → Birnen → Tafeläpfel
- Braucht am meisten Daten, da die Kombinationen selten sind (nicht jeder kauft in jedem Einkauf mehrere Produkte aus der gleichen Sub-Group)
- Ab ~20-30 Einkäufen (die beide Produkte enthalten) sinnvolle Ergebnisse

**Jede Ebene hat ihr eigenes Schichten-Modell:**

```
Für jede Ebene (Group / Sub-Group / Produkt):

Schicht 1: Ladenspezifische Daten
  → Paarweise Vergleiche aus Abhak-Sequenzen dieses Ladens

Schicht 2: Durchschnitt aller Läden
  → Fallback wenn zu wenig ladenspezifische Daten

Schicht 3: Standard-Sortierung
  → Ebene 1: Generisches ALDI-Layout
  → Ebene 2: Alphabetisch oder nach Popularität innerhalb der Group
  → Ebene 3: Nach Popularität (popularity_score) innerhalb der Sub-Group

Die Gewichtung zwischen den Schichten erfolgt pro Ebene unabhängig.
Ein Laden kann auf Ebene 1 schon genug Daten haben (→ 90% eigene Daten),
aber auf Ebene 3 noch nicht (→ 70% Durchschnitt, 30% eigene Daten).
```

**Algorithmus pro Ebene (identisch für alle drei):**

1. Für jedes Element-Paar (A, B) auf dieser Ebene zählen: Wie oft kam A vor B, wie oft B vor A?
2. Daraus eine Wahrscheinlichkeit berechnen: P(A vor B) = Anzahl(A vor B) / (Anzahl(A vor B) + Anzahl(B vor A))
3. Diese paarweisen Wahrscheinlichkeiten in eine Gesamtreihenfolge überführen (z.B. mittels einer topologischen Sortierung oder einem Ranking-Algorithmus)
4. Confidence pro Position berechnen: Hohe Übereinstimmung zwischen Sequenzen = hohe Confidence

**Gesamtsortierung der Liste:**

```
1. Sortiere Demand Groups nach gelernter Ebene-1-Reihenfolge
2. Innerhalb jeder Demand Group: Sortiere Sub-Groups nach gelernter Ebene-2-Reihenfolge
3. Innerhalb jeder Sub-Group: Sortiere Produkte nach gelernter Ebene-3-Reihenfolge
```

> Die AI soll den besten Algorithmus für die Gesamtreihenfolge vorschlagen. Möglichkeiten wären z.B. Bradley-Terry-Modell, Elo-Rating, gewichtete topologische Sortierung oder andere Ranking-Verfahren.

### 2.5 Umgang mit widersprüchlichen Daten

Nicht alle Nutzer laufen den Laden in der gleichen Richtung ab. Manche beginnen links, manche rechts.

**Erkennung:**
- Wenn die paarweisen Wahrscheinlichkeiten nahe 50/50 sind, deutet das auf zwei Laufrichtungen hin
- Der Algorithmus soll erkennen, ob es eine dominante Laufrichtung gibt

**Lösung:**
- **MVP:** Die Mehrheitsrichtung wird verwendet
- **Später:** Denkbar wäre, pro Nutzer die bevorzugte Laufrichtung zu lernen und die Sortierung anzupassen

---

## 3. Validierung von Abhak-Sequenzen

### 3.1 Problem

Nicht jede Abhak-Sequenz spiegelt die tatsächliche Laufreihenfolge wider. Nutzer, die alles nach dem Einkauf in einem Rutsch abhaken, liefern keine brauchbaren Daten.

### 3.2 Erkennungsmerkmale

| Merkmal | Echtzeit-Abhaker | Nachträglich-Abhaker |
|---------|------------------|---------------------|
| Zeitliche Abstände | Variierend (30s – 5 min zwischen Produkten) | Sehr kurz (< 3s zwischen Produkten) |
| Gesamtdauer | Realistisch (15 – 60 min für einen Einkauf) | Sehr kurz (< 2 min für alle Produkte) |
| Reihenfolge | Entspricht einer plausiblen Laufreihenfolge | Oft identisch mit der Reihenfolge der Eingabe |
| Muster | Zeitstempel bilden keine gleichmäßigen Abstände | Zeitstempel in gleichmäßigem, schnellem Takt |

### 3.3 Validierungsregeln (MVP-Startpunkt)

Eine Sequenz wird als **valide** markiert, wenn:
- Mindestens 5 Produkte abgehakt wurden
- Die Gesamtdauer (erster bis letzter Abhak-Vorgang) mindestens 3 Minuten beträgt
- Der durchschnittliche Abstand zwischen Abhak-Vorgängen mindestens 15 Sekunden beträgt
- Nicht mehr als 50% der Abstände unter 5 Sekunden liegen

Eine Sequenz wird als **invalide** markiert, wenn:
- Alle Produkte innerhalb von 60 Sekunden abgehakt werden
- Der durchschnittliche Abstand unter 5 Sekunden liegt

**Grauzone:** Sequenzen, die weder klar valide noch klar invalide sind, werden mit einem niedrigeren Gewicht in die Berechnung einbezogen.

> Diese Schwellenwerte sind Startpunkte. Die AI soll sie basierend auf realen Daten optimieren und ggf. ein Machine-Learning-Modell trainieren, das Echtzeit-Abhaker von Nachträglich-Abhakern unterscheidet.

---

## 4. Personalisiertes Produktranking

### 4.1 Ziel

Wenn ein Nutzer nach "Milch" sucht, sollen die Produkte, die er am häufigsten kauft, oben stehen.

### 4.2 Datenquelle

- UserProductPreference (siehe DATA-MODEL.md, Abschnitt 10)
- Enthält: Welches Produkt wie oft gekauft, wann zuletzt

### 4.3 Ranking-Logik

**Score pro Produkt (für einen bestimmten Nutzer):**

```
Score = (Kaufhäufigkeit × Gewicht_Häufigkeit) + (Aktualität × Gewicht_Aktualität)
```

- **Kaufhäufigkeit:** Wie oft wurde das Produkt in den letzten N Einkäufen gekauft (normalisiert)
- **Aktualität:** Wann wurde es zuletzt gekauft (kürzlich = höherer Score)
- **Gewichtung:** Die AI soll die optimale Gewichtung bestimmen

**Beispiel:**
- Nutzer kauft seit 6 Monaten jede Woche "Milsani Fettarme Milch" → hoher Score
- Nutzer hat einmal vor 3 Monaten "Milsani Vollmilch" gekauft → niedriger Score
- Nutzer hat noch nie Milch gekauft → kein persönlicher Score, nur globaler

### 4.4 Globales Ranking (für neue Nutzer)

Wenn ein Nutzer noch keine persönliche Historie hat, wird das globale Ranking verwendet:
- Basiert auf der Kaufhäufigkeit über alle Nutzer
- Wird regelmäßig neu berechnet

### 4.5 Kombination persönlich + global

```
Ergebnisreihenfolge für Suche "Milch":

1. Persönliche Favoriten (sortiert nach persönlichem Score)
2. Global beliebte Produkte (sortiert nach globalem Score, die nicht schon in 1. enthalten sind)
3. Weitere Treffer (alphabetisch)
```

---

## 5. Automatische Kategoriezuordnung

### 5.1 Ziel

Wenn ein Nutzer ein generisches Produkt eingibt (z.B. "Milch"), muss die App wissen, zu welcher Kategorie es gehört, um es korrekt in die Gangfolge einzusortieren.

### 5.2 Logik (3-Schichten-Modell)

```
Nutzer gibt "Pink Lady" ein:

1. Prüfe: Gibt es "Pink Lady" in der Produktdatenbank?
   → Ja: Kategorie aus der Datenbank übernehmen → FERTIG
   → Nein: Weiter zu Schritt 2

2. Prüfe: Gibt es "Pink Lady" in der Alias-Tabelle?
   → Ja: Kategorie aus Alias-Tabelle übernehmen → FERTIG
   → Nein: Weiter zu Schritt 3

3. Prüfe: Hat dieser Nutzer "Pink Lady" schon einmal eingegeben?
   → Ja: Kategorie des vorherigen Eintrags übernehmen → FERTIG
   → Nein: Weiter zu Schritt 4

4. AI-Sprachmodell fragen (wenn online)
   → Anfrage an Claude API: "Zu welcher Supermarkt-Kategorie gehört 'Pink Lady'?"
   → Antwort: "Obst & Gemüse"
   → Ergebnis in Alias-Tabelle speichern (für alle zukünftigen Nutzer)
   → FERTIG

5. Fallback (wenn offline oder AI nicht verfügbar)
   → Kategorie "Sonstiges" zuweisen
   → Bei nächster Online-Verbindung: AI nachfragen und korrigieren
```

### 5.3 Alias-Tabelle

Eine Datenbank-Tabelle, die Begriffe auf Kategorien mappt. Deckt Markennamen, ALDI-Eigenmarken, umgangssprachliche Begriffe und Abkürzungen ab.

**Datenmodell:**

| Feld | Beschreibung |
|------|-------------|
| alias_id | Eindeutige ID |
| term_normalized | Normalisierter Suchbegriff (Kleinbuchstaben, ohne Sonderzeichen) |
| category_id | Zugeordnete Kategorie |
| source | manual / ai / crowdsourcing |
| confidence | Konfidenz der Zuordnung (1.0 für manuelle, 0.8 für AI, variabel für Crowdsourcing) |
| created_at | Erstellungsdatum |
| updated_at | Letzte Aktualisierung |

**Initiale Befüllung:**
- Die AI soll die Alias-Tabelle initial mit mindestens 500 gängigen Begriffen befüllen
- Dazu gehören: Bekannte Marken (Pink Lady, Tempo, Nutella, Barilla...), ALDI-Eigenmarken (Milsani, GutBio, Workzone, Kokett, Tandil, Lacura...), umgangssprachliche Begriffe (Spüli → Haushalt, Klopapier → Haushalt, Brötchen → Backwaren...)
- Die Tabelle wächst automatisch durch AI-Zuordnungen (Schicht 3 im Flow oben)

**Admin-Korrektur:**
- Der Admin kann falsche Zuordnungen in der Alias-Tabelle korrigieren
- Korrigierte Einträge bekommen source = "manual" und confidence = 1.0

### 5.4 AI-Kategoriezuordnung (Sprachmodell)

**API-Aufruf:**
- Modell: Claude (oder vergleichbar)
- Prompt: "Zu welcher Supermarkt-Kategorie gehört '[Begriff]'? Antworte nur mit dem Kategorienamen aus folgender Liste: [kommaseparierte Kategorieliste]. Wenn du unsicher bist, antworte mit 'Sonstiges'."
- Antwort wird geparst und der Alias-Tabelle hinzugefügt

**Kostenmanagement:**
- Jede AI-Zuordnung kostet minimal (wenige Cent)
- Da das Ergebnis in der Alias-Tabelle gespeichert wird, wird die gleiche Anfrage nie zweimal gestellt
- Nach der Aufbauphase (erste Wochen) sinken die API-Kosten auf fast null
- Rate-Limiting: Maximal N AI-Anfragen pro Stunde (die AI soll einen sinnvollen Wert bestimmen)

**Offline-Verhalten:**
- Wenn keine Internetverbindung → Fallback-Kategorie "Sonstiges"
- Der Begriff wird in einer Queue gespeichert
- Bei nächster Online-Verbindung: AI-Anfrage nachholen und Kategorie korrigieren

---

## 6. Typische-Produkte-Algorithmus

### 6.1 Ziel

Nach einem abgeschlossenen Einkauf kann der Nutzer auf "Liste mit typischen Produkten befüllen" tippen. Die App füllt die Liste automatisch mit den Produkten, die der Nutzer regelmäßig kauft.

### 6.2 MVP-Logik (einfach)

```
Für jeden Nutzer:

1. Nimm alle Produkte aus den letzten N Einkäufen (z.B. N = 10)
2. Zähle, wie oft jedes Produkt vorkam
3. Jedes Produkt, das bei mindestens 50% der Einkäufe auf der Liste stand,
   wird als "typisches Produkt" eingestuft
4. Füge alle typischen Produkte zur neuen Liste hinzu
5. Verwende die zuletzt verwendete Menge für jedes Produkt
```

**Sonderfälle:**
- Nutzer hat weniger als 3 Einkäufe → Feature nicht verfügbar (Button ausgeblendet)
- Sowohl generische als auch spezifische Produkte werden berücksichtigt
- Wenn der Nutzer zuletzt das spezifische Produkt gewählt hat, wird das spezifische verwendet

### 6.3 Späterer Algorithmus (intelligent)

Faktoren, die der Algorithmus berücksichtigen könnte:
- **Wochentag:** Manche Produkte werden nur am Wochenende gekauft
- **Saisonalität:** Grillkohle im Sommer, Lebkuchen im Winter
- **Kaufintervall:** Manche Produkte werden wöchentlich gekauft, andere monatlich
- **Zeit seit letztem Kauf:** "Du hast seit 3 Wochen kein Spülmittel gekauft – normalerweise kaufst du es alle 2 Wochen"

> Die AI soll diese Erweiterung so designen, dass sie später modular ergänzt werden kann, ohne die MVP-Logik komplett zu ersetzen.

---

## 7. Lernzyklus (Gesamtprozess)

```
┌─────────────────────────────────────────────────────┐
│                  EINKAUF STARTET                     │
│                                                      │
│  Nutzer öffnet App im Laden                         │
│  → Laden wird erkannt                               │
│  → Gangfolge wird geladen (beste verfügbare Daten)  │
│  → Liste wird sortiert                              │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│                  EINKAUF LÄUFT                       │
│                                                      │
│  Nutzer hakt Produkte ab                            │
│  → Zeitstempel wird pro Produkt gespeichert         │
│  → Optional: Nutzer meldet Sortierungsfehler        │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│               EINKAUF ABGESCHLOSSEN                  │
│                                                      │
│  Letztes Produkt abgehakt                           │
│  → ShoppingTrip wird archiviert                     │
│  → CheckoffSequence wird gespeichert                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│                  VALIDIERUNG                         │
│                                                      │
│  Ist die Abhak-Sequenz brauchbar?                   │
│  → Zeitliche Abstände prüfen                        │
│  → Gesamtdauer prüfen                              │
│  → is_valid = true / false / grauzone               │
└──────────────────┬──────────────────────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
      Valide            Invalide
          │                 │
          ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│ LERNEN          │  │ IGNORIEREN       │
│                 │  │                  │
│ Gangfolge für   │  │ Sequenz wird     │
│ diesen Laden    │  │ nicht für        │
│ aktualisieren   │  │ Gangfolge-       │
│                 │  │ Berechnung       │
│ Aggregierte     │  │ verwendet        │
│ Gangfolge neu   │  │                  │
│ berechnen       │  │ (Einkaufs-       │
│                 │  │  historie wird    │
│ Nutzer-         │  │  trotzdem        │
│ Präferenzen     │  │  gespeichert)    │
│ aktualisieren   │  │                  │
└─────────────────┘  └──────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│            NÄCHSTER EINKAUF PROFITIERT                │
│                                                      │
│  → Gangfolge ist genauer                            │
│  → Persönliche Favoriten sind aktueller             │
│  → Typische-Produkte-Liste ist besser               │
│  → Kategoriezuordnung hat mehr Daten                │
└─────────────────────────────────────────────────────┘
```

---

## 8. Kaltstartproblem

### 8.1 Neuer Laden (keine Daten)

**Tag 1 (keine Nutzerdaten):**
- Sortierung basiert auf Kategorie-Clustering (Schicht 3)
- Obst & Gemüse zuerst (typisch für ALDI-Eingangsbereich)
- Danach: Brot, Kühlregal, Fleisch, Tiefkühl, Trockenprodukte, Getränke, Haushalt, Specials
- Funktioniert nicht perfekt, aber besser als unsortiert

**Woche 1 (~5-10 Einkäufe von verschiedenen Nutzern):**
- Erste eigene Daten fließen ein
- Mischung aus eigenen Daten (30%) und Durchschnitt (70%)
- Bereits spürbare Verbesserung

**Monat 1 (~50+ Einkäufe):**
- Gangfolge ist zuverlässig
- Confidence-Werte sind hoch
- Durchschnitt fließt nur noch minimal ein

### 8.2 Neuer Nutzer (keine persönliche Historie)

- Produktsuche zeigt globales Ranking (beliebte Produkte)
- "Typische Produkte befüllen" ist deaktiviert (braucht mind. 3 Einkäufe)
- Gangfolge basiert auf Laden-Daten (unabhängig vom Nutzer)
- Nach 2-3 Einkäufen: Erste Personalisierung sichtbar

### 8.3 Komplett neue App (kein Nutzer, kein Laden hat Daten)

- Alles basiert auf Kategorie-Clustering
- Die initiale Kategoriereihenfolge muss gut durchdacht sein (einmalige manuelle Arbeit)
- Sobald die ersten Nutzer einkaufen, beginnt der Lernzyklus
- Die App wird von Woche zu Woche besser

---

## 9. Fehler-Feedback und Selbstkorrektur

### 9.1 Fehler-Button (MVP)

- Nutzer meldet pauschal "Sortierung stimmt nicht"
- Gespeichert mit Kontext: Laden, aktuelle Sortierung, Zeitpunkt
- Admin kann Meldungen einsehen

### 9.2 Automatische Analyse (später)

Mögliche Auswertungen:
- **Häufung:** Wenn viele Fehler für einen Laden gemeldet werden → Confidence-Werte senken, mehr auf Durchschnitt zurückfallen
- **Korrelation:** Wenn Fehler häufig nach einer bestimmten Gangfolge-Änderung gemeldet werden → Änderung rückgängig machen
- **Laden-Umbau:** Ein plötzlicher Anstieg von Fehlermeldungen für einen Laden deutet auf einen Umbau hin → Gangfolge-Daten für diesen Laden zurücksetzen und neu lernen

### 9.3 Schutz vor Manipulation

- Ein einzelner Nutzer kann die Gangfolge nicht signifikant beeinflussen (Daten werden über viele Nutzer aggregiert)
- Ausreißer in Abhak-Sequenzen werden statistisch erkannt und heruntergewichtet
- Fehler-Meldungen eines einzelnen Nutzers haben begrenzten Einfluss

---

## 10. Metriken & Erfolgsmessung

Wie wissen wir, ob der Algorithmus gut funktioniert?

| Metrik | Beschreibung | Ziel |
|--------|-------------|------|
| **Sortierungs-Konsistenz** | Wie oft stimmt die vorhergesagte Gangfolge mit der tatsächlichen Abhak-Reihenfolge überein | > 80% nach 20 Einkäufen pro Laden |
| **Fehler-Rate** | Anteil der Einkäufe mit Fehler-Meldung | < 10% nach Aufbauphase |
| **Einkaufsdauer-Trend** | Wird die durchschnittliche Einkaufsdauer über die Zeit kürzer | Rückgang sichtbar |
| **Personalisierungs-Trefferquote** | Wie oft wählt ein Nutzer eines der Top-3 vorgeschlagenen Produkte | > 60% |
| **Typische-Produkte-Akzeptanz** | Wie viele der automatisch vorgeschlagenen Produkte bleiben auf der Liste | > 70% |

> Diese Metriken werden im MVP nur gesammelt und gespeichert. Ein Dashboard zur Auswertung kommt in einer späteren Phase.

---

*Letzte Aktualisierung: 2025-02-16*
*Status: Entwurf v1 – Review durch Produktinhaber ausstehend*

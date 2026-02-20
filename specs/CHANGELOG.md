# CHANGELOG.md – Änderungsprotokoll

> Hier werden alle Änderungen an den Spec-Dateien dokumentiert.
> Format: Datum, was wurde geändert, in welcher Datei, warum.

---

## 2025-02-17 – Zwei Sortier-Modi mit automatischem Umschalten

- **FEATURES.md:** F03 Sortierung komplett überarbeitet: Zwei Modi "Meine Reihenfolge" (Hinzufüge-Reihenfolge, für zu Hause) und "Einkaufsreihenfolge" (Gangfolge nach Demand Groups, für im Laden). Manuelle Umschaltung per Tabs + automatischer Wechsel bei Ladenerkennung
- **UI.md:** Sortier-Tabs im Wireframe ergänzt, Barcode-Icon im Suchfeld

---

## 2025-02-17 – Großes Update: Barcode, Demand Groups, Produktdaten, Zukunfts-Features

- **DATA-MODEL.md:** Neue Felder im Produkt-Datenmodell: article_number, ean_barcode, demand_group, demand_sub_group, popularity_score. Source um "import" erweitert
- **FEATURES.md:** F02 Barcode-Scanner als MVP-Feature ergänzt (Kamera-Icon neben Suchfeld, EAN-Scan, Produkt hinzufügen)
- **FEATURES.md:** F03 Listenansicht: Gruppierung nach Customer Demand Groups statt generischer Kategorien. Kategorie-Icons entfernt. Produktzeilen kompakter
- **FEATURES.md:** F03 Sortierung: Lernalgorithmus bezieht sich auf Demand Groups/Sub-Groups statt einzelner Produkte
- **FEATURES.md:** Neue Sektion "Zukünftige Features" mit Z1-Z6: Nicht-ALDI-Erkennung, Avatar, Mehrsprachige Eingabe, Preisübersicht nach Einkauf, Offline-Modus, Intelligentes Kommandofeld

---

## 2025-02-17 – Offline-Modus aus MVP verschoben

- **FEATURES.md:** F10 als "VERSCHOBEN – nicht im MVP" markiert. Spezifikation bleibt in OFFLINE-STRATEGY.md erhalten
- **MVP.md:** Offline-Fähigkeit aus MVP-Scope entfernt. MVP funktioniert rein online. Produktanzahl von 2.000 auf 4.000 korrigiert. Erfolgskriterium "Offline" ersetzt durch "Aktionsartikel-Verfügbarkeitsanzeige"

---

## 2025-02-17 – Aktionsartikel-Suche & Verfügbarkeitsanzeige

- **FEATURES.md:** Neues Kommando "aktionsartikel" im Suchfeld: Zeigt alle Aktionsartikel der letzten 30 Tage, sortiert nach Einlistungsdatum
- **FEATURES.md:** Verfügbarkeitsanzeige für Aktionsartikel: Grün "vermutlich verfügbar" (0-14 Tage), Gelb "Restbestände möglich" (15-30 Tage), nach 30 Tagen automatisch inaktiv. Erscheint in Suchergebnissen UND auf der Einkaufsliste
- **FEATURES.md:** Kommando "letzter einkauf" präzisiert: Produktauswahl-Liste statt Ja/Nein-Dialog

---

## 2025-02-17 – Produktvolumen & Status-Logik präzisiert

- **DATA-MODEL.md:** Sortimentsstruktur dokumentiert: ~3.500 Dauersortiment, ~6.000 neue Aktionsartikel/Jahr, ~4.000 aktive Produkte zu jedem Zeitpunkt. Status-Logik (active/inactive) und Suchbarkeit spezifiziert: Suche nur über aktive Produkte, historische bleiben in DB
- **FEATURES.md:** Produktanzahl in Suchmodul von 2.000 auf 4.000 aktive Produkte korrigiert
- **OFFLINE-STRATEGY.md:** Cache-Größe von ~1 MB auf ~2 MB angepasst (4.000 statt 2.000 Produkte)

---

## 2025-02-17 – Intelligente Kategoriezuordnung (3-Schichten-Modell)

- **FEATURES.md:** F09 Automatische Kategoriezuordnung komplett überarbeitet: 3-Schichten-Modell (Produktdatenbank → Alias-Tabelle → AI-Sprachmodell). Löst das Problem mit Markennamen wie "Pink Lady" oder "Tempo"
- **DATA-MODEL.md:** Neues Datenobjekt 6b "CategoryAlias" – Alias-Tabelle mit mind. 500 initialen Einträgen für Marken, Eigenmarken und umgangssprachliche Begriffe
- **LEARNING-LOGIC.md:** Abschnitt 5 komplett überarbeitet: 4-Schritte-Flow (DB → Alias → Nutzerhistorie → AI), Alias-Tabelle Datenmodell, AI-API-Aufruf Spezifikation, Kostenmanagement, Offline-Fallback

---

## 2025-02-17 – Eigenmarken-Suche & Kommandofeld

- **FEATURES.md:** F02 Marken-/Eigenmarken-Suche ergänzt: Suche nach "Workzone", "Milsani" etc. zeigt beliebteste Produkte der Marke
- **FEATURES.md:** F02 Kommando-Erkennung (Smart Command Field) ergänzt: MVP-Kommando "letzter Einkauf" mit Rückbestätigung
- **FEATURES.md:** F02 Vision für AI-gesteuertes Kommandofeld mit natürlicher Sprache dokumentiert
- **DATA-MODEL.md:** Feld "brand" (Marke/Eigenmarke) zum Produkt-Datenmodell hinzugefügt

---

## 2025-02-17 – Suchmodul-Spezifikation erweitert

- **FEATURES.md:** F02 Suchmodul komplett überarbeitet: Klare Matching-Regeln (Produktname-Substring statt breite Kategorie-Suche), Kein Category-Bleed, Fuzzy-Suche nur bei wenigen Treffern, Maximum 20 Ergebnisse, Leeres Suchfeld = keine Vorschläge, Modulare Schnittstelle detailliert beschrieben

---

## 2025-02-17 – UI-Vereinfachung & Interaktions-Update

- **UI.md:** Startseite und Liste zu einem einzigen Hauptscreen zusammengelegt. Keine separate Startseite mehr – Suchfeld und Liste sind immer auf dem gleichen Screen
- **UI.md:** Suchergebnisse überlagern die Einkaufsliste jetzt vollständig (statt teilweise darüber zu liegen)
- **UI.md:** Mengenänderung über direkt sichtbare Plus/Minus-Buttons (kein Popup mehr)
- **UI.md:** Abhak-Feld als Kreis (○/✓) links neben jedem Produkt
- **UI.md:** Screen-Nummerierung aktualisiert (S1=Hauptscreen, S2=Ladenauswahl, S3=Einstellungen, S4=Admin)
- **FEATURES.md:** F01 angepasst an Ein-Screen-Konzept
- **FEATURES.md:** F03 Mengenänderung und Abhaken aktualisiert
- **FEATURES.md:** F09 Kategoriezuordnung verstärkt – jedes Produkt muss eine Kategorie bekommen, auch generische Einträge

---

## 2025-02-16 – Initiale Erstellung

- **Alle Dateien:** Erstmalige Erstellung aller Spec-Dokumente
  - PRODUCT.md – Produktvision, Zielgruppe, Designprinzipien, Phasenplan
  - MVP.md – MVP-Scope, Nutzerflow, Erfolgskriterien
  - FEATURES.md – 12 MVP-Features detailliert beschrieben (F01–F12)
  - UI.md – 5 Screens, Interaktionsmuster, Design-Sprache
  - DATA-MODEL.md – 14 Datenobjekte, Datenfluss, Duplikaterkennung
  - OFFLINE-STRATEGY.md – Caching, Sync, Offline-Queue, Konfliktbehandlung
  - LEARNING-LOGIC.md – Gangfolge-Algorithmus, Validierung, Personalisierung
  - ARCHITECTURE.md – Tech-Stack, System-Architektur, modulare Schnittstellen

---

<!-- Vorlage für neue Einträge:

## YYYY-MM-DD – Kurzbeschreibung

- **DATEINAME.md:** Was wurde geändert und warum

-->

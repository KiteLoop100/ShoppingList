# PRODUCT.md – Smart Shopping List for ALDI SÜD

## 1. Produktvision

Eine intelligente Einkaufslisten-App, die den gesamten Einkaufsprozess bei ALDI SÜD – von der Planung bis zum letzten Produkt im Wagen – so schnell und reibungslos wie möglich macht.

Die App sortiert die Einkaufsliste automatisch in der Reihenfolge der Produkte im jeweiligen Laden, unterstützt sowohl generische Einträge ("Milch") als auch spezifische ALDI-Produkte ("Milsani Frische Fettarme Milch 1,5% 1L"), und lernt mit jeder Nutzung dazu – ohne manuelle Datenpflege.

---

## 2. Projekthintergrund

- **Initiator:** Privates Projekt eines ALDI SÜD Mitarbeiters
- **Ziel:** Funktionsfähigen Prototyp bauen, der intern bei ALDI SÜD präsentiert werden kann
- **Status:** Stand-alone – keine Abhängigkeit von ALDI-IT-Infrastruktur
- **Perspektive:** Bei Erfolg potenzielle Überführung in die offizielle ALDI-App (ggf. Neuentwicklung mit ALDI-Ressourcen)
- **Ressourcen:** Privates Budget, keine Firmen-Ressourcen
- **Geschäftsmodell:** Keins erforderlich – dies ist ein Prototyp/Showcase

---

## 3. Zielgruppe

- **Primär:** ALDI SÜD Kunden in Deutschland
- **Sekundär:** ALDI SÜD Kunden weltweit (Australien, UK, USA, etc.)
- **Nutzungsszenario:** Familien und Einzelpersonen, die regelmäßig bei ALDI einkaufen und ihren Einkauf effizient planen wollen
- **Technische Reichweite:** Die App muss auf allen gängigen Smartphones funktionieren (iOS + Android), zunächst als Webapp (PWA)

---

## 4. Das Problem

Der Einkauf bei ALDI besteht aus zwei Phasen, die beide unnötig aufwändig sind:

### Phase 1: Planung
- Man notiert, was man braucht, und fragt die Familie
- Bestehende Lösungen (Zettel, Notiz-Apps, To-Do-Apps) sind nicht für Einkäufe optimiert
- Man weiß nicht, ob ein bestimmtes Produkt bei ALDI verfügbar ist
- Man hat keinen Überblick über den voraussichtlichen Preis

### Phase 2: Im Laden
- Die Liste ist nicht in der Reihenfolge des Ladens sortiert → man läuft kreuz und quer
- Man vergisst Produkte oder übersieht Einträge
- Der Einkauf dauert länger als nötig

### Zusammenfassung
Kein bestehendes Tool kombiniert: intelligente Produktsuche, ladenspezifische Sortierung, Familienfreundlichkeit und selbstlernendes Verhalten.

---

## 5. Designprinzipien

### 5.1 Minimal Clicks
Jede häufige Aktion ist in maximal 2 Taps erreichbar. Die App ist für schnelles, flüssiges Arbeiten optimiert – nicht für Feature-Reichtum.

### 5.2 Offline First
Die App muss im Laden auch ohne Internetverbindung voll funktionsfähig sein. Alle Daten, die im Laden benötigt werden (Liste, Produktkatalog, Sortierinformationen), sind lokal auf dem Gerät verfügbar.

### 5.3 Selbstlernend
Das System lernt aus dem Verhalten aller Nutzer und benötigt so wenig manuelle Datenpflege wie möglich. Es wird besser, je mehr es genutzt wird.

### 5.4 Modular
Die Architektur erlaubt eigenständigen Betrieb oder spätere Integration in bestehende Apps. Komponenten (Produktdatenbank, Sortieralgorithmus, Sync-Logik) sind unabhängig voneinander austauschbar.

### 5.5 Mehrsprachig von Anfang an
Die App ist von Beginn an für Mehrsprachigkeit ausgelegt (i18n). Startsprachen: Deutsch und Englisch. Weitere Sprachen können einfach hinzugefügt werden.

---

## 6. Kernfunktionen (Übersicht)

> Detaillierte Feature-Beschreibungen stehen in FEATURES.md.
> MVP-Abgrenzung steht in MVP.md.

### 6.1 Intelligente Produkteingabe
- Nutzer tippt einen Begriff ein (z.B. "Milch")
- Sofortige Autovervollständigung mit zwei Optionen:
  - **Generisch:** "Milch" direkt zur Liste hinzufügen (ein Tap)
  - **Spezifisch:** Aus einer Liste tatsächlich bei ALDI SÜD verfügbarer Produkte auswählen
- Häufig gekaufte Produkte des Nutzers erscheinen oben (personalisiertes Ranking)
- Nach dem Hinzufügen: Menge direkt änderbar oder sofort nächstes Produkt eingeben

### 6.2 Automatische Gang-Sortierung
- Die App erkennt automatisch (GPS) oder manuell, in welchem Laden man ist
- Die Einkaufsliste wird in der Reihenfolge der Produkte im Laden sortiert
- Der Sortieralgorithmus ist selbstlernend (siehe LEARNING-LOGIC.md)
- Vorsortierung nach Produktkategorien bereits bei der Eingabe (auch ohne Ladenerkennung)

### 6.3 Effizientes Abhaken im Laden
- Produkte werden per Tap abgehakt
- Abgehakte Produkte werden ausgegraut und rutschen ans Ende der Liste
- Produkte können per Swipe von der Liste entfernt werden

### 6.4 Familienfreundliche Listen (erfordert Konto)
- Mehrere Familienmitglieder können die gleiche Liste bearbeiten
- Änderungen werden in Echtzeit synchronisiert (wenn online)
- Offline-Änderungen werden bei nächster Verbindung zusammengeführt

### 6.5 Preisschätzung
- Die App berechnet oder schätzt den Gesamtpreis des Warenkorbs beim Erstellen
- Basiert auf bekannten Produktpreisen aus der Datenbank
- Generische Einträge ohne Preiszuordnung werden als "Preis unbekannt" markiert

### 6.6 Einkaufsanalyse (Hintergrund)
- Alle Einkäufe werden mit Datum, Produkten, Laden, Preisen gespeichert
- Messung der Einkaufsdauer (GPS-basiert oder vom ersten bis zum letzten Abhaken)
- Daten stehen für spätere Auswertungen zur Verfügung

### 6.7 Fehler-Feedback
- Einfacher "Fehler"-Button, um dem Algorithmus mitzuteilen, dass die Sortierung nicht stimmt
- Hilft dem Lernalgorithmus, schneller korrekte Gangfolgen zu ermitteln

---

## 7. Kontomodell

### 7.1 Grundprinzip: Anonymous-First
Beim ersten Öffnen der App wird automatisch ein anonymes Konto (generische ID) im Hintergrund erstellt. Der Nutzer merkt davon nichts. Alle Daten – Einkaufshistorie, Präferenzen, Lernfortschritt – werden von Anfang an mit dieser anonymen ID in der Cloud gespeichert.

### 7.2 Ohne Registrierung
- Volle Einzelnutzung möglich
- Alle Daten werden über die anonyme ID in der Cloud gespeichert
- Bei Geräteverlust kann der Nutzer nicht mehr auf die Daten zugreifen (die anonyme ID ist an das Gerät gebunden)

### 7.3 Mit Registrierung
- Der Nutzer kann jederzeit ein persönliches Konto anlegen (E-Mail / Passwort)
- Das bestehende anonyme Konto wird dabei mit den Zugangsdaten verknüpft – **keine Daten gehen verloren**
- Nach Geräteverlust mit Zugangsdaten wiederherstellbar
- Voraussetzung für Familien-Features (geteilte Listen)

---

## 8. Produktdatenbank & Sortiment

### 8.1 Datenquellen
- **Phase 1 (MVP):** Manuelle Eingabe über eine Admin-Oberfläche in der App + Crowdsourcing durch Nutzer
- **Phase 2:** Upload einer Produktdatenbank (CSV/JSON) oder API-Anbindung
- **Admin-Modus** wird eingestellt, sobald eine offizielle Datenquelle angebunden ist

### 8.2 Sortimentstypen

**Daily Range (Dauerhaftes Sortiment)**
- Produkte, die ganzjährig verfügbar sind
- Preise können sich in unterschiedlichen Intervallen ändern
- Teilweise national, teilweise nur regional verfügbar
- Preise können regional variieren

**Specials (Aktionsware)**
- Werden einmal geliefert und abverkauft
- Stehen im Laden immer ungefähr an der gleichen Stelle
- Produkte, die am gleichen Termin geliefert wurden, stehen zusammen
- Aktionsinformationen können von ALDI-Websites entnommen werden (Scraping der Werbung)
- Höherer Pflegeaufwand, da Verfügbarkeit zeitlich begrenzt

---

## 9. Phasenplan (Übersicht)

> Details in MVP.md

| Phase | Schwerpunkt |
|-------|------------|
| **Phase 1: MVP** | Webapp (PWA), Einzelnutzung, generische + spezifische Produkte, Offline-Fähigkeit, Kategoriebasierte Vorsortierung, manuelle Produktpflege + Crowdsourcing |
| **Phase 2: Intelligenz** | Selbstlernende Gangsortierung, personalisiertes Produktranking, Preisschätzung, Einkaufsanalyse |
| **Phase 3: Familien-Features** | Geteilte Listen, Echtzeit-Sync, Kontomodell |
| **Phase 4: Native Apps** | PWA als iOS/Android-App via Capacitor |
| **Phase 5: Erweiterungen** | Mehrere Ladenketten (LIDL etc.), Preisvergleich, Alexa/Chefkoch-Integration, API-Anbindung Produktdatenbank |

---

## 10. Langfristige Vision

### 10.1 Preisvergleich über Ladenketten hinweg
Ein Matching-Algorithmus vergleicht den Einkaufszettel mit dem Sortiment konkurrierender Ketten (z.B. LIDL). Der Nutzer sieht: "Dein Einkauf kostet bei ALDI €47,30 – die äquivalenten Produkte bei LIDL kosten €49,10 (+3,8%)." Dies erfordert eine Produktdatenbank für jede Kette und einen Algorithmus, der äquivalente Produkte matcht.

### 10.2 Externe Integrationen
- **Rezept-Import:** Zutatenlisten aus Apps wie Chefkoch direkt auf die Einkaufsliste übernehmen
- **Sprachassistenten:** "Alexa, setz Milch auf meine ALDI-Liste"
- **Smart-Home:** Verknüpfung mit Kühlschrank-Sensoren o.ä.

### 10.3 Überführung in offizielle ALDI-App
Bei erfolgreichem Prototyp kann das Konzept und/oder die Architektur in die offizielle ALDI-App überführt werden – ggf. als Neuentwicklung mit ALDI-Ressourcen und -Infrastruktur.

---

## 11. Design & Markensprache

- Die App verwendet die **ALDI SÜD Design-Sprache** (Farben, Typografie, Logo-Stil) – abgeleitet von öffentlich verfügbaren Quellen (Website, App)
- Die **Usability** orientiert sich nicht an der bestehenden ALDI-App, sondern an den besten Consumer-Apps im Markt (z.B. hinsichtlich Flüssigkeit, Gestik-Bedienung, Animation)
- Ziel: ALDI-Look, aber Best-in-Class-Bedienung

---

## 12. Datenschutz

- Datenschutz wird von Anfang an **mitgedacht**, ist aber beim MVP nicht die höchste Priorität
- Nutzungsdaten (Einkaufshistorie, Abhak-Reihenfolgen) werden für den Lernalgorithmus verwendet
- Crowdsourced Sortierungsdaten werden anonymisiert aggregiert
- Bei späterer Veröffentlichung: DSGVO-Konformität erforderlich
- Keine Weitergabe von Nutzerdaten an Dritte

---

## 13. Nicht-funktionale Anforderungen

- **Performance:** Flüssige Bedienung auch mit 2000+ Produkten in der Datenbank
- **Offline-Fähigkeit:** Vollständige Nutzbarkeit im Laden ohne Internetverbindung
- **Geräte-Kompatibilität:** Funktioniert auf allen gängigen Smartphones (iOS Safari, Android Chrome)
- **Skalierbarkeit:** Architektur soll von einem Nutzer bis zu mehreren tausend Nutzern skalieren
- **Ladezeit:** App öffnet in unter 2 Sekunden, auch bei erster Nutzung
- **Barrierefreiheit:** Grundlegende Accessibility (Schriftgrößen, Kontraste) von Anfang an

---

*Letzte Aktualisierung: 2025-02-16*
*Status: Entwurf v1 – Review durch Produktinhaber ausstehend*

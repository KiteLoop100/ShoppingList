# OFFLINE-STRATEGY.md – Offline-Strategie

> Dieses Dokument beschreibt, wie die App ohne Internetverbindung funktioniert.
> Offline-Fähigkeit ist ein Kernprinzip der App (siehe PRODUCT.md, Designprinzip 5.2).
> Das typische Szenario: Der Nutzer plant zu Hause (online), geht in den Laden (möglicherweise offline) und kauft ein.

---

## 1. Grundprinzip

Die App speichert alle Daten, die im Laden benötigt werden, **lokal auf dem Gerät**. Der Nutzer merkt im Idealfall keinen Unterschied zwischen Online- und Offline-Nutzung. Synchronisation mit der Cloud passiert automatisch im Hintergrund, sobald eine Verbindung besteht.

---

## 2. Was muss offline funktionieren?

### Vollständig offline verfügbar (keine Einschränkungen)

| Funktion | Offline-Verhalten |
|----------|------------------|
| Einkaufsliste anzeigen | Aus lokalem Speicher |
| Produkte abhaken | Lokal gespeichert, später synchronisiert |
| Abhaken rückgängig machen | Lokal |
| Produkte per Swipe entfernen | Lokal gespeichert, später synchronisiert |
| Mengen ändern | Lokal gespeichert, später synchronisiert |
| Sortierung anzeigen | Basierend auf zuletzt synchronisierten Gangfolge-Daten |
| Fehler-Button | Meldung wird lokal gespeichert, später synchronisiert |
| Preisschätzung | Basierend auf lokal gecachten Preisen |
| Einkauf abschließen | Lokal archiviert, später synchronisiert |

### Eingeschränkt offline verfügbar (mit Fallback)

| Funktion | Online-Verhalten | Offline-Fallback |
|----------|-----------------|-----------------|
| Produktsuche | Suche über vollständige Cloud-Datenbank | Suche über lokal gecachten Produktkatalog (letzter Stand) |
| Ladenerkennung (GPS) | GPS funktioniert immer (braucht kein Internet), Laden wird aus lokaler Ladendatenbank zugeordnet | Funktioniert auch offline, da die Ladendatenbank lokal gecacht ist |
| Autovervollständigung | Vollständiger Produktkatalog | Gecachter Produktkatalog |

### Nicht offline verfügbar

| Funktion | Warum nicht |
|----------|------------|
| Neues Produkt vorschlagen (Crowdsourcing) | Muss in Cloud geschrieben werden, Eingabe wird lokal zwischengespeichert und bei Verbindung gesendet |
| Admin-Funktionen (Bulk-Import, Freigaben) | Benötigt Cloud-Zugriff |
| Daten anderer Nutzer empfangen (z.B. neue Gangfolge-Daten) | Erfordert Sync |

---

## 3. Lokaler Speicher – Was wird gecacht?

### 3.1 Beim ersten App-Start (initialer Download)

Beim allerersten Öffnen der App (online erforderlich) werden folgende Daten heruntergeladen und lokal gespeichert:

| Daten | Ungefähre Größe | Beschreibung |
|-------|-----------------|-------------|
| Produktkatalog | ~1-2 MB | Alle aktiven Produkte (~4.000 Stück: Name, Kategorie, Preis, Brand, Typ). Nur aktive Produkte, keine historischen |
| Kategorien | < 10 KB | Alle Kategorien mit Icons und Standard-Sortierung |
| Ladendatenbank (DE + AT) | ~200 KB | Alle ALDI SÜD Filialen mit Adresse und GPS-Koordinaten |
| Aggregierte Gangfolge | < 50 KB | Durchschnittliche Gangfolgen (Fallback) |
| UI-Texte (i18n) | < 50 KB | Alle Übersetzungen |

> Geschätzte Gesamtgröße initialer Cache: unter 2 MB. Für den Nutzer kaum spürbar.

### 3.2 Laufende Updates (bei jeder Online-Verbindung)

Im Hintergrund, ohne Nutzerinteraktion:

| Daten | Update-Häufigkeit | Methode |
|-------|-------------------|---------|
| Produktkatalog | Bei jedem App-Start (wenn online) | Delta-Sync: nur Änderungen seit letztem Sync |
| Preise | Bei jedem App-Start (wenn online) | Delta-Sync |
| Ladendatenbank | Wöchentlich | Delta-Sync |
| Gangfolge des Standard-Ladens | Bei jedem App-Start | Vollständiger Download (klein) |
| Gangfolge des erkannten Ladens | Bei Ladenerkennung | Vollständiger Download (klein) |
| Aggregierte Gangfolge | Täglich | Vollständiger Download (klein) |
| Nutzer-Produktpräferenzen | Nach jedem Einkauf | Bidirektionaler Sync |

### 3.3 Nutzerdaten (immer lokal + Cloud)

| Daten | Lokal | Cloud |
|-------|-------|-------|
| Aktive Einkaufsliste | ✅ (primär) | ✅ (Backup) |
| Einkaufshistorie | ✅ (letzte 10 Einkäufe) | ✅ (vollständig, unbegrenzt) |
| Produktpräferenzen | ✅ | ✅ |
| Abhak-Sequenzen | ✅ (zwischengespeichert) | ✅ (nach Sync) |
| Fehler-Meldungen | ✅ (zwischengespeichert) | ✅ (nach Sync) |

---

## 4. Synchronisation

### 4.1 Sync-Auslöser

Die Synchronisation wird automatisch ausgelöst bei:
- App-Start (wenn online)
- Wechsel von Offline zu Online
- Nach Abschluss eines Einkaufs
- In regelmäßigen Intervallen im Hintergrund (z.B. alle 5 Minuten, wenn App offen und online)
- Manuell: Pull-to-Refresh in der Listenansicht

### 4.2 Sync-Richtung

```
Lokal → Cloud (Upload):
  • Listenänderungen (hinzufügen, abhaken, löschen, Menge)
  • Abgeschlossene Einkäufe
  • Abhak-Sequenzen
  • Fehler-Meldungen
  • Crowdsourcing-Vorschläge

Cloud → Lokal (Download):
  • Produktkatalog-Updates
  • Preis-Updates
  • Gangfolge-Updates
  • Neue Ladendaten
  • Aggregierte Gangfolgen
```

### 4.3 Sync-Reihenfolge (Priorität)

Bei begrenzter Bandbreite oder kurzer Online-Phase:

1. **Höchste Priorität:** Aktive Einkaufsliste (Upload + Download)
2. **Hoch:** Gangfolge-Daten für den aktuellen/Standard-Laden
3. **Mittel:** Produktkatalog-Updates, Preis-Updates
4. **Niedrig:** Einkaufshistorie, Abhak-Sequenzen, Fehler-Meldungen
5. **Niedrigste:** Ladendatenbank-Updates, aggregierte Gangfolgen

### 4.4 Konfliktbehandlung

Im MVP (Einzelnutzer, eine Liste) sind Konflikte selten. Trotzdem muss das System damit umgehen:

**Szenario:** Nutzer bearbeitet die Liste auf einem Gerät offline, und in der Cloud existiert eine neuere Version (z.B. nach Neuinstallation oder nach Browser-Cache-Löschung).

**Lösung im MVP:** Last-Write-Wins auf Ebene einzelner Listeneinträge.
- Jeder Listeneintrag hat einen Zeitstempel der letzten Änderung
- Bei Konflikt gewinnt die neuere Änderung
- Ausnahme: Hinzufügungen werden nie überschrieben – wenn lokal und in der Cloud unterschiedliche Produkte hinzugefügt wurden, werden beide behalten

**Später (Familien-Feature):** Komplexere Konfliktauflösung nötig (siehe unten, Abschnitt 7).

---

## 5. Technische Umsetzung

### 5.1 Service Worker

- Ein Service Worker fängt alle Netzwerk-Anfragen ab
- Bei Verbindung: Anfragen gehen ans Netz, Antworten werden im Cache aktualisiert
- Ohne Verbindung: Anfragen werden aus dem lokalen Cache beantwortet
- Der Service Worker sorgt auch dafür, dass die App selbst (HTML, CSS, JS) offline startet

### 5.2 Lokaler Speicher (IndexedDB)

- Alle strukturierten Daten (Liste, Produkte, Gangfolgen) werden in IndexedDB gespeichert
- IndexedDB funktioniert in allen modernen Browsern (iOS Safari, Android Chrome)
- Speicherlimit: Mehrere hundert MB – mehr als ausreichend

### 5.3 Offline-Queue

- Alle Änderungen, die offline gemacht werden, landen in einer Queue
- Jeder Queue-Eintrag hat: Aktion (add/update/delete), Datenobjekt, Zeitstempel
- Bei Online-Verbindung wird die Queue der Reihe nach abgearbeitet
- Nach erfolgreicher Verarbeitung wird der Queue-Eintrag gelöscht
- Bei Fehlern: Retry mit exponential Backoff

---

## 6. Nutzererfahrung (UX)

### 6.1 Online-Indikator

- **Online:** Kein Hinweis (Normalzustand)
- **Offline:** Dezenter Hinweis am oberen Bildschirmrand: "Offline – Änderungen werden synchronisiert, sobald du online bist"
- **Sync läuft:** Kein sichtbarer Indikator (passiert lautlos im Hintergrund)
- **Sync abgeschlossen:** Kein sichtbarer Indikator
- **Sync-Fehler:** Nur anzeigen, wenn nach mehreren Versuchen keine Verbindung möglich ist: "Synchronisation fehlgeschlagen. Deine Daten sind lokal gespeichert."

### 6.2 Veraltete Daten

- Wenn der Produktkatalog älter als 7 Tage ist und keine Verbindung besteht: Dezenter Hinweis "Produktdaten möglicherweise nicht aktuell"
- Die App funktioniert trotzdem normal – der Hinweis ist nur informativ
- Keine blockierenden Meldungen oder Zwangs-Updates

### 6.3 Erster Start ohne Internet

- Die App kann beim allerersten Start nicht ohne Internet genutzt werden (initialer Download nötig)
- Anzeige: "Bitte verbinde dich mit dem Internet, um die App einzurichten. Danach funktioniert sie auch offline."
- Nach dem initialen Download funktioniert alles offline

---

## 7. Ausblick: Offline + Familien-Feature (nicht MVP)

> Dokumentiert für spätere Phasen.

Wenn mehrere Familienmitglieder die gleiche Liste bearbeiten, wird Offline-Sync komplexer:

**Problem:** Person A streicht offline "Milch" von der Liste. Person B fügt gleichzeitig offline "Milch 2x" hinzu. Welcher Stand gilt?

**Mögliche Strategien:**
- **Merge statt Überschreiben:** Beide Änderungen werden zusammengeführt
- **Tombstone-Prinzip:** Gelöschte Einträge werden als "gelöscht" markiert, nicht wirklich entfernt, bis der Sync bestätigt ist
- **Benachrichtigung:** Bei Konflikten wird der Nutzer informiert und kann entscheiden

Die genaue Strategie wird bei der Implementierung des Familien-Features festgelegt. Das Datenmodell ist bereits so angelegt, dass Zeitstempel pro Eintrag vorhanden sind.

---

## 8. Zusammenfassung: Offline-Garantien

| Garantie | Beschreibung |
|----------|-------------|
| **Kein Datenverlust** | Alle offline gemachten Änderungen werden bei nächster Verbindung synchronisiert |
| **Volle Funktionalität im Laden** | Liste, Abhaken, Sortierung, Fehler-Meldung – alles funktioniert offline |
| **Transparenz** | Der Nutzer weiß immer, ob er online oder offline ist |
| **Kein Zwang** | Die App blockiert nie die Nutzung, weil gerade keine Verbindung besteht (außer beim allerersten Start) |
| **Automatischer Sync** | Der Nutzer muss sich nicht um die Synchronisation kümmern |

---

*Letzte Aktualisierung: 2025-02-16*
*Status: Entwurf v1 – Review durch Produktinhaber ausstehend*

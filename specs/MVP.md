# MVP.md – Minimum Viable Product Definition

## 1. MVP-Ziel

Ein funktionsfähiger Prototyp als Progressive Web App (PWA), der den Kern-Einkaufsworkflow abbildet: Einkaufsliste erstellen → Laden betreten → Liste ist automatisch in Gangfolge sortiert → Produkte abhaken → fertig.

Der MVP dient als Showcase für eine interne Präsentation bei ALDI SÜD und muss überzeugend demonstrieren, dass das Konzept funktioniert.

---

## 2. MVP-Scope: Was ist drin

### 2.1 Intelligente Produkteingabe
- Suchfeld mit Autovervollständigung
- **Generische Eingabe:** Nutzer tippt "Milch" und kann mit einem Tap "Milch" (generisch) zur Liste hinzufügen
- **Spezifische Eingabe:** Unterhalb der generischen Option erscheinen spezifische ALDI-Produkte aus der Datenbank, die zum Suchbegriff passen
- Nach dem Hinzufügen: Menge änderbar (ein Tap) oder direkt nächstes Produkt eingeben
- Häufig gekaufte Produkte des Nutzers erscheinen weiter oben in den Vorschlägen (personalisiertes Ranking basierend auf Kaufhistorie)

### 2.2 Produktdatenbank
- Initiale Befüllung über eine Admin-Oberfläche in der App (wird nach offizieller Datenbank-Anbindung eingestellt)
- Crowdsourcing: Nutzer können Produkte zur Datenbank beitragen
- Produkte enthalten: Name, Kategorie, Preis (wenn bekannt), Sortimentstyp (Daily Range / Special)
- Unterstützung für Daily Range und Specials (siehe PRODUCT.md Abschnitt 8.2)

### 2.3 Automatische Ladenerkennung & Gang-Sortierung
- **GPS-basierte Ladenerkennung:** App erkennt automatisch, in welchem ALDI-Laden der Nutzer sich befindet
- **Manuelle Auswahl:** Falls GPS nicht funktioniert, kann der Laden händisch gewählt werden
- **Ladenspezifische Sortierung:** Liste wird in der Reihenfolge der Produkte im erkannten Laden sortiert
- **Kategorie-Vorsortierung:** Bereits bei der Eingabe werden Produkte nach Kategorien gruppiert (Obst & Gemüse zusammen, Tiefkühl zusammen, Kühlprodukte zusammen etc.)
- **Fallback bei unbekanntem Laden:** Wenn für einen Laden noch keine Sortierungsdaten vorliegen, wird der Durchschnitt aller bekannten Läden als Startannahme verwendet
- **Lernalgorithmus (Basisversion):** System lernt aus der Abhak-Reihenfolge der Nutzer (Details in LEARNING-LOGIC.md)

### 2.4 Einkaufsliste im Laden
- Liste zeigt Produkte in der berechneten Gangfolge an
- Abhaken per Tap → Produkt wird ausgegraut und rutscht ans Ende der Liste
- Entfernen per Swipe (Wischen)
- Fehler-Button: Nutzer kann signalisieren, dass die Sortierung nicht stimmt
- Vollständig offline-fähig (alle Daten lokal gecacht)

### 2.5 Einfache Preisschätzung
- Für spezifische Produkte mit bekanntem Preis: Summe wird angezeigt
- Für generische Einträge: "Preis unbekannt" – diese werden in der Summe nicht berücksichtigt
- Anzeige: "Geschätzter Preis: €XX,XX (3 von 12 Produkten ohne Preis)"
- Kein Anspruch auf Genauigkeit – Orientierungswert

### 2.6 Einkaufsanalyse (Hintergrund-Datensammlung)
- Alle Einkäufe werden protokolliert: Datum, Produkte, Laden, Preise
- Messung der Einkaufsdauer: Zeit vom ersten bis zum letzten Abhaken
- GPS-basierte Dauer (Betreten bis Verlassen des Ladens) als Erweiterungsoption
- Daten werden gespeichert, aber im MVP noch nicht als Auswertung angezeigt

### 2.7 Kontomodell (MVP)
- Automatisches anonymes Konto im Hintergrund (generische ID)
- Keine Registrierung im MVP
- Alle Daten werden in der Cloud gespeichert, gebunden an die anonyme ID

### 2.8 Offline-Fähigkeit (VERSCHOBEN – nicht im MVP)
- Offline-Modus wird auf eine spätere Phase verschoben
- Der MVP funktioniert rein online – Internetverbindung ist erforderlich
- Die vollständige Offline-Spezifikation bleibt in OFFLINE-STRATEGY.md dokumentiert

### 2.9 Mehrsprachigkeit
- App-Oberfläche in Deutsch und Englisch
- Internationalisierung (i18n) im Code von Anfang an umgesetzt
- Produktnamen sind sprachunabhängig (ALDI-Produktnamen bleiben wie sie sind)

### 2.10 Design
- ALDI SÜD Design-Sprache (Farben, Typografie)
- Best-in-Class Usability (orientiert an Top Consumer-Apps)
- Mobile-first, optimiert für Smartphone-Einhandbedienung

---

## 3. MVP-Scope: Was ist NICHT drin

| Feature | Geplant für | Grund für Ausschluss |
|---------|-------------|---------------------|
| Persönliches Konto / Registrierung | Phase 3 | MVP zeigt Konzept, Kontoverwaltung ist kein Differenzierungsmerkmal |
| Geteilte Familien-Listen | Phase 3 | Erfordert Kontomodell und komplexe Sync-Logik |
| Echtzeit-Sync zwischen Geräten | Phase 3 | Erfordert Kontomodell |
| Native iOS/Android App | Phase 4 | PWA reicht für den Prototyp |
| Push-Benachrichtigungen | Phase 4 | Ergibt erst mit nativer App und Familien-Feature Sinn |
| Preisvergleich mit LIDL / anderen Ketten | Phase 5 | Erfordert separate Produktdatenbanken und Matching-Algorithmus |
| Rezept-Import (Chefkoch etc.) | Phase 5 | Nice-to-have, kein Kernfeature |
| Sprachassistenten-Integration (Alexa) | Phase 5 | Nice-to-have, kein Kernfeature |
| API-Anbindung Produktdatenbank | Phase 2 | Im MVP wird manuell + Crowdsourcing befüllt |
| Auswertungs-Dashboard für Einkaufsanalyse | Phase 2+ | Daten werden im MVP gesammelt, aber noch nicht visualisiert |
| DSGVO-vollständige Datenschutz-Umsetzung | Pre-Launch | Wird vor öffentlichem Launch umgesetzt, nicht im Prototyp |

---

## 4. MVP-Nutzerflow (End-to-End)

### Zu Hause: Liste erstellen
```
1. App öffnen
2. Suchfeld tippen → "Milch" eintippen
3. Sofort erscheint:
   - [+ Milch]                              ← generisch, ein Tap
   - Milsani Frische Vollmilch 3,5% 1L     ← spezifisch
   - Milsani Fettarme Milch 1,5% 1L        ← spezifisch (★ häufig gekauft)
   - ...
4. Nutzer tippt auf gewünschtes Produkt → ist auf der Liste
5. Optional: Menge anpassen (Tap auf Menge → +/- oder Zahl eingeben)
6. Nächstes Produkt eingeben oder Liste schließen
7. Unten: "Geschätzter Preis: €23,40 (2 Produkte ohne Preis)"
```

### Im Laden: Einkaufen
```
1. App öffnen (oder aus Hintergrund holen)
2. App erkennt über GPS: "ALDI SÜD Musterstraße 12, München"
   - Falls nicht erkannt: Laden manuell auswählen
3. Liste sortiert sich automatisch in Gangfolge dieses Ladens
4. Nutzer läuft durch den Laden:
   - Produkt in den Wagen → Tap zum Abhaken
   - Produkt nicht gefunden → Swipe zum Entfernen
   - Sortierung stimmt nicht → Fehler-Button
5. Letztes Produkt abgehakt → Einkauf abgeschlossen
6. Im Hintergrund: Einkaufsdaten + Abhak-Reihenfolge werden gespeichert
```

---

## 5. Technische MVP-Anforderungen

- **Format:** Progressive Web App (PWA), installierbar auf Smartphone
- **Online:** MVP erfordert Internetverbindung. Offline-Modus in späterer Phase
- **Performance:** Flüssig mit bis zu 4.000 aktiven Produkten in der Datenbank
- **Browser-Support:** iOS Safari (ab iOS 15), Android Chrome (ab Android 10)
- **GPS:** Für Ladenerkennung, mit Fallback auf manuelle Auswahl
- **Responsiv:** Optimiert für Smartphone, funktional auf Tablet/Desktop

---

## 6. Erfolgskriterien für den MVP

Der MVP ist erfolgreich, wenn er in einer Live-Demo folgendes überzeugend zeigt:

1. **Schnelle Listenerstellung:** Ein Einkaufszettel mit 10 Produkten ist in unter 2 Minuten erstellt
2. **Intelligente Suche:** Autovervollständigung mit generischen und spezifischen Ergebnissen funktioniert flüssig
3. **Automatische Sortierung:** Die Liste sortiert sich korrekt nach Gangfolge beim Betreten eines bekannten Ladens
4. **Fallback funktioniert:** Bei einem unbekannten Laden greift die Durchschnitts-Sortierung sinnvoll
5. **Aktionsartikel:** Verfügbarkeitsanzeige (grün/gelb) hilft dem Nutzer einzuschätzen, ob ein Aktionsartikel noch vorrätig ist
6. **Lerneffekt sichtbar:** Nach wenigen Einkäufen verbessert sich die Sortierung merklich
7. **Preisschätzung:** Ein Orientierungspreis wird angezeigt

---

*Letzte Aktualisierung: 2025-02-16*
*Status: Entwurf v1 – Review durch Produktinhaber ausstehend*

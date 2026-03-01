# Prompt: Block 6 – Datenschutzerklärung

## Empfohlenes Modell: Opus 4.6 (normal)

## Abhängigkeit: Block 0 (Account) — Auth muss beschrieben sein, damit die Datenschutzerklärung korrekt ist

---

## Kontext

Für den Friendly User Test mit 100+ Nutzern ist eine DSGVO-konforme Datenschutzerklärung erforderlich. Die App erhebt personenbezogene Daten (Einkaufsdaten via Kassenzettel, E-Mail-Adresse bei Registrierung, Standortdaten via GPS).

---

## Aufgabe

### 1. Neue Seite `src/app/[locale]/privacy/page.tsx`

Erstelle eine statische Datenschutzseite mit folgenden Abschnitten:

1. **Verantwortlicher:** [Name und Kontaktdaten einfügen — Platzhalter lassen]
2. **Welche Daten werden erhoben:**
   - E-Mail-Adresse und Passwort (bei Registrierung)
   - Einkaufsdaten (Produkte, Preise, Datum — bei Kassenzettel-Scan)
   - Kassenzettel-Fotos (temporär in der Cloud gespeichert)
   - Standortdaten (GPS — für Laden-Erkennung, nur bei aktiver Nutzung)
   - Geräte-Informationen (Browser, Betriebssystem — für Fehlerbehebung via Sentry)
3. **Zweck der Datenerhebung:**
   - Einkaufsliste erstellen und synchronisieren
   - Produkte nach Gang-Reihenfolge sortieren
   - Preise aktualisieren
   - Fehler erkennen und beheben
4. **Speicherung:**
   - Supabase (PostgreSQL) — Server in der EU (Frankfurt, Deutschland)
   - Supabase Storage — EU
   - Vercel (Hosting) — Edge-Server weltweit, Datenverarbeitung in EU
   - Sentry (Error Tracking) — EU
5. **Drittanbieter:**
   - Anthropic (Claude API) — Kassenzettel-Fotos werden zur Texterkennung an die Anthropic API gesendet. Anthropic speichert keine Daten aus API-Calls (Zero Data Retention Policy).
6. **Rechte der Nutzer:** Auskunft, Löschung, Berichtigung, Datenportabilität, Widerspruch
7. **Löschung:** Account löschen → alle Daten werden gelöscht
8. **Cookies:** Die App verwendet keine Cookies. Daten werden in `localStorage` (Browser-Speicher) gespeichert.
9. **Kontakt:** [Platzhalter für E-Mail-Adresse]

### 2. Die Seite soll in DE und EN verfügbar sein

Translation-Keys in `de.json` und `en.json`. Keine Rechtstexte in den Code hartcoden — alles über Translation-Keys.

### 3. Link in den Settings

In der Settings-Seite (`settings-client.tsx`) ganz unten einen Link zur Datenschutzerklärung hinzufügen:

```
Datenschutzerklärung  →
Impressum             →   (Platzhalter, Link zu /privacy vorerst)
```

### 4. Link im Login-Screen

Auf der Login-Seite (Block 0) einen kleinen Link unter dem Form:
```
Mit der Nutzung akzeptierst du unsere Datenschutzerklärung.
```

### 5. Design

- Saubere Typografie, gut lesbar
- ALDI-Farben für Überschriften
- Kein visueller Overload — plain text mit klarer Struktur
- Mobile-first (die meisten Nutzer sind auf dem Handy)

---

## Fallstricke

1. **Kein Cookie-Banner nötig:** Die App nutzt nur `localStorage` (technisch notwendig, kein Tracking). Kein Google Analytics, kein Facebook Pixel. Daher kein Cookie-Consent-Banner erforderlich.

2. **Anthropic Datenschutz:** Anthropic's API-Nutzungsbedingungen bestätigen, dass API-Daten nicht zum Training verwendet werden und nicht gespeichert werden (Zero Data Retention für API-Kunden). Das sollte in der Datenschutzerklärung erwähnt werden.

3. **GPS:** Die App fragt den Nutzer um Erlaubnis (Browser-Permission-Dialog). GPS-Daten werden nicht in der Cloud gespeichert — sie werden nur clientseitig verarbeitet, um den nächsten Laden zu finden.

4. **Rechtsberatung:** Diese Datenschutzerklärung ist ein pragmatischer Entwurf für den Friendly User Test. Vor einem öffentlichen Launch sollte sie von einem Juristen geprüft werden.

---

## Testplan

- [ ] `/de/privacy` → Datenschutzerklärung auf Deutsch
- [ ] `/en/privacy` → Privacy Policy auf Englisch
- [ ] Link in Settings → funktioniert
- [ ] Mobile → gut lesbar, keine horizontale Scrollbar

---

## Specs aktualisieren

- `specs/FEATURES-CORE.md` → F12 Settings um Datenschutz-Link ergänzen
- `specs/CHANGELOG.md` → Eintrag hinzufügen

# Test: Produkt anlegen (Capture → „Produkt anlegen“)

Schritt-für-Schritt prüfen, ob über **Produkte erfassen** → **Produkt anlegen** angelegte Produkte in der Datenbank landen und in der App gefunden werden.

---

## Ablauf im System

1. **Eingabe:** Nutzer öffnet die Capture-Seite, klickt auf **„Produkt anlegen“**, füllt das Modal aus (mindestens **Name** ist Pflicht) und klickt **„Produkt speichern“**.
2. **Client:** Das Modal lädt Thumbnail und ggf. weitere Fotos in den Supabase-Storage hoch, ruft dann `POST /api/products/create-manual` mit allen Formulardaten, `thumbnail_url`, `extra_photo_urls`, `data_upload_ids` und `user_id` auf.
3. **API (`create-manual`):**
   - Liest die erste Kategorie aus `categories` (für `category_id`).
   - **Duplikat-Check:** Sucht bestehendes Produkt nacheinander nach `article_number`, `ean_barcode`, `name_normalized` (nur `status = 'active'`). Wird eins gefunden → Antwort `{ duplicate: true, existing_product_id }`; bei Bestätigung kann mit `update_existing_product_id` aktualisiert werden.
   - **Neu:** Insert in Tabelle **`products`** mit u.a.:
     - `name`, `name_normalized`, `category_id`, `country: "DE"`, `status: "active"`
     - `source: "crowdsourcing"`, `crowdsource_status: "pending"`
     - `thumbnail_url` (nach Resize 150×150 in Bucket `product-thumbnails`), optional weitere Felder
   - Setzt bei allen zugehörigen Einträgen in **`photo_uploads`** (Datenfotos, Extra-Fotos) `product_id`.
4. **App nach Speichern:** Beim Schließen des Modals wird die Produktliste aus dem **ProductsProvider** per `refetch()` neu geladen (`status = 'active'`, `country` = aktuelles Land). Das neue Produkt erscheint damit in Suche/Listen, sofern `country` z.B. DE ist.

---

## Test Schritt für Schritt

### 1. Voraussetzungen

- App läuft (lokal oder Deployment).
- Supabase ist konfiguriert (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- In der Tabelle **`categories`** existiert mindestens eine Zeile (sonst schlägt die API mit „Keine Kategorie konfiguriert“ fehl).
- Aktuelles Land der App ist **DE** (oder das Land, in dem du testest – neue Produkte werden mit `country: "DE"` angelegt; für andere Länder müsste die API ggf. angepasst werden).

### 2. Produkt anlegen

1. In der App zu **Produkte erfassen** (Capture) wechseln.
2. Auf **„Produkt anlegen“** klicken.
3. Im Modal **mindestens Name** eintragen (z.B. „Test Produkt 123“).
4. Optional: weitere Felder (Marke, Preis, EAN, …) und/oder ein Thumbnail-Foto.
5. Auf **„Produkt speichern“** klicken.

**Erwartung:**

- Modal schließt sich.
- Keine Fehlermeldung (z.B. „Supabase nicht konfiguriert“ oder „Name ist erforderlich“).

Tritt ein Fehler auf: Browser-Konsole (F12) und Netzwerk-Tab prüfen; bei 4xx/5xx die Antwort von `/api/products/create-manual` ansehen.

### 3. Prüfung in der Datenbank (Supabase)

1. **Supabase Dashboard** → Projekt → **Table Editor**.
2. Tabelle **`products`** öffnen.
3. Nach dem neuen Produkt suchen (z.B. Name „Test Produkt 123“ oder Sortierung nach **created_at** neueste zuerst).

**Erwartung:**

- Eine neue Zeile mit:
  - dem eingegebenen Namen,
  - `name_normalized` (kleingeschrieben, normalisiert),
  - `country = DE`,
  - `status = active`,
  - `source = crowdsourcing`,
  - `crowdsource_status = pending`,
  - ggf. `thumbnail_url` (URL aus Bucket `product-thumbnails`).

Wenn die Zeile fehlt: API-Log/Fehler prüfen (z.B. fehlende Kategorie, RLS, Netzwerkfehler).

### 4. Prüfung in der App (Finden des Produkts)

1. Nach dem Schließen des Modals **nicht** die Seite hart neu laden (F5).
2. Zur **Startseite/Liste** oder zur **Suche** wechseln (je nachdem, wo in der App Produkte aus dem **ProductsProvider** angezeigt werden).
3. Nach dem angelegten Produkt suchen (Name oder EAN/Artikelnummer, falls ausgefüllt).

**Erwartung:**

- Das neue Produkt erscheint in der Liste bzw. in den Suchergebnissen (weil nach dem Speichern `refetch()` die Produktliste mit `status = 'active'` und aktuellem `country` neu lädt).

Wenn es nicht erscheint:

- **Land:** Aktuelles Land der App muss zu `country` des Produkts passen (Standard „Produkt anlegen“: DE).
- **Seite einmal neu laden (F5):** Dann lädt der ProductsProvider beim Mount erneut; erscheint das Produkt danach, war nur der Refetch nicht erreichbar (z.B. Modal in anderem Baum).
- **Supabase:** In Schritt 3 prüfen, ob die Zeile wirklich in `products` mit `status = active` und passendem `country` existiert.

### 5. Optional: Duplikat-Check testen

1. Ein zweites Mal **„Produkt anlegen“** mit **gleichem Namen** (oder gleicher EAN/Artikelnummer, falls du welche genutzt hast) ausfüllen und speichern.
2. **Erwartung:** Meldung, dass ein Produkt mit gleicher EAN/Artikelnummer/Name existiert, und Abfrage „Bestehendes Produkt aktualisieren?“.
3. Bei **„Aktualisieren“** sollte die bestehende Zeile in `products` aktualisiert werden (keine zweite neue Zeile).

---

## Kurz-Checkliste

- [ ] Kategorie in `categories` vorhanden.
- [ ] „Produkt anlegen“ → Name eingeben → „Produkt speichern“ → Modal schließt ohne Fehler.
- [ ] In Supabase `products`: neue Zeile mit korrektem Namen, `country = DE`, `status = active`.
- [ ] In der App: Produkt in Liste/Suche sichtbar (ohne zwingend F5).
- [ ] Optional: Duplikat erzeugen → Hinweis und Update-Abfrage.

Wenn alle Punkte erfüllt sind, landen die über „Produkt anlegen“ erstellten Produkte in der Datenbank und werden in der App gefunden.

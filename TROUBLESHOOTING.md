# Fehlerbehebung

## "Cannot find module './vendor-chunks/…'"

**Symptom:** Beim Aufruf von `localhost:3000` erscheint ein Fehler wie:
- `Error: Cannot find module './vendor-chunks/next.js'`
- `Error: Cannot find module './vendor-chunks/@formatjs.js'`
(Require stack: webpack-runtime.js, …)

**Ursache:** Der **Next.js-Build-Cache (`.next`) ist beschädigt oder veraltet** – z. B. nach einem Update, Abbruch des Builds oder Wechsel der Node-Version.

**Lösung:**

1. **Dev-Server stoppen** (im Terminal: `Ctrl+C`).
2. Ordner `.next` löschen und neu starten:

   ```bash
   npx rimraf .next
   npm run dev
   ```

   Unter Windows: Wenn `.next` nicht gelöscht werden kann („wird von einem anderen Prozess verwendet“), den laufenden Node-/Next-Prozess beenden (Task-Manager oder alle Terminals schließen) und Schritt 2 wiederholen.

---

## "Could not find the module … app-router.js# in the React Client Manifest"

**Symptom:** Beim `npm run dev` erscheint ein Server Error mit obiger Meldung (evtl. mit `#"` am Ende des Pfads).

**Ursache:** Der **Projektpfad enthält das Zeichen `#`** (z. B. im Ordner `#Peter`). Webpack/Next.js behandeln `#` als Fragment-Kennzeichen und schneiden den Pfad an dieser Stelle ab. Dadurch werden Modulpfade im React Client Manifest ungültig.

**Lösung:** Den Projektpfad so ändern, dass **kein `#`** mehr vorkommt.

| Option | Vorgehen |
|--------|----------|
| **1. Ordner umbenennen** | Übergeordneten Ordner umbenennen: `#Peter` → z. B. `Peter` oder `_Peter`. |
| **2. Projekt verschieben** | Projekt nach z. B. `C:\Dev\DigitalShoppingList` kopieren/klonen und von dort starten. |
| **3. Junction (Windows)** | Einen Verzeichnis-Junction ohne `#` anlegen und von dort aus starten (siehe README). |

Anschließend Cache löschen und neu starten:

```bash
npx rimraf .next
npm run dev
```

Quelle: [webpack#12156](https://github.com/webpack/webpack/issues/12156) – Pfade mit `#` werden nicht zuverlässig aufgelöst.

---

## Produktkatalog leer / "Keine Produkte in dieser Kategorie"

**Symptom:** Der Katalog lädt, zeigt Kategorie-Tabs und Unterkategorien, aber das Produktraster ist leer.

**Mögliche Ursache 1 – Veralteter Sync-Timestamp (häufigste Ursache lokal):**  
`localStorage` enthält einen gespeicherten `products-last-sync-DE`-Timestamp, aber IndexedDB wurde geleert (z. B. nach einem Datenbank-Schema-Upgrade oder Löschen der Browser-Daten). Der Delta-Sync fragt dann `updated_at > <aktueller Timestamp>` ab und findet 0 Produkte.

**Lösung:**

1. Browser-Entwicklertools öffnen (F12) → **Application** → **Local Storage** → den Eintrag `products-last-sync-DE` (bzw. `products-last-sync-AT`) löschen.
2. Seite neu laden. Beim nächsten Start wird ein vollständiger Ladevorgang durchgeführt.

*Hinweis: Ab Version 2026-03-07 erkennt die App diesen Zustand automatisch und korrigiert ihn beim Start.*

---

**Mögliche Ursache 2 – Standardladen in nicht unterstütztem Land:**  
Der Standard-Laden in den Einstellungen ist auf einen Laden in einem Land gesetzt, für das keine Katalogdaten vorhanden sind (z. B. Neuseeland). Da Produkte nach Ländercode gefiltert werden, ist das Ergebnis leer.

**Lösung:** Einstellungen öffnen → Standard-Laden auf einen ALDI-Laden in Deutschland oder Österreich setzen.

*Hinweis: Ab Version 2026-03-07 zeigt die App in diesem Fall eine klare Fehlermeldung mit einem direkten Link zu den Einstellungen.*

---

## localhost:3000 ist nicht erreichbar (Firewall)

**Symptom:** Der Browser zeigt „Diese Seite ist nicht erreichbar“ oder „Verbindung abgelehnt“, obwohl `npm run dev` läuft.

**Mögliche Ursache:** Die **Windows-Firewall** blockiert eingehende Verbindungen für Node.js auf Port 3000.

**Lösung:**

1. **Firewall-Regel für Node erlauben**  
   - Windows-Suche: „Windows Defender Firewall“ → „Erweiterte Einstellungen“.  
   - „Eingehende Regeln“ → „Neue Regel…“ → „Programm“ → Durchsuchen: Pfad zu `node.exe` (z. B.  
     `C:\Program Files\nodejs\node.exe` oder im Benutzerprofil unter `nvm`/`fnm`).  
   - „Verbindung zulassen“ → Domäne + Privat (und ggf. Öffentlich) aktivieren → Namen z. B. „Node.js Dev“.

2. **Beim ersten Start:** Wenn Windows ein Pop-up „Zugriff zulassen?“ anzeigt, **„Zugriff zulassen“** wählen (für privates Netzwerk reicht meist aus).

3. **Alternativ: anderen Port nutzen**  
   Wenn nur Port 3000 blockiert ist, Dev-Server auf anderem Port starten:

   ```bash
   npx next dev -p 3001
   ```

   Im Browser dann: `http://localhost:3001`

4. **Prüfen, ob der Server hört:**  
   Im Terminal sollte bei `npm run dev` stehen: `- Local: http://localhost:3000`.  
   Wenn nicht, Build-Cache löschen (`.next`) und erneut `npm run dev` starten.

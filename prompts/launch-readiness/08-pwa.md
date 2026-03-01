# Prompt: Block 8 – PWA aktivieren

## Empfohlenes Modell: Opus 4.6 (normal)

## Abhängigkeit: Keine (kann jederzeit umgesetzt werden)

---

## Kontext

Die App ist als PWA (Progressive Web App) vorbereitet, aber noch nicht aktiviert. In `next.config.js` (Zeile 13-15) ist der PWA-Code auskommentiert:

```javascript
// PWA: enable only in production to avoid dev issues; uncomment when ready
// const withPWA = require("next-pwa")({ dest: "public", disable: process.env.NODE_ENV === "development" });
// module.exports = withPWA(withNextIntl(nextConfig));
```

`next-pwa` ist bereits in `package.json` als Dependency (`"next-pwa": "^5.6.0"`).

Für den Friendly User Test sollen Nutzer die App "zum Startbildschirm hinzufügen" können, damit sie sich wie eine native App anfühlt.

---

## Aufgabe

### 1. `next.config.js` anpassen

Die auskommentierte PWA-Zeile aktivieren. Aber Achtung: Die aktuelle Konfiguration muss mit dem Sentry-Wrapper (Block 4) kompatibel sein.

**Ohne Sentry:**
```javascript
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

module.exports = withPWA(withNextIntl(nextConfig));
```

**Mit Sentry (wenn Block 4 bereits umgesetzt):**
```javascript
module.exports = withSentryConfig(
  withPWA(withNextIntl(nextConfig)),
  sentryOptions
);
```

### 2. Web App Manifest prüfen/erstellen

Datei `public/manifest.json` (oder `manifest.webmanifest`):

```json
{
  "name": "Digital Shopping List",
  "short_name": "Einkaufsliste",
  "description": "Deine Einkaufsliste, sortiert nach der Reihenfolge im Laden",
  "start_url": "/de",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#00205C",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 3. App-Icons erstellen

Erstelle PNG-Icons in `public/icons/`:
- `icon-192x192.png` — für Android, Chrome
- `icon-512x512.png` — für Splash Screen
- `apple-touch-icon.png` (180x180) — für iOS "Zum Startbildschirm"

Design: ALDI-Blau (#00205C) Hintergrund, weißes Einkaufswagen-Icon. Schlicht und erkennbar.

### 4. Meta-Tags in `src/app/[locale]/layout.tsx`

Prüfe ob die folgenden Meta-Tags im `<head>` gesetzt sind:

```html
<meta name="theme-color" content="#00205C" />
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

### 5. Service Worker

`next-pwa` generiert automatisch einen Service Worker. Für den Friendly User Test reicht die Default-Konfiguration:
- Static Assets werden gecacht (JS, CSS, Bilder)
- API-Calls werden NICHT gecacht (online-only Modus bleibt bestehen)
- Kein Offline-Fallback nötig (kommt in Phase 2)

### 6. Install-Prompt (optional, nice-to-have)

Browser zeigen automatisch ein "Zum Startbildschirm hinzufügen"-Banner an. Optional: Eigener Button in den Settings:

```
[📱 App installieren]
```

Nutzt die `beforeinstallprompt` Event API:
```typescript
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});
```

---

## Fallstricke

1. **iOS Safari:** PWA-Support auf iOS ist eingeschränkt. Kein Install-Prompt (User muss über Share → "Zum Home-Bildschirm" gehen). Push Notifications funktionieren erst ab iOS 16.4. Der Service Worker funktioniert aber.

2. **`next-pwa` und Dev-Modus:** `disable: process.env.NODE_ENV === "development"` verhindert Service-Worker-Probleme im Dev-Modus. Ohne diese Option cached der Service Worker aggressiv und man sieht keine Code-Änderungen.

3. **Cache-Invalidierung:** Nach einem Deployment muss der Service Worker aktualisiert werden. `skipWaiting: true` sorgt dafür, dass der neue Service Worker sofort aktiv wird (kein "Bitte aktualisieren"-Banner nötig).

4. **Dropbox-Konflikt:** Das Projekt liegt in Dropbox. `next-pwa` generiert Dateien in `public/` (`sw.js`, `workbox-*.js`). Diese sollten in `.gitignore` stehen:
   ```
   public/sw.js
   public/sw.js.map
   public/workbox-*.js
   public/workbox-*.js.map
   ```

---

## Testplan

- [ ] `npm run build && npm start` → Service Worker registriert (DevTools → Application → Service Workers)
- [ ] Chrome/Android → "Zum Startbildschirm hinzufügen" Banner erscheint
- [ ] iOS Safari → Share → "Zum Home-Bildschirm" funktioniert
- [ ] App vom Startbildschirm öffnen → Vollbild, kein Browser-Chrome
- [ ] App-Icon sieht gut aus (richtige Farben, kein weißer Rand)
- [ ] Nach Deployment: Neue Version wird automatisch geladen (kein Stale Cache)

---

## Specs aktualisieren

- `specs/ARCHITECTURE.md` → PWA-Status von "later" auf "active" ändern
- `specs/CHANGELOG.md` → Eintrag hinzufügen

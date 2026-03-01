# Prompt: Block 4 – Error Tracking (Sentry)

## Empfohlenes Modell: Opus 4.6 (normal)

## Abhängigkeit: Keine (kann jederzeit umgesetzt werden)

---

## Kontext

Die App hat kein zentrales Error-Tracking. Fehler landen in `console.error` und sind für den Betreiber unsichtbar. Bei 100+ Nutzern muss erkennbar sein, wenn etwas nicht funktioniert.

---

## Aufgabe

### 1. Sentry-Account und Projekt erstellen (manuell)

1. https://sentry.io → Account erstellen (Free Plan: 5.000 Events/Monat)
2. Neues Projekt: Platform = "Next.js"
3. DSN kopieren (sieht aus wie `https://xxx@oyyy.ingest.sentry.io/zzz`)

### 2. Sentry SDK installieren und konfigurieren

```bash
npx @sentry/wizard@latest -i nextjs
```

Der Wizard erstellt automatisch:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- Aktualisiert `next.config.js` (wraps mit `withSentryConfig`)

Alternativ manuell:

```bash
npm install @sentry/nextjs
```

**`sentry.client.config.ts`** (Projekt-Root):
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% Performance-Traces
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.5, // 50% Session Replays bei Fehlern
  environment: process.env.NODE_ENV,
});
```

**`sentry.server.config.ts`** (Projekt-Root):
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

**Environment Variables:**
```
NEXT_PUBLIC_SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz
SENTRY_AUTH_TOKEN=sntrys_... (für Source Maps Upload)
SENTRY_ORG=dein-org-name
SENTRY_PROJECT=digital-shopping-list
```

In Vercel unter Settings → Environment Variables setzen.

### 3. `next.config.js` anpassen

```javascript
const { withSentryConfig } = require("@sentry/nextjs");

// ... bestehender Code ...

module.exports = withSentryConfig(
  withNextIntl(nextConfig),
  {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  },
  {
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true,
  }
);
```

### 4. React Error Boundary (global)

Sentry fängt unhandled Errors automatisch. Für eine bessere UX zusätzlich eine Error-Boundary-Komponente einbauen:

**`src/components/error-boundary.tsx`:**
```typescript
"use client";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  Sentry.captureException(error);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h2 className="text-lg font-bold mb-2">Etwas ist schiefgelaufen</h2>
      <p className="text-gray-500 mb-4">Der Fehler wurde automatisch gemeldet.</p>
      <button onClick={reset} className="px-4 py-2 bg-aldi-blue text-white rounded">
        Erneut versuchen
      </button>
    </div>
  );
}
```

Diesen als `src/app/global-error.tsx` (Next.js Convention) oder in `layout.tsx` als Error Boundary einbinden.

### 5. API-Route-Fehler explizit erfassen

In den wichtigsten API-Routes die `catch`-Blöcke um Sentry erweitern:

```typescript
import * as Sentry from "@sentry/nextjs";

// In den catch-Blöcken:
catch (err) {
  Sentry.captureException(err, {
    extra: { upload_id, photo_type },
  });
  console.error("process-photo error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

Betroffene Dateien:
- `src/app/api/process-receipt/route.ts`
- `src/app/api/process-photo/route.ts`
- `src/app/api/upload-receipt-photo/route.ts`
- `src/app/api/process-flyer-page/route.ts`

---

## Fallstricke

1. **Free Plan Limit:** 5.000 Events/Monat. Bei vielen Nutzern mit Fehlern könnte das schnell voll sein. → `tracesSampleRate: 0.1` begrenzt Performance-Events. Fehler werden immer erfasst.

2. **Source Maps:** Sentry braucht Source Maps für lesbare Stack Traces. Der `SENTRY_AUTH_TOKEN` muss in Vercel gesetzt sein, damit Source Maps beim Build hochgeladen werden.

3. **DSGVO:** Sentry speichert IP-Adressen. In den Sentry-Projekteinstellungen unter "Security & Privacy" → "Data Scrubbing" die IP-Anonymisierung aktivieren.

4. **Bundle-Size:** `@sentry/nextjs` erhöht die Bundle-Size um ~30-50 KB (gzipped). Innerhalb des Performance-Budgets (< 200 KB gesamt).

---

## Testplan

- [ ] Absichtlich einen Fehler auslösen (z.B. `throw new Error("test")` in einer Komponente) → erscheint in Sentry
- [ ] API-Route-Fehler → erscheint in Sentry mit Kontext (upload_id etc.)
- [ ] Source Maps → Stack Traces zeigen Original-TypeScript-Code, nicht kompilierten JS-Code
- [ ] Sentry Dashboard → Fehler nach Environment (development/production) filterbar

---

## Specs aktualisieren

- `specs/ARCHITECTURE.md` → Monitoring-Sektion um Sentry erweitern
- `specs/CHANGELOG.md` → Eintrag hinzufügen

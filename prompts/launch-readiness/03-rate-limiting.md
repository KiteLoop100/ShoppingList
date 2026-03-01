# Prompt: Block 3 – Rate-Limiting & API-Validierung

## Empfohlenes Modell: Opus 4.6 (normal)

## Abhängigkeit: Block 0 (Account) sollte abgeschlossen sein (für per-User Limits)

---

## Kontext

Die API-Routes, die Claude Vision aufrufen, haben keine Rate-Limits und keine Input-Validierung. Jeder kann beliebig viele Requests senden und damit Anthropic-API-Kosten verursachen.

Betroffene Endpoints mit Claude-Calls:

| Route | Claude-Calls/Request | Datei |
|-------|---------------------|-------|
| `POST /api/process-receipt` | 1 (bis 5 Bilder) | `src/app/api/process-receipt/route.ts` |
| `POST /api/process-photo` | 1–6 (Foto + Crop + PDF-Seiten) | `src/app/api/process-photo/route.ts` |
| `POST /api/process-flyer-page` | 1 | `src/app/api/process-flyer-page/route.ts` |
| `POST /api/assign-category` | 1 | `src/app/api/assign-category/route.ts` |

Referenz: `specs/SECURITY-BACKLOG.md`, Items S5 und S6.

---

## Aufgabe

### 1. Anthropic API Budget-Limit (manuell, kein Code)

Im Anthropic Dashboard unter Usage → Limits ein monatliches Budget von $50 setzen. Das ist ein Sicherheitsnetz unabhängig vom Code.

### 2. Upstash Redis Rate-Limiting einrichten

1. **Upstash Account erstellen** (kostenlos): https://upstash.com
2. **Redis-Datenbank erstellen** (Free Plan: 10.000 Requests/Tag)
3. **Environment Variables** in `.env.local` und Vercel setzen:
   ```
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

4. **Package installieren:**
   ```bash
   npm install @upstash/ratelimit @upstash/redis
   ```

5. **Rate-Limit Helper erstellen: `src/lib/api/rate-limit.ts`**
   ```typescript
   import { Ratelimit } from "@upstash/ratelimit";
   import { Redis } from "@upstash/redis";

   const redis = new Redis({
     url: process.env.UPSTASH_REDIS_REST_URL!,
     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
   });

   // 5 Requests pro Stunde pro User (für Claude-Endpoints)
   export const claudeRateLimit = new Ratelimit({
     redis,
     limiter: Ratelimit.slidingWindow(5, "1 h"),
     analytics: true,
     prefix: "ratelimit:claude",
   });

   // 20 Requests pro Minute pro User (für normale Endpoints)
   export const generalRateLimit = new Ratelimit({
     redis,
     limiter: Ratelimit.slidingWindow(20, "1 m"),
     analytics: true,
     prefix: "ratelimit:general",
   });
   ```

6. **In jede Claude-API-Route einbauen:**
   ```typescript
   import { claudeRateLimit } from "@/lib/api/rate-limit";

   export async function POST(request: Request) {
     // Rate-Limit check (user_id aus Body oder Auth-Header)
     const body = await request.json();
     const userId = body.user_id || "anonymous";
     const { success, limit, remaining, reset } = await claudeRateLimit.limit(userId);

     if (!success) {
       return NextResponse.json(
         { error: "Rate limit exceeded. Try again later.", limit, remaining, reset },
         { status: 429 }
       );
     }

     // ... existing logic ...
   }
   ```

### 3. Input-Validierung mit Zod

1. **Package installieren:**
   ```bash
   npm install zod
   ```

2. **Schemas definieren und in Routes einsetzen:**

   **`/api/process-receipt`:**
   ```typescript
   import { z } from "zod";

   const processReceiptSchema = z.object({
     photo_urls: z.array(z.string().url()).min(1).max(5),
     user_id: z.string().min(1).max(100),
   });
   ```

   **`/api/upload-receipt-photo`:**
   ```typescript
   const uploadReceiptPhotoSchema = z.object({
     base64: z.string().min(100).max(5_000_000), // ~3.75 MB
     user_id: z.string().min(1).max(100),
     index: z.number().int().min(0).max(10),
     timestamp: z.number().int().positive(),
   });
   ```

   **`/api/process-photo`:**
   ```typescript
   const processPhotoSchema = z.object({
     upload_id: z.string().uuid(),
     photo_url: z.string().url(),
     is_pdf: z.boolean().optional(),
     data_extraction: z.boolean().optional(),
   });
   ```

3. **In jeder Route am Anfang validieren:**
   ```typescript
   const parseResult = processReceiptSchema.safeParse(body);
   if (!parseResult.success) {
     return NextResponse.json(
       { error: "Invalid input", details: parseResult.error.flatten() },
       { status: 400 }
     );
   }
   const { photo_urls, user_id } = parseResult.data;
   ```

### 4. Client-seitige Fehlerbehandlung

In `receipt-scanner.tsx`: Bei HTTP 429 eine benutzerfreundliche Meldung anzeigen:
```
"Du hast das Limit für Kassenzettel-Scans erreicht (max. 5 pro Stunde). Bitte versuche es später erneut."
```

Translation-Keys in `de.json` / `en.json` ergänzen.

---

## Fallstricke

1. **Admin-Routes:** Die Admin-Endpoints (`/api/admin/*`) sollten KEIN Rate-Limiting bekommen oder ein höheres Limit haben. Sie sind passwortgeschützt.

2. **Upstash Free Tier:** 10.000 Requests/Tag gesamt (Rate-Limit-Checks, nicht Claude-Calls). Bei 100 Nutzern und ~50 Checks/Nutzer/Tag = 5.000 → reicht.

3. **Graceful Degradation:** Wenn Upstash nicht konfiguriert ist (z.B. lokal), sollte das Rate-Limiting übersprungen werden (kein Crash):
   ```typescript
   if (!process.env.UPSTASH_REDIS_REST_URL) {
     // Skip rate limiting in dev
   }
   ```

---

## Testplan

- [ ] 5 Kassenzettel-Scans in einer Stunde → alle erfolgreich
- [ ] 6. Scan → HTTP 429 mit verständlicher Fehlermeldung
- [ ] Ungültiger Input (leerer Body, fehlende Felder) → HTTP 400 mit Zod-Fehlern
- [ ] Zu großes Base64-Bild → HTTP 400
- [ ] Admin-Routes → kein Rate-Limiting
- [ ] Ohne Upstash-Config (lokal) → App funktioniert normal, kein Rate-Limiting

---

## Specs aktualisieren

- `specs/SECURITY-BACKLOG.md` → S5 (Validation) und S6 (API-Schutz) auf 🟢 Erledigt setzen
- `specs/ARCHITECTURE.md` → Rate-Limiting Sektion ergänzen
- `specs/CHANGELOG.md` → Eintrag hinzufügen

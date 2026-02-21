# Deploy-Befehle (kopierfertig)

---

## 1 — Lokaler Build-Check (vor dem Deploy)

```bash
npm run build
```

---

## 2 — Supabase: Migrations anwenden (falls neue Migrationen existieren)

```bash
supabase db push
```

*Oder* im **Supabase Dashboard → SQL Editor** die gewünschte Migration aus `supabase/migrations/` manuell ausführen.

---

## 3 — Git: Änderungen committen und pushen (triggert Vercel Auto-Deploy)

```bash
git add .
git commit -m "Deploy: [kurze Beschreibung der Änderung]"
git push origin main
```

*(Branch ggf. anpassen, z.B. `master` statt `main`.)*

---

## 4 — Optional: Deploy per Vercel CLI (ohne Git-Push)

```bash
npx vercel --prod
```

*(Vorher: `npm i -g vercel` und `vercel login`.)*

---

## 5 — Optional: PWA-Icons neu erzeugen (vor Build/Deploy)

```bash
npx tsx scripts/generate-pwa-icons.ts
```

---

## Kurz-Checkliste

- [ ] `npm run build` lokal ohne Fehler
- [ ] Supabase-Migrationen angewendet (falls nötig)
- [ ] Env-Variablen in Vercel gesetzt (NEXT_PUBLIC_SUPABASE_*, ADMIN_PASSWORD, ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY)
- [ ] `git push` oder `vercel --prod`

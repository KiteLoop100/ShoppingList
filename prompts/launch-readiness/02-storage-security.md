# Prompt: Block 2 – Storage-Sicherheit (Kassenzettel)

## Empfohlenes Modell: Opus 4.6 (normal)

## Abhängigkeit: Block 0 (Account) muss abgeschlossen sein

---

## Kontext

Kassenzettel-Fotos werden im Bucket `product-photos` gespeichert (Pfad: `receipts/{userId}/{timestamp}_{index}.jpg`). Dieser Bucket ist `public: true` — jeder mit der URL kann die Fotos abrufen. Kassenzettel enthalten persönliche Einkaufsdaten.

Referenz: `specs/SECURITY-BACKLOG.md`, Item S1.

---

## Aufgabe

### 1. Neuen privaten Bucket erstellen

Migration oder Supabase Dashboard:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('receipt-photos', 'receipt-photos', false);
```

Storage-Policies für den Bucket:
```sql
-- Nur eigene Fotos lesen (über Pfad: receipts/{userId}/...)
CREATE POLICY "Users read own receipt photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipt-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Upload nur in eigenen Ordner (über Admin Client, daher optional)
-- Die API-Route nutzt den Admin-Client für Upload → keine User-Policy nötig
```

### 2. Upload-Route anpassen: `src/app/api/upload-receipt-photo/route.ts`

**Ist-Zustand (Zeile 29, 33, 44-46):**
```typescript
const path = `receipts/${user_id}/${timestamp}_${index}.jpg`;
await supabase.storage.from("product-photos").upload(path, buffer, ...);
const { data: urlData } = supabase.storage.from("product-photos").getPublicUrl(path);
```

**Soll-Zustand:**
```typescript
const path = `${user_id}/${timestamp}_${index}.jpg`;
await supabase.storage.from("receipt-photos").upload(path, buffer, ...);

// Signed URL statt Public URL (10 Min gültig, reicht für Claude-Verarbeitung)
const { data: signedData } = await supabase.storage
  .from("receipt-photos")
  .createSignedUrl(path, 600); // 600 Sekunden = 10 Minuten

return NextResponse.json({ url: signedData.signedUrl });
```

### 3. Process-Receipt-Route prüfen: `src/app/api/process-receipt/route.ts`

Die Route empfängt `photo_urls` und sendet sie an Claude Vision. Claude unterstützt Signed URLs, solange sie zum Zeitpunkt des Aufrufs gültig sind (10 Min ist ausreichend). **Keine Änderung nötig**, aber prüfen ob die URLs korrekt ankommen.

### 4. Kassenzettel-Anzeige anpassen: `src/app/[locale]/receipts/[receiptId]/page.tsx`

Falls die Detailseite Kassenzettel-Fotos anzeigt: Diese laden aktuell Public URLs aus `receipts.photo_urls`. Nach der Änderung müssen Signed URLs on-demand generiert werden.

**Ansatz:** API-Route oder Server-Component, die für die gespeicherten Pfade Signed URLs erzeugt:
```typescript
// In der receipts detail page (server-side oder API)
const signedUrls = await Promise.all(
  receipt.photo_urls.map(path =>
    supabase.storage.from('receipt-photos').createSignedUrl(path, 300)
  )
);
```

**Wichtig:** In `receipts.photo_urls` müssen nach der Migration die **Storage-Pfade** gespeichert sein (nicht die Public URLs). Die Upload-Route muss den Pfad statt der URL speichern.

### 5. Bestehende Fotos migrieren (optional)

Bestehende Kassenzettel-Fotos liegen in `product-photos/receipts/...`. Diese können per Script in den neuen Bucket kopiert und die `receipts.photo_urls` aktualisiert werden. Für den Friendly User Test ist das optional — es betrifft nur deine eigenen Test-Kassenzettel.

---

## Fallstricke

1. **Claude braucht die URL sofort:** Die Signed URL muss beim Aufruf von `/api/process-receipt` noch gültig sein. 10 Minuten Gültigkeit sind ausreichend, da der Upload und die Verarbeitung hintereinander ablaufen.

2. **`photo_urls` in der DB:** Aktuell werden Public URLs gespeichert. Nach der Änderung müssen Storage-Pfade gespeichert werden, damit on-demand Signed URLs erzeugt werden können. Das ist ein Breaking Change für bestehende Einträge.

3. **Product-Photos Bucket bleibt public:** Der Bucket `product-photos` (für Produkt-Thumbnails, Fotos aus dem Laden) bleibt `public: true`. Nur die Kassenzettel-Fotos wandern in den privaten Bucket.

---

## Testplan

- [ ] Kassenzettel fotografieren → Upload in `receipt-photos` Bucket (nicht `product-photos`)
- [ ] Claude Vision empfängt Signed URL → OCR funktioniert
- [ ] Kassenzettel-Detailseite zeigt Fotos an (über Signed URLs)
- [ ] Direkter Zugriff auf alte Public URL → funktioniert nicht (404 oder 403)
- [ ] Anderer User → kann Fotos nicht sehen

---

## Specs aktualisieren

- `specs/SECURITY-BACKLOG.md` → S1 auf 🟢 Erledigt setzen
- `specs/ARCHITECTURE.md` → Storage-Diagramm um `receipt-photos` Bucket erweitern
- `specs/CHANGELOG.md` → Eintrag hinzufügen

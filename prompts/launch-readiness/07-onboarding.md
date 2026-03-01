# Prompt: Block 7 – Onboarding für neue Nutzer

## Empfohlenes Modell: Opus 4.6 (normal)

## Abhängigkeit: Block 0 (Account) — Login-Flow muss stehen

---

## Kontext

Aktuell startet die App mit einer leeren Einkaufsliste und einem Suchfeld. Neue Nutzer im Friendly User Test wissen nicht, was die App kann und wie sie sie bedienen. Ein kurzes Onboarding reduziert die Abbruchrate.

---

## Aufgabe

### 1. Onboarding-Flow (3 Screens)

Beim allerersten App-Start (kein Account, kein `localStorage`-Flag `onboarding-complete`):

**Screen 1: Willkommen**
```
┌─────────────────────────────────────────┐
│                                         │
│         🛒                              │
│                                         │
│     Willkommen bei der                  │
│     Digitalen Einkaufsliste             │
│                                         │
│     Deine Einkaufsliste, die sich       │
│     nach der Reihenfolge im Laden       │
│     sortiert.                           │
│                                         │
│              [Weiter →]                 │
│                                         │
│           ● ○ ○                         │
└─────────────────────────────────────────┘
```

**Screen 2: So funktioniert's**
```
┌─────────────────────────────────────────┐
│                                         │
│     1. Suche Produkte oben              │
│        im Suchfeld                      │
│                                         │
│     2. Hake sie beim Einkaufen ab       │
│                                         │
│     3. Die Liste lernt die              │
│        Reihenfolge deines Ladens        │
│                                         │
│              [Weiter →]                 │
│                                         │
│           ○ ● ○                         │
└─────────────────────────────────────────┘
```

**Screen 3: Loslegen**
```
┌─────────────────────────────────────────┐
│                                         │
│     📷 Scanne Kassenzettel,             │
│        um Preise zu speichern           │
│                                         │
│     📋 Erstelle ein Konto,              │
│        um deine Liste auf               │
│        mehreren Geräten zu nutzen       │
│                                         │
│         [Los geht's! →]                 │
│                                         │
│           ○ ○ ●                         │
└─────────────────────────────────────────┘
```

### 2. Implementierung

- **Neue Komponente `src/components/onboarding/onboarding-flow.tsx`**
- Vollbild-Overlay, swipeable (Touch-Gesten) oder mit Buttons
- Clean Design mit ALDI-Farben
- Nach "Los geht's": `localStorage.setItem('onboarding-complete', 'true')` setzen und schließen
- Automatisch `signInAnonymously()` im Hintergrund (wenn nicht schon geschehen)

### 3. Wann anzeigen

In `src/app/[locale]/page.tsx` (Home):
```typescript
const [showOnboarding, setShowOnboarding] = useState(false);

useEffect(() => {
  const done = localStorage.getItem('onboarding-complete');
  if (!done) setShowOnboarding(true);
}, []);
```

### 4. Standard-Laden über GPS setzen

Beim Onboarding-Flow (oder direkt danach) GPS-Permission anfragen und den nächsten Laden als Default setzen. Die Logik dafür existiert bereits (`detectAndSetStoreForList`). Ggf. auf dem letzten Screen einen dezenten Hinweis:

```
"Erlaube den Standortzugriff, damit die App deinen Laden erkennt."
```

### 5. Translation-Keys

Alle Texte über `de.json` / `en.json` Translation-Keys.

---

## Design-Prinzipien

- Maximal 3 Screens (Nutzer sollen schnell loslegen)
- Kein Skip-Button auf Screen 1 (zu kurz zum Skippen)
- Große Touch-Targets für "Weiter"
- Swipe-Gesten (links/rechts) als Alternative zu den Buttons
- Kein Video, keine Animation (schnell und leichtgewichtig)
- Dot-Indicator (● ○ ○) für Position

---

## Fallstricke

1. **Nicht bei wiederkehrenden Nutzern:** Das `localStorage`-Flag verhindert, dass das Onboarding nochmal angezeigt wird. Aber: Wenn der Nutzer den Browser-Cache löscht, erscheint es erneut. Das ist OK.

2. **Nicht bei Login auf neuem Gerät:** Wenn ein registrierter Nutzer sich auf einem neuen Gerät einloggt, sollte das Onboarding NICHT angezeigt werden (er kennt die App). → Prüfen ob `auth.user` existiert und nicht anonym ist → kein Onboarding.

3. **GPS-Permission:** Die Browser-Permission-Anfrage sollte NICHT im Onboarding-Overlay passieren (wird von vielen Browsern blockiert wenn nicht User-initiated). Stattdessen: Nach dem Onboarding, beim ersten Laden der Home-Seite, wird `detectAndSetStoreForList` aufgerufen → das triggert die GPS-Permission.

---

## Testplan

- [ ] Erster App-Start → Onboarding erscheint
- [ ] "Los geht's" → Onboarding verschwindet, leere Liste sichtbar
- [ ] Zweiter App-Start → kein Onboarding
- [ ] Neues Gerät mit Login → kein Onboarding (registrierter User)
- [ ] Neues Gerät ohne Login → Onboarding (anonymer User)
- [ ] Swipe-Gesten → funktionieren
- [ ] DE und EN → korrekte Texte

---

## Specs aktualisieren

- `specs/UI.md` → Onboarding-Screens beschreiben
- `specs/CHANGELOG.md` → Eintrag hinzufügen

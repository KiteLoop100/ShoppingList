# Produktdaten-Anforderungen für ALDI SÜD Datenanfrage

## MVP-Pflichtfelder (für Grundfunktion der App)

| Feld | Beispiel | Warum benötigt |
|------|----------|---------------|
| Produktname | "Fettarme Milch 1,5% 1L" | Anzeige und Suche |
| Marke/Eigenmarke | "Milsani" | Markensuche, Gruppierung |
| Customer Demand Group | "Frische & Kühlung" | Kategorisierung, Sortierung |
| Customer Demand Sub-Group | "Weiße Linie" | Feinere Sortierung |
| Verkaufspreis (EUR) | 0.99 | Preisschätzung |
| EAN/Barcode | 4061462123456 | Barcode-Scanner Feature |
| Sortimentstyp | Daily Range / Special | Verfügbarkeitsanzeige |
| Artikelnummer (intern) | 12345 | Eindeutige Identifikation, Duplikaterkennung |

## Sehr wünschenswert (verbessert App-Qualität deutlich)

| Feld | Beispiel | Warum benötigt |
|------|----------|---------------|
| Abverkaufsmenge (Einheiten/Woche) | 1.200 | Beliebtheit-Ranking in Suchergebnissen |
| Gebindegröße/Menge | "1L", "200g", "6er Pack" | Anzeige, Unterscheidung ähnlicher Produkte |
| Regional/National | National | Regionale Verfügbarkeit |
| Regionskennung | "Bayern", "NRW" | Falls regional: Wo verfügbar |

## Nice-to-have (für spätere Versionen)

| Feld | Beispiel | Möglicher Nutzen |
|------|----------|-----------------|
| Nährwerte (kcal, Fett, Zucker, Eiweiß pro 100g) | 47 kcal, 1,5g Fett | Ernährungs-Features, Filter "kalorienarm" |
| Allergene | "Enthält Laktose" | Allergen-Filter, Warnhinweise |
| Produktbild-URL | https://... | Visuelle Darstellung in der App |
| Bio/Vegan/Vegetarisch | Bio | Filter-Features |
| Herkunftsland | Deutschland | Transparenz-Features |
| Grundpreis | "€0,99/L" | Preisvergleich zwischen Gebindegrößen |
| Zutatenliste | "Milch, Vitamin D" | Detail-Ansicht |
| Mindesthaltbarkeit (typisch) | "14 Tage" | Einkaufsplanung |
| Aktionszeitraum (bei Specials) | "12.02. - 18.02.2025" | Verfügbarkeitsanzeige |

## Filialinformationen

| Feld | Beispiel | Hinweis |
|------|----------|--------|
| Filial-ID | 12345 | Eindeutige Identifikation |
| Adresse (Straße, Hausnummer) | "Musterstraße 12" | Pflicht |
| PLZ | 80331 | Pflicht |
| Stadt | "München" | Pflicht |
| Land | DE / AT | Pflicht |
| GPS-Koordinaten | Optional | Können aus Adresse berechnet werden (Geocoding) |

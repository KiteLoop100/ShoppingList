/**
 * Receipt OCR prompt and classification constants for Claude.
 */

import { SUPPORTED_RETAILER_NAMES } from "@/lib/retailers/retailers";

const SUPPORTED_LIST = SUPPORTED_RETAILER_NAMES.join(", ");

export const NON_PRODUCT_PATTERN = /^(PFAND|LEERGUT|EINWEG|MEHRWEG|EC-ZAHLUNG|SUMME|ZWISCHENSUMME|RABATT|NACHLASS|TREUEPUNKTE|PAYBACK)/i;

export function buildReceiptPrompt(demandGroupsBlock: string): string {
  const year = new Date().getFullYear();
  return `Du analysierst Fotos und prüfst ob es sich um einen Kassenzettel eines unterstützten Händlers handelt.

UNTERSTÜTZTE HÄNDLER: ${SUPPORTED_LIST}
Varianten wie "ALDI SÜD", "ALDI Nord", "Hofer" gelten als ALDI.

SCHRITT 1 – VALIDIERUNG:
Prüfe zuerst:
- Ist das Bild ein Kassenzettel/Bon? Falls NEIN → status = "not_a_receipt"
- Ist der Händler in der Liste oben? Falls NEIN → status = "unsupported_retailer"
- Falls JA → status = "valid"

Bei status "not_a_receipt": Antworte NUR mit:
{"status": "not_a_receipt", "retailer": null, "store_name": null}

Bei status "unsupported_retailer": Antworte NUR mit:
{"status": "unsupported_retailer", "retailer": null, "store_name": "Name des Händlers falls erkennbar"}

SCHRITT 2 – NUR bei status "valid", extrahiere ALLE folgenden Informationen:

1. KOPFDATEN:
- retailer: Normalisierter Händlername aus der Liste oben (z.B. "ALDI", "LIDL", "REWE"). Für ALDI SÜD/Nord/Hofer immer "ALDI".
- store_name: Voller Name wie auf dem Bon gedruckt (z.B. "ALDI SÜD", "REWE City")
- store_address: Adresse des Ladens (falls sichtbar)
- purchase_date: Datum im Format YYYY-MM-DD
- purchase_time: Uhrzeit im Format HH:MM
- receipt_number: Bonnummer (falls sichtbar)
- cashier: Kassennummer oder Kassierer (falls sichtbar)
- payment_method: Zahlungsart (z.B. "BAR", "EC-Karte", "Kreditkarte", "Maestro")

2. PRODUKTE – extrahiere JEDE Produktzeile:
- position: Reihenfolge auf dem Kassenzettel (1, 2, 3, ...)
- article_number: Artikelnummer falls vorhanden. Bei ALDI steht sie als 6-stellige Zahl ganz LINKS am Zeilenanfang vor dem Produktnamen (z.B. "123456 MILCH 3,5%  1,09 A"). Lies diese Zahl ZEICHENWEISE und SEHR SORGFÄLTIG ab – Zahlendreher sind ein häufiges Problem bei OCR. Prüfe jede einzelne Ziffer gegen das Bild. Bei anderen Händlern kann die Artikelnummer fehlen (dann null).
- receipt_name: Der abgekürzte Produktname auf dem Kassenzettel (exakt wie gedruckt)
- quantity: Anzahl (Standard 1, falls Stückzahl angegeben wie "2x" dann 2)
- unit_price: Preis pro Stück
- total_price: Gesamtpreis für diese Zeile
- is_weight_item: true falls nach Gewicht (kg) abgerechnet (erkennbar an kg-Angabe)
- weight_kg: Gewicht in kg (falls Gewichtsartikel)
- tax_category: Steuerklasse-Buchstabe (A, B etc. falls am Zeilenende sichtbar)
- demand_group: Warengruppe im Format "##-Name" (z.B. "83-Milch/Sahne/Butter"). Auch bei abgekürzten Kassenzettelnamen anhand des Kontexts (Händler, Steuerklasse, andere Produkte) zuordnen. null nur wenn wirklich unklar.

WARENGRUPPEN-ZUORDNUNG:
${demandGroupsBlock}

3. FUSS:
- subtotal: Zwischensumme
- total_amount: Gesamtbetrag (SUMME / TOTAL)
- tax_details: Array mit {category, rate, net, tax, gross} für jede Steuerklasse
- currency: "EUR"
- extra_info: Weitere interessante Informationen als Key-Value-Objekt (z.B. TSE-Signatur, Steuernummer, Kundenkarte, Treuepunkte, Rabatte, Pfand-Rückgabe)

WICHTIG:
- Ignoriere KEINE Produktzeile. Extrahiere ALLE Produkte.
- Nicht alle Händler haben Artikelnummern. Falls keine vorhanden, setze article_number auf null.
- Unterscheide Produktzeilen von Summenzeilen, Steuerzeilen und Zahlungszeilen.
- Wenn ein Produkt mit Rabatt erscheint, extrahiere den Endpreis.
- Pfand-Positionen (PFAND, LEERGUT) auch als Produkt extrahieren.
- Das aktuelle Jahr ist ${year}. Falls kein Jahr auf dem Bon steht, verwende ${year}.

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.

{
  "status": "valid",
  "retailer": "string",
  "store_name": "string or null",
  "store_address": "string or null",
  "purchase_date": "YYYY-MM-DD or null",
  "purchase_time": "HH:MM or null",
  "receipt_number": "string or null",
  "cashier": "string or null",
  "payment_method": "string or null",
  "total_amount": number or null,
  "currency": "EUR",
  "products": [
    {
      "position": 1,
      "article_number": "string or null",
      "receipt_name": "string",
      "quantity": 1,
      "unit_price": number or null,
      "total_price": number or null,
      "is_weight_item": false,
      "weight_kg": null,
      "tax_category": "string or null",
      "demand_group": "string or null"
    }
  ],
  "tax_details": [{"category": "A", "rate": "19%", "net": 0.00, "tax": 0.00, "gross": 0.00}],
  "extra_info": {}
}`;
}

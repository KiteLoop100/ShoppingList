export function buildSavingsPrompt(locale: string): string {
  return locale === "de"
    ? `Analysiere meine Einkäufe und finde Sparpotenziale:
- Identifiziere teurere Produkte, für die es günstigere ALDI-Eigenmarken gibt.
- Berechne geschätztes monatliches Sparpotenzial.
- Gib 3-5 konkrete Tipps.
- Nenne wenn möglich konkrete Produktnamen und Preise aus meinen Daten.`
    : `Analyze my purchases and find savings potential:
- Identify expensive products that have cheaper ALDI private-label alternatives.
- Calculate estimated monthly savings potential.
- Give 3-5 concrete tips.
- Reference specific product names and prices from my data where possible.`;
}

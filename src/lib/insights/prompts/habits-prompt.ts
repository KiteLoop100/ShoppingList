export function buildHabitsPrompt(locale: string): string {
  return locale === "de"
    ? `Analysiere meine Einkaufsgewohnheiten:
- Wie oft kaufe ich ein (Frequenz pro Woche)?
- Was sind meine am häufigsten gekauften Produkte?
- Gibt es saisonale Muster oder wiederkehrende Einkäufe?
- Wie groß ist ein typischer Einkauf (Anzahl Produkte, Betrag)?
- Gib 2-3 Optimierungsvorschläge.`
    : `Analyze my shopping habits:
- How often do I shop (frequency per week)?
- What are my most frequently purchased products?
- Are there seasonal patterns or recurring purchases?
- How large is a typical shopping trip (number of products, amount)?
- Give 2-3 optimization suggestions.`;
}

export function buildSpendingPrompt(locale: string): string {
  return locale === "de"
    ? `Analysiere meine Ausgaben:
- Zeige die Verteilung nach Produktkategorien.
- Identifiziere die größten Kostentreiber.
- Vergleiche den wöchentlichen Trend (steigend/fallend/stabil).
- Nenne das durchschnittliche Ausgabenniveau pro Woche und pro Einkauf.
- Gib 2-3 Hinweise zu Auffälligkeiten.`
    : `Analyze my spending:
- Show the distribution by product category.
- Identify the biggest cost drivers.
- Compare the weekly trend (rising/falling/stable).
- State the average spending level per week and per trip.
- Give 2-3 observations about notable patterns.`;
}

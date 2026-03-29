export function buildNutritionPrompt(
  locale: string,
  householdSize: number,
): string {
  return locale === "de"
    ? `Erstelle eine Ernährungsanalyse basierend auf meinen Einkäufen:
- Berechne die ungefähre tägliche Kalorienzufuhr pro Person (Haushaltsgröße: ${householdSize} Personen).
- Zeige das Verhältnis von Protein, Kohlenhydraten und Fett.
- Bewerte ob die Nährstoffverteilung ausgewogen ist.
- Weise darauf hin, wenn für viele Produkte keine Nährwertdaten vorhanden sind.
- Keine medizinische Beratung — nur informative Analyse.
Annahme: Alle gekauften Lebensmittel werden im Haushalt verbraucht.`
    : `Create a nutrition analysis based on my purchases:
- Calculate approximate daily calorie intake per person (household size: ${householdSize} people).
- Show the ratio of protein, carbohydrates, and fat.
- Assess whether the nutrient distribution is balanced.
- Note if nutritional data is missing for many products.
- No medical advice — informational analysis only.
Assumption: All purchased food is consumed in the household.`;
}

export function buildCustomPrompt(
  locale: string,
  query: string,
): string {
  const preamble =
    locale === "de"
      ? "Beantworte die folgende Frage basierend auf meinen Einkaufsdaten:"
      : "Answer the following question based on my shopping data:";

  return `${preamble}\n\n${query}`;
}

export function buildHealthPrompt(locale: string): string {
  return locale === "de"
    ? `Analysiere meine Einkäufe hinsichtlich gesunder Ernährung:
- Bewerte die Balance zwischen verarbeiteten und frischen Produkten.
- Schlage gesündere Alternativen vor, die bei ALDI erhältlich sind.
- Identifiziere häufig gekaufte Produkte mit hohem Zucker-/Salzgehalt.
- Gib 3-5 allgemeine Tipps (keine medizinische Beratung).`
    : `Analyze my purchases regarding healthy eating:
- Assess the balance between processed and fresh products.
- Suggest healthier alternatives available at ALDI.
- Identify frequently purchased products with high sugar/salt content.
- Give 3-5 general tips (not medical advice).`;
}

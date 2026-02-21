/**
 * Strukturierte Liste für Demand-Group- und Demand-Sub-Group-Dropdowns
 * (z. B. manuelles Produkt anlegen, Review-Karte).
 * Muss mit DEMAND_GROUPS_INSTRUCTION / process-photo Prompts übereinstimmen.
 */

export interface DemandGroupOption {
  group: string;
  subGroups: string[];
}

export const DEMAND_GROUPS_LIST: DemandGroupOption[] = [
  { group: "Drogerie & Körperpflege", subGroups: ["Deodorant", "Duschgel", "Gesichtspflege", "Haarpflege", "Haarstyling", "Körperpflege", "Kosmetik / Make-up", "Mundpflege", "Rasur", "Seife / Handpflege", "Zahnpflege", "Baby-/Kinderpflege"] },
  { group: "Feinkost & Delikatessen", subGroups: ["Antipasti / Delikatessen", "Aufstriche BIO", "Crackers / Gebäck", "Pralinen / Confiserie"] },
  { group: "Fertiggerichte", subGroups: ["Pasta / Teigwaren"] },
  { group: "Fisch & Meeresfrüchte", subGroups: ["Fischfilet", "Garnelen", "Lachs", "Räucherlachs", "Räucherfisch", "Hering", "Matjes"] },
  { group: "Frischfleisch", subGroups: ["Geflügel", "Hackfleisch gemischt", "Hackfleisch Rind", "Rindfleisch", "Kalbfleisch"] },
  { group: "Frühstück & Cerealien", subGroups: ["Cerealien / Müsli", "Porridge / Haferflocken", "Aufstriche / Brotbelag", "Backmischung"] },
  { group: "Getränke", subGroups: ["Mineralwasser", "Cola", "Limonade / Softdrink", "Eistee", "Frischsaft / Smoothie", "Pflanzenmilch"] },
  { group: "Gewürze & Würzmittel", subGroups: ["Gewürze gemahlen", "Kräuter getrocknet", "Pfeffer", "Salz"] },
  { group: "Haushalt & Küche", subGroups: ["Alufolie", "Backpapier", "Frischhaltefolie", "Gefrierbeutel"] },
  { group: "Hygieneartikel", subGroups: ["Damenhygiene", "Tampons", "Inkontinenz"] },
  { group: "Kaffee & Tee", subGroups: ["Kaffee", "Kaffee / Espresso", "Kaffee / Kapselkaffee"] },
  { group: "Käse", subGroups: ["Frischkäse", "Hartkäse", "Schnittkäse", "Weichkäse", "Reibekäse", "Schmelzkäse", "Ziegenkäse"] },
  { group: "Milchprodukte", subGroups: ["Butter", "Joghurt", "Sahne", "Quark", "Milch"] },
  { group: "Obst & Gemüse", subGroups: ["Gemüse / Tomaten", "Gemüse / Paprika", "Gemüse / Gurken", "Gemüse / Kartoffeln", "Gemüse / Salat", "Gemüse / Zwiebeln", "Obst / Bananen", "Obst / Zitrusfrüchte", "Obst / Kernobst", "Beeren / Obst", "Kräuter frisch", "Pilze"] },
  { group: "Papierprodukte & Haushalt", subGroups: ["Toilettenpapier", "Küchenrolle", "Taschentücher", "Servietten"] },
  { group: "Pasta & Reis", subGroups: ["Pasta", "Pastasaucen"] },
  { group: "Saucen & Dressings", subGroups: ["Ketchup", "Mayonnaise", "BBQ Sauce"] },
  { group: "Spirituosen", subGroups: ["Gin", "Vodka", "Whisky", "Rum"] },
  { group: "Süßwaren & Snacks", subGroups: ["Schokolade", "Chips / Knabbergebäck", "Fruchtgummi", "Kekse / Gebäck", "Nüsse / Trockenfrüchte", "Schokoriegel"] },
  { group: "Tierbedarf", subGroups: ["Katzenstreu"] },
  { group: "Waschmittel & Reinigung", subGroups: ["Waschmittel flüssig", "Spülmaschinentabs", "Spülmittel", "Allzweckreiniger", "WC-Reiniger", "Weichspüler", "Müllsäcke"] },
  { group: "Wein", subGroups: ["Rotwein", "Weißwein trocken", "Rosé"] },
  { group: "World Food & Konserven", subGroups: ["Asia Fertiggerichte", "Fischkonserven", "Konserven / Tomaten", "Öle & Essig", "Pesto / Saucen"] },
  { group: "Wurst & Aufschnitt", subGroups: ["Salami", "Schinken", "Kochschinken", "Aufschnitt", "Geflügelaufschnitt", "Rohschinken"] },
];

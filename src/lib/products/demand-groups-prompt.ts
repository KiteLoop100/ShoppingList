/**
 * Shared instruction text for Demand Groups / Demand Sub-Groups.
 * Uses official ALDI commodity group codes (##-Name format).
 * Used in process-photo prompts and batch-jobs.
 */

import { DEMAND_GROUPS_LIST } from "./demand-groups-list";

export const DEMAND_GROUPS_INSTRUCTION =
  "Ordne jedes Produkt einer demand_group und demand_sub_group zu. Verwende die OFFIZIELLEN ALDI Warengruppen-Codes (Format: '##-Name'). Wähle AUS DIESER LISTE – erfinde keine neuen Werte:\n\n" +
  "Demand Groups und ihre Sub-Groups:\n" +
  DEMAND_GROUPS_LIST.map(
    (g) => `- ${g.group}: ${g.subGroups.join(", ")}`,
  ).join("\n");

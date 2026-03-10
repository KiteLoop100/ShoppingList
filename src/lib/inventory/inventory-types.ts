export type InventoryStatus = "sealed" | "opened" | "consumed";
export type InventorySource = "receipt" | "manual" | "barcode" | "photo";

export interface InventoryItem {
  id: string;
  user_id: string;
  product_id: string | null;
  competitor_product_id: string | null;
  display_name: string;
  demand_group_code: string | null;
  thumbnail_url: string | null;
  quantity: number;
  status: InventoryStatus;
  source: InventorySource;
  source_receipt_id: string | null;
  added_at: string;
  opened_at: string | null;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryUpsertInput {
  product_id: string | null;
  competitor_product_id: string | null;
  display_name: string;
  demand_group_code: string | null;
  thumbnail_url?: string | null;
  quantity: number;
  source: InventorySource;
  source_receipt_id?: string | null;
}

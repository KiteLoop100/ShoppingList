/**
 * Seed data for IndexedDB bootstrap (categories + stores).
 *
 * Categories match the official ALDI category set in Supabase.
 * Products are no longer seeded — all product data comes from the ALDI import.
 */

import type { Category, Product, Store } from "@/types";

function now(): string {
  return new Date().toISOString();
}

export const SEED_CATEGORIES: Category[] = [
  { category_id: "94e53341-fba0-4a58-b68e-a79d0e4e2176", name: "Alcoholic Beverages", name_translations: { en: "Alcoholic Beverages", de: "Alkoholische Getränke" }, icon: "🍷", default_sort_position: 1 },
  { category_id: "94248ca8-8cc7-4652-bcf3-b99699e92876", name: "Bakery", name_translations: { en: "Bakery", de: "Brot & Backwaren" }, icon: "🍞", default_sort_position: 2 },
  { category_id: "3c76db4b-9ac3-44db-bb27-2e0b53476c97", name: "Breakfast", name_translations: { en: "Breakfast", de: "Frühstück" }, icon: "🥣", default_sort_position: 3 },
  { category_id: "81d737a2-27ed-4076-961c-c722edbd8380", name: "Chilled Convenience", name_translations: { en: "Chilled Convenience", de: "Kühlregal" }, icon: "🥗", default_sort_position: 4 },
  { category_id: "a47ef71f-acb1-466e-afe3-0fbc35ef9c4b", name: "Dairy", name_translations: { en: "Dairy", de: "Milchprodukte" }, icon: "🥛", default_sort_position: 5 },
  { category_id: "f0681b0d-d1c4-4817-82d3-fa9557cd9914", name: "Electronics", name_translations: { en: "Electronics", de: "Elektronik" }, icon: "🔌", default_sort_position: 6 },
  { category_id: "6245afa4-a452-48bb-be7a-c8091fc8a0f8", name: "Fashion", name_translations: { en: "Fashion", de: "Textilien" }, icon: "👕", default_sort_position: 7 },
  { category_id: "b0a6a7fb-7346-4418-8ba7-9816e438945f", name: "Freezer", name_translations: { en: "Freezer", de: "Tiefkühl" }, icon: "🧊", default_sort_position: 8 },
  { category_id: "66aa5c44-83ae-4998-b657-b376ce72594c", name: "Fresh Meat & Fish", name_translations: { en: "Fresh Meat & Fish", de: "Frischfleisch & Fisch" }, icon: "🥩", default_sort_position: 9 },
  { category_id: "a64ecc66-5923-4ce8-a2a5-a4786ed7c730", name: "Fruits & Vegetables", name_translations: { en: "Fruits & Vegetables", de: "Obst & Gemüse" }, icon: "🍎", default_sort_position: 10 },
  { category_id: "dfc34a53-e056-4bbb-b725-c02411f5b381", name: "Health, Beauty & Baby", name_translations: { en: "Health, Beauty & Baby", de: "Gesundheit, Pflege & Baby" }, icon: "💊", default_sort_position: 11 },
  { category_id: "cde99817-9d3e-46a8-aa7b-a21c477a9b80", name: "Home Improvement", name_translations: { en: "Home Improvement", de: "Haus & Garten" }, icon: "🔨", default_sort_position: 12 },
  { category_id: "a4fd1fe8-999f-492a-a541-b962daf08fd1", name: "Household", name_translations: { en: "Household", de: "Haushalt" }, icon: "🧹", default_sort_position: 13 },
  { category_id: "8af9a3d2-c101-475c-987b-0f96a02d20fc", name: "Non-Alcoholic Beverages", name_translations: { en: "Non-Alcoholic Beverages", de: "Alkoholfreie Getränke" }, icon: "🥤", default_sort_position: 14 },
  { category_id: "30aa07d6-c6c4-4660-b82f-53ad056db581", name: "Outdoor/Leisure", name_translations: { en: "Outdoor/Leisure", de: "Freizeit & Outdoor" }, icon: "⛺", default_sort_position: 15 },
  { category_id: "ac9928f4-1ce4-4f08-9f47-618bc505f9b6", name: "Pantry", name_translations: { en: "Pantry", de: "Vorratskammer" }, icon: "🍚", default_sort_position: 16 },
  { category_id: "ac512656-e4ce-4c4e-9888-67d6ceea7686", name: "Services", name_translations: { en: "Services", de: "Services" }, icon: "📱", default_sort_position: 17 },
  { category_id: "1b3a7e69-bdf2-4ec8-b012-f7d8b05e33c0", name: "Snacking", name_translations: { en: "Snacking", de: "Süßwaren & Snacks" }, icon: "🍫", default_sort_position: 18 },
  { category_id: "cf9d6752-612b-43c7-904e-69d97a8e6ea3", name: "Sonstiges", name_translations: { en: "Other", de: "Sonstiges" }, icon: "📦", default_sort_position: 19 },
  { category_id: "8c7f9179-2330-40d8-a789-6194f04d7406", name: "Aktionsartikel", name_translations: { en: "Promotional Items", de: "Aktionsartikel" }, icon: "🏷️", default_sort_position: 90 },
];

/** Demo stores for F04 (GPS radius ~50–100m). Coordinates are example values. */
export const SEED_STORES: Store[] = [
  {
    store_id: "store-aldi-musterstr",
    name: "ALDI SÜD Musterstraße",
    address: "Musterstraße 12, 40215 Düsseldorf",
    city: "Düsseldorf",
    postal_code: "40215",
    country: "DE",
    latitude: 51.2277,
    longitude: 6.7735,
    has_sorting_data: false,
    sorting_data_quality: 0,
    created_at: now(),
    updated_at: now(),
  },
  {
    store_id: "store-aldi-konrad",
    name: "ALDI SÜD Konrad-Adenauer-Platz",
    address: "Konrad-Adenauer-Platz 1, 40210 Düsseldorf",
    city: "Düsseldorf",
    postal_code: "40210",
    country: "DE",
    latitude: 51.2189,
    longitude: 6.7812,
    has_sorting_data: false,
    sorting_data_quality: 0,
    created_at: now(),
    updated_at: now(),
  },
  {
    store_id: "store-aldi-schadow",
    name: "ALDI SÜD Schadowstraße",
    address: "Schadowstraße 42, 40212 Düsseldorf",
    city: "Düsseldorf",
    postal_code: "40212",
    country: "DE",
    latitude: 51.2245,
    longitude: 6.7820,
    has_sorting_data: false,
    sorting_data_quality: 0,
    created_at: now(),
    updated_at: now(),
  },
];

/** @deprecated Products are now imported from official ALDI data, not seeded. */
export const SEED_PRODUCTS: Product[] = [];

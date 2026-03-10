import type { ExtractedProductInfo } from "@/lib/product-photo-studio/types";
import type { ProductCaptureValues } from "@/components/product-capture/hooks/use-product-capture-form";
import type { PhotoCategory } from "./classify-photo-category";
import type { FieldConflict } from "./detect-field-conflicts";

export interface ClassifiedPhoto {
  index: number;
  category: PhotoCategory | null;
  photo_type: string;
  quality_score: number;
  is_product_photo: boolean;
}

export interface PhotoAssignment {
  index: number;
  category: PhotoCategory | null;
  isThumbnail: boolean;
}

const FIELD_MAP: Array<{
  key: keyof ProductCaptureValues;
  extract: (e: ExtractedProductInfo) => string | null;
  transform?: (v: string) => string;
}> = [
  { key: "name", extract: (e) => e.name },
  { key: "brand", extract: (e) => e.brand },
  { key: "ean", extract: (e) => e.ean_barcode },
  { key: "articleNumber", extract: (e) => e.article_number },
  {
    key: "price",
    extract: (e) => (e.price != null ? String(e.price) : null),
    transform: (v) => v.replace(".", ","),
  },
  { key: "weightOrQuantity", extract: (e) => e.weight_or_quantity },
];

function normalizeForComparison(value: string): string {
  return value.replace(",", ".").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Auto-fills empty fields from AI extraction and detects conflicts
 * where the user already has a different value.
 */
export function applyAutoFillAndDetectConflicts(
  extracted: ExtractedProductInfo,
  currentValues: ProductCaptureValues,
  lockedFields: Set<string>,
): { updatedValues: ProductCaptureValues; conflicts: FieldConflict[] } {
  const updatedValues = { ...currentValues };
  const conflicts: FieldConflict[] = [];

  for (const { key, extract, transform } of FIELD_MAP) {
    if (lockedFields.has(key)) continue;

    let aiValue = extract(extracted);
    if (!aiValue) continue;
    if (transform) aiValue = transform(aiValue);

    const currentValue = String(updatedValues[key] ?? "");

    if (!currentValue) {
      (updatedValues as Record<string, unknown>)[key] = aiValue;
    } else if (
      normalizeForComparison(currentValue) !==
      normalizeForComparison(aiValue)
    ) {
      conflicts.push({
        field: key,
        currentValue,
        aiValue,
      });
    }
  }

  if (!lockedFields.has("isBio") && extracted.is_bio)
    updatedValues.isBio = true;
  if (!lockedFields.has("isVegan") && extracted.is_vegan)
    updatedValues.isVegan = true;
  if (!lockedFields.has("isGlutenFree") && extracted.is_gluten_free)
    updatedValues.isGlutenFree = true;
  if (!lockedFields.has("isLactoseFree") && extracted.is_lactose_free)
    updatedValues.isLactoseFree = true;
  if (
    !lockedFields.has("animalWelfareLevel") &&
    extracted.animal_welfare_level != null
  ) {
    if (updatedValues.animalWelfareLevel == null) {
      updatedValues.animalWelfareLevel = extracted.animal_welfare_level;
    }
  }

  return { updatedValues, conflicts };
}

/**
 * Maps classified_photos + suggested_thumbnail_index to PhotoAssignment array.
 */
export function buildPhotoAssignments(
  classifiedPhotos: ClassifiedPhoto[],
  suggestedThumbnailIndex: number | null,
): PhotoAssignment[] {
  return classifiedPhotos.map((photo) => ({
    index: photo.index,
    category: photo.category,
    isThumbnail: photo.index === suggestedThumbnailIndex,
  }));
}

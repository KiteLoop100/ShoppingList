/**
 * Product Photo Studio — types, Zod schemas, and shared interfaces.
 * Used by the multi-photo competitor product capture pipeline.
 */

import { z } from "zod";

// ── Zod Schemas ──

export const VALID_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const photoInputSchema = z.object({
  image_base64: z.string().min(100),
  media_type: z.enum(VALID_MEDIA_TYPES),
});

export const VALID_PHOTO_ROLES = ["front", "price_tag", "extra"] as const;
export type PhotoRole = (typeof VALID_PHOTO_ROLES)[number];

export const analyzeRequestSchema = z.object({
  images: z.array(photoInputSchema).min(1).max(8),
  photo_roles: z.array(z.enum(VALID_PHOTO_ROLES)).optional(),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

// ── Input ──

export interface PhotoInput {
  buffer: Buffer;
  mediaType: (typeof VALID_MEDIA_TYPES)[number];
}

export interface ProductPhotoStudioInput {
  images: PhotoInput[];
  photoRoles?: PhotoRole[];
}

// ── Stage 1: Classification ──

export type PhotoType =
  | "product_front"
  | "product_back"
  | "product_side"
  | "price_tag"
  | "barcode"
  | "shelf"
  | "other";

export interface PhotoClassification {
  photo_index: number;
  is_product_photo: boolean;
  photo_type: PhotoType;
  confidence: number;
  rejection_reason: string | null;
  quality_score: number;
  has_reflections: boolean;
  text_readable: boolean;
}

export interface ClassificationResponse {
  photos: PhotoClassification[];
  all_same_product: boolean;
  suspicious_content: boolean;
  overall_assessment: string;
}

// ── Stage 2: Extraction ──

export interface NutritionInfo {
  energy_kcal: number | null;
  fat: number | null;
  saturated_fat: number | null;
  carbs: number | null;
  sugar: number | null;
  fiber: number | null;
  protein: number | null;
  salt: number | null;
}

/** @deprecated Use ExtractedProductInfo instead */
export type ExtractedCompetitorProductInfo = ExtractedProductInfo;

export interface ExtractedProductInfo {
  name: string | null;
  brand: string | null;
  ean_barcode: string | null;
  article_number: string | null;
  price: number | null;
  retailer_from_price_tag: string | null;
  unit_price: string | null;
  weight_or_quantity: string | null;
  ingredients: string | null;
  nutrition_info: NutritionInfo | null;
  allergens: string | null;
  nutri_score: "A" | "B" | "C" | "D" | "E" | null;
  is_bio: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  is_lactose_free: boolean;
  animal_welfare_level: number | null;
  country_of_origin: string | null;
  /** Demand group code from AI (e.g. "83" for dairy). Prefer demand_group_code over demand_group. */
  demand_group_code?: string | null;
  /** @deprecated Use demand_group_code. Kept for backward compat with AI responses. */
  demand_group?: string | null;
}

export interface ExtractionResult {
  data: ExtractedProductInfo;
  suspicious_content: boolean;
}

// ── Stage 3: Thumbnail ──

export type ImageFormat = "image/webp" | "image/jpeg" | "image/png";

export interface ThumbnailResult {
  fullSize: Buffer;
  fullSizeFormat: ImageFormat;
  thumbnail: Buffer;
  thumbnailFormat: ImageFormat;
  backgroundRemoved: boolean;
  backgroundProvider: string;
  backgroundRemovalFailed?: boolean;
}

// ── Stage 4: Verification ──

export interface ThumbnailVerification {
  passes_quality_check: boolean;
  quality_score: number;
  issues: string[];
  recommendation: "approve" | "review" | "reject";
}

// ── Background Removal ──

export interface BackgroundRemovalResult {
  /** Processed image data. Named `imageBuffer` (not `buffer`) to avoid collision with Uint8Array.buffer. */
  imageBuffer: Buffer;
  hasTransparency: boolean;
  providerUsed: string;
  /** True when no real BG removal provider was configured (only crop-fallback available). */
  noProvidersConfigured?: boolean;
}

export interface BackgroundRemovalProvider {
  name: string;
  isAvailable(): boolean;
  removeBackground(imageBuffer: Buffer): Promise<Buffer>;
}

// ── Gallery ──

export interface ProcessedGalleryPhoto {
  originalIndex: number;
  category: "product" | "price_tag";
  processed: Buffer;
  processedFormat: ImageFormat;
  backgroundRemoved: boolean;
}

// ── Pipeline Output ──

export type ThumbnailType = "background_removed" | "soft_fallback";

export interface ProductPhotoStudioResult {
  status: "success" | "review_required";
  reviewReason?: string;
  classification?: ClassificationResponse;
  extractedData: ExtractedCompetitorProductInfo | null;
  thumbnailFull?: Buffer;
  thumbnailFullFormat?: ImageFormat;
  thumbnailSmall?: Buffer;
  qualityScore?: number;
  backgroundRemoved: boolean;
  backgroundRemovalFailed?: boolean;
  backgroundProvider?: string;
  thumbnailType?: ThumbnailType;
  galleryPhotos?: ProcessedGalleryPhoto[];
  processingTimeMs: number;
}

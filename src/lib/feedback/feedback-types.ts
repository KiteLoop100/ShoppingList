export type FeedbackType = "product" | "general" | "post_shopping";
export type FeedbackStatus = "new" | "read" | "archived";

export type ProductFeedbackCategory =
  | "quality"
  | "price"
  | "availability"
  | "packaging"
  | "suggestion"
  | "other";

export type GeneralFeedbackCategory =
  | "store"
  | "app"
  | "assortment"
  | "suggestion"
  | "praise"
  | "other";

export type PostShoppingFeedbackCategory =
  | "experience"
  | "waiting_time"
  | "cleanliness"
  | "staff"
  | "other";

export type FeedbackCategory =
  | ProductFeedbackCategory
  | GeneralFeedbackCategory
  | PostShoppingFeedbackCategory;

export const PRODUCT_CATEGORIES: ProductFeedbackCategory[] = [
  "quality",
  "price",
  "availability",
  "packaging",
  "suggestion",
  "other",
];

export const GENERAL_CATEGORIES: GeneralFeedbackCategory[] = [
  "store",
  "app",
  "assortment",
  "suggestion",
  "praise",
  "other",
];

export const POST_SHOPPING_CATEGORIES: PostShoppingFeedbackCategory[] = [
  "experience",
  "waiting_time",
  "cleanliness",
  "staff",
  "other",
];

export interface Feedback {
  feedback_id: string;
  user_id: string;
  feedback_type: FeedbackType;
  product_id: string | null;
  trip_id: string | null;
  store_id: string | null;
  category: FeedbackCategory | null;
  rating: number | null;
  message: string;
  status: FeedbackStatus;
  created_at: string;
  product_name?: string;
  store_name?: string;
}

export interface FeedbackInput {
  feedback_type: FeedbackType;
  product_id?: string | null;
  trip_id?: string | null;
  store_id?: string | null;
  category: FeedbackCategory;
  rating?: number | null;
  message: string;
}

"use client";

import type { Product } from "@/types";
import { useTranslations } from "next-intl";
import { BaseModal } from "@/components/ui/base-modal";
import { ProductDetailView } from "@/components/product-detail";
import { AutoReorderSection } from "@/components/product-detail";
import { ItemCommentSection } from "./item-comment-section";
import { ProductFeedbackForm } from "@/components/feedback/product-feedback-form";

export interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onEdit?: (product: Product) => void;
  onReorderChanged?: () => void;
  itemId?: string | null;
  comment?: string | null;
  onCommentChange?: (itemId: string, comment: string | null) => void;
}

export function ProductDetailModal({
  product,
  onClose,
  onEdit,
  onReorderChanged,
  itemId,
  comment: initialComment,
  onCommentChange,
}: ProductDetailModalProps) {
  const t = useTranslations("productDetail");

  if (!product) return null;

  return (
    <BaseModal open={!!product} onClose={onClose} title={t("title")}>
      <ProductDetailView product={product}>
        <AutoReorderSection
          productId={product.product_id}
          onReorderChanged={onReorderChanged}
        />

        <ItemCommentSection
          itemId={itemId ?? null}
          initialComment={initialComment ?? null}
          onCommentChange={onCommentChange}
        />

        <ProductFeedbackForm product={product} />

        {onEdit && (
          <div className="mt-4 border-t border-aldi-muted-light pt-4">
            <button
              type="button"
              onClick={() => onEdit(product)}
              className="min-h-touch w-full rounded-xl border-2 border-aldi-blue bg-white px-4 py-3 font-medium text-aldi-blue transition-colors hover:bg-aldi-blue/10"
            >
              {t("editProduct")}
            </button>
          </div>
        )}
      </ProductDetailView>
    </BaseModal>
  );
}

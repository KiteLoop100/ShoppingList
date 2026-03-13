"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { AnyProduct } from "./types";
import { isAldiProduct, isCompetitorProduct } from "./types";
import { ProductHeaderSection } from "./product-header-section";
import { AliasSection } from "./alias-section";
import { PriceSection } from "./price-section";
import { NutritionSection } from "./nutrition-section";
import { MetadataSection } from "./metadata-section";
import { CategorySection } from "./category-section";
import { EanCrossReferenceSection } from "./ean-cross-reference-section";
import { getProductPhotos } from "@/lib/product-photos/product-photo-service";
import type { ProductPhoto } from "@/lib/product-photos/types";
import type { CompetitorProductPrice } from "@/types";

export interface ProductDetailViewProps {
  product: AnyProduct;
  competitorPrices?: CompetitorProductPrice[];
  retailerNames?: string[];
  children?: ReactNode;
}

export function ProductDetailView({
  product,
  competitorPrices,
  retailerNames,
  children,
}: ProductDetailViewProps) {
  const t = useTranslations("productDetail");
  const [productPhotos, setProductPhotos] = useState<ProductPhoto[]>([]);

  const isAldi = isAldiProduct(product);
  const isCompetitor = isCompetitorProduct(product);
  const productType = isAldi ? "aldi" : "competitor";

  useEffect(() => {
    getProductPhotos(product.product_id, productType).then(setProductPhotos);
  }, [product.product_id, productType]);

  const imageLabels: Record<string, string> = {
    mainPhoto: t("mainPhoto"),
    productPhoto: t("productPhoto"),
    priceTag: t("priceTag"),
    front: isAldi ? t("frontSide") : t("frontPhoto"),
    back: t("backSide"),
    other: isCompetitor ? t("otherPhoto") : "",
  };

  const assortmentLabel = isAldi
    ? getAssortmentLabel(product.assortment_type, t)
    : undefined;

  return (
    <div className="overflow-y-auto overscroll-contain p-4">
      <ProductHeaderSection
        product={product}
        imageLabels={imageLabels}
        retailerNames={retailerNames}
        productPhotos={productPhotos}
      />

      {isAldi && (
        <PriceSection
          kind="aldi"
          price={product.price}
          weightOrQuantity={product.weight_or_quantity}
          labels={{ price: t("price"), weightQuantity: t("weightQuantity") }}
        />
      )}

      {isCompetitor && competitorPrices && (
        <PriceSection
          kind="competitor"
          prices={competitorPrices}
          locale="de"
          labels={{ latestPrice: t("latestPrice"), noPrices: t("noPrices") }}
        />
      )}

      <NutritionSection
        product={product}
        labels={{
          nutritionInfo: isAldi ? t("nutritionInfo") : t("nutrition"),
          ingredients: t("ingredients"),
          allergens: t("allergens"),
          nutriScore: isCompetitor ? t("nutriScore") : undefined,
        }}
      />

      <MetadataSection
        product={product}
        labels={{
          articleNumber: isAldi ? t("articleNumber") : "",
          eanBarcode: t("eanBarcode"),
          assortmentType: isAldi ? t("assortmentType") : undefined,
          specialPeriod: isAldi ? t("specialPeriod") : undefined,
          weightQuantity: isCompetitor ? t("weightQuantity") : undefined,
          countryOfOrigin: isCompetitor ? t("countryOfOrigin") : undefined,
          typicalShelfLife: t("typicalShelfLife"),
        }}
        assortmentLabel={assortmentLabel}
      />

      <CategorySection
        demandGroupCode={product.demand_group_code}
        demandSubGroup={product.demand_sub_group}
        labels={{
          demandGroup: t("demandGroup"),
          demandSubGroup: t("demandSubGroup"),
        }}
      />

      <AliasSection
        aliases={product.aliases}
        label={t("aliases")}
      />

      <EanCrossReferenceSection
        product={product}
        labels={{
          title: isAldi ? t("eanCrossRef") : t("eanCrossRefAldi"),
          priceOrRetailer: isAldi ? t("eanCrossRefRetailer") : t("eanCrossRefPrice"),
        }}
      />

      {children}
    </div>
  );
}

function getAssortmentLabel(
  assortmentType: string,
  t: ReturnType<typeof useTranslations<"productDetail">>,
): string {
  switch (assortmentType) {
    case "special_food": return t("assortmentSpecialFood");
    case "special_nonfood": return t("assortmentSpecialNonfood");
    case "special": return t("assortmentSpecial");
    default: return t("assortmentDailyRange");
  }
}

import type { ComponentType } from "react";
import { SearchScreen } from "./screens/search-screen";
import { ShoppingOrderScreen } from "./screens/shopping-order-screen";
import { ProductDetailScreen } from "./screens/product-detail-screen";
import { SwipeActionsScreen } from "./screens/swipe-actions-screen";
import { FlyerSpecialsScreen } from "./screens/flyer-specials-screen";
import { MultiDeviceScreen } from "./screens/multi-device-screen";
import { ReceiptHistoryScreen } from "./screens/receipt-history-screen";

export interface OnboardingScreenDef {
  id: string;
  component: ComponentType;
}

export const ONBOARDING_SCREENS: OnboardingScreenDef[] = [
  { id: "search", component: SearchScreen },
  { id: "shopping-order", component: ShoppingOrderScreen },
  { id: "product-detail", component: ProductDetailScreen },
  { id: "swipe-actions", component: SwipeActionsScreen },
  { id: "flyer-specials", component: FlyerSpecialsScreen },
  { id: "multi-device", component: MultiDeviceScreen },
  { id: "receipt-history", component: ReceiptHistoryScreen },
];

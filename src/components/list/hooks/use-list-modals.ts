"use client";

import { useReducer, useCallback } from "react";
import type { Product, CompetitorProduct } from "@/types";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

interface CompetitorFormDefaults {
  name?: string;
  retailer?: string;
  ean?: string;
  brand?: string;
}

export interface ModalState {
  detailProduct: Product | null;
  editProduct: Product | null;
  genericPickerItem: ListItemWithMeta | null;
  elsewherePickerItem: ListItemWithMeta | null;
  checkoffPromptItem: ListItemWithMeta | null;
  competitorFormOpen: boolean;
  competitorFormDefaults: CompetitorFormDefaults;
  competitorFormItemId: string | null;
  competitorFormEditProduct: CompetitorProduct | null;
  detailCompetitorProduct: CompetitorProduct | null;
  detailCompetitorRetailer: string | null;
  checkedOpen: boolean;
}

type ModalAction =
  | { type: "OPEN_DETAIL"; product: Product }
  | { type: "CLOSE_DETAIL" }
  | { type: "OPEN_EDIT"; product: Product }
  | { type: "CLOSE_EDIT" }
  | { type: "OPEN_GENERIC_PICKER"; item: ListItemWithMeta }
  | { type: "CLOSE_GENERIC_PICKER" }
  | { type: "OPEN_ELSEWHERE_PICKER"; item: ListItemWithMeta }
  | { type: "CLOSE_ELSEWHERE_PICKER" }
  | { type: "OPEN_CHECKOFF_PROMPT"; item: ListItemWithMeta }
  | { type: "CLOSE_CHECKOFF_PROMPT" }
  | { type: "OPEN_COMPETITOR_FORM"; defaults: CompetitorFormDefaults; itemId: string | null }
  | { type: "CLOSE_COMPETITOR_FORM" }
  | { type: "SET_COMPETITOR_EDIT"; product: CompetitorProduct | null }
  | { type: "OPEN_COMPETITOR_DETAIL"; product: CompetitorProduct; retailer: string | null }
  | { type: "CLOSE_COMPETITOR_DETAIL" }
  | { type: "EDIT_FROM_COMPETITOR_DETAIL"; product: CompetitorProduct }
  | { type: "DETAIL_TO_EDIT"; product: Product }
  | { type: "TOGGLE_CHECKED_SECTION" };

export const initialState: ModalState = {
  detailProduct: null,
  editProduct: null,
  genericPickerItem: null,
  elsewherePickerItem: null,
  checkoffPromptItem: null,
  competitorFormOpen: false,
  competitorFormDefaults: {},
  competitorFormItemId: null,
  competitorFormEditProduct: null,
  detailCompetitorProduct: null,
  detailCompetitorRetailer: null,
  checkedOpen: false,
};

export function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case "OPEN_DETAIL":
      return { ...state, detailProduct: action.product };
    case "CLOSE_DETAIL":
      return { ...state, detailProduct: null };
    case "OPEN_EDIT":
      return { ...state, editProduct: action.product };
    case "CLOSE_EDIT":
      return { ...state, editProduct: null };
    case "OPEN_GENERIC_PICKER":
      return { ...state, genericPickerItem: action.item };
    case "CLOSE_GENERIC_PICKER":
      return { ...state, genericPickerItem: null };
    case "OPEN_ELSEWHERE_PICKER":
      return { ...state, elsewherePickerItem: action.item };
    case "CLOSE_ELSEWHERE_PICKER":
      return { ...state, elsewherePickerItem: null };
    case "OPEN_CHECKOFF_PROMPT":
      return { ...state, checkoffPromptItem: action.item };
    case "CLOSE_CHECKOFF_PROMPT":
      return { ...state, checkoffPromptItem: null };
    case "OPEN_COMPETITOR_FORM":
      return {
        ...state,
        competitorFormOpen: true,
        competitorFormDefaults: action.defaults,
        competitorFormItemId: action.itemId,
      };
    case "CLOSE_COMPETITOR_FORM":
      return {
        ...state,
        competitorFormOpen: false,
        competitorFormEditProduct: null,
      };
    case "SET_COMPETITOR_EDIT":
      return { ...state, competitorFormEditProduct: action.product };
    case "OPEN_COMPETITOR_DETAIL":
      return {
        ...state,
        detailCompetitorProduct: action.product,
        detailCompetitorRetailer: action.retailer,
      };
    case "CLOSE_COMPETITOR_DETAIL":
      return {
        ...state,
        detailCompetitorProduct: null,
        detailCompetitorRetailer: null,
      };
    case "EDIT_FROM_COMPETITOR_DETAIL":
      return {
        ...state,
        detailCompetitorProduct: null,
        detailCompetitorRetailer: null,
        competitorFormEditProduct: action.product,
        competitorFormDefaults: {},
        competitorFormItemId: null,
        competitorFormOpen: true,
      };
    case "DETAIL_TO_EDIT":
      return {
        ...state,
        detailProduct: null,
        editProduct: action.product,
      };
    case "TOGGLE_CHECKED_SECTION":
      return { ...state, checkedOpen: !state.checkedOpen };
    default:
      return state;
  }
}

export function useListModals() {
  const [state, dispatch] = useReducer(modalReducer, initialState);

  const openDetail = useCallback((product: Product) => dispatch({ type: "OPEN_DETAIL", product }), []);
  const closeDetail = useCallback(() => dispatch({ type: "CLOSE_DETAIL" }), []);
  const openEdit = useCallback((product: Product) => dispatch({ type: "OPEN_EDIT", product }), []);
  const closeEdit = useCallback(() => dispatch({ type: "CLOSE_EDIT" }), []);
  const openGenericPicker = useCallback((item: ListItemWithMeta) => dispatch({ type: "OPEN_GENERIC_PICKER", item }), []);
  const closeGenericPicker = useCallback(() => dispatch({ type: "CLOSE_GENERIC_PICKER" }), []);
  const openElsewherePicker = useCallback((item: ListItemWithMeta) => dispatch({ type: "OPEN_ELSEWHERE_PICKER", item }), []);
  const closeElsewherePicker = useCallback(() => dispatch({ type: "CLOSE_ELSEWHERE_PICKER" }), []);
  const openCheckoffPrompt = useCallback((item: ListItemWithMeta) => dispatch({ type: "OPEN_CHECKOFF_PROMPT", item }), []);
  const closeCheckoffPrompt = useCallback(() => dispatch({ type: "CLOSE_CHECKOFF_PROMPT" }), []);
  const openCompetitorForm = useCallback(
    (defaults: CompetitorFormDefaults, itemId: string | null) =>
      dispatch({ type: "OPEN_COMPETITOR_FORM", defaults, itemId }),
    []
  );
  const closeCompetitorForm = useCallback(() => dispatch({ type: "CLOSE_COMPETITOR_FORM" }), []);
  const setCompetitorEdit = useCallback((product: CompetitorProduct | null) => dispatch({ type: "SET_COMPETITOR_EDIT", product }), []);
  const openCompetitorDetail = useCallback(
    (product: CompetitorProduct, retailer: string | null) =>
      dispatch({ type: "OPEN_COMPETITOR_DETAIL", product, retailer }),
    []
  );
  const closeCompetitorDetail = useCallback(() => dispatch({ type: "CLOSE_COMPETITOR_DETAIL" }), []);
  const editFromCompetitorDetail = useCallback(
    (product: CompetitorProduct) => dispatch({ type: "EDIT_FROM_COMPETITOR_DETAIL", product }),
    []
  );
  const detailToEdit = useCallback((product: Product) => dispatch({ type: "DETAIL_TO_EDIT", product }), []);
  const toggleCheckedSection = useCallback(() => dispatch({ type: "TOGGLE_CHECKED_SECTION" }), []);

  return {
    state,
    openDetail,
    closeDetail,
    openEdit,
    closeEdit,
    openGenericPicker,
    closeGenericPicker,
    openElsewherePicker,
    closeElsewherePicker,
    openCheckoffPrompt,
    closeCheckoffPrompt,
    openCompetitorForm,
    closeCompetitorForm,
    setCompetitorEdit,
    openCompetitorDetail,
    closeCompetitorDetail,
    editFromCompetitorDetail,
    detailToEdit,
    toggleCheckedSection,
  };
}

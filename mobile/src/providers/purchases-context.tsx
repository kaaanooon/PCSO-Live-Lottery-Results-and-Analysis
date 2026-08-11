import { createContext, useContext } from "react";

export const REMOVE_ADS_PRODUCT_ID = "ad_free_lifetime";

export type PurchaseStatus =
  | "loading"
  | "available"
  | "purchasing"
  | "restoring"
  | "purchased"
  | "pending"
  | "unavailable"
  | "error";

export type RestorePurchaseResult = "restored" | "not-found" | "unavailable";

export interface PurchasesContextValue {
  /** True after cached state and current store ownership have been reconciled. */
  readonly ready: boolean;
  readonly connected: boolean;
  readonly adsRemoved: boolean;
  /** Localized, tax-aware price supplied by the current app store. */
  readonly storePrice: string | null;
  readonly canPurchase: boolean;
  readonly purchasing: boolean;
  readonly restoring: boolean;
  readonly status: PurchaseStatus;
  readonly message: string | null;
  readonly purchaseRemoveAds: () => Promise<void>;
  readonly restoreRemoveAds: () => Promise<RestorePurchaseResult>;
}

export const PurchasesContext = createContext<
  PurchasesContextValue | undefined
>(undefined);

export function usePurchases(): PurchasesContextValue {
  const context = useContext(PurchasesContext);
  if (!context)
    throw new Error("usePurchases must be used inside a PurchasesProvider.");
  return context;
}

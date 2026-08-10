import { useMemo, type PropsWithChildren } from 'react';

import {
  PurchasesContext,
  type PurchasesContextValue,
  type RestorePurchaseResult,
} from '@/providers/purchases-context';

/** Browser fallback. Google Play Billing is available only in an installed native build. */
export function PurchasesProvider({ children }: PropsWithChildren) {
  const value = useMemo<PurchasesContextValue>(
    () => ({
      ready: true,
      connected: false,
      adsRemoved: false,
      storePrice: null,
      canPurchase: false,
      purchasing: false,
      restoring: false,
      status: 'unavailable',
      message: 'Google Play purchases are available in the installed Android app.',
      purchaseRemoveAds: async () => {},
      restoreRemoveAds: async (): Promise<RestorePurchaseResult> => 'unavailable',
    }),
    [],
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

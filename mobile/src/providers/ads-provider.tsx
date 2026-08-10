import { useMemo, type PropsWithChildren } from 'react';

import { AdsContext, type AdsContextValue } from '@/providers/ads-context';
import { usePurchases } from '@/providers/purchases-context';

/**
 * Web and non-native fallback. It keeps localhost usable without importing the
 * native Google Mobile Ads module; ad components render labelled previews.
 */
export function AdsProvider({ children }: PropsWithChildren) {
  const { adsRemoved, ready: purchasesReady } = usePurchases();
  const value = useMemo<AdsContextValue>(
    () => ({
      ready: purchasesReady,
      canRequestAds: true,
      adsEnabled: purchasesReady && !adsRemoved,
    }),
    [adsRemoved, purchasesReady],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

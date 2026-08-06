import { useMemo, type PropsWithChildren } from 'react';

import { AdsContext, type AdsContextValue } from '@/providers/ads-context';
import { usePreferences } from '@/providers/preferences-provider';

/**
 * Web and non-native fallback. It keeps localhost usable without importing the
 * native Google Mobile Ads module; ad components render labelled previews.
 */
export function AdsProvider({ children }: PropsWithChildren) {
  const { adsRemoved } = usePreferences();
  const value = useMemo<AdsContextValue>(
    () => ({
      ready: true,
      canRequestAds: true,
      adsEnabled: !adsRemoved,
    }),
    [adsRemoved],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

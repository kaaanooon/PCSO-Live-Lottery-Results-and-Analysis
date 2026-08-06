import { createContext, useContext } from 'react';

export interface AdsContextValue {
  /** True after the platform has finished preparing its ads capability. */
  readonly ready: boolean;
  /** Whether the current consent state permits ad requests on this platform. */
  readonly canRequestAds: boolean;
  /** Whether ad UI should render after consent and the remove-ads preference. */
  readonly adsEnabled: boolean;
}

export const AdsContext = createContext<AdsContextValue | undefined>(undefined);

export function useAds(): AdsContextValue {
  const context = useContext(AdsContext);
  if (!context) throw new Error('useAds must be used inside an AdsProvider.');
  return context;
}

import { createContext, useContext } from 'react';

export interface AdsContextValue {
  /** True after the platform has finished preparing its ads capability. */
  readonly ready: boolean;
  /** Whether the current consent state permits ad requests on this platform. */
  readonly canRequestAds: boolean;
  /** Whether ad UI should render after consent and paid-entitlement restoration. */
  readonly adsEnabled: boolean;
  /** Whether Google requires an in-app privacy-options entry point. */
  readonly privacyOptionsRequired: boolean;
  /** Opens Google's privacy-options form when it is available. */
  readonly showPrivacyOptions: () => Promise<boolean>;
}

export const AdsContext = createContext<AdsContextValue | undefined>(undefined);

export function useAds(): AdsContextValue {
  const context = useContext(AdsContext);
  if (!context) throw new Error('useAds must be used inside an AdsProvider.');
  return context;
}

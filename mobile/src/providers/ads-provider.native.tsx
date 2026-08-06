import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';

import { AdsContext, type AdsContextValue } from '@/providers/ads-context';
import { usePreferences } from '@/providers/preferences-provider';

interface NativeAdsState {
  readonly ready: boolean;
  readonly canRequestAds: boolean;
}

const INITIAL_STATE: NativeAdsState = {
  ready: false,
  canRequestAds: false,
};

/**
 * Native provider that refreshes UMP consent on every cold app launch. It has
 * no loading UI of its own, so app content remains available while consent and
 * SDK initialization complete.
 */
export function AdsProvider({ children }: PropsWithChildren) {
  const { adsRemoved } = usePreferences();
  const [state, setState] = useState<NativeAdsState>(INITIAL_STATE);
  const initializationPromise = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    let active = true;

    const startMobileAdsWhenPermitted = async (): Promise<boolean> => {
      const consentInfo = await AdsConsent.getConsentInfo();
      if (!consentInfo.canRequestAds) return false;

      if (!initializationPromise.current) {
        initializationPromise.current = mobileAds()
          .initialize()
          .catch((error) => {
            initializationPromise.current = null;
            throw error;
          });
      }
      await initializationPromise.current;

      if (active) setState({ ready: true, canRequestAds: true });
      return true;
    };

    // A previous-session consent decision may allow SDK initialization while
    // UMP obtains the mandatory fresh launch-time consent status.
    void startMobileAdsWhenPermitted().catch(() => false);

    void AdsConsent.gatherConsent()
      .catch(() => {
        // UMP may still allow ads using the consent state from the last launch.
      })
      .then(startMobileAdsWhenPermitted)
      .then((started) => {
        if (active && !started) setState({ ready: true, canRequestAds: false });
      })
      .catch(() => {
        if (active) setState({ ready: true, canRequestAds: false });
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AdsContextValue>(
    () => ({
      ready: state.ready,
      canRequestAds: state.canRequestAds,
      adsEnabled: state.ready && state.canRequestAds && !adsRemoved,
    }),
    [adsRemoved, state.canRequestAds, state.ready],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

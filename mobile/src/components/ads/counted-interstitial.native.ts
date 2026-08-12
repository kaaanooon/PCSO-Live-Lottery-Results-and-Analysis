import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  AdEventType,
  InterstitialAd,
} from 'react-native-google-mobile-ads';

import {
  fullscreenAdFrequencyGate,
  type FullscreenAdLease,
  type FullscreenAdPlacement,
} from '@/components/ads/fullscreen-ad-frequency';
import { useAds } from '@/providers/ads-context';

export function useCountedInterstitial({
  actionsPerAd,
  placement,
  unitId,
}: {
  actionsPerAd: number;
  placement: FullscreenAdPlacement;
  unitId: string;
}) {
  const { adsEnabled } = useAds();
  const interstitial = useMemo(
    () => InterstitialAd.createForAdRequest(unitId),
    [unitId],
  );
  const pendingAction = useRef<(() => void) | null>(null);
  const lease = useRef<FullscreenAdLease | null>(null);

  const finishPendingAction = useCallback(() => {
    const currentLease = lease.current;
    const pending = pendingAction.current;
    lease.current = null;
    pendingAction.current = null;
    currentLease?.release();
    pending?.();
  }, []);

  useEffect(() => {
    if (!adsEnabled) {
      finishPendingAction();
      return;
    }

    const unsubscribeClosed = interstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        finishPendingAction();
        interstitial.load();
      },
    );
    const unsubscribeError = interstitial.addAdEventListener(
      AdEventType.ERROR,
      () => {
        finishPendingAction();
      },
    );

    interstitial.load();
    return () => {
      unsubscribeClosed();
      unsubscribeError();
      finishPendingAction();
    };
  }, [adsEnabled, finishPendingAction, interstitial]);

  const runBeforeAction = useCallback(
    (action: () => void) => {
      const acquiredLease = fullscreenAdFrequencyGate.recordAction({
        placement,
        actionsPerAd,
        adReady: adsEnabled && interstitial.loaded && !pendingAction.current,
      });

      if (!acquiredLease) {
        if (adsEnabled && !interstitial.loaded) interstitial.load();
        action();
        return;
      }

      lease.current = acquiredLease;
      pendingAction.current = action;
      try {
        void interstitial.show().catch(() => finishPendingAction());
      } catch {
        finishPendingAction();
      }
    },
    [actionsPerAd, adsEnabled, finishPendingAction, interstitial, placement],
  );

  return { adsEnabled, runBeforeAction };
}

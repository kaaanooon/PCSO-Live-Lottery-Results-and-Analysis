import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  AdEventType,
  InterstitialAd,
  TestIds,
} from 'react-native-google-mobile-ads';

import { useAds } from '@/providers/ads-context';

import type { AnalysisInterstitialController } from './analysis-interstitial';

const ACTIONS_PER_INTERSTITIAL = 2;

function analysisInterstitialUnitId(): string {
  const configured = Platform.select({
    android: process.env.EXPO_PUBLIC_ADMOB_ANALYSIS_INTERSTITIAL_ANDROID_ID,
    ios: process.env.EXPO_PUBLIC_ADMOB_ANALYSIS_INTERSTITIAL_IOS_ID,
  });
  return __DEV__ || !configured
    ? (TestIds.INTERSTITIAL_VIDEO ?? TestIds.INTERSTITIAL)
    : configured;
}

/**
 * Preloads one interstitial and shows it at most once per two valid Analyze
 * actions. Analysis always continues immediately when an ad is unavailable.
 */
export function useAnalysisInterstitial(): AnalysisInterstitialController {
  const { adsEnabled } = useAds();
  const interstitial = useMemo(
    () => InterstitialAd.createForAdRequest(analysisInterstitialUnitId()),
    [],
  );
  const [loaded, setLoaded] = useState(false);
  const actionCount = useRef(0);
  const pendingAnalysis = useRef<(() => void) | null>(null);

  const finishPendingAnalysis = useCallback(() => {
    const pending = pendingAnalysis.current;
    pendingAnalysis.current = null;
    pending?.();
  }, []);

  useEffect(() => {
    if (!adsEnabled) {
      finishPendingAnalysis();
      return;
    }

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setLoaded(true);
    });
    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setLoaded(false);
      finishPendingAnalysis();
      interstitial.load();
    });
    const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      setLoaded(false);
      finishPendingAnalysis();
    });

    interstitial.load();
    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
      finishPendingAnalysis();
    };
  }, [adsEnabled, finishPendingAnalysis, interstitial]);

  const runBeforeAnalysis = useCallback(
    (analyze: () => void) => {
      actionCount.current += 1;
      const shouldShow =
        adsEnabled &&
        loaded &&
        actionCount.current % ACTIONS_PER_INTERSTITIAL === 0;

      if (!shouldShow) {
        analyze();
        return;
      }

      pendingAnalysis.current = analyze;
      setLoaded(false);
      void interstitial.show().catch(() => finishPendingAnalysis());
    },
    [adsEnabled, finishPendingAnalysis, interstitial, loaded],
  );

  return { adsEnabled, runBeforeAnalysis };
}

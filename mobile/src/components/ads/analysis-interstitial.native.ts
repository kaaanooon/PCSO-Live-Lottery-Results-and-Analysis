import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

import { useCountedInterstitial } from '@/components/ads/counted-interstitial.native';

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
  const { adsEnabled, runBeforeAction } = useCountedInterstitial({
    actionsPerAd: ACTIONS_PER_INTERSTITIAL,
    placement: 'analysis-draws',
    unitId: analysisInterstitialUnitId(),
  });
  return { adsEnabled, runBeforeAnalysis: runBeforeAction };
}

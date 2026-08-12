import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

import { useCountedInterstitial } from '@/components/ads/counted-interstitial.native';

import type {
  GenerationAdPlacement,
  GenerationInterstitialController,
} from './generation-interstitial';

const GENERATIONS_PER_INTERSTITIAL = 5;

function configuredUnitId(placement: GenerationAdPlacement): string | undefined {
  if (placement === 'analysis') {
    return Platform.select({
      android:
        process.env
          .EXPO_PUBLIC_ADMOB_ANALYSIS_RANDOM_COMBINATION_INTERSTITIAL_ANDROID_ID,
      ios:
        process.env.EXPO_PUBLIC_ADMOB_ANALYSIS_RANDOM_COMBINATION_INTERSTITIAL_IOS_ID,
    });
  }
  return Platform.select({
    android:
      process.env.EXPO_PUBLIC_ADMOB_PICK_RANDOM_COMBINATION_INTERSTITIAL_ANDROID_ID,
    ios: process.env.EXPO_PUBLIC_ADMOB_PICK_RANDOM_COMBINATION_INTERSTITIAL_IOS_ID,
  });
}

function productionOrTestId(placement: GenerationAdPlacement): string {
  const configured = configuredUnitId(placement)?.trim();
  return __DEV__ || !configured?.startsWith('ca-app-pub-')
    ? (TestIds.INTERSTITIAL_VIDEO ?? TestIds.INTERSTITIAL)
    : configured;
}

export function useGenerationInterstitial(
  placement: GenerationAdPlacement,
): GenerationInterstitialController {
  const { runBeforeAction } = useCountedInterstitial({
    actionsPerAd: GENERATIONS_PER_INTERSTITIAL,
    placement: placement === 'analysis' ? 'analysis-random' : 'pick-random',
    unitId: productionOrTestId(placement),
  });
  return { runBeforeGeneration: runBeforeAction };
}

import { useCallback } from 'react';

export interface AnalysisInterstitialController {
  readonly adsEnabled: boolean;
  readonly runBeforeAnalysis: (analyze: () => void) => void;
}

/** Web fallback: Google Mobile Ads is a native SDK, so analysis continues immediately. */
export function useAnalysisInterstitial(): AnalysisInterstitialController {
  const runBeforeAnalysis = useCallback((analyze: () => void) => analyze(), []);
  return { adsEnabled: false, runBeforeAnalysis };
}

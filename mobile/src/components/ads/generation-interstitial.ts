import { useCallback } from 'react';

export type GenerationAdPlacement = 'analysis' | 'pick';

export interface GenerationInterstitialController {
  readonly runBeforeGeneration: (generate: () => void) => void;
}

/** Web fallback: Google Mobile Ads is native, so generation continues. */
export function useGenerationInterstitial(
  _placement: GenerationAdPlacement,
): GenerationInterstitialController {
  const runBeforeGeneration = useCallback((generate: () => void) => generate(), []);
  return { runBeforeGeneration };
}

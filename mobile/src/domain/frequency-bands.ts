export const FREQUENCY_BANDS = [
  'hot',
  'warm',
  'neutral',
  'cool',
  'cold',
] as const;

export type FrequencyBand = (typeof FREQUENCY_BANDS)[number];

export function frequencyBand(
  count: number,
  minimum: number,
  maximum: number,
): FrequencyBand {
  if (
    !Number.isFinite(count) ||
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    minimum >= maximum
  ) {
    return 'neutral';
  }

  const relative = (count - minimum) / (maximum - minimum);
  if (relative >= 0.8) return 'hot';
  if (relative >= 0.6) return 'warm';
  if (relative <= 0.2) return 'cold';
  if (relative <= 0.4) return 'cool';
  return 'neutral';
}

export interface FrequencyMetric {
  readonly numericValue: number;
  readonly appearanceCount: number;
}

export function rankFrequencyRows<T extends FrequencyMetric>(
  rows: readonly T[],
): readonly { readonly row: T; readonly band: FrequencyBand }[] {
  const ranked = [...rows].sort(
    (left, right) =>
      right.appearanceCount - left.appearanceCount ||
      left.numericValue - right.numericValue,
  );
  const counts = ranked.map((row) => row.appearanceCount);
  const minimum = counts.length ? Math.min(...counts) : 0;
  const maximum = counts.length ? Math.max(...counts) : 0;
  return ranked.map((row) => ({
    row,
    band: frequencyBand(row.appearanceCount, minimum, maximum),
  }));
}

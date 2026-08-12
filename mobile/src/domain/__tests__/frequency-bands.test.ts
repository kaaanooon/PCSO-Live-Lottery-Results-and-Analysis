import { describe, expect, it } from 'vitest';

import { frequencyBand, rankFrequencyRows } from '../frequency-bands';

describe('frequency presentation bands', () => {
  it('uses five relative bands and treats tied samples as neutral', () => {
    expect(frequencyBand(10, 0, 10)).toBe('hot');
    expect(frequencyBand(8, 0, 10)).toBe('hot');
    expect(frequencyBand(7, 0, 10)).toBe('warm');
    expect(frequencyBand(5, 0, 10)).toBe('neutral');
    expect(frequencyBand(3, 0, 10)).toBe('cool');
    expect(frequencyBand(2, 0, 10)).toBe('cold');
    expect(frequencyBand(4, 4, 4)).toBe('neutral');
  });

  it('ranks most-seen first, breaks ties by number, and does not mutate input', () => {
    const rows = [
      { numericValue: 9, appearanceCount: 1 },
      { numericValue: 4, appearanceCount: 3 },
      { numericValue: 2, appearanceCount: 3 },
      { numericValue: 7, appearanceCount: 0 },
    ] as const;

    const ranked = rankFrequencyRows(rows);

    expect(ranked.map(({ row }) => row.numericValue)).toEqual([2, 4, 9, 7]);
    expect(ranked.map(({ band }) => band)).toEqual(['hot', 'hot', 'cool', 'cold']);
    expect(rows.map((row) => row.numericValue)).toEqual([9, 4, 2, 7]);
  });

  it('keeps an empty set empty and marks tied rows as neutral', () => {
    expect(rankFrequencyRows([])).toEqual([]);
    expect(rankFrequencyRows([
      { numericValue: 3, appearanceCount: 2 },
      { numericValue: 1, appearanceCount: 2 },
    ])).toEqual([
      { row: { numericValue: 1, appearanceCount: 2 }, band: 'neutral' },
      { row: { numericValue: 3, appearanceCount: 2 }, band: 'neutral' },
    ]);
  });
});

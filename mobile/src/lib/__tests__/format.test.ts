import { describe, expect, it } from 'vitest';

import { formatDrawDate, formatPeso, isValidIsoDate } from '../format';

describe('date and amount formatting', () => {
  it('accepts real ISO dates and rejects impossible calendar dates', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('06-08-2026')).toBe(false);
  });

  it('formats valid dates without normalizing invalid input', () => {
    expect(formatDrawDate('2026-08-06')).toBe('Aug 6, 2026');
    expect(formatDrawDate('2026-13-01')).toBe('2026-13-01');
  });

  it('retains source-reported centavos while keeping whole pesos compact', () => {
    expect(formatPeso('4000')).toMatch(/4,000/);
    expect(formatPeso('4000.25')).toMatch(/4,000\.25/);
    expect(formatPeso('0')).toBe('Not reported');
  });
});

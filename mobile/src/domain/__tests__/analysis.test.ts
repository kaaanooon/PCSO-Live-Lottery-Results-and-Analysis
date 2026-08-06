import { describe, expect, it } from 'vitest';

import { analyzeGame, EQUAL_ODDS_WARNING } from '../analysis';
import { GAME_BY_CODE } from '../games';
import type { LotteryDraw, LogicalGameCode } from '../types';

const makeDraw = (
  logicalGameCode: LogicalGameCode,
  date: string,
  numbers: number[],
): LotteryDraw => ({
  logicalGameCode,
  gameCode: logicalGameCode,
  date,
  time: '21:00',
  numbers,
  amount: '10000000',
  winners: 0,
});

describe('mobile analysis engine', () => {
  const draws = [
    makeDraw('LOTTO42', '2026-08-01', [1, 2, 3, 20, 30, 42]),
    makeDraw('LOTTO42', '2026-08-02', [1, 4, 8, 20, 31, 41]),
    makeDraw('LOTTO42', '2026-08-03', [5, 6, 7, 21, 30, 40]),
    makeDraw('LOTTO42', '2026-08-04', [1, 9, 10, 20, 32, 39]),
    makeDraw('LOTTO42', '2026-08-05', [2, 11, 12, 22, 33, 42]),
  ];

  it('reconciles frequency, parity, pair, and triple totals', () => {
    const result = analyzeGame(draws, GAME_BY_CODE.LOTTO42);
    expect(result.summary.drawCount).toBe(5);
    expect(result.frequency.reduce((total, row) => total + row.appearanceCount, 0)).toBe(30);
    expect(result.parityDistribution.reduce((total, row) => total + row.drawCount, 0)).toBe(5);
    expect(result.pairFrequency.reduce((total, row) => total + row.occurrenceCount, 0)).toBe(75);
    expect(result.tripleFrequency.reduce((total, row) => total + row.occurrenceCount, 0)).toBe(100);
    expect(result.pairFrequency.every((row) => row.drawSupportPct <= 100)).toBe(true);
  });

  it('marks unseen values as unseen rather than overdue', () => {
    const result = analyzeGame(draws, GAME_BY_CODE.LOTTO42);
    const unseen = result.frequency.find((row) => row.numericValue === 38);
    expect(unseen?.seenInSelectedSample).toBe(false);
    expect(unseen?.drawsSinceLast).toBeNull();
  });

  it('returns a deterministic valid candidate with an equal-odds warning', () => {
    const left = analyzeGame(draws, GAME_BY_CODE.LOTTO42, { candidatePoolSize: 500 });
    const right = analyzeGame(draws, GAME_BY_CODE.LOTTO42, { candidatePoolSize: 500 });
    expect(left.recommendedCandidate).toEqual(right.recommendedCandidate);
    expect(left.recommendedCandidate?.numbers).toHaveLength(6);
    expect(new Set(left.recommendedCandidate?.numbers).size).toBe(6);
    expect(left.recommendedCandidate?.numbers.every((value) => value >= 1 && value <= 42)).toBe(true);
    expect(left.probabilityWarning).toBe(EQUAL_ODDS_WARNING);
  });

  it('returns distinct deterministic alternatives for small ordered games', () => {
    const ordered = [
      makeDraw('3DL', '2026-08-01', [1, 0, 2]),
      makeDraw('3DL', '2026-08-02', [3, 0, 4]),
      makeDraw('3DL', '2026-08-03', [5, 0, 6]),
      makeDraw('3DL', '2026-08-04', [7, 0, 8]),
      makeDraw('3DL', '2026-08-05', [9, 0, 1]),
    ];
    const candidates = [0, 1, 2, 3].map(
      (candidateVariant) =>
        analyzeGame(ordered, GAME_BY_CODE['3DL'], { candidatePoolSize: 500, candidateVariant })
          .recommendedCandidate?.combination,
    );
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(
      analyzeGame(ordered, GAME_BY_CODE['3DL'], { candidatePoolSize: 500, candidateVariant: 1 })
        .recommendedCandidate?.combination,
    ).toBe(candidates[1]);
  });

  it('keeps repeated ordered transitions at no more than 100 percent draw support', () => {
    const ordered = [
      makeDraw('4DL', '2026-08-01', [0, 0, 0, 0]),
      makeDraw('4DL', '2026-08-02', [0, 0, 0, 0]),
    ];
    const result = analyzeGame(ordered, GAME_BY_CODE['4DL']);
    expect(result.pairFrequency[0]?.occurrenceCount).toBe(6);
    expect(result.pairFrequency[0]?.drawSupportCount).toBe(2);
    expect(result.pairFrequency[0]?.drawSupportPct).toBe(100);
  });

  it('returns a safe empty analysis', () => {
    const result = analyzeGame([], GAME_BY_CODE.UL58);
    expect(result.summary.drawCount).toBe(0);
    expect(result.recommendedCandidate).toBeNull();
    expect(result.narratives[0]).toContain('No valid');
  });
});

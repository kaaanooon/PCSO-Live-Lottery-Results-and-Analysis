import { describe, expect, it } from 'vitest';

import { GAME_BY_CODE } from '../games';
import {
  comparePick,
  crossCheckHistory,
  generateRandomCombination,
  parsePick,
  resultPageForGame,
  validatePick,
} from '../picks';
import type { LotteryDraw } from '../types';

const draw = (overrides: Partial<LotteryDraw>): LotteryDraw => ({
  logicalGameCode: '3DL',
  gameCode: '3DL-2PM',
  date: '2026-08-05',
  time: '14:00',
  numbers: [0, 4, 6],
  amount: '4500',
  winners: 3,
  ...overrides,
});

describe('pick parsing and validation', () => {
  it('generates a valid unweighted random combination for each rule shape', () => {
    const jackpot = generateRandomCombination(GAME_BY_CODE.UL58);
    const digitGame = generateRandomCombination(GAME_BY_CODE['6DL']);

    expect(validatePick(jackpot, 'UL58')).toEqual([]);
    expect(new Set(jackpot).size).toBe(6);
    expect(jackpot).toEqual([...jackpot].sort((left, right) => left - right));
    expect(validatePick(digitGame, '6DL')).toEqual([]);
  });

  it('preserves positional leading zeroes for digit games', () => {
    const parsed = parsePick('046', '3DL');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.numbers).toEqual([0, 4, 6]);
      expect(parsed.formatted).toBe('046');
    }
  });

  it('allows 2D repeats within 1 through 31', () => {
    expect(validatePick([31, 31], '2DL')).toEqual([]);
    expect(validatePick([0, 32], '2DL').map((error) => error.code)).toEqual([
      'out-of-range',
      'out-of-range',
    ]);
  });

  it('rejects duplicate jackpot values', () => {
    expect(validatePick([1, 2, 3, 4, 5, 5], 'LOTTO42')).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'duplicate', value: 5 })]),
    );
  });
});

describe('rule-aware comparison', () => {
  it('keeps standard order but allows a 3D Rambolito multiset match', () => {
    expect(comparePick([0, 4, 6], [6, 4, 0], '3DL', 'standard').isWin).toBe(false);
    expect(comparePick([0, 4, 6], [6, 4, 0], '3DL', 'rambolito').isWin).toBe(true);
  });

  it('matches jackpot combinations in any order', () => {
    expect(comparePick([1, 2, 3, 4, 5, 42], [42, 5, 4, 3, 2, 1], 'LOTTO42').isWin).toBe(true);
  });

  it('rejects comparison modes that a game does not support', () => {
    expect(() => comparePick([1, 2, 3, 4], [4, 3, 2, 1], '4DL', 'rambolito')).toThrow(/does not support/i);
    expect(comparePick([1, 2, 3, 4], [4, 3, 2, 1], '4DL', 'perm').isWin).toBe(true);
    expect(() => comparePick([1, 2, 3, 4, 5, 42], [1, 2, 3, 4, 5, 42], 'LOTTO42', 'exact')).toThrow(/does not support/i);
  });
});

describe('history checks and navigation', () => {
  const history: LotteryDraw[] = [
    draw({ date: '2026-08-05', time: '14:00', gameCode: '3DL-2PM', numbers: [0, 4, 6] }),
    draw({ date: '2026-08-05', time: '17:00', gameCode: '3DL-5PM', numbers: [6, 4, 0] }),
    draw({ date: '2026-08-04', time: '14:00', gameCode: '3DL-2PM', numbers: [6, 4, 0] }),
  ];

  it('keeps 2 PM history separate when a concrete draw slot is supplied', () => {
    const result = crossCheckHistory('3DL', [0, 4, 6], history, { gameCode: '3DL-2PM' });
    expect(result.drawsChecked).toBe(2);
    expect(result.exactMatchCount).toBe(1);
    expect(result.anyOrderMatchCount).toBe(2);
  });

  it('clamps previous/next pages and returns newest first', () => {
    const newest = resultPageForGame(history, '3DL', 0);
    const oldest = resultPageForGame(history, '3DL', 99);
    expect(newest.result?.date).toBe('2026-08-05');
    expect(newest.canGoNext).toBe(false);
    expect(oldest.result?.date).toBe('2026-08-04');
    expect(oldest.canGoPrevious).toBe(false);
  });
});

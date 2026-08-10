import { describe, expect, it } from 'vitest';

import { ANALYSIS_DRAW_COUNT, latestAnalysisDraws } from '../analysis-navigation';
import type { LotteryDraw } from '../types';

function draw(index: number, overrides: Partial<LotteryDraw> = {}): LotteryDraw {
  return {
    logicalGameCode: '3DL',
    gameCode: '3DL-2PM',
    date: `2026-08-${String(index).padStart(2, '0')}`,
    time: '14:00',
    numbers: [index % 10, (index + 1) % 10, (index + 2) % 10],
    amount: '4500',
    winners: 0,
    ...overrides,
  };
}

describe('latestAnalysisDraws', () => {
  it('sorts unsorted input and keeps exactly the newest 10 records', () => {
    const input = Array.from({ length: 12 }, (_, index) => draw(index + 1)).reverse();
    const result = latestAnalysisDraws(input, '3DL');

    expect(result).toHaveLength(ANALYSIS_DRAW_COUNT);
    expect(result[0]?.date).toBe('2026-08-03');
    expect(result.at(-1)?.date).toBe('2026-08-12');
  });

  it('filters a concrete draw time before applying the latest-10 limit', () => {
    const input = Array.from({ length: 12 }, (_, index) =>
      draw(index + 1, index % 2
        ? { gameCode: '3DL-5PM', time: '17:00' }
        : { gameCode: '3DL-2PM', time: '14:00' }),
    );

    const result = latestAnalysisDraws(input, '3DL', '3DL-5PM');
    expect(result).toHaveLength(6);
    expect(result.every((item) => item.gameCode === '3DL-5PM')).toBe(true);
  });

  it('returns every matching record when fewer than 10 are available', () => {
    const result = latestAnalysisDraws([draw(2), draw(1)], '3DL');
    expect(result.map((item) => item.date)).toEqual(['2026-08-01', '2026-08-02']);
  });

  it('does not mix records from another logical game', () => {
    const input = [
      draw(1),
      draw(2, {
        logicalGameCode: 'LOTTO42',
        gameCode: 'LOTTO42',
        time: '21:00',
        numbers: [1, 2, 3, 4, 5, 6],
      }),
    ];
    expect(latestAnalysisDraws(input, '3DL')).toEqual([input[0]]);
  });
});


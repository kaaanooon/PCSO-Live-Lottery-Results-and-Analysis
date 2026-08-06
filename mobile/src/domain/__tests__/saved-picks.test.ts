import { describe, expect, it } from 'vitest';

import { restoreSavedPicks } from '../saved-picks';

describe('saved pick restoration', () => {
  const valid = {
    id: 'one',
    gameCode: '3DL',
    drawGameCode: '3DL-2PM',
    numbers: [0, 4, 6],
    mode: 'standard',
    createdAt: '2026-08-06T04:00:00.000Z',
  };

  it('restores valid picks and preserves a leading-zero value', () => {
    expect(restoreSavedPicks(JSON.stringify([valid]))).toEqual({ picks: [valid], discardedCount: 0 });
  });

  it('keeps good records while discarding stale or corrupt records', () => {
    const restored = restoreSavedPicks(JSON.stringify([
      valid,
      { ...valid, id: 'wrong-slot', drawGameCode: '3DL-7PM' },
      { ...valid, id: 'wrong-shape', numbers: [1, 2] },
    ]));
    expect(restored.picks).toHaveLength(1);
    expect(restored.discardedCount).toBe(2);
  });

  it('rejects a non-array payload', () => {
    expect(() => restoreSavedPicks('{}')).toThrow(/array/i);
  });
});

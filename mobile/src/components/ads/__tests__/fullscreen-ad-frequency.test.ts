import { describe, expect, it } from 'vitest';

import { FullscreenAdFrequencyGate } from '../fullscreen-ad-frequency';

describe('fullscreen ad frequency', () => {
  it('reserves the fifth action independently for each generator', () => {
    const gate = new FullscreenAdFrequencyGate(0);

    for (let index = 1; index < 5; index += 1) {
      expect(gate.recordAction({
        placement: 'pick-random',
        actionsPerAd: 5,
        adReady: true,
        now: index,
      })).toBeNull();
    }
    const pickLease = gate.recordAction({
      placement: 'pick-random',
      actionsPerAd: 5,
      adReady: true,
      now: 5,
    });
    expect(pickLease).not.toBeNull();
    pickLease?.release(5);

    expect(gate.recordAction({
      placement: 'analysis-random',
      actionsPerAd: 5,
      adReady: true,
      now: 6,
    })).toBeNull();
  });

  it('shares one cooldown across all fullscreen placements', () => {
    const gate = new FullscreenAdFrequencyGate(60_000);

    let analysisLease = null;
    for (let index = 0; index < 2; index += 1) {
      analysisLease = gate.recordAction({
        placement: 'analysis-draws',
        actionsPerAd: 2,
        adReady: true,
        now: index,
      });
    }
    expect(analysisLease).not.toBeNull();
    analysisLease?.release(1_000);

    let analysisRandomLease = null;
    for (let index = 0; index < 5; index += 1) {
      analysisRandomLease = gate.recordAction({
        placement: 'analysis-random',
        actionsPerAd: 5,
        adReady: true,
        now: 30_000 + index,
      });
    }
    expect(analysisRandomLease).toBeNull();

    let pickLease = null;
    for (let index = 0; index < 5; index += 1) {
      pickLease = gate.recordAction({
        placement: 'pick-random',
        actionsPerAd: 5,
        adReady: true,
        now: 61_001 + index,
      });
    }
    expect(pickLease).not.toBeNull();
  });

  it('continues without reserving an ad when none is ready', () => {
    const gate = new FullscreenAdFrequencyGate();
    let lease = null;
    for (let index = 0; index < 5; index += 1) {
      lease = gate.recordAction({
        placement: 'pick-random',
        actionsPerAd: 5,
        adReady: false,
      });
    }
    expect(lease).toBeNull();
  });

  it('blocks concurrent fullscreen ads and ignores duplicate release calls', () => {
    const gate = new FullscreenAdFrequencyGate(60_000);
    const firstLease = gate.recordAction({
      placement: 'analysis-draws',
      actionsPerAd: 1,
      adReady: true,
      now: 1_000,
    });
    expect(firstLease).not.toBeNull();
    expect(gate.recordAction({
      placement: 'pick-random',
      actionsPerAd: 1,
      adReady: true,
      now: 2_000,
    })).toBeNull();

    firstLease?.release(3_000);
    firstLease?.release(100_000);
    expect(gate.recordAction({
      placement: 'analysis-random',
      actionsPerAd: 1,
      adReady: true,
      now: 62_999,
    })).toBeNull();
    expect(gate.recordAction({
      placement: 'analysis-random',
      actionsPerAd: 1,
      adReady: true,
      now: 63_000,
    })).not.toBeNull();
  });
});

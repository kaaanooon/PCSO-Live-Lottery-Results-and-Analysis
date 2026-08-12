export type FullscreenAdPlacement =
  | 'analysis-draws'
  | 'analysis-random'
  | 'pick-random';

export const FULLSCREEN_AD_COOLDOWN_MS = 60_000;

export interface FullscreenAdLease {
  release(now?: number): void;
}

/**
 * Keeps placement counters independent while enforcing one cooldown for every
 * fullscreen ad in the current app session.
 */
export class FullscreenAdFrequencyGate {
  private readonly actionCounts = new Map<FullscreenAdPlacement, number>();
  private activeToken: number | null = null;
  private nextToken = 0;
  private lastCompletedAt: number | null = null;

  constructor(private readonly cooldownMs = FULLSCREEN_AD_COOLDOWN_MS) {}

  recordAction({
    placement,
    actionsPerAd,
    adReady,
    now = Date.now(),
  }: {
    placement: FullscreenAdPlacement;
    actionsPerAd: number;
    adReady: boolean;
    now?: number;
  }): FullscreenAdLease | null {
    const nextCount = (this.actionCounts.get(placement) ?? 0) + 1;
    this.actionCounts.set(placement, nextCount);

    if (!Number.isInteger(actionsPerAd) || actionsPerAd < 1) return null;
    if (!adReady || nextCount % actionsPerAd !== 0) return null;
    if (this.activeToken !== null) return null;
    if (
      this.lastCompletedAt !== null &&
      now - this.lastCompletedAt < this.cooldownMs
    ) {
      return null;
    }

    const token = this.nextToken + 1;
    this.nextToken = token;
    this.activeToken = token;
    let released = false;
    return {
      release: (completedAt = Date.now()) => {
        if (released || this.activeToken !== token) return;
        released = true;
        this.activeToken = null;
        this.lastCompletedAt = completedAt;
      },
    };
  }
}

export const fullscreenAdFrequencyGate = new FullscreenAdFrequencyGate();

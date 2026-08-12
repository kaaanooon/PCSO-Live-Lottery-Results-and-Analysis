import type { DrawGameCode, GameRule, LogicalGameCode, LotteryDraw } from './types';

export const ANALYSIS_DRAW_COUNT = 10;

export type AnalysisSlot = 'ALL' | DrawGameCode;

export const ANALYSIS_FINDINGS = [
  {
    id: 'random',
    title: 'Random combination',
    description: 'Generate a fair random pick, then describe its pattern.',
    icon: 'shuffle-outline',
  },
  {
    id: 'summary',
    title: 'Summary',
    description: 'Most seen, least seen, totals, and repeated numbers.',
    icon: 'grid-outline',
  },
  {
    id: 'frequency',
    title: 'Number frequency',
    description: 'See the result for every number in the game.',
    icon: 'bar-chart-outline',
  },
  {
    id: 'chart',
    title: 'Number chart',
    description: 'See where every drawn number appeared across the analyzed draws.',
    icon: 'analytics-outline',
  },
  {
    id: 'trend',
    title: 'Recent trend',
    description: 'Compare the newer half of the draws with the older half.',
    icon: 'trending-up-outline',
  },
  {
    id: 'gaps',
    title: 'Last seen and gaps',
    description: 'Check recency and average gaps for every number.',
    icon: 'time-outline',
  },
  {
    id: 'parity',
    title: 'Even and odd',
    description: 'Compare the even and odd mix in the selected draws.',
    icon: 'contrast-outline',
  },
  {
    id: 'patterns',
    title: 'Pairs and patterns',
    description: 'Review sums, low and high values, pairs, and repeats.',
    icon: 'shapes-outline',
  },
  {
    id: 'position',
    title: 'Numbers by position',
    description: 'For exact-order games, see every value in every position.',
    icon: 'list-outline',
    orderedOnly: true,
  },
] as const;

export type AnalysisFinding = (typeof ANALYSIS_FINDINGS)[number]['id'];

export function isAnalysisFinding(value: unknown): value is AnalysisFinding {
  return ANALYSIS_FINDINGS.some((finding) => finding.id === value);
}

export function findingsForRule(rule: GameRule) {
  return ANALYSIS_FINDINGS.filter(
    (finding) => !('orderedOnly' in finding) || !finding.orderedOnly || rule.ordered,
  );
}

export function isAnalysisSlotForGame(
  value: unknown,
  gameCode: LogicalGameCode,
  rule: GameRule,
): value is AnalysisSlot {
  if (value === 'ALL') return true;
  return typeof value === 'string' && Boolean(
    rule.slots?.some((slot) => slot.gameCode === value && value.startsWith(gameCode)),
  );
}

/** Return the newest records in chronological order so gap calculations stay correct. */
export function latestAnalysisDraws(
  draws: readonly LotteryDraw[],
  gameCode: LogicalGameCode,
  slot: AnalysisSlot = 'ALL',
): LotteryDraw[] {
  return draws
    .filter(
      (draw) =>
        draw.logicalGameCode === gameCode &&
        (slot === 'ALL' || draw.gameCode === slot),
    )
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.time.localeCompare(right.time) ||
        left.gameCode.localeCompare(right.gameCode),
    )
    .slice(-ANALYSIS_DRAW_COUNT);
}

import {
  formatCombination,
  formatNumber,
  theoreticalOutcomeCount,
} from "./games";
import type { Draw, GameRule } from "./types";

/**
 * A historical profile is descriptive, not predictive. This warning is kept on
 * every generated combination so a UI cannot accidentally present it as odds.
 */
export const EQUAL_ODDS_WARNING =
  "This historical-profile pick is not more likely than another valid combination. In a fair draw, every valid combination has the same chance.";

export type FrequencyTemperature =
  | "Sample hot"
  | "Sample cold"
  | "Middle"
  | "Tied";

export interface FrequencyRow {
  readonly number: string;
  readonly numericValue: number;
  readonly appearanceCount: number;
  readonly appearanceSharePct: number;
  readonly drawHitCount: number;
  readonly drawHitRatePct: number;
  readonly expectedCount: number;
  readonly differenceFromExpected: number;
  readonly seenInSelectedSample: boolean;
  /** Draw records since the last hit; null means unseen in this selected sample. */
  readonly drawsSinceLast: number | null;
  readonly meanGapDraws: number | null;
  readonly maximumGapDraws: number | null;
  readonly lastSeen: string | null;
  readonly temperature: FrequencyTemperature;
}

export interface PositionFrequencyRow {
  readonly position: number;
  readonly number: string;
  readonly numericValue: number;
  readonly count: number;
  readonly ratePct: number;
}

export interface ParityRow {
  readonly pattern: string;
  readonly evenCount: number;
  readonly oddCount: number;
  readonly drawCount: number;
  readonly observedPct: number;
  readonly theoreticalPct: number;
}

export interface DistributionRow {
  readonly value: number;
  readonly drawCount: number;
  readonly observedPct: number;
}

export interface LowHighRow {
  readonly pattern: string;
  readonly lowCount: number;
  readonly highCount: number;
  readonly drawCount: number;
  readonly observedPct: number;
}

export interface PatternFrequencyRow {
  readonly key: string;
  readonly numbers: readonly number[];
  readonly occurrenceCount: number;
  readonly drawSupportCount: number;
  readonly drawSupportPct: number;
}

export interface DrawFeature {
  readonly index: number;
  readonly gameCode: Draw["gameCode"];
  readonly date: string;
  readonly time: string;
  readonly numbers: readonly number[];
  readonly combination: string;
  readonly sum: number;
  readonly evenCount: number;
  readonly oddCount: number;
  readonly lowCount: number;
  readonly highCount: number;
  readonly uniqueValues: number;
  readonly consecutivePairs: number;
  readonly sharedValuesWithPrevious: number | null;
  readonly sharedDistinctValuesWithPrevious: number | null;
  readonly exactPositionRepeatsWithPrevious: number | null;
}

export interface SumStatistics {
  readonly average: number | null;
  readonly median: number | null;
  readonly minimum: number | null;
  readonly maximum: number | null;
}

export interface PreviousOverlapStatistics {
  readonly comparisons: number;
  readonly drawsSharingAtLeastOne: number;
  readonly drawsSharingAtLeastOnePct: number;
  readonly averageSharedValues: number;
  /** Applies only to ordered games; null for jackpot games. */
  readonly averageExactPositionRepeats: number | null;
}

export interface ConsecutiveStatistics {
  readonly drawsWithConsecutive: number;
  readonly drawsWithConsecutivePct: number;
  readonly totalConsecutivePairs: number;
  readonly averageConsecutivePairs: number;
  readonly maximumConsecutivePairs: number;
  readonly distribution: readonly DistributionRow[];
}

export interface AmountStatistics {
  readonly kind: GameRule["amountKind"];
  readonly availableDraws: number;
  readonly unavailableOrZeroDraws: number;
  readonly average: number | null;
  readonly median: number | null;
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly latestAvailable: number | null;
}

export interface WinnerStatistics {
  readonly reportedTotal: number;
  readonly reportedAveragePerDraw: number;
  readonly drawsWithReportedWinners: number;
  readonly maximumReportedWinners: number;
  readonly zeroReportedDraws: number;
}

export interface HistoricalProfileCandidate {
  readonly numbers: readonly number[];
  readonly combination: string;
  readonly historicalFitScore: number;
  readonly evenCount: number;
  readonly oddCount: number;
  readonly lowCount: number;
  readonly highCount: number;
  readonly sum: number;
  readonly uniqueValues: number;
  readonly seenBeforeCount: number;
  readonly theoreticalOddsOneIn: number;
  readonly method: string;
  readonly probabilityWarning: string;
}

export interface GameAnalysisSummary {
  readonly gameCode: GameRule["code"];
  readonly game: string;
  readonly drawCount: number;
  readonly selectedStartDate: string | null;
  readonly selectedEndDate: string | null;
  readonly numberObservations: number;
  readonly evenOccurrences: number;
  readonly oddOccurrences: number;
  readonly evenOccurrencePct: number;
  readonly oddOccurrencePct: number;
  readonly lowBoundary: number;
  readonly highBoundary: number;
  readonly theoreticalOutcomes: number;
  readonly theoreticalOdds: string;
}

export interface GameAnalysis {
  readonly rule: GameRule;
  readonly summary: GameAnalysisSummary;
  readonly narratives: readonly string[];
  readonly frequency: readonly FrequencyRow[];
  readonly hotNumbers: readonly number[];
  readonly coldNumbers: readonly number[];
  readonly positionFrequency: readonly PositionFrequencyRow[];
  readonly parityDistribution: readonly ParityRow[];
  readonly drawFeatures: readonly DrawFeature[];
  readonly sumStatistics: SumStatistics;
  readonly sumDistribution: readonly DistributionRow[];
  readonly lowHighDistribution: readonly LowHighRow[];
  readonly consecutive: ConsecutiveStatistics;
  readonly previousOverlap: PreviousOverlapStatistics;
  readonly pairFrequency: readonly PatternFrequencyRow[];
  readonly tripleFrequency: readonly PatternFrequencyRow[];
  readonly amountStatistics: AmountStatistics;
  readonly winnerStatistics: WinnerStatistics;
  readonly recommendedCandidate: HistoricalProfileCandidate | null;
  readonly probabilityWarning: string;
}

export interface AnalysisOptions {
  /** Changing the seed changes the deterministic candidate, not the analysis. */
  readonly seed?: number;
  /** Useful for a deterministic “show another” action. */
  readonly candidateVariant?: number;
  /** More samples can find a closer profile fit but do not improve win odds. */
  readonly candidatePoolSize?: number;
}

interface CandidateContext {
  readonly drawCount: number;
  readonly overall: ReadonlyMap<number, number>;
  readonly positions: readonly ReadonlyMap<number, number>[];
  readonly parity: ReadonlyMap<number, number>;
  readonly low: ReadonlyMap<number, number>;
  readonly unique: ReadonlyMap<number, number>;
  readonly historyBlend: number;
  readonly sumMean: number;
  readonly sumStandardDeviation: number;
}

const round = (value: number, places = 3): number => {
  const scale = 10 ** places;
  return Math.round((value + Number.EPSILON) * scale) / scale;
};

const average = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;

const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]!
    : (ordered[middle - 1]! + ordered[middle]!) / 2;
};

const percentage = (part: number, whole: number): number =>
  whole === 0 ? 0 : round((part / whole) * 100, 4);

const domainFor = (rule: GameRule): number[] =>
  Array.from(
    { length: rule.maximum - rule.minimum + 1 },
    (_, index) => rule.minimum + index,
  );

const increment = <Key>(map: Map<Key, number>, key: Key, by = 1): void => {
  map.set(key, (map.get(key) ?? 0) + by);
};

const chronological = (left: Draw, right: Draw): number =>
  left.date.localeCompare(right.date) ||
  left.time.localeCompare(right.time) ||
  left.gameCode.localeCompare(right.gameCode);

const validDrawsFor = (draws: readonly Draw[], rule: GameRule): Draw[] =>
  draws
    .filter(
      (draw) =>
        draw.logicalGameCode === rule.code &&
        draw.numbers.length === rule.pickCount &&
        draw.numbers.every(
          (number) =>
            Number.isInteger(number) &&
            number >= rule.minimum &&
            number <= rule.maximum,
        ) &&
        (rule.repeatsAllowed || new Set(draw.numbers).size === draw.numbers.length),
    )
    .sort(chronological);

const choose = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0;
  let result = 1;
  const smaller = Math.min(k, n - k);
  for (let index = 1; index <= smaller; index += 1) {
    result = (result * (n - smaller + index)) / index;
  }
  return Math.round(result);
};

const theoreticalParityProbability = (
  rule: GameRule,
  evenCount: number,
): number => {
  const domain = domainFor(rule);
  const evenValues = domain.filter((number) => number % 2 === 0).length;
  const oddValues = domain.length - evenValues;
  const oddCount = rule.pickCount - evenCount;
  if (rule.ordered) {
    const evenProbability = evenValues / domain.length;
    return (
      choose(rule.pickCount, evenCount) *
      evenProbability ** evenCount *
      (1 - evenProbability) ** oddCount
    );
  }
  if (evenCount > evenValues || oddCount > oddValues) return 0;
  return (
    (choose(evenValues, evenCount) * choose(oddValues, oddCount)) /
    choose(domain.length, rule.pickCount)
  );
};

const multisetOverlap = (
  current: readonly number[],
  previous: readonly number[],
): number => {
  const currentCounts = new Map<number, number>();
  const previousCounts = new Map<number, number>();
  current.forEach((number) => increment(currentCounts, number));
  previous.forEach((number) => increment(previousCounts, number));
  let overlap = 0;
  currentCounts.forEach((count, number) => {
    overlap += Math.min(count, previousCounts.get(number) ?? 0);
  });
  return overlap;
};

const parsePositiveAmount = (value: string): number | null => {
  const normalized = value
    .trim()
    .replace(/[,₱]/g, "")
    .replace(/^PHP\s*/i, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const patternRows = (
  occurrence: ReadonlyMap<string, number>,
  support: ReadonlyMap<string, number>,
  values: ReadonlyMap<string, readonly number[]>,
  drawCount: number,
): PatternFrequencyRow[] =>
  [...occurrence.entries()]
    .map(([key, occurrenceCount]) => ({
      key,
      numbers: values.get(key) ?? [],
      occurrenceCount,
      drawSupportCount: support.get(key) ?? 0,
      drawSupportPct: percentage(support.get(key) ?? 0, drawCount),
    }))
    .sort(
      (left, right) =>
        right.occurrenceCount - left.occurrenceCount ||
        left.key.localeCompare(right.key),
    );

const countMapMaximum = (map: ReadonlyMap<number, number>): number =>
  Math.max(1, ...map.values());

const createCandidateContext = (
  draws: readonly Draw[],
  rule: GameRule,
): CandidateContext => {
  const overall = new Map<number, number>();
  const positions = Array.from(
    { length: rule.pickCount },
    () => new Map<number, number>(),
  );
  const parity = new Map<number, number>();
  const low = new Map<number, number>();
  const unique = new Map<number, number>();
  const midpoint = Math.floor((rule.minimum + rule.maximum) / 2);
  const sums: number[] = [];

  draws.forEach((draw) => {
    draw.numbers.forEach((number, position) => {
      increment(overall, number);
      increment(positions[position]!, number);
    });
    increment(parity, draw.numbers.filter((number) => number % 2 === 0).length);
    increment(low, draw.numbers.filter((number) => number <= midpoint).length);
    increment(unique, new Set(draw.numbers).size);
    sums.push(draw.numbers.reduce((total, number) => total + number, 0));
  });

  const domainSize = rule.maximum - rule.minimum + 1;
  const historyBlend = Math.min(0.35, draws.length / (draws.length + 20));
  const fairSumMean =
    (rule.pickCount * (rule.minimum + rule.maximum)) / 2;
  let fairSumVariance =
    (rule.pickCount * (domainSize ** 2 - 1)) / 12;
  if (!rule.ordered && domainSize > 1) {
    fairSumVariance *=
      (domainSize - rule.pickCount) / (domainSize - 1);
  }
  const sampleSumMean = sums.length > 0 ? average(sums) : fairSumMean;

  return {
    drawCount: draws.length,
    overall,
    positions,
    parity,
    low,
    unique,
    historyBlend,
    sumMean:
      (1 - historyBlend) * fairSumMean + historyBlend * sampleSumMean,
    sumStandardDeviation: Math.sqrt(Math.max(0, fairSumVariance)),
  };
};

const profileScore = (
  numbers: readonly number[],
  rule: GameRule,
  context: CandidateContext,
): number => {
  const domainSize = rule.maximum - rule.minimum + 1;
  let relativeRates: number[];
  if (rule.ordered) {
    relativeRates = numbers.map((number, position) => {
      const smoothed =
        ((context.positions[position]?.get(number) ?? 0) + 1) /
        (context.drawCount + domainSize);
      return smoothed / (1 / domainSize);
    });
  } else {
    const slots = context.drawCount * rule.pickCount;
    relativeRates = numbers.map((number) => {
      const smoothed =
        ((context.overall.get(number) ?? 0) + 1) / (slots + domainSize);
      return smoothed / (1 / domainSize);
    });
  }
  const frequencyFit = average(
    relativeRates.map((rate) => Math.min(2, rate) / 2),
  );
  const evenCount = numbers.filter((number) => number % 2 === 0).length;
  const midpoint = Math.floor((rule.minimum + rule.maximum) / 2);
  const lowCount = numbers.filter((number) => number <= midpoint).length;
  const parityFit =
    (context.parity.get(evenCount) ?? 0) / countMapMaximum(context.parity);
  const lowFit =
    (context.low.get(lowCount) ?? 0) / countMapMaximum(context.low);
  const sum = numbers.reduce((total, number) => total + number, 0);
  const sumZ =
    context.sumStandardDeviation === 0
      ? 0
      : (sum - context.sumMean) / context.sumStandardDeviation;
  const sumFit = Math.exp(-0.5 * sumZ * sumZ);
  const uniqueFit = rule.ordered
    ? (context.unique.get(new Set(numbers).size) ?? 0) /
      countMapMaximum(context.unique)
    : 1;
  return round(
    (0.35 * frequencyFit +
      0.2 * parityFit +
      0.15 * lowFit +
      0.2 * sumFit +
      0.1 * uniqueFit) *
      100,
    2,
  );
};

const fnv1a32 = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const weightedIndex = (
  random: () => number,
  weights: readonly number[],
): number => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    target -= weights[index]!;
    if (target <= 0) return index;
  }
  return weights.length - 1;
};

const generateOne = (
  random: () => number,
  rule: GameRule,
  context: CandidateContext,
): number[] => {
  const domain = domainFor(rule);
  const domainSize = domain.length;
  const blend = context.historyBlend;

  if (rule.ordered) {
    const selected: number[] = [];
    const remaining = [...domain];
    for (let position = 0; position < rule.pickCount; position += 1) {
      const values = rule.repeatsAllowed ? domain : remaining;
      const positionCounts = context.positions[position]!;
      const weights = values.map((number) => {
        const smoothed =
          ((positionCounts.get(number) ?? 0) + 1) /
          (context.drawCount + domainSize);
        return (1 - blend) * (1 / domainSize) + blend * smoothed;
      });
      const selectedIndex = weightedIndex(random, weights);
      const value = values[selectedIndex]!;
      selected.push(value);
      if (!rule.repeatsAllowed) {
        remaining.splice(remaining.indexOf(value), 1);
      }
    }
    return selected;
  }

  const remaining = [...domain];
  const selected: number[] = [];
  const totalSlots = context.drawCount * rule.pickCount;
  while (selected.length < rule.pickCount) {
    const weights = remaining.map((number) => {
      const smoothed =
        ((context.overall.get(number) ?? 0) + 1) /
        (totalSlots + domainSize);
      return (1 - blend) * (1 / domainSize) + blend * smoothed;
    });
    const index = weightedIndex(random, weights);
    selected.push(remaining[index]!);
    remaining.splice(index, 1);
  }
  return selected.sort((left, right) => left - right);
};

const candidateHistoryKey = (
  numbers: readonly number[],
  rule: GameRule,
): string =>
  (rule.ordered ? [...numbers] : [...numbers].sort((a, b) => a - b)).join(
    ",",
  );

/**
 * Produce a stable profile-fit pick for the exact draw sample supplied. Use a
 * different variant for a deterministic “show another” button.
 */
export function generateHistoricalProfileCandidate(
  inputDraws: readonly Draw[],
  rule: GameRule,
  options: AnalysisOptions = {},
): HistoricalProfileCandidate | null {
  const draws = validDrawsFor(inputDraws, rule);
  if (draws.length === 0) return null;

  const context = createCandidateContext(draws, rule);
  const seed = options.seed ?? 20260806;
  const variant = Math.max(0, Math.trunc(options.candidateVariant ?? 0));
  const poolSize = Math.max(
    250,
    Math.min(10_000, Math.trunc(options.candidatePoolSize ?? 2_000)),
  );
  const signature = draws
    .map(
      (draw) =>
        `${draw.gameCode}:${draw.date}:${draw.time}:${draw.numbers.join(",")}`,
    )
    .join("|");
  const random = mulberry32(
    fnv1a32(`${seed}:${rule.code}:${signature}`),
  );
  const generated = new Map<string, { readonly numbers: number[]; readonly score: number }>();

  for (let index = 0; index < poolSize; index += 1) {
    const candidate = generateOne(random, rule, context);
    const key = candidate.join(",");
    if (generated.has(key)) continue;
    const score = profileScore(candidate, rule, context);
    generated.set(key, { numbers: candidate, score });
  }
  const ranked = [...generated.entries()].sort(
    ([leftKey, left], [rightKey, right]) => right.score - left.score || leftKey.localeCompare(rightKey),
  );
  if (ranked.length === 0) return null;
  const selectedRank = variant % ranked.length;
  const [, selected] = ranked[selectedRank]!;
  const best = selected.numbers;
  const bestScore = selected.score;

  const midpoint = Math.floor((rule.minimum + rule.maximum) / 2);
  const evenCount = best.filter((number) => number % 2 === 0).length;
  const history = new Map<string, number>();
  draws.forEach((draw) =>
    increment(history, candidateHistoryKey(draw.numbers, rule)),
  );
  return {
    numbers: best,
    combination: formatCombination(best, rule),
    historicalFitScore: bestScore,
    evenCount,
    oddCount: rule.pickCount - evenCount,
    lowCount: best.filter((number) => number <= midpoint).length,
    highCount: best.filter((number) => number > midpoint).length,
    sum: best.reduce((total, number) => total + number, 0),
    uniqueValues: new Set(best).size,
    seenBeforeCount: history.get(candidateHistoryKey(best, rule)) ?? 0,
    theoreticalOddsOneIn: theoreticalOutcomeCount(rule),
    method: `${variant === 0 ? 'Best' : `Alternative ${selectedRank + 1}`} historical-profile fit found in ${poolSize.toLocaleString()} deterministic samples using smoothed number frequency, even/odd and low/high shapes, sum centrality, and repetition shape.`,
    probabilityWarning: EQUAL_ODDS_WARNING,
  };
}

const emptyAnalysis = (rule: GameRule): GameAnalysis => {
  const midpoint = Math.floor((rule.minimum + rule.maximum) / 2);
  const outcomes = theoreticalOutcomeCount(rule);
  return {
    rule,
    summary: {
      gameCode: rule.code,
      game: rule.name,
      drawCount: 0,
      selectedStartDate: null,
      selectedEndDate: null,
      numberObservations: 0,
      evenOccurrences: 0,
      oddOccurrences: 0,
      evenOccurrencePct: 0,
      oddOccurrencePct: 0,
      lowBoundary: midpoint,
      highBoundary: midpoint + 1,
      theoreticalOutcomes: outcomes,
      theoreticalOdds: `1 in ${outcomes.toLocaleString()}`,
    },
    narratives: [
      `No valid ${rule.name} draws were found in the selected sample or date range.`,
      EQUAL_ODDS_WARNING,
    ],
    frequency: [],
    hotNumbers: [],
    coldNumbers: [],
    positionFrequency: [],
    parityDistribution: [],
    drawFeatures: [],
    sumStatistics: {
      average: null,
      median: null,
      minimum: null,
      maximum: null,
    },
    sumDistribution: [],
    lowHighDistribution: [],
    consecutive: {
      drawsWithConsecutive: 0,
      drawsWithConsecutivePct: 0,
      totalConsecutivePairs: 0,
      averageConsecutivePairs: 0,
      maximumConsecutivePairs: 0,
      distribution: [],
    },
    previousOverlap: {
      comparisons: 0,
      drawsSharingAtLeastOne: 0,
      drawsSharingAtLeastOnePct: 0,
      averageSharedValues: 0,
      averageExactPositionRepeats: rule.ordered ? 0 : null,
    },
    pairFrequency: [],
    tripleFrequency: [],
    amountStatistics: {
      kind: rule.amountKind,
      availableDraws: 0,
      unavailableOrZeroDraws: 0,
      average: null,
      median: null,
      minimum: null,
      maximum: null,
      latestAvailable: null,
    },
    winnerStatistics: {
      reportedTotal: 0,
      reportedAveragePerDraw: 0,
      drawsWithReportedWinners: 0,
      maximumReportedWinners: 0,
      zeroReportedDraws: 0,
    },
    recommendedCandidate: null,
    probabilityWarning: EQUAL_ODDS_WARNING,
  };
};

/**
 * Analyze the caller-selected sample. The caller chooses and orders the draw
 * records; this function intentionally does not impose a range filter.
 */
export function analyzeGame(
  inputDraws: readonly Draw[],
  rule: GameRule,
  options: AnalysisOptions = {},
): GameAnalysis {
  const draws = validDrawsFor(inputDraws, rule);
  if (draws.length === 0) return emptyAnalysis(rule);

  const drawCount = draws.length;
  const totalSlots = drawCount * rule.pickCount;
  const domain = domainFor(rule);
  const occurrence = new Map<number, number>();
  const hitIndices = new Map<number, number[]>();
  const lastSeen = new Map<number, string>();
  draws.forEach((draw, drawIndex) => {
    draw.numbers.forEach((number) => increment(occurrence, number));
    new Set(draw.numbers).forEach((number) => {
      const indices = hitIndices.get(number) ?? [];
      indices.push(drawIndex);
      hitIndices.set(number, indices);
      lastSeen.set(number, draw.date);
    });
  });

  const counts = domain.map((number) => occurrence.get(number) ?? 0);
  const maximumFrequency = Math.max(...counts);
  const minimumFrequency = Math.min(...counts);
  const expectedCount = totalSlots / domain.length;
  const frequency: FrequencyRow[] = domain.map((number) => {
    const indices = hitIndices.get(number) ?? [];
    const gaps = indices
      .slice(1)
      .map((right, index) => right - indices[index]! - 1);
    const appearanceCount = occurrence.get(number) ?? 0;
    let temperature: FrequencyTemperature = "Middle";
    if (maximumFrequency === minimumFrequency) temperature = "Tied";
    else if (appearanceCount === maximumFrequency) temperature = "Sample hot";
    else if (appearanceCount === minimumFrequency) temperature = "Sample cold";
    return {
      number: formatNumber(number, rule),
      numericValue: number,
      appearanceCount,
      appearanceSharePct: percentage(appearanceCount, totalSlots),
      drawHitCount: indices.length,
      drawHitRatePct: percentage(indices.length, drawCount),
      expectedCount: round(expectedCount),
      differenceFromExpected: round(appearanceCount - expectedCount),
      seenInSelectedSample: indices.length > 0,
      drawsSinceLast:
        indices.length > 0 ? drawCount - indices[indices.length - 1]! - 1 : null,
      meanGapDraws: gaps.length > 0 ? round(average(gaps)) : null,
      maximumGapDraws: gaps.length > 0 ? Math.max(...gaps) : null,
      lastSeen: lastSeen.get(number) ?? null,
      temperature,
    };
  });
  const hotNumbers =
    maximumFrequency === minimumFrequency
      ? []
      : frequency
          .filter((row) => row.appearanceCount === maximumFrequency)
          .map((row) => row.numericValue);
  const coldNumbers =
    maximumFrequency === minimumFrequency
      ? []
      : frequency
          .filter((row) => row.appearanceCount === minimumFrequency)
          .map((row) => row.numericValue);

  const positionFrequency: PositionFrequencyRow[] = [];
  if (rule.ordered) {
    for (let position = 0; position < rule.pickCount; position += 1) {
      const positionCounts = new Map<number, number>();
      draws.forEach((draw) => increment(positionCounts, draw.numbers[position]!));
      domain.forEach((number) => {
        const count = positionCounts.get(number) ?? 0;
        positionFrequency.push({
          position: position + 1,
          number: formatNumber(number, rule),
          numericValue: number,
          count,
          ratePct: percentage(count, drawCount),
        });
      });
    }
  }

  const midpoint = Math.floor((rule.minimum + rule.maximum) / 2);
  const parityCounts = new Map<number, number>();
  const lowHighCounts = new Map<string, number>();
  const consecutiveCounts = new Map<number, number>();
  const sums: number[] = [];
  const drawFeatures: DrawFeature[] = [];
  let previous: readonly number[] | null = null;
  draws.forEach((draw, index) => {
    const featureValues = rule.ordered
      ? [...draw.numbers]
      : [...draw.numbers].sort((left, right) => left - right);
    const evenCount = featureValues.filter((number) => number % 2 === 0).length;
    const lowCount = featureValues.filter((number) => number <= midpoint).length;
    const consecutivePairs = featureValues
      .slice(1)
      .filter(
        (number, position) =>
          Math.abs(number - featureValues[position]!) === 1,
      ).length;
    const sum = featureValues.reduce((total, number) => total + number, 0);
    increment(parityCounts, evenCount);
    increment(lowHighCounts, `${lowCount},${rule.pickCount - lowCount}`);
    increment(consecutiveCounts, consecutivePairs);
    sums.push(sum);

    let sharedValuesWithPrevious: number | null = null;
    let sharedDistinctValuesWithPrevious: number | null = null;
    let exactPositionRepeatsWithPrevious: number | null = null;
    if (previous) {
      sharedValuesWithPrevious = multisetOverlap(featureValues, previous);
      sharedDistinctValuesWithPrevious = new Set(featureValues.filter((number) =>
        previous!.includes(number),
      )).size;
      if (rule.ordered) {
        exactPositionRepeatsWithPrevious = featureValues.filter(
          (number, position) => number === previous![position],
        ).length;
      }
    }
    drawFeatures.push({
      index: index + 1,
      gameCode: draw.gameCode,
      date: draw.date,
      time: draw.time,
      numbers: [...draw.numbers],
      combination: formatCombination(draw.numbers, rule),
      sum,
      evenCount,
      oddCount: rule.pickCount - evenCount,
      lowCount,
      highCount: rule.pickCount - lowCount,
      uniqueValues: new Set(featureValues).size,
      consecutivePairs,
      sharedValuesWithPrevious,
      sharedDistinctValuesWithPrevious,
      exactPositionRepeatsWithPrevious,
    });
    previous = featureValues;
  });

  const parityDistribution: ParityRow[] = Array.from(
    { length: rule.pickCount + 1 },
    (_, evenCount) => ({
      pattern: `${evenCount}E-${rule.pickCount - evenCount}O`,
      evenCount,
      oddCount: rule.pickCount - evenCount,
      drawCount: parityCounts.get(evenCount) ?? 0,
      observedPct: percentage(parityCounts.get(evenCount) ?? 0, drawCount),
      theoreticalPct: round(
        theoreticalParityProbability(rule, evenCount) * 100,
        4,
      ),
    }),
  );
  const sumCounts = new Map<number, number>();
  sums.forEach((sum) => increment(sumCounts, sum));
  const sumDistribution: DistributionRow[] = [...sumCounts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([value, count]) => ({
      value,
      drawCount: count,
      observedPct: percentage(count, drawCount),
    }));
  const lowHighDistribution: LowHighRow[] = [...lowHighCounts.entries()]
    .map(([key, count]) => {
      const [lowCount, highCount] = key.split(",").map(Number);
      return {
        pattern: `${lowCount}L-${highCount}H`,
        lowCount: lowCount!,
        highCount: highCount!,
        drawCount: count,
        observedPct: percentage(count, drawCount),
      };
    })
    .sort(
      (left, right) =>
        right.drawCount - left.drawCount || left.lowCount - right.lowCount,
    );

  const pairOccurrence = new Map<string, number>();
  const pairSupport = new Map<string, number>();
  const pairValues = new Map<string, readonly number[]>();
  const tripleOccurrence = new Map<string, number>();
  const tripleSupport = new Map<string, number>();
  const tripleValues = new Map<string, readonly number[]>();
  draws.forEach((draw) => {
    const values = rule.ordered
      ? [...draw.numbers]
      : [...draw.numbers].sort((left, right) => left - right);
    const pairs: number[][] = [];
    const triples: number[][] = [];
    if (rule.ordered) {
      for (let index = 0; index < values.length - 1; index += 1) {
        pairs.push(values.slice(index, index + 2));
      }
      for (let index = 0; index < values.length - 2; index += 1) {
        triples.push(values.slice(index, index + 3));
      }
    } else {
      for (let first = 0; first < values.length; first += 1) {
        for (let second = first + 1; second < values.length; second += 1) {
          pairs.push([values[first]!, values[second]!]);
          for (let third = second + 1; third < values.length; third += 1) {
            triples.push([values[first]!, values[second]!, values[third]!]);
          }
        }
      }
    }
    const pairKeys = new Set<string>();
    pairs.forEach((pair) => {
      const key = pair.map((number) => formatNumber(number, rule)).join(
        rule.ordered ? ">" : "-",
      );
      increment(pairOccurrence, key);
      pairValues.set(key, pair);
      pairKeys.add(key);
    });
    pairKeys.forEach((key) => increment(pairSupport, key));
    const tripleKeys = new Set<string>();
    triples.forEach((triple) => {
      const key = triple.map((number) => formatNumber(number, rule)).join(
        rule.ordered ? ">" : "-",
      );
      increment(tripleOccurrence, key);
      tripleValues.set(key, triple);
      tripleKeys.add(key);
    });
    tripleKeys.forEach((key) => increment(tripleSupport, key));
  });

  const comparisonFeatures = drawFeatures.slice(1);
  const drawsSharingAtLeastOne = comparisonFeatures.filter(
    (feature) => (feature.sharedValuesWithPrevious ?? 0) > 0,
  ).length;
  const drawsWithConsecutive = drawFeatures.filter(
    (feature) => feature.consecutivePairs > 0,
  ).length;
  const totalConsecutivePairs = drawFeatures.reduce(
    (total, feature) => total + feature.consecutivePairs,
    0,
  );
  const consecutiveDistribution = [...consecutiveCounts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([value, count]) => ({
      value,
      drawCount: count,
      observedPct: percentage(count, drawCount),
    }));

  const amounts = draws
    .map((draw) => parsePositiveAmount(draw.amount))
    .filter((value): value is number => value !== null);
  const winnerValues = draws.map((draw) =>
    Number.isFinite(draw.winners) && draw.winners > 0
      ? Math.trunc(draw.winners)
      : 0,
  );
  const amountStatistics: AmountStatistics = {
    kind: rule.amountKind,
    availableDraws: amounts.length,
    unavailableOrZeroDraws: drawCount - amounts.length,
    average: amounts.length > 0 ? round(average(amounts), 2) : null,
    median: amounts.length > 0 ? round(median(amounts), 2) : null,
    minimum: amounts.length > 0 ? Math.min(...amounts) : null,
    maximum: amounts.length > 0 ? Math.max(...amounts) : null,
    latestAvailable: amounts.length > 0 ? amounts[amounts.length - 1]! : null,
  };
  const winnerStatistics: WinnerStatistics = {
    reportedTotal: winnerValues.reduce((total, value) => total + value, 0),
    reportedAveragePerDraw: round(average(winnerValues)),
    drawsWithReportedWinners: winnerValues.filter((value) => value > 0).length,
    maximumReportedWinners: Math.max(0, ...winnerValues),
    zeroReportedDraws: winnerValues.filter((value) => value === 0).length,
  };

  const topCount = maximumFrequency;
  const leastCount = minimumFrequency;
  const mostSeen = frequency
    .filter((row) => row.appearanceCount === topCount)
    .map((row) => row.number);
  const leastSeen = frequency
    .filter((row) => row.appearanceCount === leastCount)
    .map((row) => row.number);
  const modalParityCount = Math.max(
    ...parityDistribution.map((row) => row.drawCount),
  );
  const modalParity = parityDistribution.filter(
    (row) => row.drawCount === modalParityCount,
  );
  const pairFrequency = patternRows(
    pairOccurrence,
    pairSupport,
    pairValues,
    drawCount,
  );
  const tripleFrequency = patternRows(
    tripleOccurrence,
    tripleSupport,
    tripleValues,
    drawCount,
  );
  const topPair = pairFrequency[0];
  const topTriple = tripleFrequency[0];

  const narratives: string[] = [
    `This view uses ${drawCount} ${rule.name} draw${drawCount === 1 ? "" : "s"} from ${draws[0]!.date} through ${draws[drawCount - 1]!.date}.`,
  ];
  if (maximumFrequency === minimumFrequency) {
    narratives.push(
      `Every value in the game range is tied at ${maximumFrequency} appearance${maximumFrequency === 1 ? "" : "s"} in this selected sample.`,
    );
  } else {
    narratives.push(
      `${mostSeen.slice(0, 5).join(", ")}${mostSeen.length > 5 ? " and others" : ""} appeared most often (${topCount} time${topCount === 1 ? "" : "s"}). The least-seen values appeared ${leastCount} time${leastCount === 1 ? "" : "s"}: ${leastSeen.slice(0, 6).join(", ")}${leastSeen.length > 6 ? " and others" : ""}.`,
    );
  }
  narratives.push(
    modalParity.length === 1
      ? `The most common even/odd shape was ${modalParity[0]!.evenCount} even and ${modalParity[0]!.oddCount} odd, occurring in ${modalParityCount} of ${drawCount} draws.`
      : `The leading even/odd shapes were tied: ${modalParity.map((row) => row.pattern).join(", ")}, each occurring in ${modalParityCount} of ${drawCount} draws.`,
    `Draw sums averaged ${average(sums).toFixed(1)}, with a low of ${Math.min(...sums)} and a high of ${Math.max(...sums)} in this sample.`,
    `${drawsWithConsecutive} of ${drawCount} draws contained at least one ${rule.ordered ? "adjacent positional" : "numerically consecutive"} pair.${comparisonFeatures.length > 0 ? ` ${drawsSharingAtLeastOne} of ${comparisonFeatures.length} comparable draws shared at least one value with the previous draw.` : " At least two draws are needed for a previous-draw comparison."}`,
    `For this game, low means ${rule.minimum}-${midpoint} and high means ${midpoint + 1}-${rule.maximum}.`,
    `The source reported ${winnerStatistics.reportedTotal.toLocaleString()} winner${winnerStatistics.reportedTotal === 1 ? "" : "s"} across this sample. Positive ${rule.amountKind} values were available for ${amounts.length} of ${drawCount} draws; zero placeholders are treated as unavailable.`,
  );
  if (topPair && topPair.occurrenceCount > 1) {
    narratives.push(
      `The leading ${rule.ordered ? "ordered transition" : "pair"} was ${topPair.key}, with ${topPair.occurrenceCount} occurrences across ${topPair.drawSupportCount} draw${topPair.drawSupportCount === 1 ? "" : "s"}.`,
    );
  } else {
    narratives.push(
      `No ${rule.ordered ? "ordered transition" : "pair"} repeated in this selected sample.`,
    );
  }
  if (rule.pickCount < 3) {
    narratives.push("Triple analysis does not apply to 2D Lotto.");
  } else if (topTriple && topTriple.occurrenceCount > 1) {
    narratives.push(
      `The leading ${rule.ordered ? "adjacent ordered triple" : "unordered triple"} was ${topTriple.key}, with ${topTriple.occurrenceCount} occurrences.`,
    );
  } else {
    narratives.push("No triple repeated in this selected sample.");
  }
  narratives.push(
    "Absence and gap values count selected logical-game draw records, not calendar days.",
  );
  if (drawCount < 30) {
    narratives.push(
      "This is a small sample. Hot/cold labels, gaps, pairs, triples, and profile scores can change sharply when another draw is added.",
    );
  }
  narratives.push(EQUAL_ODDS_WARNING);

  const evenOccurrences = draws.reduce(
    (total, draw) =>
      total + draw.numbers.filter((number) => number % 2 === 0).length,
    0,
  );
  const outcomes = theoreticalOutcomeCount(rule);
  return {
    rule,
    summary: {
      gameCode: rule.code,
      game: rule.name,
      drawCount,
      selectedStartDate: draws[0]!.date,
      selectedEndDate: draws[drawCount - 1]!.date,
      numberObservations: totalSlots,
      evenOccurrences,
      oddOccurrences: totalSlots - evenOccurrences,
      evenOccurrencePct: percentage(evenOccurrences, totalSlots),
      oddOccurrencePct: percentage(totalSlots - evenOccurrences, totalSlots),
      lowBoundary: midpoint,
      highBoundary: midpoint + 1,
      theoreticalOutcomes: outcomes,
      theoreticalOdds: `1 in ${outcomes.toLocaleString()}`,
    },
    narratives,
    frequency,
    hotNumbers,
    coldNumbers,
    positionFrequency,
    parityDistribution,
    drawFeatures,
    sumStatistics: {
      average: round(average(sums)),
      median: round(median(sums)),
      minimum: Math.min(...sums),
      maximum: Math.max(...sums),
    },
    sumDistribution,
    lowHighDistribution,
    consecutive: {
      drawsWithConsecutive,
      drawsWithConsecutivePct: percentage(drawsWithConsecutive, drawCount),
      totalConsecutivePairs,
      averageConsecutivePairs: round(totalConsecutivePairs / drawCount),
      maximumConsecutivePairs: Math.max(
        ...drawFeatures.map((feature) => feature.consecutivePairs),
      ),
      distribution: consecutiveDistribution,
    },
    previousOverlap: {
      comparisons: comparisonFeatures.length,
      drawsSharingAtLeastOne,
      drawsSharingAtLeastOnePct: percentage(
        drawsSharingAtLeastOne,
        comparisonFeatures.length,
      ),
      averageSharedValues: round(
        average(
          comparisonFeatures.map(
            (feature) => feature.sharedValuesWithPrevious ?? 0,
          ),
        ),
      ),
      averageExactPositionRepeats: rule.ordered
        ? round(
            average(
              comparisonFeatures.map(
                (feature) => feature.exactPositionRepeatsWithPrevious ?? 0,
              ),
            ),
          )
        : null,
    },
    pairFrequency,
    tripleFrequency,
    amountStatistics,
    winnerStatistics,
    recommendedCandidate: generateHistoricalProfileCandidate(draws, rule, options),
    probabilityWarning: EQUAL_ODDS_WARNING,
  };
}

import {
  GAME_CODES,
  effectiveMatchMode,
  formatCombination,
  formatNumber,
  getGameRule,
  supportsMatchMode,
  toLogicalGameCode,
} from "./games";
import type {
  DrawGameCode,
  DrawSlot,
  GameRule,
  GameResultPage,
  HistoricalCrossCheckOptions,
  HistoricalCrossCheckSummary,
  HistoricalMatch,
  LogicalGameCode,
  LotteryDraw,
  MatchMode,
  PickParseResult,
  PickValidationError,
  TicketComparison,
} from "./types";

export type PickInput = string | readonly number[];

export interface DrawFilterOptions {
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly gameCode?: DrawGameCode;
  readonly slot?: DrawSlot;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Generate a uniform pick without using draw history or analysis weights. */
export function generateRandomCombination(rule: GameRule): number[] {
  const domain = Array.from(
    { length: rule.maximum - rule.minimum + 1 },
    (_, index) => rule.minimum + index,
  );

  if (rule.repeatsAllowed) {
    return Array.from(
      { length: rule.pickCount },
      () => domain[Math.floor(Math.random() * domain.length)]!,
    );
  }

  const available = [...domain];
  const selected: number[] = [];
  while (selected.length < rule.pickCount) {
    const index = Math.floor(Math.random() * available.length);
    selected.push(available[index]!);
    available.splice(index, 1);
  }
  return rule.ordered ? selected : selected.sort((left, right) => left - right);
}

/** Describe a generated combination using simple patterns and recent draw counts. */
export function describeRandomCombination(
  numbers: readonly number[],
  rule: GameRule,
  draws: readonly LotteryDraw[] = [],
  previous: string | null = null,
): string {
  const drawCount = draws.length;
  const formatValues = (values: readonly number[]) =>
    values.length
      ? values.map((number) => formatNumber(number, rule)).join(', ')
      : 'none';
  const formattedCombination = formatValues(numbers);
  const evenNumbers = numbers.filter((number) => number % 2 === 0);
  const oddNumbers = numbers.filter((number) => number % 2 !== 0);
  const lowBoundary = Math.floor((rule.minimum + rule.maximum) / 2);
  const lowNumbers = numbers.filter((number) => number <= lowBoundary);
  const highNumbers = numbers.filter((number) => number > lowBoundary);
  const sum = numbers.reduce((total, number) => total + number, 0);
  const orderedForPairs = rule.ordered
    ? [...numbers]
    : [...numbers].sort((left, right) => left - right);
  const consecutivePairs = orderedForPairs.slice(1).flatMap((number, index) => {
    const previousNumber = orderedForPairs[index]!;
    return Math.abs(number - previousNumber) === 1
      ? [`${formatNumber(previousNumber, rule)}-${formatNumber(number, rule)}`]
      : [];
  });
  const comments = [
    `${Math.abs(evenNumbers.length - oddNumbers.length) <= 1 ? 'Nice balance' : 'Number mix'}: ${evenNumbers.length} even (${formatValues(evenNumbers)}) and ${oddNumbers.length} odd (${formatValues(oddNumbers)}).`,
    `Range profile: ${lowNumbers.length} low (${formatValues(lowNumbers)}), ${highNumbers.length} high (${formatValues(highNumbers)}).`,
    consecutivePairs.length
      ? `Notable pattern: consecutive pair${consecutivePairs.length === 1 ? '' : 's'} ${consecutivePairs.join(', ')}.`
      : `Clean spread: no consecutive pair in ${formattedCombination}.`,
  ];

  if (drawCount > 0) {
    const averageSum = draws.reduce(
      (total, draw) => total + draw.numbers.reduce((drawTotal, number) => drawTotal + number, 0),
      0,
    ) / drawCount;
    const relation = sum > averageSum ? 'above' : sum < averageSum ? 'below' : 'equal to';
    comments.push(
      `Total profile: ${sum}, ${relation} the latest-${drawCount} average of ${averageSum.toFixed(1)}.`,
    );

    const counts = new Map<number, number>();
    for (let value = rule.minimum; value <= rule.maximum; value += 1) {
      counts.set(value, 0);
    }
    draws.forEach((draw) => {
      draw.numbers.forEach((number) => counts.set(number, (counts.get(number) ?? 0) + 1));
    });
    const observedCounts = [...counts.values()];
    const maximumCount = Math.max(...observedCounts);
    const minimumCount = Math.min(...observedCounts);

    if (maximumCount !== minimumCount) {
      const mostSeen = new Set(
        [...counts.entries()]
          .filter(([, count]) => count === maximumCount)
          .map(([number]) => number),
      );
      const leastSeen = new Set(
        [...counts.entries()]
          .filter(([, count]) => count === minimumCount)
          .map(([number]) => number),
      );
      const mostSeenIncluded = [...new Set(numbers.filter((number) => mostSeen.has(number)))];
      const leastSeenIncluded = [...new Set(numbers.filter((number) => leastSeen.has(number)))];
      comments.push(
        mostSeenIncluded.length
          ? `Recent highlight: ${formatValues(mostSeenIncluded)} ${mostSeenIncluded.length === 1 ? 'was' : 'were'} among the most-seen in ${drawCount} draws.`
          : `Fresh mix: ${formattedCombination} skips the recent most-seen numbers.`,
        leastSeenIncluded.length
          ? `Fresh contrast: ${formatValues(leastSeenIncluded)} ${leastSeenIncluded.length === 1 ? 'was' : 'were'} among the least-seen in ${drawCount} draws.`
          : `Steady mix: ${formattedCombination} skips the recent least-seen numbers.`,
      );
    }
  }

  if (rule.ordered) {
    const digitCounts = numbers.reduce<Map<number, number>>((counts, number) => {
      counts.set(number, (counts.get(number) ?? 0) + 1);
      return counts;
    }, new Map());
    const repeatedDigits = [...digitCounts.entries()].filter(([, count]) => count > 1);
    comments.push(
      repeatedDigits.length === 0
        ? `Clean digit mix: every position differs in ${formattedCombination}.`
        : `Repeat pattern: ${repeatedDigits
            .map(([number, count]) => `${formatNumber(number, rule)} (${count}x)`)
            .join(', ')}.`,
    );
  }

  const alternatives = comments.filter((comment) => comment !== previous);
  return alternatives[Math.floor(Math.random() * alternatives.length)] ?? comments[0]!;
}

/** Return every validation problem so one edit can fix several fields. */
export function validatePick(
  numbers: readonly number[],
  game: LogicalGameCode | string,
): PickValidationError[] {
  const rule = getGameRule(game);
  const errors: PickValidationError[] = [];

  if (numbers.length === 0) {
    return [
      {
        code: "empty",
        message: `Enter ${rule.pickCount} ${
          rule.pickCount === 1 ? "number" : "numbers"
        } for ${rule.name}.`,
      },
    ];
  }

  if (numbers.length !== rule.pickCount) {
    errors.push({
      code: "wrong-count",
      message: `${rule.name} needs exactly ${rule.pickCount} values; you entered ${numbers.length}.`,
    });
  }

  numbers.forEach((value, position) => {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      errors.push({
        code: "invalid-token",
        position,
        value,
        message: `Value ${position + 1} must be a whole number.`,
      });
      return;
    }
    if (value < rule.minimum || value > rule.maximum) {
      errors.push({
        code: "out-of-range",
        position,
        value,
        message: `Value ${position + 1} must be from ${rule.minimum} to ${rule.maximum}.`,
      });
    }
  });

  if (!rule.repeatsAllowed) {
    const duplicateValues = [...new Set(numbers.filter((value, index) =>
      Number.isInteger(value) && numbers.indexOf(value) !== index,
    ))];
    duplicateValues.forEach((value) => {
      errors.push({
        code: "duplicate",
        value,
        message: `${rule.name} does not allow duplicate number ${value}.`,
      });
    });
  }

  return errors;
}

export const validateCombination = validatePick;

/**
 * Parse friendly mobile input.
 *
 * 3D/4D/6D accept compact digits (for example 046 or 056459) so leading
 * zeroes remain positions. All games also accept spaces, commas, or hyphens.
 * 2D deliberately requires a separator because each value can reach 31.
 */
export function parsePick(
  input: PickInput,
  game: LogicalGameCode | string,
): PickParseResult {
  const rule = getGameRule(game);
  const tokenErrors: PickValidationError[] = [];
  let numbers: number[];

  if (typeof input !== "string") {
    numbers = [...input];
  } else {
    const normalized = input.trim();
    if (!normalized) {
      return {
        ok: false,
        numbers: [],
        formatted: "",
        errors: validatePick([], rule.code),
      };
    }

    const isCompactDigitGame =
      rule.minimum === 0 &&
      rule.maximum === 9 &&
      rule.displayWidth === 1 &&
      /^\d+$/.test(normalized);
    const tokens = isCompactDigitGame
      ? normalized.split("")
      : normalized.split(/[\s,;:/|\\-]+/).filter(Boolean);

    numbers = tokens.map((token, position) => {
      if (!/^\d+$/.test(token)) {
        tokenErrors.push({
          code: "invalid-token",
          token,
          position,
          message: `“${token}” is not a whole number.`,
        });
        return Number.NaN;
      }
      return Number(token);
    });
  }

  const validationErrors = validatePick(numbers, rule.code).filter(
    (error) =>
      !(
        error.code === "invalid-token" &&
        tokenErrors.some((tokenError) => tokenError.position === error.position)
      ),
  );
  const errors = [...tokenErrors, ...validationErrors];
  if (errors.length > 0) {
    return { ok: false, numbers, formatted: "", errors };
  }

  return {
    ok: true,
    numbers,
    formatted: formatCombination(numbers, rule),
    errors: [],
  };
}

export const parseCombination = parsePick;

export function sameExactOrder(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/** Multiset equality: duplicate counts matter for digit games. */
export function sameAnyOrder(
  left: readonly number[],
  right: readonly number[],
): boolean {
  if (left.length !== right.length) return false;
  const orderedLeft = [...left].sort((a, b) => a - b);
  const orderedRight = [...right].sort((a, b) => a - b);
  return orderedLeft.every((value, index) => value === orderedRight[index]);
}

export function comparePick(
  pick: readonly number[],
  drawnNumbers: readonly number[],
  game: LogicalGameCode | string,
  mode: MatchMode = "standard",
): TicketComparison {
  const rule = getGameRule(game);
  assertValidNumbers(pick, rule.code, "ticket");
  assertValidNumbers(drawnNumbers, rule.code, "draw");

  if (!supportsMatchMode(rule, mode)) {
    throw new RangeError(`${rule.name} does not support ${mode.toUpperCase()} matching.`);
  }

  const exact = sameExactOrder(pick, drawnNumbers);
  const anyOrder = sameAnyOrder(pick, drawnNumbers);
  const effectiveMode = effectiveMatchMode(rule, mode);
  return {
    mode,
    effectiveMode,
    exact,
    anyOrder,
    isWin: effectiveMode === "exact" ? exact : anyOrder,
  };
}

export const compareCombination = comparePick;

/** Newest-first results for one logical game, optionally narrowed by slot/date. */
export function resultsForGame(
  draws: readonly LotteryDraw[],
  game: LogicalGameCode | string,
  options: DrawFilterOptions = {},
): LotteryDraw[] {
  const logicalCode = toLogicalGameCode(game);
  validateDateRange(options.fromDate, options.toDate);
  if (
    options.gameCode &&
    toLogicalGameCode(options.gameCode) !== logicalCode
  ) {
    throw new RangeError(
      `${options.gameCode} does not belong to ${logicalCode}.`,
    );
  }

  return sortDrawsNewestFirst(
    draws.filter((draw) => {
      if (draw.logicalGameCode !== logicalCode) return false;
      if (options.fromDate && draw.date < options.fromDate) return false;
      if (options.toDate && draw.date > options.toDate) return false;
      if (options.gameCode && draw.gameCode !== options.gameCode) return false;
      if (options.slot && !draw.gameCode.endsWith(`-${options.slot}`)) return false;
      return true;
    }),
  );
}

export function sortDrawsNewestFirst(
  draws: readonly LotteryDraw[],
): LotteryDraw[] {
  return [...draws].sort((left, right) => {
    const byDate = right.date.localeCompare(left.date);
    if (byDate) return byDate;
    const byTime = right.time.localeCompare(left.time);
    if (byTime) return byTime;
    return right.gameCode.localeCompare(left.gameCode);
  });
}

export function groupDrawsByGame(
  draws: readonly LotteryDraw[],
): Record<LogicalGameCode, LotteryDraw[]> {
  const grouped = Object.fromEntries(
    GAME_CODES.map((gameCode) => [gameCode, [] as LotteryDraw[]]),
  ) as Record<LogicalGameCode, LotteryDraw[]>;

  draws.forEach((draw) => {
    grouped[draw.logicalGameCode].push(draw);
  });
  GAME_CODES.forEach((gameCode) => {
    grouped[gameCode] = sortDrawsNewestFirst(grouped[gameCode]);
  });
  return grouped;
}

export function resultPageForGame(
  draws: readonly LotteryDraw[],
  game: LogicalGameCode | string,
  requestedIndex = 0,
  options: DrawFilterOptions = {},
): GameResultPage {
  const logicalCode = toLogicalGameCode(game);
  const results = resultsForGame(draws, logicalCode, options);
  const index = results.length
    ? Math.min(Math.max(Math.trunc(requestedIndex), 0), results.length - 1)
    : 0;
  return {
    gameCode: logicalCode,
    index,
    total: results.length,
    result: results[index] ?? null,
    canGoNext: index > 0,
    canGoPrevious: index + 1 < results.length,
  };
}

/** The Nth newest result for all nine logical games, in GAME_RULES order. */
export function resultsForEachGameAtOffset(
  draws: readonly LotteryDraw[],
  offset = 0,
): GameResultPage[] {
  const grouped = groupDrawsByGame(draws);
  return GAME_CODES.map((gameCode) =>
    resultPageForGame(grouped[gameCode], gameCode, offset),
  );
}

export function latestResultByGame(
  draws: readonly LotteryDraw[],
): Record<LogicalGameCode, LotteryDraw | null> {
  const grouped = groupDrawsByGame(draws);
  return Object.fromEntries(
    GAME_CODES.map((gameCode) => [gameCode, grouped[gameCode][0] ?? null]),
  ) as Record<LogicalGameCode, LotteryDraw | null>;
}

/**
 * Search prior results for a pick. Exact and unordered counts are both kept,
 * while standardWin follows the selected game's actual standard rule.
 */
export function crossCheckHistory(
  game: LogicalGameCode | string,
  pick: PickInput,
  draws: readonly LotteryDraw[],
  options: HistoricalCrossCheckOptions = {},
): HistoricalCrossCheckSummary {
  const rule = getGameRule(game);
  const parsed = parsePick(pick, rule.code);
  if (!parsed.ok) {
    throw new RangeError(parsed.errors.map((error) => error.message).join(" "));
  }
  validateDateRange(options.fromDate, options.toDate);
  if (
    options.gameCode &&
    toLogicalGameCode(options.gameCode) !== rule.code
  ) {
    throw new RangeError(`${options.gameCode} does not belong to ${rule.name}.`);
  }

  const checkedDraws = resultsForGame(draws, rule.code, {
    fromDate: options.fromDate,
    toDate: options.toDate,
    gameCode: options.gameCode,
  });
  const matching: HistoricalMatch[] = [];
  let exactMatchCount = 0;
  let anyOrderMatchCount = 0;
  let standardWinCount = 0;

  checkedDraws.forEach((draw) => {
    const comparison = comparePick(
      parsed.numbers,
      draw.numbers,
      rule.code,
      "standard",
    );
    if (comparison.exact) exactMatchCount += 1;
    if (comparison.anyOrder) anyOrderMatchCount += 1;
    if (comparison.isWin) standardWinCount += 1;
    if (!comparison.anyOrder) return;

    matching.push({
      draw,
      exact: comparison.exact,
      anyOrder: true,
      standardWin: comparison.isWin,
      rambolitoWin:
        rule.specialModes.includes("rambolito") && comparison.anyOrder,
      permWin: rule.specialModes.includes("perm") && comparison.anyOrder,
    });
  });

  const latestExactMatch = matching.find((match) => match.exact) ?? null;
  const latestAnyOrderMatch = matching[0] ?? null;
  const matchLimit = normalizeMatchLimit(options.matchLimit);

  return {
    gameCode: rule.code,
    numbers: parsed.numbers,
    formatted: parsed.formatted,
    drawsChecked: checkedDraws.length,
    exactMatchCount,
    anyOrderMatchCount,
    standardWinCount,
    rambolitoMatchCount: rule.specialModes.includes("rambolito")
      ? anyOrderMatchCount
      : 0,
    permMatchCount: rule.specialModes.includes("perm")
      ? anyOrderMatchCount
      : 0,
    latestExactMatch,
    latestAnyOrderMatch,
    matches: matching.slice(0, matchLimit),
  };
}

export const historicalCrossCheck = crossCheckHistory;

function assertValidNumbers(
  numbers: readonly number[],
  game: LogicalGameCode,
  label: string,
): void {
  const errors = validatePick(numbers, game);
  if (errors.length) {
    throw new RangeError(
      `Invalid ${label}: ${errors.map((error) => error.message).join(" ")}`,
    );
  }
}

function validateDateRange(fromDate?: string, toDate?: string): void {
  if (fromDate && !isValidIsoDate(fromDate)) {
    throw new RangeError(`Invalid start date: ${fromDate}. Use YYYY-MM-DD.`);
  }
  if (toDate && !isValidIsoDate(toDate)) {
    throw new RangeError(`Invalid end date: ${toDate}. Use YYYY-MM-DD.`);
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new RangeError("Start date must be on or before end date.");
  }
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeMatchLimit(value: number | undefined): number {
  if (value === undefined) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(value)) return value > 0 ? Number.POSITIVE_INFINITY : 0;
  return Math.max(0, Math.trunc(value));
}

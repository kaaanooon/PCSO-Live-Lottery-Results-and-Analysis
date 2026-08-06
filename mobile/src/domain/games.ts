import type {
  DrawGameCode,
  DrawSlot,
  GameRule,
  LogicalGameCode,
  MatchMode,
  SpecialPlayMode,
  StandardMatchMode,
} from "./types";

const orderedRuleText = (
  pickCount: number,
  minimum: number,
  maximum: number,
) =>
  `Choose ${pickCount} positional values from ${minimum}-${maximum}; exact order; repeats allowed.`;

const jackpotRuleText = (maximum: number) =>
  `Choose 6 unique numbers from 1-${maximum}; ticket order does not matter.`;

export const GAME_RULES = [
  {
    code: "2DL",
    name: "2D Lotto",
    shortName: "2D",
    feedCode: "2DL",
    pickCount: 2,
    minimum: 1,
    maximum: 31,
    ordered: true,
    repeatsAllowed: true,
    displayWidth: 2,
    amountKind: "prize",
    specialPlay: "Rambolito",
    slots: [
      { slot: "2PM", gameCode: "2DL-2PM", label: "2 PM", time: "14:00" },
      { slot: "5PM", gameCode: "2DL-5PM", label: "5 PM", time: "17:00" },
      { slot: "9PM", gameCode: "2DL-9PM", label: "9 PM", time: "21:00" },
    ],
    standardMatch: "exact",
    specialModes: ["rambolito"],
    ruleText: orderedRuleText(2, 1, 31),
  },
  {
    code: "3DL",
    name: "3D Lotto",
    shortName: "3D",
    feedCode: "3DL",
    pickCount: 3,
    minimum: 0,
    maximum: 9,
    ordered: true,
    repeatsAllowed: true,
    displayWidth: 1,
    amountKind: "prize",
    specialPlay: "Rambolito",
    slots: [
      { slot: "2PM", gameCode: "3DL-2PM", label: "2 PM", time: "14:00" },
      { slot: "5PM", gameCode: "3DL-5PM", label: "5 PM", time: "17:00" },
      { slot: "9PM", gameCode: "3DL-9PM", label: "9 PM", time: "21:00" },
    ],
    standardMatch: "exact",
    specialModes: ["rambolito"],
    ruleText: orderedRuleText(3, 0, 9),
  },
  {
    code: "4DL",
    name: "4D Lotto",
    shortName: "4D",
    feedCode: "4DL",
    pickCount: 4,
    minimum: 0,
    maximum: 9,
    ordered: true,
    repeatsAllowed: true,
    displayWidth: 1,
    amountKind: "prize",
    specialPlay: "PERM",
    standardMatch: "exact",
    specialModes: ["perm"],
    ruleText: orderedRuleText(4, 0, 9),
  },
  {
    code: "6DL",
    name: "6D Lotto",
    shortName: "6D",
    feedCode: "6DL",
    pickCount: 6,
    minimum: 0,
    maximum: 9,
    ordered: true,
    repeatsAllowed: true,
    displayWidth: 1,
    amountKind: "prize",
    standardMatch: "exact",
    specialModes: [],
    ruleText: orderedRuleText(6, 0, 9),
  },
  {
    code: "LOTTO42",
    name: "Lotto 6/42",
    shortName: "6/42",
    feedCode: "LOTTO42",
    pickCount: 6,
    minimum: 1,
    maximum: 42,
    ordered: false,
    repeatsAllowed: false,
    displayWidth: 2,
    amountKind: "jackpot",
    standardMatch: "any-order",
    specialModes: [],
    ruleText: jackpotRuleText(42),
  },
  {
    code: "ML45",
    name: "Mega Lotto 6/45",
    shortName: "6/45",
    feedCode: "ML45",
    pickCount: 6,
    minimum: 1,
    maximum: 45,
    ordered: false,
    repeatsAllowed: false,
    displayWidth: 2,
    amountKind: "jackpot",
    standardMatch: "any-order",
    specialModes: [],
    ruleText: jackpotRuleText(45),
  },
  {
    code: "SL49",
    name: "Super Lotto 6/49",
    shortName: "6/49",
    feedCode: "SL49",
    pickCount: 6,
    minimum: 1,
    maximum: 49,
    ordered: false,
    repeatsAllowed: false,
    displayWidth: 2,
    amountKind: "jackpot",
    standardMatch: "any-order",
    specialModes: [],
    ruleText: jackpotRuleText(49),
  },
  {
    code: "GL55",
    name: "Grand Lotto 6/55",
    shortName: "6/55",
    feedCode: "GL55",
    pickCount: 6,
    minimum: 1,
    maximum: 55,
    ordered: false,
    repeatsAllowed: false,
    displayWidth: 2,
    amountKind: "jackpot",
    standardMatch: "any-order",
    specialModes: [],
    ruleText: jackpotRuleText(55),
  },
  {
    code: "UL58",
    name: "Ultra Lotto 6/58",
    shortName: "6/58",
    feedCode: "UL58",
    pickCount: 6,
    minimum: 1,
    maximum: 58,
    ordered: false,
    repeatsAllowed: false,
    displayWidth: 2,
    amountKind: "jackpot",
    standardMatch: "any-order",
    specialModes: [],
    ruleText: jackpotRuleText(58),
  },
] as const satisfies readonly GameRule[];

/** Primary screen-facing name requested by the mobile contract. */
export const GAMES: readonly GameRule[] = GAME_RULES;

export const GAME_CODES = GAME_RULES.map(
  (game) => game.code,
) as readonly LogicalGameCode[];

export const GAME_BY_CODE: Readonly<Record<LogicalGameCode, GameRule>> =
  Object.freeze(
    Object.fromEntries(GAME_RULES.map((game) => [game.code, game])) as unknown as Record<
      LogicalGameCode,
      GameRule
    >,
  );

const aliases: Readonly<Record<string, LogicalGameCode>> = Object.freeze({
  "2d": "2DL",
  "2dl": "2DL",
  "2dlotto": "2DL",
  ez2: "2DL",
  "3d": "3DL",
  "3dl": "3DL",
  "3dlotto": "3DL",
  swertres: "3DL",
  "4d": "4DL",
  "4dl": "4DL",
  "4dlotto": "4DL",
  "6d": "6DL",
  "6dl": "6DL",
  "6dlotto": "6DL",
  "642": "LOTTO42",
  lotto42: "LOTTO42",
  lotto642: "LOTTO42",
  "645": "ML45",
  ml45: "ML45",
  megalotto: "ML45",
  megalotto645: "ML45",
  "649": "SL49",
  sl49: "SL49",
  superlotto: "SL49",
  superlotto649: "SL49",
  "655": "GL55",
  gl55: "GL55",
  grandlotto: "GL55",
  grandlotto655: "GL55",
  "658": "UL58",
  ul58: "UL58",
  ultralotto: "UL58",
  ultralotto658: "UL58",
});

const aliasKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

export function isLogicalGameCode(value: unknown): value is LogicalGameCode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(GAME_BY_CODE, value)
  );
}

/** Convert a logical code, time-specific draw code, or common game name. */
export function toLogicalGameCode(value: string): LogicalGameCode {
  const normalized = value.trim().toUpperCase();
  const timedDraw = normalized.match(/^(2DL|3DL)-(?:2PM|5PM|9PM)$/);
  if (timedDraw) return timedDraw[1] as LogicalGameCode;
  if (isLogicalGameCode(normalized)) return normalized;

  const code = aliases[aliasKey(value)];
  if (code) return code;
  throw new RangeError(`Unknown lottery game: ${value || "(empty)"}.`);
}

export function getGameRule(game: LogicalGameCode | string): GameRule {
  return GAME_BY_CODE[toLogicalGameCode(game)];
}

export function drawSlotFromTime(
  value: string | null | undefined,
): DrawSlot | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (/^(?:0?2|14)(?::00)?(?:\s*PM)?$/.test(normalized)) return "2PM";
  if (/^(?:0?5|17)(?::00)?(?:\s*PM)?$/.test(normalized)) return "5PM";
  if (/^(?:0?9|21)(?::00)?(?:\s*PM)?$/.test(normalized)) return "9PM";
  return null;
}

export function drawSlotFromGameCode(
  value: string | null | undefined,
): DrawSlot | null {
  if (!value) return null;
  const match = value.trim().toUpperCase().match(/-(2PM|5PM|9PM)$/);
  return (match?.[1] as DrawSlot | undefined) ?? null;
}

export function drawGameCodeFor(
  game: LogicalGameCode,
  slot?: DrawSlot | null,
): DrawGameCode {
  if ((game === "2DL" || game === "3DL") && slot) {
    return `${game}-${slot}`;
  }
  return game;
}

export function formatNumber(
  value: number,
  game: LogicalGameCode | GameRule,
): string;
export function formatNumber(
  game: LogicalGameCode | GameRule,
  value: number,
): string;
export function formatNumber(
  first: number | LogicalGameCode | GameRule,
  second: number | LogicalGameCode | GameRule,
): string {
  const value = typeof first === "number" ? first : (second as number);
  const game = (typeof first === "number" ? second : first) as
    | LogicalGameCode
    | GameRule;
  const rule = typeof game === "string" ? getGameRule(game) : game;
  return String(value).padStart(rule.displayWidth, "0");
}

/** Canonical order: preserve positions for digit games and sort jackpot games. */
export function canonicalNumbers(
  numbers: readonly number[],
  game: LogicalGameCode | GameRule,
): number[] {
  const rule = typeof game === "string" ? getGameRule(game) : game;
  return rule.ordered ? [...numbers] : [...numbers].sort((a, b) => a - b);
}

export function formatCombination(
  numbers: readonly number[],
  game: LogicalGameCode | GameRule,
): string;
export function formatCombination(
  game: LogicalGameCode | GameRule,
  numbers: readonly number[],
): string;
export function formatCombination(
  first: readonly number[] | LogicalGameCode | GameRule,
  second: readonly number[] | LogicalGameCode | GameRule,
): string {
  const numbers = Array.isArray(first)
    ? first
    : (second as readonly number[]);
  const game = Array.isArray(first)
    ? (second as LogicalGameCode | GameRule)
    : (first as LogicalGameCode | GameRule);
  const rule = typeof game === "string" ? getGameRule(game) : game;
  const formatted = canonicalNumbers(numbers, rule).map((number) =>
    formatNumber(number, rule),
  );
  if (rule.code === "2DL" || !rule.ordered) return formatted.join("-");
  return formatted.join("");
}

export function effectiveMatchMode(
  game: LogicalGameCode | GameRule,
  mode: MatchMode = "standard",
): StandardMatchMode {
  const rule = typeof game === "string" ? getGameRule(game) : game;
  if (mode === "standard") return rule.standardMatch;
  return mode === "exact" ? "exact" : "any-order";
}

export function supportsMatchMode(
  game: LogicalGameCode | GameRule,
  mode: MatchMode,
): boolean {
  const rule = typeof game === "string" ? getGameRule(game) : game;
  if (mode === "standard") return true;
  if (mode === "exact") return rule.ordered;
  if (mode === "any-order") return !rule.ordered;
  return rule.specialModes.includes(mode as SpecialPlayMode);
}

export function theoreticalOutcomeCount(
  game: LogicalGameCode | GameRule,
  mode: MatchMode = "standard",
): number {
  const rule = typeof game === "string" ? getGameRule(game) : game;
  const domainSize = rule.maximum - rule.minimum + 1;
  if (effectiveMatchMode(rule, mode) === "exact") {
    return domainSize ** rule.pickCount;
  }
  return rule.repeatsAllowed
    ? combinationsWithRepetition(domainSize, rule.pickCount)
    : combinations(domainSize, rule.pickCount);
}

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  const smaller = Math.min(k, n - k);
  for (let index = 1; index <= smaller; index += 1) {
    result = (result * (n - smaller + index)) / index;
  }
  return Math.round(result);
}

function combinationsWithRepetition(n: number, k: number): number {
  return combinations(n + k - 1, k);
}

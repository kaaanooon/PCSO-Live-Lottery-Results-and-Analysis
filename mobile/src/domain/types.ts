/**
 * Shared, UI-independent lottery domain types.
 *
 * Dates are ISO calendar dates (YYYY-MM-DD) and times are Philippine local
 * times (HH:mm). Keeping them as strings avoids accidental UTC conversion in
 * React Native while still allowing chronological string comparison.
 */

export type LogicalGameCode =
  | "2DL"
  | "3DL"
  | "4DL"
  | "6DL"
  | "LOTTO42"
  | "ML45"
  | "SL49"
  | "GL55"
  | "UL58";

export type DrawSlot = "2PM" | "5PM" | "9PM";

export type DrawGameCode =
  | LogicalGameCode
  | `2DL-${DrawSlot}`
  | `3DL-${DrawSlot}`;

export type StandardMatchMode = "exact" | "any-order";
export type SpecialPlayMode = "rambolito" | "perm";
export type MatchMode = "standard" | StandardMatchMode | SpecialPlayMode;

export type AmountKind = "prize" | "jackpot";

export interface GameSlotRule {
  readonly slot: DrawSlot;
  readonly gameCode: DrawGameCode;
  readonly label: string;
  readonly time: string;
}

export interface GameRule {
  readonly code: LogicalGameCode;
  readonly name: string;
  readonly shortName?: string;
  /** Code accepted by the results provider. */
  readonly feedCode: LogicalGameCode;
  readonly pickCount: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly ordered: boolean;
  readonly repeatsAllowed: boolean;
  readonly displayWidth: number;
  readonly amountKind: AmountKind;
  readonly specialPlay?: string;
  readonly slots?: readonly GameSlotRule[];
  /** Extended comparison metadata used by the pure domain helpers. */
  readonly standardMatch: StandardMatchMode;
  readonly specialModes: readonly SpecialPlayMode[];
  readonly ruleText: string;
}

/** Compact tuple used by the bundled offline JSON archive. */
export type DrawTuple = readonly [
  logicalGameCode: LogicalGameCode,
  gameCode: DrawGameCode,
  drawDate: string,
  drawTime: string,
  numbers: readonly number[],
  jackpot: string,
  winners: number,
];

export interface Draw {
  logicalGameCode: LogicalGameCode;
  gameCode: DrawGameCode;
  date: string;
  time: string;
  numbers: number[];
  /** Prize or jackpot decimal retained as text so loading loses no precision. */
  amount: string;
  winners: number;
  /** Optional upstream identifier when a live provider supplies one. */
  sourceId?: string;
}

/** Descriptive alias retained for repository and UI consumers. */
export type LotteryDraw = Draw;

export interface DrawArchive {
  readonly schemaVersion: number;
  readonly source: string;
  readonly timezone: string;
  readonly availableFrom: string;
  readonly availableTo: string;
  readonly drawCount: number;
  readonly draws: readonly DrawTuple[];
}

export type PickValidationErrorCode =
  | "empty"
  | "invalid-token"
  | "wrong-count"
  | "out-of-range"
  | "duplicate";

export interface PickValidationError {
  readonly code: PickValidationErrorCode;
  readonly message: string;
  readonly token?: string;
  readonly position?: number;
  readonly value?: number;
}

export type PickParseResult =
  | {
      readonly ok: true;
      readonly numbers: readonly number[];
      readonly formatted: string;
      readonly errors: readonly [];
    }
  | {
      readonly ok: false;
      readonly numbers: readonly number[];
      readonly formatted: "";
      readonly errors: readonly PickValidationError[];
    };

export interface TicketComparison {
  readonly mode: MatchMode;
  readonly effectiveMode: StandardMatchMode;
  readonly exact: boolean;
  readonly anyOrder: boolean;
  readonly isWin: boolean;
}

export interface HistoricalMatch {
  readonly draw: LotteryDraw;
  readonly exact: boolean;
  readonly anyOrder: boolean;
  readonly standardWin: boolean;
  readonly rambolitoWin: boolean;
  readonly permWin: boolean;
}

export interface HistoricalCrossCheckSummary {
  readonly gameCode: LogicalGameCode;
  readonly numbers: readonly number[];
  readonly formatted: string;
  readonly drawsChecked: number;
  readonly exactMatchCount: number;
  /** Includes exact matches because exact order is also the same multiset. */
  readonly anyOrderMatchCount: number;
  readonly standardWinCount: number;
  readonly rambolitoMatchCount: number;
  readonly permMatchCount: number;
  readonly latestExactMatch: HistoricalMatch | null;
  readonly latestAnyOrderMatch: HistoricalMatch | null;
  /** Newest first; includes only exact or same-multiset matches. */
  readonly matches: readonly HistoricalMatch[];
}

export interface HistoricalCrossCheckOptions {
  readonly fromDate?: string;
  readonly toDate?: string;
  /** Restrict aggregate 2D/3D history to one time-specific draw stream. */
  readonly gameCode?: DrawGameCode;
  /** Limit returned match details without changing the summary counts. */
  readonly matchLimit?: number;
}

export interface GameResultPage {
  readonly gameCode: LogicalGameCode;
  readonly index: number;
  readonly total: number;
  readonly result: LotteryDraw | null;
  /** A lower index moves toward newer results. */
  readonly canGoNext: boolean;
  /** A higher index moves toward older results. */
  readonly canGoPrevious: boolean;
}

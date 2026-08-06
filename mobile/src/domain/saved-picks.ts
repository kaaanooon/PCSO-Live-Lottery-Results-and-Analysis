import { GAME_BY_CODE, isLogicalGameCode } from './games';
import { parsePick } from './picks';
import type { DrawGameCode, LogicalGameCode, MatchMode } from './types';

export interface SavedPick {
  readonly id: string;
  readonly gameCode: LogicalGameCode;
  readonly drawGameCode: DrawGameCode;
  readonly numbers: readonly number[];
  readonly mode: MatchMode;
  readonly createdAt: string;
}

export interface RestoredPicks {
  readonly picks: readonly SavedPick[];
  readonly discardedCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function restoreOne(value: unknown): SavedPick | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    !isLogicalGameCode(value.gameCode) ||
    typeof value.drawGameCode !== 'string' ||
    !Array.isArray(value.numbers) ||
    typeof value.mode !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt))
  ) {
    return null;
  }

  const rule = GAME_BY_CODE[value.gameCode];
  const allowedDrawCodes = rule.slots?.map((slot) => slot.gameCode) ?? [rule.code];
  if (!allowedDrawCodes.includes(value.drawGameCode as DrawGameCode)) return null;

  const allowedModes: readonly string[] = ['standard', ...rule.specialModes];
  if (!allowedModes.includes(value.mode)) return null;

  const parsed = parsePick(value.numbers.join('-'), value.gameCode);
  if (!parsed.ok) return null;

  return {
    id: value.id,
    gameCode: value.gameCode,
    drawGameCode: value.drawGameCode as DrawGameCode,
    numbers: [...parsed.numbers],
    mode: value.mode as MatchMode,
    createdAt: value.createdAt,
  };
}

export function restoreSavedPicks(serialized: string): RestoredPicks {
  const parsed: unknown = JSON.parse(serialized);
  if (!Array.isArray(parsed)) throw new TypeError('Saved picks must be an array.');

  const picks = parsed.map(restoreOne).filter((pick): pick is SavedPick => pick !== null);
  return { picks, discardedCount: parsed.length - picks.length };
}

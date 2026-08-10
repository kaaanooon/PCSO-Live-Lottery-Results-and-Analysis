import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { GAME_CODES } from '@/domain/games';
import type { LogicalGameCode } from '@/domain/types';
import { palette } from '@/theme/tokens';

const STORAGE_KEY = '@lottolens-ph/preferences/v1';
const STORAGE_VERSION = 3;

export interface PreferencesContextValue {
  readonly isDark: boolean;
  readonly toggleDarkMode: () => void;
  readonly enabledGames: readonly LogicalGameCode[];
  readonly setGameEnabled: (code: LogicalGameCode, enabled: boolean) => void;
  readonly resultRemindersEnabled: boolean;
  readonly setResultRemindersEnabled: (enabled: boolean) => void;
  readonly ready: boolean;
}

export interface AppThemeColors {
  readonly background: string;
  readonly surface: string;
  readonly surfaceAlt: string;
  readonly text: string;
  readonly textMuted: string;
  readonly border: string;
  readonly input: string;
  readonly header: string;
  readonly primary: string;
  readonly danger: string;
  readonly overlay: string;
}

interface StoredPreferences {
  readonly version: 3;
  readonly isDark: boolean;
  readonly enabledGames: readonly LogicalGameCode[];
  readonly resultRemindersEnabled: boolean;
}

const LIGHT_COLORS: AppThemeColors = Object.freeze({
  background: palette.slate50,
  surface: palette.white,
  surfaceAlt: palette.slate100,
  text: palette.slate950,
  textMuted: palette.slate600,
  border: palette.slate200,
  input: palette.white,
  header: palette.navy900,
  primary: palette.teal700,
  danger: palette.coral600,
  overlay: 'rgba(0,40,86,0.42)',
});

const DARK_COLORS: AppThemeColors = Object.freeze({
  background: '#07111F',
  surface: '#101D2D',
  surfaceAlt: '#18283A',
  text: '#F1F5F9',
  textMuted: '#AFC0D3',
  border: '#2A3B50',
  input: '#142437',
  header: '#061A33',
  primary: '#55A9F3',
  danger: '#FF777C',
  overlay: 'rgba(0,0,0,0.68)',
});

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function restoreEnabledGames(value: unknown): readonly LogicalGameCode[] | null {
  if (!Array.isArray(value)) return null;
  const selected = new Set<LogicalGameCode>();
  value.forEach((code) => {
    if (typeof code === 'string' && GAME_CODES.includes(code as LogicalGameCode)) {
      selected.add(code as LogicalGameCode);
    }
  });
  return GAME_CODES.filter((code) => selected.has(code));
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const [isDark, setIsDark] = useState(false);
  const [enabledGames, setEnabledGames] = useState<readonly LogicalGameCode[]>(GAME_CODES);
  const [resultRemindersEnabled, setResultRemindersEnabledState] = useState(true);
  const [ready, setReady] = useState(false);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((serialized) => {
        if (!active || !serialized) return;
        const candidate: unknown = JSON.parse(serialized);
        if (
          !isRecord(candidate) ||
          (candidate.version !== 1 &&
            candidate.version !== 2 &&
            candidate.version !== STORAGE_VERSION)
        ) return;

        if (typeof candidate.isDark === 'boolean') setIsDark(candidate.isDark);
        const restoredGames = restoreEnabledGames(candidate.enabledGames);
        if (restoredGames) setEnabledGames(restoredGames);
        // Versions 1 and 2 exposed a free ad toggle. It is intentionally ignored instead
        // of being migrated into the paid Google Play entitlement.
        // Version 1 did not include reminders. Missing values intentionally migrate to on.
        if (typeof candidate.resultRemindersEnabled === 'boolean') {
          setResultRemindersEnabledState(candidate.resultRemindersEnabled);
        }
      })
      .catch(() => {
        // Corrupt or unavailable preferences safely fall back to defaults.
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload: StoredPreferences = {
      version: STORAGE_VERSION,
      isDark,
      enabledGames,
      resultRemindersEnabled,
    };
    const write = () => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    persistenceQueue.current = persistenceQueue.current.then(write, write).catch(() => {});
  }, [enabledGames, isDark, ready, resultRemindersEnabled]);

  const toggleDarkMode = useCallback(() => setIsDark((value) => !value), []);
  const setGameEnabled = useCallback((code: LogicalGameCode, enabled: boolean) => {
    setEnabledGames((current) => {
      const selected = new Set(current);
      if (enabled) selected.add(code);
      else selected.delete(code);
      return GAME_CODES.filter((gameCode) => selected.has(gameCode));
    });
  }, []);
  const setResultRemindersEnabled = useCallback(
    (enabled: boolean) => setResultRemindersEnabledState(enabled),
    [],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      isDark,
      toggleDarkMode,
      enabledGames,
      setGameEnabled,
      resultRemindersEnabled,
      setResultRemindersEnabled,
      ready,
    }),
    [
      enabledGames,
      isDark,
      ready,
      resultRemindersEnabled,
      setGameEnabled,
      setResultRemindersEnabled,
      toggleDarkMode,
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside a PreferencesProvider.');
  return context;
}

export function useAppTheme(): { readonly isDark: boolean; readonly colors: AppThemeColors } {
  const { isDark } = usePreferences();
  return useMemo(
    () => ({ isDark, colors: isDark ? DARK_COLORS : LIGHT_COLORS }),
    [isDark],
  );
}

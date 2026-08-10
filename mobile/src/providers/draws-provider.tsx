import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import {
  getBundledSnapshot,
  loadDraws,
  refreshDraws,
  type DrawSource,
} from "@/data/repository";
import type { Draw } from "@/domain/types";

export interface DrawsContextValue {
  readonly draws: readonly Draw[];
  readonly refresh: () => Promise<void>;
  /** True only while the first-launch result synchronization is presented. */
  readonly initializing: boolean;
  /** Always false because a bundled snapshot is available on the first frame. */
  readonly loading: boolean;
  /** Network updates are intentionally silent and never replace cached content. */
  readonly refreshing: boolean;
  /** Cache refresh timestamp, or the bundled archive's newest draw date. */
  readonly lastUpdated: string | null;
  readonly source: DrawSource;
  /** A recoverable cache, partial-feed, or network error. */
  readonly error: string | null;
}

const DrawsContext = createContext<DrawsContextValue | undefined>(undefined);

const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1_000;
const SCHEDULE_POLL_MS = 15_000;
const DRAW_HOURS = new Set([14, 17, 21]);
const PUBLICATION_RETRY_MINUTES = new Set([0, 5, 10, 15]);
const INITIAL_SYNC_KEY = '@pcso-live-lotto/initial-sync/v1';
const INITIAL_SYNC_MAX_WAIT_MS = 8_000;
const INITIAL_SYNC_MIN_VISIBLE_MS = 900;
const immediateSnapshot = getBundledSnapshot();

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Return a stable key only during a scheduled Manila publication retry minute. */
function manilaPublicationBucket(now = new Date()): string | null {
  // The Philippines observes UTC+8 year-round. Reading the shifted value with
  // UTC getters keeps this independent from the phone's configured timezone.
  const manila = new Date(now.getTime() + MANILA_UTC_OFFSET_MS);
  const hour = manila.getUTCHours();
  const minute = manila.getUTCMinutes();
  if (!DRAW_HOURS.has(hour) || !PUBLICATION_RETRY_MINUTES.has(minute)) {
    return null;
  }

  const year = manila.getUTCFullYear();
  const month = String(manila.getUTCMonth() + 1).padStart(2, "0");
  const day = String(manila.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}|${String(hour).padStart(2, "0")}:${String(
    minute,
  ).padStart(2, "0")}`;
}

export function DrawsProvider({ children }: { readonly children: ReactNode }) {
  // The bundled archive is available synchronously, so the first rendered
  // screen never needs to wait on AsyncStorage or display an empty loader.
  const [draws, setDraws] = useState<readonly Draw[]>(immediateSnapshot.draws);
  const [initializing, setInitializing] = useState(true);
  const loading = false;
  const refreshing = false;
  const [lastUpdated, setLastUpdated] = useState<string | null>(
    immediateSnapshot.lastUpdated,
  );
  const [source, setSource] = useState<DrawSource>(immediateSnapshot.source);
  const [error, setError] = useState<string | null>(null);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const mounted = useRef(true);
  const initialized = useRef(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const lastPublicationBucket = useRef<string | null>(null);

  const applySnapshot = useCallback(
    (snapshot: Awaited<ReturnType<typeof loadDraws>>) => {
      if (!mounted.current) return;
      setDraws(snapshot.draws);
      setLastUpdated(snapshot.lastUpdated);
      setSource(snapshot.source);
      setError(snapshot.error);
    },
    [],
  );

  const performRefresh = useCallback(async () => {
    try {
      applySnapshot(await refreshDraws());
    } catch (reason) {
      if (mounted.current) {
        setError(
          `Live results could not be refreshed: ${
            reason instanceof Error ? reason.message : String(reason)
          }`,
        );
      }
    }
  }, [applySnapshot]);

  const refresh = useCallback((): Promise<void> => {
    // A startup or foreground refresh inside a retry minute also
    // satisfies that bucket, preventing a redundant scheduled request.
    const publicationBucket = manilaPublicationBucket();
    if (publicationBucket) lastPublicationBucket.current = publicationBucket;
    if (refreshInFlight.current) return refreshInFlight.current;
    const request = performRefresh().finally(() => {
      if (refreshInFlight.current === request) refreshInFlight.current = null;
    });
    refreshInFlight.current = request;
    return request;
  }, [performRefresh]);

  useEffect(() => {
    mounted.current = true;
    if (!initialized.current) {
      initialized.current = true;
      void (async () => {
        let firstLaunch = true;
        try {
          applySnapshot(await loadDraws());
        } catch (reason) {
          if (mounted.current) {
            setError(
              `Lottery results could not be loaded: ${
                reason instanceof Error ? reason.message : String(reason)
              }`,
            );
          }
        } finally {
          if (mounted.current) setCacheHydrated(true);
        }

        try {
          firstLaunch =
            (await AsyncStorage.getItem(INITIAL_SYNC_KEY)) !== 'complete';
        } catch {
          // If local storage is unavailable, still allow one initialization
          // attempt and continue into the bundled archive.
        }

        if (!mounted.current) return;
        if (!firstLaunch) {
          setInitializing(false);
          // Cached rows replace the bundled fallback first. The live request is
          // deliberately silent and persists its merged result for next launch.
          void refresh();
          return;
        }

        // Installation cannot run app JavaScript. On the first actual launch,
        // visibly attempt one live sync, but never trap an offline user behind
        // the network request. The in-flight refresh may still finish later.
        await Promise.all([
          Promise.race([refresh(), delay(INITIAL_SYNC_MAX_WAIT_MS)]),
          delay(INITIAL_SYNC_MIN_VISIBLE_MS),
        ]);
        try {
          await AsyncStorage.setItem(INITIAL_SYNC_KEY, 'complete');
        } catch {
          // Storage failure must not prevent the bundled results from opening.
        }
        if (mounted.current) setInitializing(false);
      })();
    }
    return () => {
      mounted.current = false;
    };
  }, [applySnapshot, refresh]);

  useEffect(() => {
    if (!cacheHydrated) return;

    let appState = AppState.currentState;
    const refreshForPublicationWindow = () => {
      if (appState !== "active") return;
      const bucket = manilaPublicationBucket();
      if (!bucket || bucket === lastPublicationBucket.current) return;
      lastPublicationBucket.current = bucket;
      void refresh();
    };

    // Covers mounting during a publication minute; startup refresh deduping
    // ensures this cannot start a second concurrent request.
    refreshForPublicationWindow();
    const interval = setInterval(refreshForPublicationWindow, SCHEDULE_POLL_MS);
    const subscription = AppState.addEventListener("change", (nextState) => {
      const returnedToForeground =
        nextState === "active" && appState !== "active";
      appState = nextState;
      if (returnedToForeground) void refresh();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [cacheHydrated, refresh]);

  const value = useMemo<DrawsContextValue>(
    () => ({
      draws,
      refresh,
      initializing,
      loading,
      refreshing,
      lastUpdated,
      source,
      error,
    }),
    [draws, error, initializing, lastUpdated, loading, refresh, refreshing, source],
  );

  return (
    <DrawsContext.Provider value={value}>{children}</DrawsContext.Provider>
  );
}

export function useDraws(): DrawsContextValue {
  const context = useContext(DrawsContext);
  if (!context) {
    throw new Error("useDraws must be used inside a DrawsProvider.");
  }
  return context;
}

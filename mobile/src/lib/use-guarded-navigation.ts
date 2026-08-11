import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Prevents rapid taps from adding the same destination to the stack more than
 * once. The lock is released when the source screen becomes active again.
 */
export function useGuardedNavigation() {
  const locked = useRef(false);

  useFocusEffect(
    useCallback(() => {
      locked.current = false;
    }, []),
  );

  const navigate = useCallback((href: Href) => {
    if (locked.current) return;
    locked.current = true;
    router.navigate(href);
  }, []);

  return { navigate } as const;
}

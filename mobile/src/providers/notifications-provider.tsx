import { useMemo, type PropsWithChildren } from 'react';

import {
  ResultRemindersContext,
  type ResultRemindersContextValue,
} from '@/providers/notifications-context';

/** Web intentionally does not schedule native notifications. */
export function ResultRemindersProvider({ children }: PropsWithChildren) {
  const value = useMemo<ResultRemindersContextValue>(
    () => ({
      available: false,
      status: 'unavailable',
      permissionCanAskAgain: false,
      enableReminders: async () => ({ granted: false, canAskAgain: false }),
      disableReminders: async () => {},
      openNotificationSettings: async () => {},
    }),
    [],
  );

  return (
    <ResultRemindersContext.Provider value={value}>
      {children}
    </ResultRemindersContext.Provider>
  );
}
